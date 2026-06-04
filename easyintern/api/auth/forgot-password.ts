import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

type Action = 'request_otp' | 'reset_password';

function decodeJwtProjectRef(jwt: string | undefined): string | undefined {
  if (!jwt || typeof jwt !== 'string') return undefined;
  const parts = jwt.split('.');
  if (parts.length < 2) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { ref?: string };
    return typeof payload.ref === 'string' ? payload.ref : undefined;
  } catch {
    return undefined;
  }
}

function resolveSupabaseUrl(): string | undefined {
  const explicit = [process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL].find(
    Boolean
  );
  if (explicit) return explicit.replace(/\/$/, '');

  const idRaw =
    process.env.SUPABASE_PROJECT_REF || process.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID;
  const id = idRaw?.replace(/^["']|["']$/g, '').trim();
  if (id && /^[a-z0-9_-]{15,40}$/i.test(id)) {
    return `https://${id}.supabase.co`;
  }

  const ref =
    decodeJwtProjectRef(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    decodeJwtProjectRef(process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return ref ? `https://${ref}.supabase.co` : undefined;
}

function resolveServiceRoleKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    undefined
  );
}

function getJsonBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body as unknown;
  if (b == null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) {
    return b as Record<string, unknown>;
  }
  const s = typeof b === 'string' ? b : Buffer.isBuffer(b) ? b.toString('utf8') : String(b);
  try {
    const parsed = JSON.parse(s) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const supabaseUrl = resolveSupabaseUrl();
    const serviceRoleKey = resolveServiceRoleKey();
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        success: false,
        message: 'Supabase credentials missing',
        hint:
          'Set SUPABASE_SERVICE_ROLE_KEY (server only, never VITE_) and SUPABASE_URL or VITE_SUPABASE_PROJECT_ID on Vercel.',
        hasUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = getJsonBody(req);
    const { action, email, otp, newPassword } = body as {
      action?: Action;
      email?: string;
      otp?: string;
      newPassword?: string;
    };

    const normalizedEmail = String(email ?? '').trim().toLowerCase();

    if (!action || !normalizedEmail) {
      return res.status(400).json({ success: false, message: 'Missing action or email' });
    }

    if (action === 'request_otp') {
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

      const { error: insertError } = await supabase.from('password_resets').insert({
        email: normalizedEmail,
        otp: generatedOtp,
      });
      if (insertError) {
        return res.status(500).json({ success: false, message: `Failed to generate OTP: ${insertError.message}` });
      }

      const SMTP_USER = process.env.SMTP_USER || '';
      const SMTP_PASS = process.env.SMTP_PASS || '';
      if (!SMTP_USER || !SMTP_PASS) {
        return res.status(500).json({ success: false, message: 'SMTP Credentials missing' });
      }

      const nodemailer = (await import('nodemailer')).default;
      const transporter = nodemailer.createTransport({
        host: 'smtp.hostinger.com',
        port: 587,
        secure: false,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15000,
      });

      try {
        await transporter.verify();
      } catch {
        /* verify often flaky on serverless */
      }

      await transporter.sendMail({
        from: `"EzyIntern" <${SMTP_USER}>`,
        to: normalizedEmail,
        subject: 'Your Password Reset OTP',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="background-color: #0084FF; padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0;">Password Reset</h1>
            </div>
            <div style="padding: 24px; text-align: center;">
              <p>Use this OTP to reset your password:</p>
              <p style="font-size: 32px; letter-spacing: 8px; font-weight: 800; color: #0084FF;">${generatedOtp}</p>
              <p style="font-size: 12px; color: #64748b;">This code expires in 15 minutes.</p>
            </div>
          </div>
        `,
      });

      return res.status(200).json({ success: true, message: 'OTP sent successfully' });
    }

    if (action === 'reset_password') {
      const normalizedOtp = String(otp || '').trim();
      const password = String(newPassword || '');
      if (normalizedOtp.length !== 6 || password.length < 6) {
        return res.status(400).json({ success: false, message: 'Invalid OTP or password' });
      }

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
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
      }

      const { data: userId, error: userIdError } = await supabase.rpc('get_user_id_by_email', {
        email_text: normalizedEmail,
      });
      if (userIdError || !userId) {
        return res.status(400).json({ success: false, message: 'User not found for this email' });
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password,
      });
      if (updateError) {
        return res.status(500).json({ success: false, message: `Failed to update password: ${updateError.message}` });
      }

      await supabase.from('password_resets').delete().eq('email', normalizedEmail);

      return res.status(200).json({ success: true, message: 'Password reset successful' });
    }

    return res.status(400).json({ success: false, message: 'Invalid action' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('forgot-password error:', msg);
    return res.status(500).json({ success: false, message: msg || 'Internal server error' });
  }
}
