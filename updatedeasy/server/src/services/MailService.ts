import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
    });
  }

  async sendMailWithRetry(mailOptions: nodemailer.SendMailOptions, attempts = 3): Promise<any> {
    let lastError: any;
    for (let i = 0; i < attempts; i++) {
      try {
        const info = await this.transporter.sendMail({
          from: `"EzyIntern" <${config.smtpUser}>`,
          ...mailOptions,
        });
        logger.info({ messageId: info.messageId, to: mailOptions.to }, 'Email sent successfully');
        return info;
      } catch (e: any) {
        lastError = e;
        logger.warn({ err: e.message, attempt: i + 1, to: mailOptions.to }, 'Email send attempt failed, retrying...');
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
    logger.error({ err: lastError.message, to: mailOptions.to }, 'All email send attempts failed');
    throw lastError;
  }

  getRegistrationSuccessHtml(fullName: string, email: string, regId: string, password?: string, loginLink?: string) {
    const defaultLogin = 'https://www.ezyintern.in/login?portal=student';
    const link = loginLink || defaultLogin;
    const pwdSec = password
      ? `<p style="margin: 8px 0; font-size: 14px;"><strong>Password:</strong> ${password}</p>`
      : `<p style="margin: 8px 0; font-size: 14px;"><strong>Password:</strong> As set during registration</p>`;

    return `
      <div style="font-family: Georgia, 'Times New Roman', serif; padding: 32px; border: 1px solid #e2e8f0; border-radius: 4px; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b;">EzyIntern</p>
          <h1 style="color: #1e293b; margin: 12px 0 0; font-size: 22px; font-weight: 600;">Registration confirmed</h1>
          <p style="margin: 10px 0 0; color: #64748b; font-size: 15px; font-family: system-ui, sans-serif;">
            Thank you for registering with EzyIntern.
          </p>
        </div>
        <p style="font-size: 15px; line-height: 1.6;">Dear ${fullName},</p>
        <p style="font-size: 15px; line-height: 1.6; font-family: system-ui, sans-serif;">
          Your registration has been completed successfully. Your login details are provided below.
        </p>
        <div style="background: #f8fafc; padding: 22px 24px; border-radius: 4px; margin: 24px 0; border: 1px solid #e2e8f0; font-family: system-ui, sans-serif;">
          <p style="margin: 0 0 14px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; font-weight: 600;">Login details</p>
          <p style="margin: 8px 0; font-size: 14px;"><strong>Email (sign-in ID):</strong> ${email}</p>
          <p style="margin: 8px 0; font-size: 14px;"><strong>Registration ID:</strong> ${regId}</p>
          ${pwdSec}
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${link}" style="display:inline-block; padding: 14px 28px; background: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 14px; font-family: system-ui, sans-serif;">Sign in to dashboard</a>
        </div>
        <div style="background: #f1f5f9; padding: 16px 18px; border-radius: 4px; margin-top: 24px; border-left: 3px solid #4F46E5; font-family: system-ui, sans-serif;">
          <p style="margin: 0; color: #334155; font-size: 13px; font-weight: 600;">Next step</p>
          <p style="margin: 8px 0 0; color: #475569; font-size: 14px; line-height: 1.5;">
            Please sign in using the credentials above to access your dashboard and your offer letter.
          </p>
        </div>
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 32px; font-family: system-ui, sans-serif;">
          For support, reply to this email or contact us through the official channels listed on our website.<br/>
          <span style="color: #cbd5e1;">© 2026 EzyIntern. All rights reserved.</span>
        </p>
      </div>
    `;
  }

  getOtpHtml(otp: string, isLogin: boolean) {
    const title = isLogin ? 'Login Verification' : 'Password Reset';
    const bodyText = isLogin
      ? 'Use the following code to complete your login:'
      : 'You requested to reset your password. Use the 6-digit code below to proceed:';

    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #0084FF; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${title}</h1>
        </div>
        <div style="padding: 32px; text-align: center; color: #1e293b;">
          <p style="font-size: 16px; margin-bottom: 24px;">Hello,</p>
          <p style="font-size: 16px; line-height: 1.5;">${bodyText}</p>
          <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 16px; margin: 32px 0; display: inline-block;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #0084FF; font-family: monospace;">${otp}</span>
          </div>
          <p style="font-size: 12px; color: #64748b;">This code expires in 15 minutes.</p>
        </div>
      </div>
    `;
  }

  getAdminPasswordResetHtml(fullName: string, email: string, passwordToUse: string, loginLink?: string) {
    const link = loginLink || 'https://www.ezyintern.in/login?portal=student';
    return `
      <div style="font-family: Georgia, 'Times New Roman', serif; padding: 32px; border: 1px solid #e2e8f0; border-radius: 4px; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b;">EzyIntern</p>
          <h1 style="color: #1e293b; margin: 12px 0 0; font-size: 22px; font-weight: 600;">Password reset notification</h1>
          <p style="margin: 10px 0 0; color: #64748b; font-size: 15px; font-family: system-ui, sans-serif;">
            An administrator has reset your account password.
          </p>
        </div>

        <p style="font-size: 15px; line-height: 1.6;">Dear ${fullName},</p>
        <p style="font-size: 15px; line-height: 1.6; font-family: system-ui, sans-serif;">
          Your password for the EzyIntern platform has been reset. Use the new password below to sign in.
        </p>

        <div style="background: #fafaf9; padding: 22px 24px; border-radius: 4px; margin: 24px 0; border: 1px solid #e7e5e4; font-family: system-ui, sans-serif;">
          <p style="margin: 0 0 14px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #57534e; font-weight: 600;">Updated credentials</p>
          <p style="margin: 8px 0; font-size: 14px;"><strong>Email (sign-in ID):</strong> ${email}</p>
          <p style="margin: 8px 0; font-size: 14px;"><strong>New password:</strong> <code style="background: #f5f5f4; padding: 4px 10px; border-radius: 4px; font-size: 14px; font-family: ui-monospace, monospace; color: #1c1917;">${passwordToUse}</code></p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${link}" style="display:inline-block; padding: 14px 28px; background: #c2410c; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 14px; font-family: system-ui, sans-serif;">Sign in</a>
        </div>

        <div style="background: #f8fafc; padding: 16px 18px; border-radius: 4px; border-left: 3px solid #334155; font-family: system-ui, sans-serif;">
          <p style="margin: 0; color: #334155; font-size: 13px; font-weight: 600;">Security recommendation</p>
          <p style="margin: 8px 0 0; color: #475569; font-size: 14px; line-height: 1.5;">
            After signing in, please change your password under <strong>Dashboard → Security Settings</strong>.
          </p>
        </div>

        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 32px; font-family: system-ui, sans-serif;">
          If you did not expect this email, contact support immediately.<br/>
          <span style="color: #cbd5e1;">© 2026 EzyIntern. All rights reserved.</span>
        </p>
      </div>
    `;
  }

  getCollegeAdminWelcomeHtml(fullName: string, email: string, collegeAdminId: string, loginLink?: string) {
    const link = loginLink || 'https://ezyintern.in/college/login';
    return `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 28px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800;">College administrator access</h1>
        </div>
        <div style="padding: 28px 24px; line-height: 1.6;">
          <p style="margin: 0 0 12px;">Dear ${fullName},</p>
          <p style="margin: 0 0 16px;">Your EzyIntern <strong>college portal</strong> account is ready. Sign in with your email and the College Admin ID below (this is your sign-in secret; store it safely).</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
            <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #166534; font-weight: 700;">College Admin ID</p>
            <p style="margin: 0; font-size: 18px; font-family: ui-monospace, monospace; font-weight: 800; color: #14532d;">${collegeAdminId}</p>
            <p style="margin: 16px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #166534; font-weight: 700;">Email (sign-in)</p>
            <p style="margin: 4px 0 0; font-size: 15px;">${email}</p>
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${link}" style="display:inline-block; padding: 14px 28px; background: #059669; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">Open college sign-in</a>
          </div>
          <p style="margin: 0; font-size: 13px; color: #64748b;">If the button does not work, copy this URL into your browser:<br/><span style="word-break: break-all; color: #0f766e;">${link}</span></p>
        </div>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; padding: 16px; margin: 0; border-top: 1px solid #e2e8f0;">© 2026 EzyIntern</p>
      </div>
    `;
  }

  getBulkAnnouncementHtml(message: string) {
    return `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">EzyIntern Announcement</h1>
        </div>
        <div style="padding: 40px 32px; color: #1e293b; line-height: 1.6;">
          <div style="font-size: 16px;">
            ${String(message || '').replace(/\n/g, '<br/>')}
          </div>
        </div>
        <div style="background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">EzyIntern — Empowering Future Careers</p>
        </div>
      </div>
    `;
  }

  getCertificateGeneratedHtml(studentName: string, programme: string, certificateId: string) {
    return `
      <div style="font-family: sans-serif; padding: 32px; border: 1px solid #eee; border-radius: 16px;">
        <h1 style="color: #059669;">Certificate Ready!</h1>
        <p>Dear ${studentName}, your certificate for ${programme} is now available.</p>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <p><strong>Certificate ID:</strong> ${certificateId}</p>
        </div>
        <a href="https://www.ezyintern.in/dashboard" style="display:inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 8px;">Download Certificate</a>
      </div>
    `;
  }
}
export const mailService = new MailService();
