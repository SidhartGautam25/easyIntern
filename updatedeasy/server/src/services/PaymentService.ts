import crypto from 'crypto';
import Razorpay from 'razorpay';
import { Redis } from 'ioredis';
// @ts-ignore
import Redlock from 'redlock';
import { IPaymentRepository } from '../repositories/interfaces/IPaymentRepository.js';
import { ICollegeRepository } from '../repositories/interfaces/ICollegeRepository.js';
import { IStudentRepository } from '../repositories/interfaces/IStudentRepository.js';
import { queueService } from './QueueService.js';
import { config } from '../config/index.js';
import { audit, logger, withErrorCategory } from '../utils/logger.js';

export class PaymentService {
  private paymentRepo: IPaymentRepository;
  private collegeRepo: ICollegeRepository;
  private studentRepo: IStudentRepository;
  private redisClient: Redis;
  private redlock: Redlock | null = null;

  constructor(
    paymentRepo: IPaymentRepository,
    collegeRepo: ICollegeRepository,
    studentRepo: IStudentRepository
  ) {
    this.paymentRepo = paymentRepo;
    this.collegeRepo = collegeRepo;
    this.studentRepo = studentRepo;

    this.redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.redisClient.on('error', (err: any) => {
      logger.error(withErrorCategory('redis', { error: err }), 'Redis connection error in PaymentService');
    });

    // Initialize Redlock
    try {
      this.redlock = new Redlock([this.redisClient], {
        driftFactor: 0.01,
        retryCount: 15,
        retryDelay: 150,
        retryJitter: 100,
        automaticExtensionThreshold: 500,
      });

      this.redlock.on('clientError', (err: any) => {
        logger.error(withErrorCategory('redis', { error: err }), 'Redlock client error');
      });
    } catch (err: any) {
      logger.error(withErrorCategory('redis', { error: err }), 'Failed to initialize Redlock');
    }
  }

  private async getRazorpayInstance(): Promise<{ instance: Razorpay; keyId: string; keySecret: string; webhookSecret: string }> {
    const useEnv = config.nodeEnv === 'development' || config.nodeEnv === 'test' || process.env.USE_ENV_PAYMENT_CONFIG === 'true';
    const dbConfig = useEnv ? null : await this.collegeRepo.findPaymentConfig();

    const keyId = dbConfig?.razorpay_key_id || process.env.RAZORPAY_KEY_ID || '';
    const keySecret = dbConfig?.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET || '';
    const webhookSecret = dbConfig?.razorpay_webhook_secret || process.env.RAZORPAY_WEBHOOK_SECRET || '';

    if (!keyId || !keySecret) {
      throw new Error('Razorpay keys are not configured in system.');
    }

    const instance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    return { instance, keyId, keySecret, webhookSecret };
  }

  async createRegistrationOrder(studentData: any, amountPaise: number) {
    const { email, contact, fullName } = studentData;

    // Validate registration availability first
    const avail = await this.studentRepo.checkRegistrationAvailable(email, contact);
    if (!avail.available) {
      throw new Error(avail.message || 'Registration is no longer available.');
    }

    // Validate Referral Code if present
    if (studentData.referralCode) {
      const validatedCode = await this.paymentRepo.validateReferralCode(studentData.referralCode);
      studentData.referralCode = validatedCode; // set null if invalid, or validated code
    }

    const { instance, keyId } = await this.getRazorpayInstance();

    // Create Order in Razorpay
    const orderOptions = {
      amount: amountPaise,
      currency: 'INR',
      receipt: `receipt_reg_${Date.now()}`,
      notes: {
        email: email.trim().toLowerCase(),
        contact: contact.trim(),
        fullName: fullName.trim(),
      },
    };

    let rzpOrder;
    try {
      rzpOrder = await instance.orders.create(orderOptions);
    } catch (err: any) {
      logger.error(withErrorCategory('payment', { error: err }), 'Razorpay order creation failed');
      const status = err.statusCode || err.status || 500;
      const errorMsg = err.error?.description || err.message || 'Failed to create order on payment gateway.';
      const customErr = new Error(errorMsg) as any;
      customErr.status = status === 401 ? 401 : 500;
      throw customErr;
    }

    if (!rzpOrder || !rzpOrder.id) {
      throw new Error('Failed to create order on payment gateway.');
    }

    // Save order in Database
    await this.paymentRepo.saveOrder({
      order_id: rzpOrder.id,
      user_email: email.trim().toLowerCase(),
      user_phone: contact.trim(),
      amount: amountPaise,
      status: 'pending',
      metadata: studentData,
    });

    // Cache the registration form data temporarily in Redis for 1 hour
    const redisKey = `reg_temp:${rzpOrder.id}`;
    await this.redisClient.set(redisKey, JSON.stringify(studentData), 'EX', 3600);

    audit({
      action: 'payment.registration_order_created',
      actorEmail: email.trim().toLowerCase(),
      targetId: rzpOrder.id,
      outcome: 'success',
      amountPaise,
      currency: rzpOrder.currency,
    });
    logger.info({ orderId: rzpOrder.id, email }, 'Razorpay order created and cached in Redis');

    return {
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId,
    };
  }

  async verifyClientSignature(orderId: string, paymentId: string, clientSignature: string) {
    const { keySecret } = await this.getRazorpayInstance();

    const text = `${orderId}|${paymentId}`;
    const generatedSig = crypto
      .createHmac('sha256', keySecret)
      .update(text)
      .digest('hex');

    if (generatedSig !== clientSignature) {
      logger.warn(withErrorCategory('payment', { orderId, paymentId, clientSignature, generatedSig }), 'Invalid client payment signature');
      audit({
        action: 'payment.client_signature_verified',
        targetId: orderId,
        outcome: 'failure',
        paymentId,
      });
      const err = new Error('Invalid signature. Verification failed.') as any;
      err.status = 400;
      throw err;
    }

    audit({
      action: 'payment.client_signature_verified',
      targetId: orderId,
      outcome: 'success',
      paymentId,
    });
    logger.info({ orderId, paymentId }, 'Signature verification matches');

    // Lock resource using Redlock
    let lock = null;
    const lockKey = `lock:payment:${orderId}`;
    if (this.redlock) {
      try {
        lock = await this.redlock.acquire([lockKey], 10000); // 10s lease
      } catch (err: any) {
        logger.warn(withErrorCategory('payment', { error: err, orderId }), 'Lock collision or failed lock acquisition');
        throw new Error('Payment processing in progress. Please check status later.');
      }
    }

    try {
      // Check if success log already written
      const successLog = await this.paymentRepo.findPaymentSuccessLog(paymentId);
      if (successLog) {
        logger.info({ paymentId }, 'Order already marked successful previously');
        return { success: true, message: 'Payment verified and processed.' };
      }

      // Update Order Status in Database
      await this.paymentRepo.updateOrderStatus(orderId, 'paid', paymentId);

      // Enqueue fulfillment job to BullMQ
      await queueService.enqueueEnrollment(orderId, {
        orderId,
        paymentId,
        signature: clientSignature,
      });

      audit({
        action: 'payment.enrollment_queued',
        targetId: orderId,
        outcome: 'success',
        paymentId,
      });
      return { success: true, message: 'Payment verified. Enrollment is in progress.' };
    } finally {
      if (lock) {
        await lock.release().catch((e: any) => logger.error(withErrorCategory('payment', { error: e }), 'Failed to release lock'));
      }
    }
  }

  async processWebhook(bodyString: string, signatureHeader: string) {
    const { webhookSecret } = await this.getRazorpayInstance();
    if (!webhookSecret) {
      logger.warn(withErrorCategory('payment'), 'Webhook secret is not configured. Webhook ignored.');
      throw new Error('Webhook configuration missing.');
    }

    // Verify webhook signature
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyString)
      .digest('hex');

    if (expectedSig !== signatureHeader) {
      logger.warn(withErrorCategory('payment', { expectedSig, signatureHeader }), 'Razorpay Webhook signature mismatch');
      audit({
        action: 'payment.webhook_verified',
        outcome: 'failure',
      });
      throw new Error('Invalid webhook signature');
    }

    const payload = JSON.parse(bodyString);
    const event = payload.event;
    audit({
      action: 'payment.webhook_verified',
      targetId: payload.id,
      outcome: 'success',
      eventName: event,
    });
    logger.info({ event, id: payload.id }, 'Received verified Razorpay webhook event');

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentObj = payload.payload?.payment?.entity;
      const orderId = paymentObj?.order_id;
      const paymentId = paymentObj?.id;

      if (!orderId || !paymentId) {
        logger.warn(withErrorCategory('payment', { payload }), 'Order ID or Payment ID missing in webhook payload');
        return;
      }

      // Acquire lock
      let lock = null;
      const lockKey = `lock:payment:${orderId}`;
      if (this.redlock) {
        try {
          lock = await this.redlock.acquire([lockKey], 10000);
        } catch {
          logger.info({ orderId }, 'Webhook lock skipped: processing already handled');
          return; // Skip if lock held or already processed
        }
      }

      try {
        const successLog = await this.paymentRepo.findPaymentSuccessLog(paymentId);
        if (successLog) {
          logger.info({ paymentId }, 'Webhook: Order already marked successful previously');
          return;
        }

        // Update status
        await this.paymentRepo.updateOrderStatus(orderId, 'paid', paymentId);

        // Enqueue job
        await queueService.enqueueEnrollment(orderId, {
          orderId,
          paymentId,
        });

        audit({
          action: 'payment.webhook_enrollment_queued',
          targetId: orderId,
          outcome: 'success',
          paymentId,
          eventName: event,
        });
        logger.info({ orderId, paymentId }, 'Webhook: Pushed enrollment job to queue');
      } finally {
        if (lock) {
          await lock.release().catch((e: any) => logger.error(withErrorCategory('payment', { error: e }), 'Failed to release lock'));
        }
      }
    }
  }

  async getOrderStatus(orderId: string) {
    // Check if student profile is already registered under this order ID or cached data email
    const order = await this.paymentRepo.findOrderById(orderId);
    if (!order) {
      return { status: 'not_found' };
    }

    if (order.status === 'paid') {
      // Find if student is fully created
      const student = await this.studentRepo.findStudentByEmail(order.user_email);
      if (student?.registration_id) {
        return { status: 'fulfilled', registrationId: student.registration_id, userId: student.id };
      }
      return { status: 'paid_pending_fulfillment' };
    }

    return { status: order.status };
  }

  async close() {
    await this.redisClient.quit();
  }
}
