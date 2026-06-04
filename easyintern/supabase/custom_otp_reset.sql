-- Lovable Cloud / Supabase: run this ENTIRE script in the project's SQL editor once.
--
-- Root cause of "gen_salt(unknown) does not exist" + RPC 404:
-- pgcrypto installs crypt/gen_salt into schema "extensions" on hosted Supabase.
-- Our function used search_path = public, auth only → gen_salt invisible → CREATE FUNCTION or
-- runtime fails → reset_user_password never registers → PostgREST returns 404.
--
-- Fix: include "extensions" in search_path and cast literals to text.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Create a table to store custom OTPs
CREATE TABLE IF NOT EXISTS public.password_resets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '15 minutes'
);

-- Enable RLS
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- Remove restrictive policy from hotfix_forgot_password_otp.sql if present (blocks browser OTP insert).
DROP POLICY IF EXISTS "Service role manages password resets" ON public.password_resets;

-- Policy: Allow anyone to insert (so the app can generate OTPs from the anon browser client)
DROP POLICY IF EXISTS "Anyone can request password reset" ON public.password_resets;
CREATE POLICY "Anyone can request password reset" ON public.password_resets FOR INSERT WITH CHECK (true);

-- Policy: No one can select/update/delete directly (only the RPC can check)
DROP POLICY IF EXISTS "Public cannot view OTPs" ON public.password_resets;
CREATE POLICY "Public cannot view OTPs" ON public.password_resets FOR SELECT USING (false);

-- 2. Create the RPC function to reset password securely
-- This function runs as the database owner (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.reset_user_password(p_email TEXT, p_otp TEXT, p_new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS and update auth.users
-- extensions first: hosted Supabase puts pgcrypto there; public covers older installs.
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_otp_valid BOOLEAN;
BEGIN
  -- Check if a valid, non-expired OTP exists for this email
  SELECT TRUE INTO v_otp_valid
  FROM public.password_resets
  WHERE lower(email) = lower(p_email)
    AND otp = p_otp 
    AND expires_at > now()
  ORDER BY created_at DESC 
  LIMIT 1;

  IF v_otp_valid IS NULL THEN
    -- OTP is incorrect or expired
    RETURN FALSE;
  END IF;

  -- Get the user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email);

  IF v_user_id IS NULL THEN
    -- User doesn't exist
    RETURN FALSE;
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(p_new_password::text, extensions.gen_salt('bf'::text)),
    updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.students
  SET
    password = p_new_password,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('password', p_new_password::text)
  WHERE id = v_user_id;

  DELETE FROM public.password_resets WHERE lower(email) = lower(p_email);

  RETURN TRUE;
END;
$$;

-- Grant access to the RPC function
GRANT EXECUTE ON FUNCTION public.reset_user_password(TEXT, TEXT, TEXT) TO anon, authenticated;

-- Required for Lovable/managed Supabase + Vercel SMTP-only (no service_role on hosting).
GRANT INSERT ON TABLE public.password_resets TO anon, authenticated;
