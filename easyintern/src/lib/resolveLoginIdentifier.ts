import type { SupabaseClient } from '@supabase/supabase-js';

export type ResolveLoginResult =
  | { ok: true; email: string; usedPhone: boolean }
  | { ok: false; message: string };

/**
 * Resolve sign-in identifier to a normalized auth email.
 * Accepts email or Indian mobile (10 digits, optional +91 prefix).
 */
export async function resolveLoginIdentifier(
  supabase: SupabaseClient,
  rawInput: string
): Promise<ResolveLoginResult> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, message: 'Please enter your email or phone number.' };
  }

  const usedPhone = !trimmed.includes('@');
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (usedPhone && digitsOnly.length > 0 && digitsOnly.length < 10) {
    return { ok: false, message: 'Enter a valid 10-digit mobile number or your email address.' };
  }

  const { data, error } = await supabase.rpc('resolve_login_email', {
    p_identifier: trimmed,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('Multiple accounts') || error.code === 'P0001') {
      return {
        ok: false,
        message:
          'Multiple accounts use this phone number. Please sign in with your email address instead.',
      };
    }
    if (msg.includes('could not find') || error.code === 'PGRST202') {
      return {
        ok: false,
        message:
          'Phone login is not set up on the database yet. Run supabase/migrations/20260519120000_phone_login_resolve.sql in Lovable SQL.',
      };
    }
    return { ok: false, message: msg || 'Could not resolve login identifier.' };
  }

  const email = String(data || '')
    .trim()
    .toLowerCase();
  if (!email) {
    return {
      ok: false,
      message: usedPhone
        ? 'No account found with this phone number.'
        : 'No account found with this email address.',
    };
  }

  return { ok: true, email, usedPhone };
}
