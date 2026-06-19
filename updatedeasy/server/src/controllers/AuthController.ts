import { Context } from 'koa';
import { AuthService } from '../services/AuthService.js';
import { StudentRepository } from '../repositories/StudentRepository.js';
import { forgotPasswordRequestSchema, forgotPasswordResetSchema } from '../utils/validation.js';
import { audit } from '../utils/logger.js';
import { supabase } from '../lib/supabase.js';

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

  logEvent = async (ctx: Context) => {
    const { action, outcome, details } = ctx.request.body as any;
    let actorId = 'anonymous';
    let actorEmail = 'anonymous';

    const authHeader = ctx.headers.authorization;
    if (authHeader) {
      const parts = (authHeader as string).split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        try {
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user) {
            actorId = user.id;
            actorEmail = user.email || '';
          }
        } catch (err) {
          // ignore token resolution error for anonymous events
        }
      }
    }

    audit({
      action: action || 'user.activity',
      actorId,
      actorEmail,
      outcome: outcome || 'success',
      ...details,
    }, `User activity: ${action}`);

    ctx.status = 200;
    ctx.body = { success: true };
  };
}
