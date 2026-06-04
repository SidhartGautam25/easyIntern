import { IStudentRepository } from '../repositories/interfaces/IStudentRepository.js';
import { mailService } from './MailService.js';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';

export class AuthService {
  private studentRepo: IStudentRepository;

  constructor(studentRepo: IStudentRepository) {
    this.studentRepo = studentRepo;
  }

  async requestOtp(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    // Verify if profile exists first
    const profile = await this.studentRepo.findProfileByEmail(normalizedEmail);
    if (!profile) {
      throw new Error('No account found with this email address.');
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const { error: insertError } = await supabase.from('password_resets').insert({
      email: normalizedEmail,
      otp: generatedOtp,
    });

    if (insertError) {
      logger.error({ insertError, email: normalizedEmail }, 'Failed to insert password reset OTP');
      throw new Error(`Failed to generate OTP: ${insertError.message}`);
    }

    // Send OTP email
    const html = mailService.getOtpHtml(generatedOtp, false);
    await mailService.sendMailWithRetry({
      to: normalizedEmail,
      subject: 'Your Password Reset OTP',
      html,
    });

    logger.info({ email: normalizedEmail }, 'Password reset OTP requested and sent successfully');
  }

  async resetPassword(email: string, otp: string, passwordToSet: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    const { data: otpRecord, error: otpError } = await supabase
      .from('password_resets')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('otp', normalizedOtp)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRecord) {
      throw new Error('Invalid or expired OTP code.');
    }

    const { data: userId, error: userIdError } = await supabase.rpc('get_user_id_by_email', {
      email_text: normalizedEmail,
    });

    if (userIdError || !userId) {
      logger.error({ userIdError, email: normalizedEmail }, 'Failed to resolve user ID by email during password reset');
      throw new Error('User account not found for this email address.');
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: passwordToSet,
    });

    if (updateError) {
      logger.error({ updateError, userId }, 'Failed to update user password in Auth admin');
      throw new Error(`Failed to update password: ${updateError.message}`);
    }

    // Clean up reset OTPs
    await supabase.from('password_resets').delete().eq('email', normalizedEmail);
    logger.info({ email: normalizedEmail, userId }, 'Password reset completed successfully');
  }
}
