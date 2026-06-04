import { Context } from 'koa';
import { AuthService } from '../services/AuthService.js';
import { StudentRepository } from '../repositories/StudentRepository.js';
import { forgotPasswordRequestSchema, forgotPasswordResetSchema } from '../utils/validation.js';

export class AuthController {
  private authService: AuthService;

  constructor() {
    const studentRepo = new StudentRepository();
    this.authService = new AuthService(studentRepo);
  }

  requestPasswordResetOtp = async (ctx: Context) => {
    const parseResult = forgotPasswordRequestSchema.safeParse(ctx.request.body);
    if (!parseResult.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: 'Invalid email payload',
        errors: parseResult.error.flatten(),
      };
      return;
    }

    const { email } = parseResult.data;
    await this.authService.requestOtp(email);

    ctx.status = 200;
    ctx.body = {
      success: true,
      message: 'Password reset OTP has been sent successfully.',
    };
  };

  resetPasswordWithOtp = async (ctx: Context) => {
    const parseResult = forgotPasswordResetSchema.safeParse(ctx.request.body);
    if (!parseResult.success) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.flatten(),
      };
      return;
    }

    const { email, otp, newPassword } = parseResult.data;
    await this.authService.resetPassword(email, otp, newPassword);

    ctx.status = 200;
    ctx.body = {
      success: true,
      message: 'Your password has been successfully reset.',
    };
  };
}
