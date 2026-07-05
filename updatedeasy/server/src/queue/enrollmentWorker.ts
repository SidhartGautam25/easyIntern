import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { StudentRepository } from '../repositories/StudentRepository.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';
import { CollegeRepository } from '../repositories/CollegeRepository.js';
import { mailService } from '../services/MailService.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { supabase } from '../lib/supabase.js';

export class EnrollmentWorker {
  private worker: Worker;
  private connection: Redis;
  private studentRepo: StudentRepository;
  private paymentRepo: PaymentRepository;
  private collegeRepo: CollegeRepository;

  constructor() {
    this.studentRepo = new StudentRepository();
    this.paymentRepo = new PaymentRepository();
    this.collegeRepo = new CollegeRepository();

    this.connection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.connection.on('error', (err: any) => {
      logger.error({ err: err.message }, 'Redis error in EnrollmentWorker');
    });

    this.worker = new Worker(
      'enrollment-queue',
      async (job: Job) => {
        await this.processJob(job);
      },
      {
        connection: this.connection as any,
        concurrency: 5,
        limiter: {
          max: 10,
          duration: 1000,
        },
      }
    );

    this.worker.on('completed', (job: Job) => {
      logger.info({ jobId: job.id }, 'Enrollment job completed successfully');
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error({ jobId: job?.id, err: err.message }, 'Enrollment job failed');
    });

    logger.info('EnrollmentWorker successfully started');
  }

  private async processJob(job: Job) {
    const { orderId, paymentId } = job.data as { orderId: string; paymentId: string };
    logger.info({ jobId: job.id, orderId, paymentId }, 'Starting background enrollment fulfillment');

    // 1. Retrieve registration data
    let studentData: any = null;

    // A. Try Redis cache
    const redisKey = `reg_temp:${orderId}`;
    try {
      const cached = await this.connection.get(redisKey);
      if (cached) {
        studentData = JSON.parse(cached);
      }
    } catch (err: any) {
      logger.warn({ err: err.message, orderId }, 'Failed to read registration data from Redis cache');
    }

    // B. Fallback to Payment Order in DB
    if (!studentData) {
      logger.info({ orderId }, 'Redis registration cache missed. Falling back to DB payment order metadata');
      const order = await this.paymentRepo.findOrderById(orderId);
      if (!order || !order.metadata) {
        throw new Error(`Fulfillment failed: No registration metadata found for order ${orderId}`);
      }
      studentData = order.metadata;
    }

    const {
      fullName,
      gender,
      parentName,
      contact,
      email,
      collegeId,
      degree,
      departmentName,
      classSem,
      session,
      subject,
      rollNo,
      course,
      internshipMode,
      emName,
      emPhone,
      emRel,
      password,
      consentFormUrl,
      referralCode,
    } = studentData;

    const normalizedEmail = email.trim().toLowerCase();
    const finalPassword = password || `Ezy@${contact.slice(-4)}`;

    // 2. Check if student already exists
    const existingStudent = await this.studentRepo.findStudentByEmail(normalizedEmail);
    if (existingStudent?.registration_id) {
      logger.info({ email: normalizedEmail, regId: existingStudent.registration_id }, 'Student registration is already complete');
      // Ensure payment success log is present
      await this.ensurePaymentSuccessLog(existingStudent.id, paymentId, orderId, normalizedEmail, fullName, studentData);
      return;
    }

    // 3. Create Auth User
    logger.info({ email: normalizedEmail }, 'Creating Supabase Auth account');
    const { userId, created: isUserCreated } = await this.studentRepo.createAuthUser(
      normalizedEmail,
      finalPassword,
      fullName
    );
    logger.info({ userId, isUserCreated }, 'Auth account resolved');

    // 4. Double check if student record got inserted concurrently
    const studentCheck = await this.studentRepo.findStudentById(userId);
    let registrationId = studentCheck?.registration_id;

    if (!registrationId) {
      // 5. Build Student Payload & Insert
      logger.info({ userId }, 'Inserting student record');
      const insertPayload = {
        id: userId,
        email: normalizedEmail,
        full_name: fullName,
        gender,
        parent_name: parentName,
        contact_number: contact,
        university_name: studentData.university_name || '', // Resolved by controller/client or saved
        college_name: studentData.college_name || '',
        course,
        internship_domain: course,
        degree,
        department: departmentName || '',
        class_semester: classSem,
        academic_session: session,
        roll_number: rollNo,
        emergency_name: emName || '',
        emergency_contact: emPhone || '',
        emergency_relation: emRel || '',
        status: 'Active',
        cybercafe_shop_name: studentData.cybercafe_shop_name || null,
        cybercafe_email: studentData.cybercafe_email || null,
        referral_code: referralCode || null,
        metadata: {
          subject,
          internship_mode: internshipMode,
          consent_form_url: consentFormUrl || null,
          password: finalPassword,
        },
      };

      registrationId = await this.studentRepo.insertStudent(insertPayload);
      logger.info({ registrationId }, 'Student record successfully created');
    }

    // 6. Upsert Profile
    logger.info({ userId }, 'Upserting profile record');
    await this.studentRepo.upsertProfile({
      id: userId,
      full_name: fullName,
      email: normalizedEmail,
      contact_number: contact,
      gender,
      parent_name: parentName,
    });

    // 7. Assign Student Role
    logger.info({ userId }, 'Assigning "student" role to user');
    await this.studentRepo.assignRole(userId, 'student');

    // 8. Roster claims
    try {
      if (collegeId) {
        logger.info({ collegeId, userId }, 'Executing college roster claim');
        await this.collegeRepo.claimCollegeRosterRow(collegeId, userId, normalizedEmail, contact);
      }
    } catch (e: any) {
      logger.warn({ err: e.message, userId, collegeId }, 'College roster claim failed');
    }

    try {
      const refNo = studentData.referenceNumber || studentData.reference_number;
      if (refNo) {
        logger.info({ refNo, userId }, 'Executing prefilled student reference claim');
        await this.collegeRepo.claimPrefilledStudent(refNo, userId);
      }
    } catch (e: any) {
      logger.warn({ err: e.message, userId }, 'Prefilled student claim failed');
    }

    // 9. Write Payment Success Log
    await this.ensurePaymentSuccessLog(userId, paymentId, orderId, normalizedEmail, fullName, studentData);

    // 10. Delete Lead
    try {
      logger.info({ email: normalizedEmail }, 'Removing registration lead');
      await supabase.from('registration_leads').delete().eq('email', normalizedEmail);
    } catch (e: any) {
      logger.warn({ err: e.message }, 'Failed to delete registration lead');
    }

    // 11. Send Confirmation Email
    try {
      logger.info({ email: normalizedEmail }, 'Dispatching registration confirmation email');
      const html = mailService.getRegistrationSuccessHtml(
        fullName,
        normalizedEmail,
        registrationId,
        finalPassword
      );
      await mailService.sendMailWithRetry({
        to: normalizedEmail,
        subject: '🎉 EzyIntern Registration Complete!',
        html,
      });
    } catch (e: any) {
      logger.error({ err: e.message, email: normalizedEmail }, 'Failed to send registration welcome email');
    }

    // 12. Delete temporary Redis cache key
    await this.connection.del(redisKey).catch(() => {});
    logger.info({ orderId }, 'Temporary Redis cache cleared. Enrollment flow complete.');
  }

  private async ensurePaymentSuccessLog(
    userId: string,
    paymentId: string,
    orderId: string,
    email: string,
    fullName: string,
    studentData: any
  ) {
    try {
      const existingSuccess = await this.paymentRepo.findPaymentSuccessLog(paymentId);
      if (!existingSuccess) {
        const order = await this.paymentRepo.findOrderById(orderId);
        const amountPaise = order ? order.amount : 0;

        await this.paymentRepo.insertPaymentSuccess({
          user_id: userId,
          payment_id: paymentId,
          amount_paise: amountPaise,
          email,
          full_name: fullName,
          college_name: studentData.college_name || studentData.college || null,
          cybercafe_shop_name: studentData.cybercafe_shop_name || null,
          cybercafe_email: studentData.cybercafe_email || null,
          status: 'success',
        });
        logger.info({ paymentId }, 'Fulfillment success log written');
      }
    } catch (err: any) {
      logger.error({ err: err.message, paymentId }, 'Failed to write payment success log');
    }
  }

  async close() {
    await this.worker.close();
    await this.connection.quit();
  }
}
export const enrollmentWorker = new EnrollmentWorker();
