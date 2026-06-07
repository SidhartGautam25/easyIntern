import { Context } from 'koa';
import { StudentRepository } from '../repositories/StudentRepository.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';
import { CollegeRepository } from '../repositories/CollegeRepository.js';
import { mailService } from '../services/MailService.js';
import {
  adminRegisterSchema,
  adminTasksSchema,
  sendMailSchema,
  sendBulkMailSchema,
} from '../utils/validation.js';
import { audit, logger } from '../utils/logger.js';
import { supabase } from '../lib/supabase.js';

export class AdminController {
  private studentRepo: StudentRepository;
  private paymentRepo: PaymentRepository;
  private collegeRepo: CollegeRepository;

  constructor() {
    this.studentRepo = new StudentRepository();
    this.paymentRepo = new PaymentRepository();
    this.collegeRepo = new CollegeRepository();
  }

  registerStudent = async (ctx: Context) => {
    const parseResult = adminRegisterSchema.safeParse(ctx.request.body);
    if (!parseResult.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: 'Invalid registration payload',
        errors: parseResult.error.flatten(),
      };
      return;
    }

    const { student_data, payment_amount, transaction_id } = parseResult.data;
    const email = student_data.email.trim().toLowerCase();
    const contact = student_data.contact_number.trim();
    const fullName = student_data.full_name.trim();

    // 1. Check Availability
    const check = await this.studentRepo.checkRegistrationAvailable(email, contact);
    if (!check.available) {
      ctx.status = 400;
      ctx.body = { success: false, message: check.message };
      return;
    }

    // 2. Resolve Password
    const finalPassword = student_data.password || `Ezy@${contact.slice(-4)}`;

    // 3. Create Auth User
    const { userId } = await this.studentRepo.createAuthUser(
      email,
      finalPassword,
      fullName
    );

    // 4. Insert Student
    const insertPayload = {
      id: userId,
      email,
      full_name: fullName,
      gender: student_data.gender,
      parent_name: student_data.parent_name,
      contact_number: contact,
      university_name: student_data.university_name,
      college_name: student_data.college_name,
      course: student_data.course || student_data.internship_domain || '',
      internship_domain: student_data.internship_domain || student_data.course || '',
      degree: student_data.degree,
      department: student_data.department || '',
      class_semester: student_data.class_semester,
      academic_session: student_data.academic_session,
      roll_number: student_data.roll_number,
      emergency_name: student_data.emergency_name || '',
      emergency_contact: student_data.emergency_contact || '',
      emergency_relation: student_data.emergency_relation || '',
      status: 'Active',
      password: finalPassword,
      metadata: {
        subject: student_data.subject || '',
        password: finalPassword,
      },
    };

    const registrationId = await this.studentRepo.insertStudent(insertPayload);

    // 5. Upsert Profile
    await this.studentRepo.upsertProfile({
      id: userId,
      full_name: fullName,
      email,
      contact_number: contact,
      gender: student_data.gender,
      parent_name: student_data.parent_name,
    });

    // 6. Assign student role
    await this.studentRepo.assignRole(userId, 'student');

    // 7. Roster check (manual college selection roster claim)
    try {
      // Find college ID by matching university name if present
      const { data: college } = await supabase
        .from('colleges')
        .select('id')
        .ilike('name', student_data.college_name)
        .maybeSingle();

      if (college?.id) {
        await this.collegeRepo.claimCollegeRosterRow(college.id, userId, email, contact);
      }
    } catch (e: any) {
      logger.warn({ err: e.message, userId }, 'Admin register college roster claim failed');
    }

    // 8. Payment Log
    const amount = Number(payment_amount || 0);
    if (amount > 0 && transaction_id) {
      try {
        await this.paymentRepo.insertPaymentSuccess({
          user_id: userId,
          payment_id: transaction_id,
          amount_paise: amount * 100, // convert Rs to paise
          email,
          full_name: fullName,
          college_name: student_data.college_name,
          status: 'success',
        });
      } catch (e: any) {
        logger.error({ err: e.message }, 'Admin register payment success logging failed');
      }
    }

    // 9. Send Email
    try {
      const html = mailService.getRegistrationSuccessHtml(fullName, email, registrationId, finalPassword);
      await mailService.sendMailWithRetry({
        to: email,
        subject: '🎉 EzyIntern Account Created!',
        html,
      });
    } catch (e: any) {
      logger.error({ err: e.message, email }, 'Admin register welcome email delivery failed');
    }

    ctx.status = 200;
    ctx.body = {
      success: true,
      message: 'Student registered successfully.',
      data: {
        userId,
        registrationId,
      },
    };

    audit({
      action: 'admin.student_registered',
      actorId: ctx.state.user?.id,
      targetId: userId,
      actorEmail: ctx.state.user?.email,
      outcome: 'success',
      registrationId,
      paymentAmount: amount,
    });
  };

  executeAdminTask = async (ctx: Context) => {
    const parseResult = adminTasksSchema.safeParse(ctx.request.body);
    if (!parseResult.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: 'Invalid task payload',
        errors: parseResult.error.flatten(),
      };
      return;
    }

    const { action, email, password, roleTag, role, permissions, target_user_id } = parseResult.data;

    if (action === 'create_sub_user') {
      if (!email || !password) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Email and password required for sub-user creation' };
        return;
      }

      const name = email.split('@')[0];
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });

      if (authError) {
        audit({
          action: 'admin.sub_user_created',
          actorId: ctx.state.user?.id,
          actorEmail: ctx.state.user?.email,
          targetId: email.trim().toLowerCase(),
          outcome: 'failure',
        });
        ctx.status = 400;
        ctx.body = { success: false, message: authError.message };
        return;
      }

      const userId = authUser.user.id;

      // Upsert profile
      await this.studentRepo.upsertProfile({
        id: userId,
        full_name: name,
        email: email.trim().toLowerCase(),
        contact_number: '',
      });

      // Assign role (staff or admin)
      const finalRole = role || 'staff';
      await this.studentRepo.assignRole(userId, finalRole);

      // Upsert admin_staff
      await this.studentRepo.upsertAdminStaff({
        id: userId,
        email: email.trim().toLowerCase(),
        role_tag: roleTag || finalRole,
      });

      // Upsert permissions
      if (permissions) {
        await this.studentRepo.upsertAdminPermissions({
          user_id: userId,
          permissions,
        });
      }

      audit({
        action: 'admin.sub_user_created',
        actorId: ctx.state.user?.id,
        actorEmail: ctx.state.user?.email,
        targetId: userId,
        outcome: 'success',
        role: finalRole,
        roleTag,
      });
      ctx.status = 200;
      ctx.body = { success: true, message: `Sub-user ${email} successfully created.` };
      return;
    }

    if (action === 'force_logout') {
      if (!target_user_id) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Target User ID required for force logout' };
        return;
      }

      await this.studentRepo.signOutUserGlobally(target_user_id);

      audit({
        action: 'admin.user_force_logout',
        actorId: ctx.state.user?.id,
        actorEmail: ctx.state.user?.email,
        targetId: target_user_id,
        outcome: 'success',
      });
      ctx.status = 200;
      ctx.body = { success: true, message: 'User globally signed out.' };
      return;
    }

    ctx.status = 400;
    ctx.body = { success: false, message: 'Unsupported task action' };
  };

  sendSingleMail = async (ctx: Context) => {
    const parseResult = sendMailSchema.safeParse(ctx.request.body);
    if (!parseResult.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: 'Invalid mail payload',
        errors: parseResult.error.flatten(),
      };
      return;
    }

    const { action, to, email, subject, data, otp } = parseResult.data;
    const recipient = to || email;

    if (!recipient) {
      ctx.status = 400;
      ctx.body = { success: false, message: 'Recipient email is required' };
      return;
    }

    let html = '';
    let finalSubject = subject || 'Update from EzyIntern';

    if (action === 'registration_confirmation' || action === 'registration_success') {
      html = mailService.getRegistrationSuccessHtml(
        data?.fullName || data?.full_name || 'Student',
        recipient,
        data?.regId || data?.registration_id || '',
        data?.password || ''
      );
      finalSubject = '🎉 EzyIntern Registration Complete!';
    } else if (action === 'send_otp' || action === 'login_otp') {
      html = mailService.getOtpHtml(otp || data?.otp || '', true);
      finalSubject = 'Your Login Verification Code';
    } else if (action === 'admin_password_reset') {
      html = mailService.getAdminPasswordResetHtml(
        data?.fullName || data?.full_name || 'User',
        recipient,
        data?.password || ''
      );
      finalSubject = 'Security Update: Account Password Reset';
    } else if (action === 'certificate_generated') {
      html = mailService.getCertificateGeneratedHtml(
        data?.fullName || data?.full_name || 'Student',
        data?.programme || 'Internship Programme',
        data?.certificateId || ''
      );
      finalSubject = 'Your EzyIntern Certificate is Ready!';
    } else if (action === 'college_admin_welcome') {
      html = mailService.getCollegeAdminWelcomeHtml(
        data?.fullName || data?.full_name || 'Admin',
        recipient,
        data?.collegeAdminId || ''
      );
      finalSubject = 'Access Granted: College Portal';
    } else {
      // Default plain action or content-based
      html = data?.message || data?.html || (ctx.request.body as any).message || '';
    }

    await mailService.sendMailWithRetry({
      to: recipient,
      subject: finalSubject,
      html: html || String((ctx.request.body as any).message || ''),
    });

    audit({
      action: 'admin.mail_sent',
      actorId: ctx.state.user?.id,
      actorEmail: ctx.state.user?.email,
      targetId: recipient,
      outcome: 'success',
      mailAction: action,
    });
    ctx.status = 200;
    ctx.body = { success: true, message: 'Mail sent successfully' };
  };

  sendBulkMail = async (ctx: Context) => {
    const parseResult = sendBulkMailSchema.safeParse(ctx.request.body);
    if (!parseResult.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: 'Invalid bulk email payload',
        errors: parseResult.error.flatten(),
      };
      return;
    }

    const { subject, message, recipients } = parseResult.data;

    // Run bulk mail sending in background to avoid blocking the client request thread
    const recipientsBatch = [...new Set(recipients)];
    const html = mailService.getBulkAnnouncementHtml(message);
    const finalSubject = subject || 'Important Announcement from EzyIntern';

    logger.info({ count: recipientsBatch.length }, 'Starting asynchronous bulk email dispatch');
    audit({
      action: 'admin.bulk_mail_started',
      actorId: ctx.state.user?.id,
      actorEmail: ctx.state.user?.email,
      outcome: 'started',
      recipientCount: recipientsBatch.length,
    });

    // Run asynchronously
    (async () => {
      let sent = 0;
      let failed = 0;
      for (let i = 0; i < recipientsBatch.length; i++) {
        const to = recipientsBatch[i];
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 2500)); // rate limiting delay between sends
        }

        try {
          await mailService.sendMailWithRetry({
            to,
            subject: finalSubject,
            html,
          });
          sent++;
        } catch (e: any) {
          failed++;
          logger.error({ err: e.message, to }, 'Failed to send bulk announcement to recipient');
        }
      }
      logger.info({ sent, failed }, 'Asynchronous bulk email dispatch complete');
    })();

    ctx.status = 200;
    ctx.body = {
      success: true,
      message: `Bulk email transmission initiated for ${recipientsBatch.length} recipients.`,
    };
  };
}
