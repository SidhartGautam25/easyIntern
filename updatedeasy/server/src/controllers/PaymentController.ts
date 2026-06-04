import { Context } from 'koa';
import { PaymentService } from '../services/PaymentService.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';
import { CollegeRepository } from '../repositories/CollegeRepository.js';
import { StudentRepository } from '../repositories/StudentRepository.js';
import { createOrderSchema, verifyPaymentSchema } from '../utils/validation.js';
import { logger } from '../utils/logger.js';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    const paymentRepo = new PaymentRepository();
    const collegeRepo = new CollegeRepository();
    const studentRepo = new StudentRepository();
    this.paymentService = new PaymentService(paymentRepo, collegeRepo, studentRepo);
  }

  createOrder = async (ctx: Context) => {
    const parseResult = createOrderSchema.safeParse(ctx.request.body);
    if (!parseResult.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: 'Invalid order registration details.',
        errors: parseResult.error.flatten(),
      };
      return;
    }

    const { studentData, amount } = parseResult.data;
    const result = await this.paymentService.createRegistrationOrder(studentData, amount);

    ctx.status = 200;
    ctx.body = {
      success: true,
      data: result,
    };
  };

  verifyPayment = async (ctx: Context) => {
    const parseResult = verifyPaymentSchema.safeParse(ctx.request.body);
    if (!parseResult.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: 'Missing payment details.',
        errors: parseResult.error.flatten(),
      };
      return;
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parseResult.data;
    const result = await this.paymentService.verifyClientSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    ctx.status = 200;
    ctx.body = result;
  };

  webhook = async (ctx: Context) => {
    // Retrieve raw body string
    const rawBody = (ctx.request as any).rawBody;
    const signature = ctx.headers['x-razorpay-signature'] as string;

    if (!rawBody || !signature) {
      ctx.status = 400;
      ctx.body = { success: false, message: 'Missing raw body or signature header.' };
      return;
    }

    try {
      await this.paymentService.processWebhook(rawBody, signature);
      ctx.status = 200;
      ctx.body = { success: true, message: 'Webhook processed' };
    } catch (err: any) {
      logger.error({ err: err.message }, 'Razorpay Webhook execution failed');
      ctx.status = 400;
      ctx.body = { success: false, message: err.message || 'Webhook verification failed' };
    }
  };

  status = async (ctx: Context) => {
    const orderId = ctx.params.orderId || ctx.query.orderId as string;
    if (!orderId) {
      ctx.status = 400;
      ctx.body = { success: false, message: 'Order ID parameter is required.' };
      return;
    }

    const result = await this.paymentService.getOrderStatus(orderId);
    ctx.status = 200;
    ctx.body = {
      success: true,
      ...result,
    };
  };
}
