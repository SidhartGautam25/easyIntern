-- Enable uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant schema-level usage to Supabase default roles (critical if public schema was dropped/recreated)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, anon;

-- Roles enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('student', 'admin', 'super_admin', 'staff', 'college_admin', 'referral_partner');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Internship Domains baseline table
CREATE TABLE IF NOT EXISTS public.internship_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Students baseline table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  gender TEXT,
  parent_name TEXT,
  contact_number TEXT,
  internship_domain TEXT,
  college_name TEXT,
  university_name TEXT,
  degree TEXT,
  department TEXT,
  class_semester TEXT,
  academic_session TEXT,
  roll_number TEXT,
  course TEXT,
  emergency_name TEXT,
  emergency_contact TEXT,
  emergency_relation TEXT,
  metadata JSONB,
  registration_id TEXT UNIQUE,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Classes baseline table
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  link_type TEXT NOT NULL CHECK (link_type IN ('youtube', 'meet')),
  url TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  domain_id UUID REFERENCES public.internship_domains(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cybercafe Profiles baseline table
CREATE TABLE IF NOT EXISTS public.cybercafe_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  shop_name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending_approval',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cybercafe_profiles ENABLE ROW LEVEL SECURITY;

-- Admin Logs baseline table
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Payment Success baseline table
CREATE TABLE IF NOT EXISTS public.payment_success (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL,
  amount_paise BIGINT NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  status TEXT,
  college_name TEXT,
  cybercafe_shop_name TEXT,
  cybercafe_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);
ALTER TABLE public.payment_success ENABLE ROW LEVEL SECURITY;

-- Payment Cancelled baseline table
CREATE TABLE IF NOT EXISTS public.payment_cancelled (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  user_phone TEXT,
  amount BIGINT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_cancelled ENABLE ROW LEVEL SECURITY;

-- Payment Config baseline table
CREATE TABLE IF NOT EXISTS public.payment_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  razorpay_key_id TEXT,
  razorpay_key_secret TEXT,
  amount_paise BIGINT DEFAULT 9900,
  currency TEXT DEFAULT 'INR',
  is_active BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT one_row CHECK (id = 1)
);
ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;

-- Payment Orders baseline table
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT UNIQUE NOT NULL,
  user_email TEXT NOT NULL,
  user_phone TEXT,
  amount BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_id TEXT,
  signature TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- User Security baseline table
CREATE TABLE IF NOT EXISTS public.user_security (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  security_pin TEXT NOT NULL CHECK (security_pin ~ '^[0-9]{4}$'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;

-- Admin Permissions baseline table
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  can_manage_students BOOLEAN DEFAULT true,
  can_manage_classes BOOLEAN DEFAULT true,
  can_manage_certificates BOOLEAN DEFAULT true,
  can_manage_institutions BOOLEAN DEFAULT true,
  can_view_payments BOOLEAN DEFAULT true,
  can_manage_leads BOOLEAN DEFAULT true,
  can_manage_notifications BOOLEAN DEFAULT true,
  can_manage_assignments BOOLEAN DEFAULT true,
  can_manage_communications BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Password Resets baseline table
CREATE TABLE IF NOT EXISTS public.password_resets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '15 minutes')
);
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- Site Settings baseline table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  notice_enabled BOOLEAN DEFAULT false,
  notice_title TEXT DEFAULT 'Important Notice',
  notice_message TEXT DEFAULT '',
  show_on_home BOOLEAN DEFAULT true,
  show_on_registration BOOLEAN DEFAULT true,
  show_on_login BOOLEAN DEFAULT false,
  reg_min_delay INTEGER DEFAULT 0,
  reg_max_delay INTEGER DEFAULT 0,
  whatsapp_link_enabled BOOLEAN DEFAULT true,
  whatsapp_link_url TEXT DEFAULT 'https://whatsapp.com/channel/0029VbC9lvi3bbV8TS7TbB00',
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT one_row CHECK (id = 1)
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.site_settings (id, notice_enabled, notice_title, notice_message, show_on_home, show_on_registration)
VALUES (1, false, 'Important Notice', '', true, true)
ON CONFLICT (id) DO NOTHING;

-- Attendance baseline table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Notifications baseline table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('all', 'specific')),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Assignments baseline table
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    total_marks INTEGER NOT NULL,
    passing_marks INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Assignment Questions baseline table
CREATE TABLE IF NOT EXISTS public.assignment_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_option_index INTEGER NOT NULL,
    marks INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.assignment_questions ENABLE ROW LEVEL SECURITY;

-- Assignment Submissions baseline table
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    answers JSONB,
    score INTEGER NOT NULL DEFAULT 0,
    is_passed BOOLEAN NOT NULL DEFAULT false,
    warnings_received INTEGER DEFAULT 0,
    cheating_detected BOOLEAN DEFAULT false,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(assignment_id, student_id)
);
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Site Visits baseline table
CREATE TABLE IF NOT EXISTS public.site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  page_path TEXT,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- Migration: 20260428200641_4fbee0a9-fdbc-4e21-bc3f-0cef2b3c5dba.sql
-- --------------------------------------------------------
-- Roles enum and table

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Cybercafe Profiles table definition
CREATE TABLE IF NOT EXISTS public.cybercafe_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  shop_name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending_approval',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cybercafe_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pisa_fee INTEGER DEFAULT 50000
);
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view universities" ON public.universities FOR SELECT USING (true);
CREATE POLICY "Admins manage universities" ON public.universities FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  registration_fee INTEGER DEFAULT 50000,
  pisa_fee INTEGER DEFAULT 50000,
  UNIQUE (university_id, name)
);
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view colleges" ON public.colleges FOR SELECT USING (true);
CREATE POLICY "Admins manage colleges" ON public.colleges FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (college_id, name)
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT '',
  parent_name TEXT NOT NULL DEFAULT '',
  contact_number TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Academic info
CREATE TABLE public.academic_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  university_name TEXT NOT NULL,
  college_name TEXT NOT NULL,
  degree TEXT NOT NULL,
  department TEXT NOT NULL,
  class_semester TEXT NOT NULL,
  academic_session TEXT NOT NULL,
  subject TEXT,
  roll_number TEXT NOT NULL,
  course TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.academic_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own academic" ON public.academic_info FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own academic" ON public.academic_info FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own academic" ON public.academic_info FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all academic" ON public.academic_info FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Emergency contacts
CREATE TABLE public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  relationship TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own emergency" ON public.emergency_contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own emergency" ON public.emergency_contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own emergency" ON public.emergency_contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all emergency" ON public.emergency_contacts FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Certificates (publicly verifiable)
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id TEXT NOT NULL UNIQUE,
  student_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  internship_name TEXT NOT NULL,
  duration TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can verify certificates" ON public.certificates FOR SELECT USING (true);
CREATE POLICY "Admins manage certificates" ON public.certificates FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Auto-assign student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------
-- Migration: 20260428200705_006db074-79f4-4ddb-989a-e14f5ca2b3b6.sql
-- --------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------
-- Migration: 20260509120000_account_login_route_rpcs.sql
-- --------------------------------------------------------
-- Pre-login routing: block portal accounts on /login and student-only on /admin/login
-- without creating an auth session. Run via Supabase migrations or SQL editor.

CREATE OR REPLACE FUNCTION public.account_requires_admin_login(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(u.email)) = lower(trim(check_email))
      AND (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = u.id
            AND ur.role IN (
              'admin'::public.app_role,
              'super_admin'::public.app_role,
              'staff'::public.app_role
            )
        )
        OR EXISTS (SELECT 1 FROM public.cybercafe_profiles c WHERE c.id = u.id)
        OR COALESCE((u.raw_user_meta_data ->> 'is_staff')::boolean, false) = true
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.account_is_student_only(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(u.email)) = lower(trim(check_email))
      AND NOT (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = u.id
            AND ur.role IN (
              'admin'::public.app_role,
              'super_admin'::public.app_role,
              'staff'::public.app_role
            )
        )
        OR EXISTS (SELECT 1 FROM public.cybercafe_profiles c WHERE c.id = u.id)
        OR COALESCE((u.raw_user_meta_data ->> 'is_staff')::boolean, false) = true
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.account_requires_admin_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_is_student_only(text) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260509140000_registration_leads.sql
-- --------------------------------------------------------
-- Draft registrations (abandoned before payment) surfaced in Lead Hub.
-- Permissive anon policies match existing client-side lead capture patterns.
CREATE TABLE IF NOT EXISTS public.registration_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT,
  step INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  cybercafe_shop_name TEXT,
  cybercafe_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_leads_email_unique
  ON public.registration_leads (email);

CREATE INDEX IF NOT EXISTS idx_registration_leads_updated ON public.registration_leads (updated_at DESC);

ALTER TABLE public.registration_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon manage registration_leads" ON public.registration_leads;
CREATE POLICY "Allow anon manage registration_leads"
  ON public.registration_leads
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read registration_leads" ON public.registration_leads;
CREATE POLICY "Allow authenticated read registration_leads"
  ON public.registration_leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role, 'staff'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Staff admins delete registration_leads" ON public.registration_leads;
CREATE POLICY "Staff admins delete registration_leads"
  ON public.registration_leads
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role, 'staff'::public.app_role)
    )
  );

GRANT ALL ON public.registration_leads TO anon, authenticated, service_role;


-- --------------------------------------------------------
-- Migration: 20260509170000_profiles_staff_admin_manage.sql
-- --------------------------------------------------------
-- Learner profile rows must be updatable by admins / staff when editing the student directory.
-- Without this, students.update succeeds but profiles.upsert fails under RLS and edits appear "broken".

DROP POLICY IF EXISTS "Staff and admins update learner profiles" ON public.profiles;
CREATE POLICY "Staff and admins update learner profiles" ON public.profiles
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role, 'staff'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Staff and admins insert learner profiles" ON public.profiles;
CREATE POLICY "Staff and admins insert learner profiles" ON public.profiles
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role, 'staff'::public.app_role)
  )
);


-- --------------------------------------------------------
-- Migration: 20260509200000_finalize_sub_admin_creation_rpc.sql
-- --------------------------------------------------------
-- Sub-admin creation without SUPABASE_SERVICE_ROLE_KEY:
-- Requires handle_new_user (fix_signup_error.sql or equivalent) so signup assigns roles + admin_permissions from raw_user_meta_data.
-- Ensure enum app_role includes 'staff' (see supabase/add_staff_role.sql) before creating staff accounts.

-- 1) Browser calls auth.signUp (anon key) with role + is_staff in raw_user_meta_data (trigger handle_new_user).
-- 2) Caller invokes finalize_sub_admin_creation(...) using their admin JWT to set granular permissions + admin_staff row.

CREATE TABLE IF NOT EXISTS public.admin_staff (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role_tag TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_staff_email ON public.admin_staff (lower(email));

ALTER TABLE public.admin_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read admin_staff directory" ON public.admin_staff;
CREATE POLICY "Admins read admin_staff directory" ON public.admin_staff
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  )
);

COMMENT ON TABLE public.admin_staff IS 'Optional directory row for staff/sub-admins; mutations use finalize_sub_admin_creation RPC.';

CREATE OR REPLACE FUNCTION public.finalize_sub_admin_creation(
  target_user_id uuid,
  staff_email text,
  staff_full_name text,
  p_permissions jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.admin_permissions (
    user_id,
    can_manage_students,
    can_manage_classes,
    can_manage_certificates,
    can_manage_institutions,
    can_view_payments,
    can_manage_leads,
    can_manage_notifications,
    can_manage_assignments,
    can_manage_communications
  )
  VALUES (
    target_user_id,
    COALESCE((p_permissions ->> 'can_manage_students')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_classes')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_certificates')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_institutions')::boolean, true),
    COALESCE((p_permissions ->> 'can_view_payments')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_leads')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_notifications')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_assignments')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_communications')::boolean, true)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    can_manage_students = EXCLUDED.can_manage_students,
    can_manage_classes = EXCLUDED.can_manage_classes,
    can_manage_certificates = EXCLUDED.can_manage_certificates,
    can_manage_institutions = EXCLUDED.can_manage_institutions,
    can_view_payments = EXCLUDED.can_view_payments,
    can_manage_leads = EXCLUDED.can_manage_leads,
    can_manage_notifications = EXCLUDED.can_manage_notifications,
    can_manage_assignments = EXCLUDED.can_manage_assignments,
    can_manage_communications = EXCLUDED.can_manage_communications;

  INSERT INTO public.admin_staff (id, email, full_name, role_tag, permissions)
  VALUES (
    target_user_id,
    lower(trim(staff_email)),
    staff_full_name,
    staff_full_name,
    COALESCE(p_permissions, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role_tag = EXCLUDED.role_tag,
    permissions = EXCLUDED.permissions;

  BEGIN
    UPDATE public.profiles
    SET
      full_name = COALESCE(NULLIF(trim(staff_full_name), ''), full_name),
      email = lower(trim(staff_email))
    WHERE id = target_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Older schemas may differ; core permission rows still succeed.
    NULL;
  END;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_sub_admin_creation(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_sub_admin_creation(uuid, text, text, jsonb) TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260509210000_students_password_directory.sql
-- --------------------------------------------------------
-- Plaintext copy for admin “Resend credentials” (login truth remains in auth.users).
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS password TEXT;

COMMENT ON COLUMN public.students.password IS 'Optional directory copy of login password for admin emails; not the auth hash.';


-- --------------------------------------------------------
-- Migration: 20260509220000_admin_upsert_student_profile_rpc.sql
-- --------------------------------------------------------
-- Student-directory edits must sync auth.users-linked profiles without relying on client RLS for INSERT/UPDATE on other users' rows.

CREATE OR REPLACE FUNCTION public.admin_upsert_student_profile(
  p_id uuid,
  p_full_name text,
  p_email text,
  p_contact_number text DEFAULT '',
  p_gender text DEFAULT '',
  p_parent_name text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role, 'staff'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    contact_number,
    gender,
    parent_name
  )
  VALUES (
    p_id,
    COALESCE(NULLIF(trim(p_full_name), ''), 'Student'),
    lower(trim(p_email)),
    COALESCE(p_contact_number, ''),
    COALESCE(p_gender, ''),
    COALESCE(p_parent_name, '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    contact_number = EXCLUDED.contact_number,
    gender = EXCLUDED.gender,
    parent_name = EXCLUDED.parent_name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_student_profile(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_student_profile(uuid, text, text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.admin_upsert_student_profile IS 'Lets admins/staff upsert learner profiles without permissive profiles RLS on every environment.';


-- --------------------------------------------------------
-- Migration: 20260509230000_fix_admin_reset_password_pgcrypto.sql
-- --------------------------------------------------------
-- Fixes: function gen_salt(unknown) does not exist — qualify pgcrypto as extensions.*

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id UUID, new_pass TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin'::public.app_role, 'admin'::public.app_role, 'staff'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(new_pass::text, extensions.gen_salt('bf'::text)),
    updated_at = now()
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260509231000_sync_students_directory_password_on_auth_change.sql
-- --------------------------------------------------------
-- Mirror login password into public.students (directory copy) whenever auth password changes,
-- so Admin "Resend credentials" matches what actually works in Supabase Auth.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id UUID, new_pass TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin'::public.app_role, 'admin'::public.app_role, 'staff'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(new_pass::text, extensions.gen_salt('bf'::text)),
    updated_at = now()
  WHERE id = target_user_id;

  UPDATE public.students
  SET
    password = new_pass,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('password', new_pass::text)
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;

-- Forgot-password OTP flow (same directory sync).
CREATE OR REPLACE FUNCTION public.reset_user_password(p_email TEXT, p_otp TEXT, p_new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_otp_valid BOOLEAN;
BEGIN
  SELECT TRUE INTO v_otp_valid
  FROM public.password_resets
  WHERE lower(email) = lower(p_email)
    AND otp = p_otp
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_otp_valid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email);

  IF v_user_id IS NULL THEN
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

GRANT EXECUTE ON FUNCTION public.reset_user_password(TEXT, TEXT, TEXT) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260509232000_student_sync_directory_password_rpc.sql
-- --------------------------------------------------------
-- Reliable sync of students.password + metadata.password after the learner changes Auth password.
-- Browser UPDATE can fail under RLS or race with profile saves; this RPC runs as definer.

CREATE OR REPLACE FUNCTION public.sync_student_directory_password(p_plain TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plain TEXT := trim(p_plain);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_plain IS NULL OR length(v_plain) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE public.students
  SET
    password = v_plain,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('password', v_plain)
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.sync_student_directory_password(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_student_directory_password(TEXT) TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260509240000_students_joining_completion_duration.sql
-- --------------------------------------------------------
-- Offer letter + profile edits store internship window and duration on students;
-- client upserts these columns — without them PostgREST returns schema cache errors.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS joining_date TEXT,
  ADD COLUMN IF NOT EXISTS completion_date TEXT,
  ADD COLUMN IF NOT EXISTS internship_duration TEXT;

COMMENT ON COLUMN public.students.joining_date IS 'Internship start (typically ISO date from UI)';
COMMENT ON COLUMN public.students.completion_date IS 'Internship end (typically ISO date from UI)';
COMMENT ON COLUMN public.students.internship_duration IS 'Human-readable duration e.g. 120 Hours';


-- --------------------------------------------------------
-- Migration: 20260510120000_referral_partners_and_student_referral.sql
-- --------------------------------------------------------
-- Referral partners (admin-created) + attribution on students

CREATE TABLE IF NOT EXISTS public.referral_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  contact_number text NOT NULL DEFAULT '',
  referral_code text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_referral_partners_active ON public.referral_partners (active);
CREATE INDEX IF NOT EXISTS idx_referral_partners_email_lower ON public.referral_partners (lower(email));

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS referral_code text;

CREATE INDEX IF NOT EXISTS idx_students_referral_code ON public.students (referral_code)
  WHERE referral_code IS NOT NULL;

COMMENT ON TABLE public.referral_partners IS 'Marketing / ambassador referral rows; link is /register?ref=<referral_code>';
COMMENT ON COLUMN public.students.referral_code IS 'First-touch referral code captured at registration (must match active partner at signup time).';

ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage referral partners" ON public.referral_partners;
CREATE POLICY "Admins manage referral partners" ON public.referral_partners
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_partners TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260511060000_lnmu_marwari_fee.sql
-- --------------------------------------------------------
-- LNMU Marwari College students pay a flat ₹549 (₹500 + ₹49 GST + processing).
-- Stored in paise on the college row so the existing registration flow
-- (college.pisa_fee → university.pisa_fee → payment_config.amount_paise) picks it up.

UPDATE public.colleges c
SET pisa_fee = 54900
FROM public.universities u
WHERE c.university_id = u.id
  AND c.name ILIKE '%marwari%'
  AND (
    u.name ILIKE '%lalit%narayan%'
    OR u.name ILIKE '%lnmu%'
    OR u.name ILIKE '%mithila%'
  );


-- --------------------------------------------------------
-- Migration: 20260511070000_lock_role_assignment_and_revoke_breach.sql
-- --------------------------------------------------------
-- =============================================================================
-- SECURITY HARDENING + INCIDENT REMEDIATION
-- Incident: a student account (dilxxso1@gmail.com) reached /admin because the
-- signup trigger trusted `raw_user_meta_data.role` (and other code paths trusted
-- `raw_user_meta_data.is_staff`). Both are client-editable through the Supabase
-- anon key (auth.signUp options.data / auth.updateUser data), so any visitor
-- could promote themselves.
--
-- This migration:
--   1) Locks public.handle_new_user so it ALWAYS assigns the 'student' role
--      and never reads role/is_staff from client metadata.
--   2) Moves elevation into the admin-only RPC finalize_sub_admin_creation:
--      it now writes the user_roles row directly (admin or staff) under the
--      caller's verified admin/super_admin JWT.
--   3) Drops the is_staff metadata clause from the login-routing RPCs.
--   4) Strips `role` + `is_staff` from raw_user_meta_data on every existing
--      account that DOES NOT have a legitimate elevated row in user_roles, so
--      stale metadata can't be used to flip future routing decisions.
--   5) Revokes admin/super_admin/staff from dilxxso1@gmail.com (if present),
--      ensures they have a 'student' role, and invalidates their refresh
--      tokens so the active session terminates immediately.
-- =============================================================================

-- 1) Harden handle_new_user — role/is_staff in raw_user_meta_data is IGNORED.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Always default to student. Elevation only happens via
    -- finalize_sub_admin_creation() called under an admin/super_admin JWT.
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User'),
        COALESCE(NEW.email, '')
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Role elevation now happens server-side in finalize_sub_admin_creation
--    under the caller's verified admin/super_admin JWT.
CREATE OR REPLACE FUNCTION public.finalize_sub_admin_creation(
  target_user_id uuid,
  staff_email text,
  staff_full_name text,
  p_permissions jsonb DEFAULT '{}'::jsonb,
  p_role public.app_role DEFAULT 'staff'::public.app_role
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_super boolean := EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'::public.app_role
  );
  v_caller_is_admin boolean := v_caller_is_super OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::public.app_role
  );
BEGIN
  IF NOT v_caller_is_admin THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  -- Only super_admins may mint admins. Admins may only mint staff.
  IF p_role = 'super_admin'::public.app_role THEN
    RAISE EXCEPTION 'Cannot create super_admin via this RPC' USING ERRCODE = '42501';
  END IF;
  IF p_role = 'admin'::public.app_role AND NOT v_caller_is_super THEN
    RAISE EXCEPTION 'Only super_admin can create admin accounts' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('admin'::public.app_role, 'staff'::public.app_role) THEN
    RAISE EXCEPTION 'Invalid role for sub-admin creation' USING ERRCODE = '22023';
  END IF;

  -- Replace any existing elevated rows for this target with the requested role.
  DELETE FROM public.user_roles
  WHERE user_id = target_user_id
    AND role IN (
      'admin'::public.app_role,
      'staff'::public.app_role
    );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.admin_permissions (
    user_id,
    can_manage_students,
    can_manage_classes,
    can_manage_certificates,
    can_manage_institutions,
    can_view_payments,
    can_manage_leads,
    can_manage_notifications,
    can_manage_assignments,
    can_manage_communications
  )
  VALUES (
    target_user_id,
    COALESCE((p_permissions ->> 'can_manage_students')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_classes')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_certificates')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_institutions')::boolean, true),
    COALESCE((p_permissions ->> 'can_view_payments')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_leads')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_notifications')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_assignments')::boolean, true),
    COALESCE((p_permissions ->> 'can_manage_communications')::boolean, true)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    can_manage_students = EXCLUDED.can_manage_students,
    can_manage_classes = EXCLUDED.can_manage_classes,
    can_manage_certificates = EXCLUDED.can_manage_certificates,
    can_manage_institutions = EXCLUDED.can_manage_institutions,
    can_view_payments = EXCLUDED.can_view_payments,
    can_manage_leads = EXCLUDED.can_manage_leads,
    can_manage_notifications = EXCLUDED.can_manage_notifications,
    can_manage_assignments = EXCLUDED.can_manage_assignments,
    can_manage_communications = EXCLUDED.can_manage_communications;

  INSERT INTO public.admin_staff (id, email, full_name, role_tag, permissions)
  VALUES (
    target_user_id,
    lower(trim(staff_email)),
    staff_full_name,
    staff_full_name,
    COALESCE(p_permissions, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role_tag = EXCLUDED.role_tag,
    permissions = EXCLUDED.permissions;

  BEGIN
    UPDATE public.profiles
    SET
      full_name = COALESCE(NULLIF(trim(staff_full_name), ''), full_name),
      email = lower(trim(staff_email))
    WHERE id = target_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('ok', true, 'role', p_role::text);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_sub_admin_creation(uuid, text, text, jsonb, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_sub_admin_creation(uuid, text, text, jsonb, public.app_role) TO authenticated;

-- 3) Login-routing RPCs no longer trust raw_user_meta_data.is_staff.
CREATE OR REPLACE FUNCTION public.account_requires_admin_login(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(u.email)) = lower(trim(check_email))
      AND (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = u.id
            AND ur.role IN (
              'admin'::public.app_role,
              'super_admin'::public.app_role,
              'staff'::public.app_role
            )
        )
        OR EXISTS (SELECT 1 FROM public.cybercafe_profiles c WHERE c.id = u.id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.account_is_student_only(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(u.email)) = lower(trim(check_email))
      AND NOT (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = u.id
            AND ur.role IN (
              'admin'::public.app_role,
              'super_admin'::public.app_role,
              'staff'::public.app_role
            )
        )
        OR EXISTS (SELECT 1 FROM public.cybercafe_profiles c WHERE c.id = u.id)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.account_requires_admin_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_is_student_only(text) TO anon, authenticated;

-- 4) Strip role / is_staff from raw_user_meta_data on accounts that are NOT in
--    user_roles as admin/super_admin/staff. Stale metadata can't be used to
--    flip future routing decisions even if older client code still reads it.
UPDATE auth.users u
SET raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb) - 'role' - 'is_staff'
WHERE (
        COALESCE((u.raw_user_meta_data ? 'role'), false)
        OR COALESCE((u.raw_user_meta_data ? 'is_staff'), false)
      )
  AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = u.id
          AND ur.role IN (
            'admin'::public.app_role,
            'super_admin'::public.app_role,
            'staff'::public.app_role
          )
      );

-- 5) Targeted incident remediation: dilxxso1@gmail.com
DO $remediate$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(trim(email)) = 'dilxxso1@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'dilxxso1@gmail.com not present; nothing to revoke.';
    RETURN;
  END IF;

  -- Drop every elevated role row.
  DELETE FROM public.user_roles
  WHERE user_id = v_user_id
    AND role IN (
      'admin'::public.app_role,
      'super_admin'::public.app_role,
      'staff'::public.app_role
    );

  -- Drop any admin permission / directory rows just in case.
  DELETE FROM public.admin_permissions WHERE user_id = v_user_id;
  DELETE FROM public.admin_staff WHERE id = v_user_id;

  -- Ensure they're a regular student.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'student'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Clean any role / is_staff metadata bits.
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'role' - 'is_staff'
  WHERE id = v_user_id;

  -- Force the active session to terminate immediately by invalidating refresh
  -- tokens. (Access tokens are short-lived JWTs and will fail to refresh.)
  BEGIN
    DELETE FROM auth.refresh_tokens WHERE user_id::uuid = v_user_id;
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    RAISE NOTICE 'Skipped auth.refresh_tokens cleanup (insufficient privilege). Use Supabase Auth → Users → "Sign out user" for dilxxso1@gmail.com.';
  END;

  RAISE NOTICE 'Revoked elevated access for dilxxso1@gmail.com (user_id=%).', v_user_id;
END;
$remediate$;


-- --------------------------------------------------------
-- Migration: 20260511080000_college_student_rosters.sql
-- --------------------------------------------------------
-- =============================================================================
-- COLLEGE STUDENT ROSTERS
--   * Admin uploads a CSV / XLSX list of pre-approved students per college.
--   * Public registration form looks up rows by (college_id, email | phone) and
--     auto-fills the remaining academic / internship fields.
--   * On successful payment the matched row is "claimed" so it cannot be reused.
--
-- Security model:
--   * RLS lets only admin / super_admin SELECT, INSERT, UPDATE, DELETE.
--   * Anonymous registrants can never read the table directly; they call
--     SECURITY DEFINER RPCs that return at most one row and only when the
--     caller already knows the student's email or phone.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.college_student_rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  full_name TEXT,
  registration_number TEXT,
  email TEXT,
  phone TEXT,
  course TEXT,
  degree TEXT,
  department TEXT,
  subject TEXT,
  class_semester TEXT,
  academic_session TEXT,
  gender TEXT,
  dob TEXT,
  parent_name TEXT,
  internship_mode TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_file TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roster_college ON public.college_student_rosters(college_id);
CREATE INDEX IF NOT EXISTS idx_roster_email
  ON public.college_student_rosters(college_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';
CREATE INDEX IF NOT EXISTS idx_roster_phone
  ON public.college_student_rosters(college_id, phone)
  WHERE phone IS NOT NULL AND phone <> '';
CREATE INDEX IF NOT EXISTS idx_roster_regno
  ON public.college_student_rosters(college_id, lower(registration_number))
  WHERE registration_number IS NOT NULL AND registration_number <> '';
CREATE INDEX IF NOT EXISTS idx_roster_claimed
  ON public.college_student_rosters(claimed_user_id)
  WHERE claimed_user_id IS NOT NULL;

ALTER TABLE public.college_student_rosters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read college rosters" ON public.college_student_rosters;
CREATE POLICY "Admins read college rosters" ON public.college_student_rosters
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Admins write college rosters" ON public.college_student_rosters;
CREATE POLICY "Admins write college rosters" ON public.college_student_rosters
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  )
);

-- Saved column mapping per college so re-uploads are one click.
CREATE TABLE IF NOT EXISTS public.college_roster_mappings (
  college_id UUID PRIMARY KEY REFERENCES public.colleges(id) ON DELETE CASCADE,
  mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.college_roster_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage roster mappings" ON public.college_roster_mappings;
CREATE POLICY "Admins manage roster mappings" ON public.college_roster_mappings
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  )
);

-- =============================================================================
-- RPCs
-- =============================================================================

-- Bulk insert / update — admin only via JWT.
-- p_rows is an array of jsonb objects with snake_case keys matching the table.
CREATE OR REPLACE FUNCTION public.upsert_college_roster_rows(
  p_college_id UUID,
  p_rows JSONB,
  p_source_file TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_university_id UUID;
  v_row JSONB;
  v_inserted INT := 0;
  v_updated INT := 0;
  v_skipped INT := 0;
  v_existing UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT university_id INTO v_university_id FROM public.colleges WHERE id = p_college_id;
  IF v_university_id IS NULL THEN
    RAISE EXCEPTION 'Unknown college_id %', p_college_id USING ERRCODE = '22023';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
  LOOP
    -- Skip blank rows.
    IF COALESCE(NULLIF(trim(v_row->>'full_name'), ''), NULLIF(trim(v_row->>'email'), ''), NULLIF(trim(v_row->>'phone'), '')) IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Match by (college_id, lower(registration_number)) first, then (college_id, lower(email)).
    v_existing := NULL;
    IF NULLIF(trim(v_row->>'registration_number'), '') IS NOT NULL THEN
      SELECT id INTO v_existing
      FROM public.college_student_rosters
      WHERE college_id = p_college_id
        AND lower(trim(registration_number)) = lower(trim(v_row->>'registration_number'))
      LIMIT 1;
    END IF;

    IF v_existing IS NULL AND NULLIF(trim(v_row->>'email'), '') IS NOT NULL THEN
      SELECT id INTO v_existing
      FROM public.college_student_rosters
      WHERE college_id = p_college_id
        AND lower(trim(email)) = lower(trim(v_row->>'email'))
      LIMIT 1;
    END IF;

    IF v_existing IS NOT NULL THEN
      UPDATE public.college_student_rosters
      SET
        university_id = v_university_id,
        full_name = COALESCE(NULLIF(trim(v_row->>'full_name'), ''), full_name),
        registration_number = COALESCE(NULLIF(trim(v_row->>'registration_number'), ''), registration_number),
        email = COALESCE(NULLIF(lower(trim(v_row->>'email')), ''), email),
        phone = COALESCE(NULLIF(regexp_replace(COALESCE(v_row->>'phone', ''), '\D', '', 'g'), ''), phone),
        course = COALESCE(NULLIF(trim(v_row->>'course'), ''), course),
        degree = COALESCE(NULLIF(trim(v_row->>'degree'), ''), degree),
        department = COALESCE(NULLIF(trim(v_row->>'department'), ''), department),
        subject = COALESCE(NULLIF(trim(v_row->>'subject'), ''), subject),
        class_semester = COALESCE(NULLIF(trim(v_row->>'class_semester'), ''), class_semester),
        academic_session = COALESCE(NULLIF(trim(v_row->>'academic_session'), ''), academic_session),
        gender = COALESCE(NULLIF(trim(v_row->>'gender'), ''), gender),
        dob = COALESCE(NULLIF(trim(v_row->>'dob'), ''), dob),
        parent_name = COALESCE(NULLIF(trim(v_row->>'parent_name'), ''), parent_name),
        internship_mode = COALESCE(NULLIF(trim(v_row->>'internship_mode'), ''), internship_mode),
        metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(v_row->'metadata', '{}'::jsonb),
        source_file = COALESCE(p_source_file, source_file),
        uploaded_by = auth.uid(),
        uploaded_at = now(),
        updated_at = now()
      WHERE id = v_existing;
      v_updated := v_updated + 1;
    ELSE
      INSERT INTO public.college_student_rosters (
        college_id, university_id, full_name, registration_number, email, phone,
        course, degree, department, subject, class_semester, academic_session,
        gender, dob, parent_name, internship_mode, metadata, source_file, uploaded_by
      ) VALUES (
        p_college_id,
        v_university_id,
        NULLIF(trim(v_row->>'full_name'), ''),
        NULLIF(trim(v_row->>'registration_number'), ''),
        NULLIF(lower(trim(v_row->>'email')), ''),
        NULLIF(regexp_replace(COALESCE(v_row->>'phone', ''), '\D', '', 'g'), ''),
        NULLIF(trim(v_row->>'course'), ''),
        NULLIF(trim(v_row->>'degree'), ''),
        NULLIF(trim(v_row->>'department'), ''),
        NULLIF(trim(v_row->>'subject'), ''),
        NULLIF(trim(v_row->>'class_semester'), ''),
        NULLIF(trim(v_row->>'academic_session'), ''),
        NULLIF(trim(v_row->>'gender'), ''),
        NULLIF(trim(v_row->>'dob'), ''),
        NULLIF(trim(v_row->>'parent_name'), ''),
        NULLIF(trim(v_row->>'internship_mode'), ''),
        COALESCE(v_row->'metadata', '{}'::jsonb),
        p_source_file,
        auth.uid()
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_college_roster_rows(UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_college_roster_rows(UUID, JSONB, TEXT) TO authenticated;

-- Public lookup — anon callable. Returns at most one row, and only when the
-- caller already knows the email or phone for that college.
CREATE OR REPLACE FUNCTION public.match_college_roster(
  p_college_id UUID,
  p_email TEXT,
  p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_norm_email TEXT := NULLIF(lower(trim(COALESCE(p_email, ''))), '');
  v_norm_phone TEXT;
  v_phone_tail TEXT;
  v_row public.college_student_rosters%ROWTYPE;
  v_count INT;
BEGIN
  IF p_college_id IS NULL THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;

  v_norm_phone := NULLIF(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), '');
  IF v_norm_phone IS NOT NULL AND length(v_norm_phone) >= 10 THEN
    v_phone_tail := right(v_norm_phone, 10);
  ELSE
    v_phone_tail := v_norm_phone;
  END IF;

  IF v_norm_email IS NULL AND v_phone_tail IS NULL THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;

  -- 1) Tightest match: email AND phone match same row.
  IF v_norm_email IS NOT NULL AND v_phone_tail IS NOT NULL THEN
    SELECT * INTO v_row
    FROM public.college_student_rosters
    WHERE college_id = p_college_id
      AND lower(trim(email)) = v_norm_email
      AND right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10) = v_phone_tail
    LIMIT 1;
    IF FOUND THEN
      RETURN public._roster_match_result(v_row);
    END IF;
  END IF;

  -- 2) Email-only match (must be unique).
  IF v_norm_email IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.college_student_rosters
    WHERE college_id = p_college_id
      AND lower(trim(email)) = v_norm_email;
    IF v_count = 1 THEN
      SELECT * INTO v_row
      FROM public.college_student_rosters
      WHERE college_id = p_college_id
        AND lower(trim(email)) = v_norm_email
      LIMIT 1;
      RETURN public._roster_match_result(v_row);
    ELSIF v_count > 1 THEN
      RETURN jsonb_build_object('status', 'ambiguous');
    END IF;
  END IF;

  -- 3) Phone-only match (must be unique).
  IF v_phone_tail IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.college_student_rosters
    WHERE college_id = p_college_id
      AND right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10) = v_phone_tail;
    IF v_count = 1 THEN
      SELECT * INTO v_row
      FROM public.college_student_rosters
      WHERE college_id = p_college_id
        AND right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10) = v_phone_tail
      LIMIT 1;
      RETURN public._roster_match_result(v_row);
    ELSIF v_count > 1 THEN
      RETURN jsonb_build_object('status', 'ambiguous');
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'none');
END;
$$;

-- Internal helper that shapes a roster row into the response. Kept separate so
-- the access policy is "only callable via match_college_roster".
CREATE OR REPLACE FUNCTION public._roster_match_result(v_row public.college_student_rosters)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF v_row.claimed_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'claimed');
  END IF;
  RETURN jsonb_build_object(
    'status', 'matched',
    'data', jsonb_build_object(
      'id', v_row.id,
      'full_name', v_row.full_name,
      'registration_number', v_row.registration_number,
      'email', v_row.email,
      'phone', v_row.phone,
      'course', v_row.course,
      'degree', v_row.degree,
      'department', v_row.department,
      'subject', v_row.subject,
      'class_semester', v_row.class_semester,
      'academic_session', v_row.academic_session,
      'gender', v_row.gender,
      'dob', v_row.dob,
      'parent_name', v_row.parent_name,
      'internship_mode', v_row.internship_mode,
      'metadata', v_row.metadata
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public._roster_match_result(public.college_student_rosters) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.match_college_roster(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_college_roster(UUID, TEXT, TEXT) TO anon, authenticated;

-- Claim a roster row for a given auth user after a successful payment.
-- Called from the payment-verify endpoint with the service-role key, but also
-- usable by the matched user themselves (auth.uid()) since they own the row
-- they just claimed.
CREATE OR REPLACE FUNCTION public.claim_college_roster_row(
  p_college_id UUID,
  p_user_id UUID,
  p_email TEXT,
  p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_email TEXT := NULLIF(lower(trim(COALESCE(p_email, ''))), '');
  v_norm_phone TEXT;
  v_phone_tail TEXT;
  v_id UUID;
BEGIN
  v_norm_phone := NULLIF(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), '');
  IF v_norm_phone IS NOT NULL AND length(v_norm_phone) >= 10 THEN
    v_phone_tail := right(v_norm_phone, 10);
  ELSE
    v_phone_tail := v_norm_phone;
  END IF;

  IF p_user_id IS NULL OR p_college_id IS NULL OR (v_norm_email IS NULL AND v_phone_tail IS NULL) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'missing_params');
  END IF;

  SELECT id INTO v_id
  FROM public.college_student_rosters
  WHERE college_id = p_college_id
    AND claimed_user_id IS NULL
    AND (
      (v_norm_email IS NOT NULL AND lower(trim(email)) = v_norm_email)
      OR (v_phone_tail IS NOT NULL AND right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10) = v_phone_tail)
    )
  ORDER BY (
    CASE
      WHEN v_norm_email IS NOT NULL AND lower(trim(email)) = v_norm_email
       AND v_phone_tail IS NOT NULL AND right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10) = v_phone_tail
       THEN 0
      ELSE 1
    END
  )
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'no_match');
  END IF;

  UPDATE public.college_student_rosters
  SET claimed_user_id = p_user_id,
      claimed_at = now(),
      updated_at = now()
  WHERE id = v_id
    AND claimed_user_id IS NULL;

  RETURN jsonb_build_object('claimed', true, 'roster_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_college_roster_row(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_college_roster_row(UUID, UUID, TEXT, TEXT) TO authenticated;

-- Aggregate view for the admin "College Rosters" tab.
-- One row per college that has at least one roster row.
CREATE OR REPLACE VIEW public.college_roster_summary AS
SELECT
  c.id AS college_id,
  c.name AS college_name,
  u.id AS university_id,
  u.name AS university_name,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE r.claimed_user_id IS NOT NULL) AS claimed_rows,
  COUNT(*) FILTER (WHERE r.claimed_user_id IS NULL) AS pending_rows,
  MAX(r.uploaded_at) AS last_uploaded_at
FROM public.college_student_rosters r
JOIN public.colleges c ON c.id = r.college_id
LEFT JOIN public.universities u ON u.id = r.university_id
GROUP BY c.id, c.name, u.id, u.name;

GRANT SELECT ON public.college_roster_summary TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260512090000_lnmu_flat_fee_600.sql
-- --------------------------------------------------------
-- LNMU flat-fee colleges (Marwari, JK College Biraul, MLSM) — ₹600 each.
-- Stored in paise on the college row so the existing registration flow
-- (college.pisa_fee → university.pisa_fee → payment_config.amount_paise)
-- picks it up. The client also applies the same ₹600 (₹551 + ₹49 GST)
-- via src/lib/feeRules.ts as a safety net in case the DB value is missing.
--
-- Supersedes the earlier 20260511060000_lnmu_marwari_fee.sql price (₹549).

UPDATE public.colleges c
SET pisa_fee = 60000
FROM public.universities u
WHERE c.university_id = u.id
  AND (
    u.name ILIKE '%lalit%narayan%'
    OR u.name ILIKE '%lnmu%'
    OR u.name ILIKE '%mithila%'
  )
  AND (
    c.name ILIKE '%marwari%'
    -- MLSM is stored as "M. L. S. M. College, Darbhanga" — allow dots/spaces.
    OR c.name ~* 'm\.?\s*l\.?\s*s\.?\s*m\M'
    OR (c.name ~* '\mj\.?\s*k\M' AND c.name ILIKE '%biraul%')
  );


-- --------------------------------------------------------
-- Migration: 20260512100000_prefilled_students.sql
-- --------------------------------------------------------
-- Prefilled student data (sourced from college admission CSVs) used to
-- short-circuit the public / cyber-cafe registration flow.
--
-- * One row per (reference_number) — globally unique across uploaded files.
-- * `raw_data` holds the full CSV row verbatim so we can inspect / surface
--   any column without needing schema changes.
-- * `claimed_user_id` is set after a successful payment so the same reference
--   number can't be reused.

CREATE TABLE IF NOT EXISTS public.prefilled_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL,
  full_name TEXT,
  father_name TEXT,
  gender TEXT,
  dob TEXT,
  university_name TEXT,
  college_name TEXT,
  degree TEXT,
  department TEXT,
  subject TEXT,
  session TEXT,
  semester TEXT,
  internship_domain TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  college_id UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
  claimed_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_prefilled_ref
  ON public.prefilled_students(lower(reference_number));

CREATE INDEX IF NOT EXISTS idx_prefilled_college ON public.prefilled_students(college_id);
CREATE INDEX IF NOT EXISTS idx_prefilled_university ON public.prefilled_students(university_id);
CREATE INDEX IF NOT EXISTS idx_prefilled_claimed ON public.prefilled_students(claimed_user_id);
CREATE INDEX IF NOT EXISTS idx_prefilled_dob ON public.prefilled_students(dob);

ALTER TABLE public.prefilled_students ENABLE ROW LEVEL SECURITY;

-- Admins / super-admins manage rows; everyone else gets data only via RPCs.
DROP POLICY IF EXISTS prefilled_admin_all ON public.prefilled_students;
CREATE POLICY prefilled_admin_all ON public.prefilled_students
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
  );

-- Anon-callable RPC: look up by reference + DOB. Returns at most one row.
-- DOB comparison is loose (string-equal) because CSV formats vary.
CREATE OR REPLACE FUNCTION public.match_prefilled_student(
  p_reference_number TEXT,
  p_dob TEXT
)
RETURNS TABLE (
  status TEXT,
  data JSONB
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.prefilled_students;
BEGIN
  IF p_reference_number IS NULL OR length(btrim(p_reference_number)) = 0 THEN
    RETURN QUERY SELECT 'none'::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM public.prefilled_students
  WHERE lower(reference_number) = lower(btrim(p_reference_number))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'none'::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  -- If DOB is stored on the row, require a loose match (ignore separators).
  IF v_row.dob IS NOT NULL AND length(btrim(v_row.dob)) > 0 THEN
    IF p_dob IS NULL OR length(btrim(p_dob)) = 0 THEN
      RETURN QUERY SELECT 'dob_required'::TEXT, NULL::JSONB;
      RETURN;
    END IF;
    IF regexp_replace(btrim(v_row.dob), '[^0-9]', '', 'g')
       <> regexp_replace(btrim(p_dob), '[^0-9]', '', 'g')
    THEN
      RETURN QUERY SELECT 'dob_mismatch'::TEXT, NULL::JSONB;
      RETURN;
    END IF;
  END IF;

  IF v_row.claimed_user_id IS NOT NULL THEN
    RETURN QUERY SELECT 'claimed'::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'matched'::TEXT, jsonb_build_object(
    'id', v_row.id,
    'reference_number', v_row.reference_number,
    'full_name', v_row.full_name,
    'father_name', v_row.father_name,
    'gender', v_row.gender,
    'dob', v_row.dob,
    'university_id', v_row.university_id,
    'university_name', v_row.university_name,
    'college_id', v_row.college_id,
    'college_name', v_row.college_name,
    'degree', v_row.degree,
    'department', v_row.department,
    'subject', v_row.subject,
    'session', v_row.session,
    'semester', v_row.semester,
    'internship_domain', v_row.internship_domain,
    'raw_data', v_row.raw_data
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_prefilled_student(TEXT, TEXT) TO anon, authenticated;

-- Mark a prefilled row as claimed after the matching student finishes payment.
CREATE OR REPLACE FUNCTION public.claim_prefilled_student(
  p_reference_number TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_affected INT;
BEGIN
  IF p_reference_number IS NULL OR p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.prefilled_students
  SET claimed_user_id = p_user_id,
      claimed_at = now()
  WHERE lower(reference_number) = lower(btrim(p_reference_number))
    AND claimed_user_id IS NULL;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_prefilled_student(TEXT, UUID) TO authenticated, service_role;


-- --------------------------------------------------------
-- Migration: 20260512110000_prefilled_dob_optional.sql
-- --------------------------------------------------------
-- Make DOB strictly optional in the reference-number lookup. If the caller
-- supplies a DOB we still verify it (loose, digits-only match); if they
-- leave it blank we skip the check and return the matched row anyway.

CREATE OR REPLACE FUNCTION public.match_prefilled_student(
  p_reference_number TEXT,
  p_dob TEXT
)
RETURNS TABLE (
  status TEXT,
  data JSONB
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.prefilled_students;
  v_dob_supplied BOOLEAN;
BEGIN
  IF p_reference_number IS NULL OR length(btrim(p_reference_number)) = 0 THEN
    RETURN QUERY SELECT 'none'::TEXT, NULL::JSONB; RETURN;
  END IF;

  SELECT * INTO v_row
  FROM public.prefilled_students
  WHERE lower(reference_number) = lower(btrim(p_reference_number))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'none'::TEXT, NULL::JSONB; RETURN;
  END IF;

  v_dob_supplied := p_dob IS NOT NULL AND length(btrim(p_dob)) > 0;

  -- Only verify DOB when the caller supplied one *and* we have one on file.
  IF v_dob_supplied
     AND v_row.dob IS NOT NULL
     AND length(btrim(v_row.dob)) > 0
  THEN
    IF regexp_replace(btrim(v_row.dob), '[^0-9]', '', 'g')
       <> regexp_replace(btrim(p_dob), '[^0-9]', '', 'g')
    THEN
      RETURN QUERY SELECT 'dob_mismatch'::TEXT, NULL::JSONB; RETURN;
    END IF;
  END IF;

  IF v_row.claimed_user_id IS NOT NULL THEN
    RETURN QUERY SELECT 'claimed'::TEXT, NULL::JSONB; RETURN;
  END IF;

  RETURN QUERY SELECT 'matched'::TEXT, jsonb_build_object(
    'id', v_row.id,
    'reference_number', v_row.reference_number,
    'full_name', v_row.full_name,
    'father_name', v_row.father_name,
    'gender', v_row.gender,
    'dob', v_row.dob,
    'university_id', v_row.university_id,
    'university_name', v_row.university_name,
    'college_id', v_row.college_id,
    'college_name', v_row.college_name,
    'degree', v_row.degree,
    'department', v_row.department,
    'subject', v_row.subject,
    'session', v_row.session,
    'semester', v_row.semester,
    'internship_domain', v_row.internship_domain,
    'raw_data', v_row.raw_data
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_prefilled_student(TEXT, TEXT) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260512120000_prefilled_ref_unique_constraint.sql
-- --------------------------------------------------------
-- The original migration created a unique *expression index* on
-- lower(reference_number). That works for queries but does NOT satisfy
-- `ON CONFLICT (reference_number)` used by the admin roster import.
-- Adding a regular unique constraint so the upsert path is happy.

ALTER TABLE public.prefilled_students
  ADD CONSTRAINT prefilled_students_reference_number_key UNIQUE (reference_number);


-- --------------------------------------------------------
-- Migration: 20260512130000_mlsm_fee_500.sql
-- --------------------------------------------------------
-- MLSM College (under LNMU) drops from ₹600 to ₹500 flat, all-inclusive.
-- Marwari and JK Biraul stay at ₹600 (handled by the earlier
-- 20260512090000_lnmu_flat_fee_600 migration).
--
-- The client also applies the same ₹500 override via src/lib/feeRules.ts as
-- a safety net in case the DB value is missing.

UPDATE public.colleges c
SET pisa_fee = 50000
FROM public.universities u
WHERE c.university_id = u.id
  AND (
    u.name ILIKE '%lalit%narayan%'
    OR u.name ILIKE '%lnmu%'
    OR u.name ILIKE '%mithila%'
  )
  AND c.name ~* 'm\.?\s*l\.?\s*s\.?\s*m\M';


-- --------------------------------------------------------
-- Migration: 20260514120000_lnmu_mk_college_fee_548.sql
-- --------------------------------------------------------
-- M. K. College, Laheriasarai, Darbhanga (single college name in DB) —
-- internship registration total ₹548 (₹499 + ₹49 processing), in paise.
-- Matches dotted initials "M. K." not the substring "mk".
-- Client: src/lib/feeRules.ts (same patterns).

UPDATE public.colleges c
SET pisa_fee = 54800
FROM public.universities u
WHERE c.university_id = u.id
  AND (
    u.name ILIKE '%lalit%narayan%'
    OR u.name ILIKE '%lnmu%'
    OR u.name ILIKE '%mithila%'
  )
  AND c.name ~* 'm\.?\s*k\.?\s*college'
  AND c.name ILIKE '%laheria%';


-- --------------------------------------------------------
-- Migration: 20260514135500_college_admin_app_role_enum.sql
-- --------------------------------------------------------
-- Postgres requires enum additions to commit before the new label can be used
-- in the same database session. Keep this migration ONLY the ALTER TYPE so
-- `20260514140000_college_admin_portal.sql` runs in a later transaction.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'college_admin';


-- --------------------------------------------------------
-- Migration: 20260514140000_college_admin_portal.sql
-- --------------------------------------------------------
-- College portal: role + assignment + finalize RPC + scoped RLS + login helpers.
-- Enum label `college_admin` is added in 20260514135500_college_admin_app_role_enum.sql
-- (separate migration / transaction — required by Postgres 55P04).

CREATE OR REPLACE FUNCTION public.normalize_space_label(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(trim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')))
$$;

CREATE TABLE IF NOT EXISTS public.college_admin_assignments (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  college_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  college_admin_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT college_admin_assignments_code_key UNIQUE (college_admin_code)
);

CREATE INDEX IF NOT EXISTS idx_college_admin_assignments_college
  ON public.college_admin_assignments (college_id);

COMMENT ON TABLE public.college_admin_assignments IS
  'College portal accounts: one row per auth user; college_admin_code is the initial Supabase password (College Admin ID).';

ALTER TABLE public.college_admin_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "College admin reads own assignment" ON public.college_admin_assignments;
CREATE POLICY "College admin reads own assignment"
  ON public.college_admin_assignments
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage college admin assignments" ON public.college_admin_assignments;
CREATE POLICY "Admins manage college admin assignments"
  ON public.college_admin_assignments
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

GRANT SELECT ON public.college_admin_assignments TO authenticated;

-- ---------------------------------------------------------------------------
-- finalize_college_admin_creation: anon signup → elevate under admin JWT.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_college_admin_creation(
  target_user_id uuid,
  staff_email text,
  staff_full_name text,
  p_college_id uuid,
  p_college_admin_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_ok boolean := EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  );
BEGIN
  IF NOT v_caller_ok THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF p_college_id IS NULL THEN
    RAISE EXCEPTION 'College is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.colleges WHERE id = p_college_id) THEN
    RAISE EXCEPTION 'Invalid college_id' USING ERRCODE = '22023';
  END IF;

  IF p_college_admin_code IS NULL OR length(trim(p_college_admin_code)) < 6 THEN
    RAISE EXCEPTION 'College admin code must be at least 6 characters' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = target_user_id
    AND role IN (
      'student'::public.app_role,
      'admin'::public.app_role,
      'staff'::public.app_role,
      'college_admin'::public.app_role
    );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'college_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.college_admin_assignments (user_id, college_id, college_admin_code)
  VALUES (target_user_id, p_college_id, trim(p_college_admin_code))
  ON CONFLICT (user_id) DO UPDATE SET
    college_id = EXCLUDED.college_id,
    college_admin_code = EXCLUDED.college_admin_code;

  BEGIN
    UPDATE public.profiles
    SET
      full_name = COALESCE(NULLIF(trim(staff_full_name), ''), full_name),
      email = lower(trim(staff_email))
    WHERE id = target_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('ok', true, 'role', 'college_admin');
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_college_admin_creation(uuid, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_college_admin_creation(uuid, text, text, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Login routing: college admins use /college/login only; block wrong portals.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_requires_admin_login(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(u.email)) = lower(trim(check_email))
      AND (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = u.id
            AND ur.role IN (
              'admin'::public.app_role,
              'super_admin'::public.app_role,
              'staff'::public.app_role
            )
        )
        OR EXISTS (SELECT 1 FROM public.cybercafe_profiles c WHERE c.id = u.id)
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur2
          WHERE ur2.user_id = u.id
            AND ur2.role = 'college_admin'::public.app_role
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.account_is_student_only(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(u.email)) = lower(trim(check_email))
      AND NOT (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = u.id
            AND ur.role IN (
              'admin'::public.app_role,
              'super_admin'::public.app_role,
              'staff'::public.app_role,
              'college_admin'::public.app_role
            )
        )
        OR EXISTS (SELECT 1 FROM public.cybercafe_profiles c WHERE c.id = u.id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.account_may_use_college_login(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'college_admin'::public.app_role
    WHERE lower(trim(u.email)) = lower(trim(check_email))
  );
$$;

GRANT EXECUTE ON FUNCTION public.account_may_use_college_login(text) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.account_requires_admin_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_is_student_only(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Students: college admins see rows where roster college name matches assignment.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "College admins view their college students" ON public.students;
CREATE POLICY "College admins view their college students"
  ON public.students
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'college_admin'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.college_admin_assignments caa
      JOIN public.colleges c ON c.id = caa.college_id
      WHERE caa.user_id = auth.uid()
        AND public.normalize_space_label(c.name)
          = public.normalize_space_label(public.students.college_name)
    )
  );

-- Profiles (read-only for assigned college learners)
DROP POLICY IF EXISTS "College admins view profiles of their college students" ON public.profiles;
CREATE POLICY "College admins view profiles of their college students"
  ON public.profiles
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'college_admin'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.college_admin_assignments caa ON caa.user_id = auth.uid()
      JOIN public.colleges c ON c.id = caa.college_id
      WHERE s.id = public.profiles.id
        AND public.normalize_space_label(c.name)
          = public.normalize_space_label(s.college_name)
    )
  );


-- --------------------------------------------------------
-- Migration: 20260514150000_delete_college_admin_rpc.sql
-- --------------------------------------------------------
-- Allow admins to revoke college portal access (DB + role). Auth user remains;
-- student role is restored so the account is not left with zero roles.

CREATE OR REPLACE FUNCTION public.delete_college_admin(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean := EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  );
BEGIN
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.college_admin_assignments WHERE user_id = target_user_id;

  DELETE FROM public.user_roles
  WHERE user_id = target_user_id
    AND role = 'college_admin'::public.app_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'student'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_college_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_college_admin(uuid) TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260515135500_referral_partner_app_role_enum.sql
-- --------------------------------------------------------
-- Must run in its own migration transaction (Postgres 55P04) before using the new label.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'referral_partner';


-- --------------------------------------------------------
-- Migration: 20260515140000_referral_partner_portal.sql
-- --------------------------------------------------------
-- Referral promoters: auth-linked partners + scoped student visibility + login RPCs.

ALTER TABLE public.referral_partners
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.referral_partners
  ADD COLUMN IF NOT EXISTS partner_login_secret text;

COMMENT ON COLUMN public.referral_partners.auth_user_id IS 'Supabase Auth user for /referral/login portal; NULL until provisioned.';
COMMENT ON COLUMN public.referral_partners.partner_login_secret IS 'Initial login secret (same as Auth password at provision); optional support copy.';

CREATE INDEX IF NOT EXISTS idx_referral_partners_auth_user ON public.referral_partners (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

DROP POLICY IF EXISTS "Referral partners read own partner row" ON public.referral_partners;
CREATE POLICY "Referral partners read own partner row"
  ON public.referral_partners
  FOR SELECT
  USING (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- finalize_referral_partner_creation: signup under admin JWT → link partner row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_referral_partner_creation(
  target_user_id uuid,
  p_partner_id uuid,
  p_login_secret text,
  partner_full_name text,
  partner_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean := EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  );
BEGIN
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF p_partner_id IS NULL OR target_user_id IS NULL THEN
    RAISE EXCEPTION 'partner and user are required' USING ERRCODE = '22023';
  END IF;

  IF p_login_secret IS NULL OR length(trim(p_login_secret)) < 6 THEN
    RAISE EXCEPTION 'Login secret must be at least 6 characters' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.referral_partners
    WHERE id = p_partner_id
      AND lower(trim(email)) = lower(trim(partner_email))
      AND auth_user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid partner, email mismatch, or portal already provisioned' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = target_user_id
    AND role IN (
      'student'::public.app_role,
      'admin'::public.app_role,
      'staff'::public.app_role,
      'college_admin'::public.app_role,
      'referral_partner'::public.app_role
    );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'referral_partner'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.referral_partners
  SET
    auth_user_id = target_user_id,
    partner_login_secret = trim(p_login_secret),
    full_name = COALESCE(NULLIF(trim(partner_full_name), ''), full_name),
    email = lower(trim(partner_email)),
    updated_at = now()
  WHERE id = p_partner_id;

  BEGIN
    UPDATE public.profiles
    SET
      full_name = COALESCE(NULLIF(trim(partner_full_name), ''), full_name),
      email = lower(trim(partner_email))
    WHERE id = target_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_referral_partner_creation(uuid, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_referral_partner_creation(uuid, uuid, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin: remove portal link (partner row unlinked; auth user gets student role).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.detach_referral_partner_portal(p_partner_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean := EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  );
  v_uid uuid;
BEGIN
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT auth_user_id INTO v_uid FROM public.referral_partners WHERE id = p_partner_id FOR UPDATE;
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', true, 'note', 'no_portal');
  END IF;

  UPDATE public.referral_partners
  SET auth_user_id = NULL, partner_login_secret = NULL, updated_at = now()
  WHERE id = p_partner_id;

  DELETE FROM public.user_roles
  WHERE user_id = v_uid AND role = 'referral_partner'::public.app_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'student'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.detach_referral_partner_portal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.detach_referral_partner_portal(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Login routing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_requires_admin_login(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(u.email)) = lower(trim(check_email))
      AND (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = u.id
            AND ur.role IN (
              'admin'::public.app_role,
              'super_admin'::public.app_role,
              'staff'::public.app_role
            )
        )
        OR EXISTS (SELECT 1 FROM public.cybercafe_profiles c WHERE c.id = u.id)
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur2
          WHERE ur2.user_id = u.id
            AND ur2.role = 'college_admin'::public.app_role
        )
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur3
          WHERE ur3.user_id = u.id
            AND ur3.role = 'referral_partner'::public.app_role
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.account_is_student_only(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(u.email)) = lower(trim(check_email))
      AND NOT (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = u.id
            AND ur.role IN (
              'admin'::public.app_role,
              'super_admin'::public.app_role,
              'staff'::public.app_role,
              'college_admin'::public.app_role,
              'referral_partner'::public.app_role
            )
        )
        OR EXISTS (SELECT 1 FROM public.cybercafe_profiles c WHERE c.id = u.id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.account_may_use_referral_login(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'referral_partner'::public.app_role
    WHERE lower(trim(u.email)) = lower(trim(check_email))
  );
$$;

GRANT EXECUTE ON FUNCTION public.account_may_use_referral_login(text) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.account_requires_admin_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_is_student_only(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Students: referral partners see rows matching their referral_code.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Referral partners see referred students" ON public.students;
CREATE POLICY "Referral partners see referred students"
  ON public.students
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'referral_partner'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.referral_partners rp
      WHERE rp.auth_user_id = auth.uid()
        AND rp.active = true
        AND lower(trim(COALESCE(rp.referral_code, ''))) = lower(trim(COALESCE(public.students.referral_code, '')))
    )
  );

DROP POLICY IF EXISTS "Referral partners view profiles of referred students" ON public.profiles;
CREATE POLICY "Referral partners view profiles of referred students"
  ON public.profiles
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'referral_partner'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.referral_partners rp
      JOIN public.students s ON s.id = public.profiles.id
      WHERE rp.auth_user_id = auth.uid()
        AND rp.active = true
        AND lower(trim(COALESCE(rp.referral_code, ''))) = lower(trim(COALESCE(s.referral_code, '')))
    )
  );


-- --------------------------------------------------------
-- Migration: 20260516120000_referral_partner_rls_scoped_only.sql
-- --------------------------------------------------------
-- Referral-only promoters must NOT satisfy broad student/profile policies (those are OR'd with
-- "Referral partners see referred students" under Postgres permissive RLS). Without this,
-- a user who only has referral_partner can still match e.g. "Admins view all students" if that
-- policy includes staff or other roles, and incorrectly see the full roster.

CREATE OR REPLACE FUNCTION public.auth_is_referral_partner_scoped_only(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _uid
      AND ur.role = 'referral_partner'::public.app_role
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur2
    WHERE ur2.user_id = _uid
      AND ur2.role IN (
        'admin'::public.app_role,
        'super_admin'::public.app_role,
        'staff'::public.app_role,
        'college_admin'::public.app_role
      )
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_referral_partner_scoped_only(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_referral_partner_scoped_only(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- students: tighten broad SELECT / UPDATE so referral-only accounts never match
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins view all students" ON public.students;
CREATE POLICY "Admins view all students"
  ON public.students
  FOR SELECT
  USING (
    NOT public.auth_is_referral_partner_scoped_only(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN (
          'admin'::public.app_role,
          'super_admin'::public.app_role,
          'staff'::public.app_role
        )
    )
  );

DROP POLICY IF EXISTS "Admins update all students" ON public.students;
CREATE POLICY "Admins update all students"
  ON public.students
  FOR UPDATE
  USING (
    NOT public.auth_is_referral_partner_scoped_only(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN (
          'admin'::public.app_role,
          'super_admin'::public.app_role,
          'staff'::public.app_role
        )
    )
  );

DROP POLICY IF EXISTS "College admins view their college students" ON public.students;
CREATE POLICY "College admins view their college students"
  ON public.students
  FOR SELECT
  USING (
    NOT public.auth_is_referral_partner_scoped_only(auth.uid())
    AND public.has_role(auth.uid(), 'college_admin'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.college_admin_assignments caa
      JOIN public.colleges c ON c.id = caa.college_id
      WHERE caa.user_id = auth.uid()
        AND public.normalize_space_label(c.name)
          = public.normalize_space_label(public.students.college_name)
    )
  );

-- ---------------------------------------------------------------------------
-- profiles: same guard on admin-wide SELECT (if present on project)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    NOT public.auth_is_referral_partner_scoped_only(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "College admins view profiles of their college students" ON public.profiles;
CREATE POLICY "College admins view profiles of their college students"
  ON public.profiles
  FOR SELECT
  USING (
    NOT public.auth_is_referral_partner_scoped_only(auth.uid())
    AND public.has_role(auth.uid(), 'college_admin'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.college_admin_assignments caa ON caa.user_id = auth.uid()
      JOIN public.colleges c ON c.id = caa.college_id
      WHERE s.id = public.profiles.id
        AND public.normalize_space_label(c.name)
          = public.normalize_space_label(s.college_name)
    )
  );

DROP POLICY IF EXISTS "Admins delete students" ON public.students;
CREATE POLICY "Admins delete students"
  ON public.students
  FOR DELETE
  USING (
    NOT public.auth_is_referral_partner_scoped_only(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );


-- --------------------------------------------------------
-- Migration: 20260516120100_rb_college_dalsinghsarai_fee_500.sql
-- --------------------------------------------------------
-- R. B. / RB College, Dalsinghsarai (LNMU): flat ₹500 (50000 paise).
-- Run after universities exist; scoped to LNMU-like university names.

UPDATE public.colleges c
SET pisa_fee = 50000
FROM public.universities u
WHERE
  u.id = c.university_id
  AND (
    u.name ILIKE '%lalit%narayan%'
    OR u.name ILIKE '%lnmu%'
    OR u.name ILIKE '%mithila%'
  )
  AND (
    c.name ILIKE '%dalsinghsarai%'
    OR c.name ILIKE '%dalsighsarai%'
  )
  AND (
    c.name ILIKE '%r. b.%'
    OR c.name ILIKE '%r.b.%'
    OR c.name ~* 'R[.\s]*B[.\s]*College'
    OR (c.name ILIKE '%rb%' AND c.name ILIKE '%college%')
  );


-- --------------------------------------------------------
-- Migration: 20260516130200_bm_college_rahika_fee_500.sql
-- --------------------------------------------------------
-- BM College, Rahika (LNMU): flat ₹500 (50000 paise).
-- Client override: src/lib/feeRules.ts (LNMU_FLAT_500_COLLEGES).

UPDATE public.colleges c
SET pisa_fee = 50000
FROM public.universities u
WHERE
  u.id = c.university_id
  AND (
    u.name ILIKE '%lalit%narayan%'
    OR u.name ILIKE '%lnmu%'
    OR u.name ILIKE '%mithila%'
  )
  AND c.name ILIKE '%rahika%'
  AND (
    c.name ~* 'b[.\s]*m[.\s]*college'
    OR (c.name ILIKE '%college%' AND c.name ILIKE '%bm%' AND c.name ILIKE '%rahika%')
  );


-- --------------------------------------------------------
-- Migration: 20260516140000_lnmu_mrsm_college_fee_499.sql
-- --------------------------------------------------------
-- MRSM College (LNMU): flat ₹499 (49900 paise).
-- Client override: src/lib/feeRules.ts (LNMU_FLAT_499_COLLEGES).

UPDATE public.colleges c
SET pisa_fee = 49900
FROM public.universities u
WHERE
  u.id = c.university_id
  AND (
    u.name ILIKE '%lalit%narayan%'
    OR u.name ILIKE '%lnmu%'
    OR u.name ILIKE '%mithila%'
  )
  AND (
    c.name ILIKE '%mrsm%'
    OR c.name ~* 'm\.?\s*r\.?\s*s\.?\s*m'
  );


-- --------------------------------------------------------
-- Migration: 20260517120000_lnmu_gkpd_college_karpoori.sql
-- --------------------------------------------------------
-- G.K.P.D. College, Karpoori Gram, Samastipur (LNMU): ₹549 (50000 + 4900 paise).
-- Client: src/lib/feeRules.ts (LNMU_REGISTRATION_549_COLLEGES).

INSERT INTO public.colleges (university_id, name, pisa_fee)
SELECT u.id, 'G.K.P.D. College Karpoori Gram, Samastipur', 54900
FROM public.universities u
WHERE
  u.name ILIKE '%lalit%narayan%'
  OR u.name ILIKE '%lnmu%'
  OR u.name ILIKE '%mithila%'
ORDER BY u.created_at
LIMIT 1
ON CONFLICT (university_id, name) DO UPDATE
SET pisa_fee = EXCLUDED.pisa_fee;

-- Align fee if college already exists under a slightly different spelling.
UPDATE public.colleges c
SET pisa_fee = 54900
FROM public.universities u
WHERE
  c.university_id = u.id
  AND (
    u.name ILIKE '%lalit%narayan%'
    OR u.name ILIKE '%lnmu%'
    OR u.name ILIKE '%mithila%'
  )
  AND c.name ILIKE '%karpoori%'
  AND c.name ~* 'g[.\s]*k[.\s]*p[.\s]*d';


-- --------------------------------------------------------
-- Migration: 20260518120000_payment_config_webhook_secret.sql
-- --------------------------------------------------------
-- Webhook secret from Razorpay Dashboard (shown once when you create the webhook).
ALTER TABLE public.payment_config
  ADD COLUMN IF NOT EXISTS razorpay_webhook_secret TEXT;


-- --------------------------------------------------------
-- Migration: 20260518130000_lnmu_millat_college_fee_500.sql
-- --------------------------------------------------------
-- Millat College (LNMU): flat ₹500 (50000 paise).
-- Client override: src/lib/feeRules.ts (LNMU_FLAT_500_COLLEGES).

UPDATE public.colleges c
SET pisa_fee = 50000
FROM public.universities u
WHERE
  u.id = c.university_id
  AND (
    u.name ILIKE '%lalit%narayan%'
    OR u.name ILIKE '%lnmu%'
    OR u.name ILIKE '%mithila%'
  )
  AND c.name ILIKE '%millat%';


-- --------------------------------------------------------
-- Migration: 20260518140000_bnmu_colleges_fee_249.sql
-- --------------------------------------------------------
-- BNMU colleges: flat ₹249 (24900 paise).
-- Client override: src/lib/feeRules.ts (BNMU_FLAT_249_COLLEGES).

UPDATE public.colleges c
SET pisa_fee = 24900
FROM public.universities u
WHERE
  u.id = c.university_id
  AND (
    u.name ILIKE '%bnmu%'
    OR u.name ILIKE '%bhupendra%narayan%mand%'
  )
  AND (
  -- Manohar Lal Tekriwal (MLT) College, Saharsa
    (
      c.name ILIKE '%saharsa%'
      AND (
        c.name ILIKE '%tekriwal%'
        OR c.name ~* 'm\.?\s*l\.?\s*t'
        OR c.name ILIKE '%manohar%lal%'
      )
    )
    OR
  -- Sarb Narayan Singh Ram Kumar Singh College, Saharsa
    (
      c.name ILIKE '%saharsa%'
      AND c.name ILIKE '%sarb%narayan%'
      AND c.name ILIKE '%ram%kumar%'
    )
    OR
  -- Bhupendra Narayan Mandal Vanijya Mahavidyalaya, Madhepura
    (
      c.name ILIKE '%madhepura%'
      AND c.name ILIKE '%vanijya%'
    )
  );


-- --------------------------------------------------------
-- Migration: 20260519100000_fix_password_reset_and_staff_search.sql
-- --------------------------------------------------------
-- Forgot password: staff/admin + students (trim OTP, ensure anon can insert OTP rows)
-- Run in Lovable SQL editor if not applied via migration sync.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DROP POLICY IF EXISTS "Service role manages password resets" ON public.password_resets;
DROP POLICY IF EXISTS "Anyone can request password reset" ON public.password_resets;
CREATE POLICY "Anyone can request password reset"
  ON public.password_resets
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public cannot view OTPs" ON public.password_resets;
CREATE POLICY "Public cannot view OTPs"
  ON public.password_resets
  FOR SELECT
  USING (false);

-- Pre-check before sending OTP (any auth user: student, staff, admin)
CREATE OR REPLACE FUNCTION public.auth_email_registered_for_reset(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(trim(email)) = lower(trim(p_email))
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_email_registered_for_reset(text) TO anon, authenticated;

-- Verify OTP before showing new-password step (browser cannot read password_resets)
CREATE OR REPLACE FUNCTION public.verify_password_reset_otp(p_email text, p_otp text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.password_resets
    WHERE lower(trim(email)) = lower(trim(p_email))
      AND trim(otp) = trim(p_otp)
      AND expires_at > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_password_reset_otp(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.reset_user_password(p_email text, p_otp text, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_email text := lower(trim(p_email));
  v_otp text := trim(p_otp);
BEGIN
  IF v_email = '' OR v_otp = '' OR p_new_password IS NULL OR length(trim(p_new_password)) < 6 THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.password_resets
    WHERE lower(trim(email)) = v_email
      AND trim(otp) = v_otp
      AND expires_at > now()
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(trim(email)) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(trim(p_new_password)::text, extensions.gen_salt('bf'::text)),
    updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.students
  SET
    password = trim(p_new_password),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('password', trim(p_new_password)::text)
  WHERE id = v_user_id;

  DELETE FROM public.password_resets WHERE lower(trim(email)) = v_email;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_user_password(text, text, text) TO anon, authenticated;

-- Referral-only guard (no-op if already created in 20260516120000)
CREATE OR REPLACE FUNCTION public.auth_is_referral_partner_scoped_only(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _uid AND ur.role = 'referral_partner'::public.app_role
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = _uid
      AND ur2.role IN (
        'admin'::public.app_role,
        'super_admin'::public.app_role,
        'staff'::public.app_role,
        'college_admin'::public.app_role
      )
  );
$$;

-- Staff RLS: ensure staff can read students (idempotent if already applied)
DROP POLICY IF EXISTS "Admins view all students" ON public.students;
CREATE POLICY "Admins view all students"
  ON public.students
  FOR SELECT
  USING (
    NOT public.auth_is_referral_partner_scoped_only(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN (
          'admin'::public.app_role,
          'super_admin'::public.app_role,
          'staff'::public.app_role
        )
    )
  );


-- --------------------------------------------------------
-- Migration: 20260519120000_phone_login_resolve.sql
-- --------------------------------------------------------
-- Phone-or-email login: resolve 10-digit numbers to auth email (students, profiles, referral partners).
-- Must DROP old functions first: parameter renamed p_email → p_identifier (Postgres 42P13 otherwise).

DROP FUNCTION IF EXISTS public.auth_email_registered_for_reset(text);
DROP FUNCTION IF EXISTS public.verify_password_reset_otp(text, text);
DROP FUNCTION IF EXISTS public.reset_user_password(text, text, text);

CREATE OR REPLACE FUNCTION public.normalize_phone_tail(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(d) >= 10 THEN right(d, 10)
    ELSE NULL
  END
  FROM (
    SELECT regexp_replace(COALESCE(p_raw, ''), '\D', '', 'g') AS d
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_phone_tail(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_raw text := trim(COALESCE(p_identifier, ''));
  v_tail text;
  v_emails text[];
BEGIN
  IF v_raw = '' THEN
    RETURN NULL;
  END IF;

  IF position('@' in v_raw) > 0 THEN
    RETURN lower(v_raw);
  END IF;

  v_tail := public.normalize_phone_tail(v_raw);
  IF v_tail IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(DISTINCT e ORDER BY e)
  INTO v_emails
  FROM (
    SELECT lower(trim(s.email)) AS e
    FROM public.students s
    WHERE s.email IS NOT NULL
      AND trim(s.email) <> ''
      AND public.normalize_phone_tail(s.contact_number) = v_tail
    UNION
    SELECT lower(trim(p.email)) AS e
    FROM public.profiles p
    WHERE p.email IS NOT NULL
      AND trim(p.email) <> ''
      AND public.normalize_phone_tail(p.contact_number) = v_tail
    UNION
    SELECT lower(trim(rp.email)) AS e
    FROM public.referral_partners rp
    WHERE rp.email IS NOT NULL
      AND trim(rp.email) <> ''
      AND public.normalize_phone_tail(rp.contact_number) = v_tail
  ) matches;

  IF v_emails IS NULL OR array_length(v_emails, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  IF array_length(v_emails, 1) > 1 THEN
    RAISE EXCEPTION 'Multiple accounts are linked to this phone number. Please sign in with your email address instead.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_emails[1];
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

-- Forgot password: accept email or phone
CREATE OR REPLACE FUNCTION public.auth_email_registered_for_reset(p_identifier text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := public.resolve_login_email(p_identifier);
  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE lower(trim(email)) = v_email
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_password_reset_otp(p_identifier text, p_otp text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := public.resolve_login_email(p_identifier);
  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.password_resets
    WHERE lower(trim(email)) = v_email
      AND trim(otp) = trim(p_otp)
      AND expires_at > now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_user_password(p_identifier text, p_otp text, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_email text;
  v_otp text := trim(p_otp);
BEGIN
  v_email := public.resolve_login_email(p_identifier);
  IF v_email IS NULL OR v_otp = '' OR p_new_password IS NULL OR length(trim(p_new_password)) < 6 THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.password_resets
    WHERE lower(trim(email)) = v_email
      AND trim(otp) = v_otp
      AND expires_at > now()
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(trim(email)) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(trim(p_new_password)::text, extensions.gen_salt('bf'::text)),
    updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.students
  SET
    password = trim(p_new_password),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('password', trim(p_new_password)::text)
  WHERE id = v_user_id;

  DELETE FROM public.password_resets WHERE lower(trim(email)) = v_email;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_email_registered_for_reset(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_password_reset_otp(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_user_password(text, text, text) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260519130000_phone_login_resolve_missing_funcs.sql
-- --------------------------------------------------------
-- Run if verify query shows only 2 of 4 functions (missing resolve_login_email / verify_password_reset_otp).

CREATE OR REPLACE FUNCTION public.normalize_phone_tail(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(d) >= 10 THEN right(d, 10)
    ELSE NULL
  END
  FROM (
    SELECT regexp_replace(COALESCE(p_raw, ''), '\D', '', 'g') AS d
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_phone_tail(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_raw text := trim(COALESCE(p_identifier, ''));
  v_tail text;
  v_emails text[];
BEGIN
  IF v_raw = '' THEN
    RETURN NULL;
  END IF;

  IF position('@' in v_raw) > 0 THEN
    RETURN lower(v_raw);
  END IF;

  v_tail := public.normalize_phone_tail(v_raw);
  IF v_tail IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(DISTINCT e ORDER BY e)
  INTO v_emails
  FROM (
    SELECT lower(trim(s.email)) AS e
    FROM public.students s
    WHERE s.email IS NOT NULL
      AND trim(s.email) <> ''
      AND public.normalize_phone_tail(s.contact_number) = v_tail
    UNION
    SELECT lower(trim(p.email)) AS e
    FROM public.profiles p
    WHERE p.email IS NOT NULL
      AND trim(p.email) <> ''
      AND public.normalize_phone_tail(p.contact_number) = v_tail
    UNION
    SELECT lower(trim(rp.email)) AS e
    FROM public.referral_partners rp
    WHERE rp.email IS NOT NULL
      AND trim(rp.email) <> ''
      AND public.normalize_phone_tail(rp.contact_number) = v_tail
  ) matches;

  IF v_emails IS NULL OR array_length(v_emails, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  IF array_length(v_emails, 1) > 1 THEN
    RAISE EXCEPTION 'Multiple accounts are linked to this phone number. Please sign in with your email address instead.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_emails[1];
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_password_reset_otp(p_identifier text, p_otp text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := public.resolve_login_email(p_identifier);
  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.password_resets
    WHERE lower(trim(email)) = v_email
      AND trim(otp) = trim(p_otp)
      AND expires_at > now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_password_reset_otp(text, text) TO anon, authenticated;

-- Recreate dependent function so it calls resolve_login_email (safe if already exists)
CREATE OR REPLACE FUNCTION public.auth_email_registered_for_reset(p_identifier text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := public.resolve_login_email(p_identifier);
  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE lower(trim(email)) = v_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_email_registered_for_reset(text) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260519150000_college_fees_management.sql
-- --------------------------------------------------------
-- Per-college fee breakdown (admin-managed). Backfill mirrors src/lib/feeRules.ts.

ALTER TABLE public.colleges
  ADD COLUMN IF NOT EXISTS fee_base_paise INTEGER,
  ADD COLUMN IF NOT EXISTS fee_processing_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS show_fee_breakdown BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fees_managed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.colleges.fee_base_paise IS 'Registration/course component (paise); used when show_fee_breakdown is true.';
COMMENT ON COLUMN public.colleges.fee_processing_paise IS 'Processing/GST component (paise).';
COMMENT ON COLUMN public.colleges.show_fee_breakdown IS 'When true, students see base + processing lines before total.';
COMMENT ON COLUMN public.colleges.fees_managed IS 'When true, registration uses DB fee fields instead of code feeRules.';

-- 1) Non-LNMU / non-special: flat total from existing pisa_fee (or ₹500 default).
UPDATE public.colleges c
SET
  pisa_fee = COALESCE(NULLIF(c.pisa_fee, 0), 50000),
  fee_base_paise = COALESCE(NULLIF(c.pisa_fee, 0), 50000),
  fee_processing_paise = 0,
  show_fee_breakdown = false,
  fees_managed = true
FROM public.universities u
WHERE u.id = c.university_id
  AND NOT (
    u.name ~* 'lalit\s*narayan|lnmu|mithila|bnmu|bhupendra\s*narayan\s*mandal'
  );

-- 2) BNMU flat ₹249 colleges
UPDATE public.colleges c
SET
  pisa_fee = 24900,
  fee_base_paise = 24900,
  fee_processing_paise = 0,
  show_fee_breakdown = false,
  fees_managed = true
FROM public.universities u
WHERE
  u.id = c.university_id
  AND (u.name ILIKE '%bnmu%' OR u.name ILIKE '%bhupendra%narayan%mand%')
  AND (
    (
      c.name ILIKE '%saharsa%'
      AND (
        c.name ILIKE '%tekriwal%'
        OR c.name ~* 'm\.?\s*l\.?\s*t'
        OR c.name ILIKE '%manohar%lal%'
      )
    )
    OR (
      c.name ILIKE '%saharsa%'
      AND c.name ILIKE '%sarb%narayan%'
      AND c.name ILIKE '%ram%kumar%'
    )
    OR (c.name ILIKE '%madhepura%' AND c.name ILIKE '%vanijya%')
  );

-- 3) Other BNMU: keep pisa_fee, flat display
UPDATE public.colleges c
SET
  pisa_fee = COALESCE(NULLIF(c.pisa_fee, 0), 50000),
  fee_base_paise = COALESCE(NULLIF(c.pisa_fee, 0), 50000),
  fee_processing_paise = 0,
  show_fee_breakdown = false,
  fees_managed = true
FROM public.universities u
WHERE
  u.id = c.university_id
  AND (u.name ILIKE '%bnmu%' OR u.name ILIKE '%bhupendra%narayan%mand%')
  AND c.fees_managed IS NOT TRUE;

-- 4) LNMU flat ₹500
UPDATE public.colleges c
SET
  pisa_fee = 50000,
  fee_base_paise = 50000,
  fee_processing_paise = 0,
  show_fee_breakdown = false,
  fees_managed = true
FROM public.universities u
WHERE
  u.id = c.university_id
  AND (u.name ~* 'lalit\s*narayan|lnmu|mithila')
  AND (
    (
      c.name ~* 'dalsinghsarai|dalsighsarai'
      AND c.name ~* 'r[\s.]*b'
    )
    OR (c.name ILIKE '%rahika%' AND c.name ~* 'b[\s.]*m')
    OR c.name ILIKE '%millat%'
  );

-- 5) LNMU flat ₹499 (MRSM)
UPDATE public.colleges c
SET
  pisa_fee = 49900,
  fee_base_paise = 49900,
  fee_processing_paise = 0,
  show_fee_breakdown = false,
  fees_managed = true
FROM public.universities u
WHERE
  u.id = c.university_id
  AND (u.name ~* 'lalit\s*narayan|lnmu|mithila')
  AND c.name ILIKE '%mrsm%';

-- 6) LNMU GKPD ₹549 with breakdown
UPDATE public.colleges c
SET
  pisa_fee = 54900,
  fee_base_paise = 50000,
  fee_processing_paise = 4900,
  show_fee_breakdown = true,
  fees_managed = true
FROM public.universities u
WHERE
  u.id = c.university_id
  AND (u.name ~* 'lalit\s*narayan|lnmu|mithila')
  AND c.name ~* 'karpoori'
  AND c.name ~* 'g[\s.]*k[\s.]*p[\s.]*d';

-- 7) LNMU ₹600 exceptions (Marwari, JK Biraul, RCSS Bihat, MRJD Begusarai)
UPDATE public.colleges c
SET
  pisa_fee = 60000,
  fee_base_paise = 55100,
  fee_processing_paise = 4900,
  show_fee_breakdown = true,
  fees_managed = true
FROM public.universities u
WHERE
  u.id = c.university_id
  AND (u.name ~* 'lalit\s*narayan|lnmu|mithila')
  AND (
    c.name ILIKE '%marwari%'
    OR (c.name ILIKE '%biraul%' AND c.name ~* 'j[\s.]*k')
    OR (c.name ILIKE '%bihat%' AND c.name ~* 'r[\s.]*c[\s.]*s[\s.]*s')
    OR (c.name ILIKE '%begusarai%' AND c.name ~* 'm[\s.]*r[\s.]*j[\s.]*d')
  );

-- 8) LNMU default ₹549 with breakdown (remaining LNMU colleges)
UPDATE public.colleges c
SET
  pisa_fee = 54900,
  fee_base_paise = 50000,
  fee_processing_paise = 4900,
  show_fee_breakdown = true,
  fees_managed = true
FROM public.universities u
WHERE
  u.id = c.university_id
  AND (u.name ~* 'lalit\s*narayan|lnmu|mithila')
  AND c.fees_managed IS NOT TRUE;

-- Ensure fee_base is always set when managed
UPDATE public.colleges
SET fee_base_paise = GREATEST(0, pisa_fee - fee_processing_paise)
WHERE fees_managed = true AND fee_base_paise IS NULL;


-- --------------------------------------------------------
-- Migration: 20260520120000_lnmu_pdkj_college_name.sql
-- --------------------------------------------------------
-- LNMU: shorten Prof. Chandra Shekhar Jha PDKJ college title for display and matching.

UPDATE public.colleges c
SET name = 'PDKJ College'
FROM public.universities u
WHERE
  u.id = c.university_id
  AND (
    u.name ILIKE '%lnmu%'
    OR u.name ILIKE '%lalit%narayan%mithila%'
    OR u.name ILIKE '%mithila%university%'
  )
  AND (
    c.name ILIKE '%pdkj%'
    OR (
      c.name ILIKE '%chandra%shekhar%jha%'
      AND c.name ILIKE '%prof%'
    )
  )
  AND c.name IS DISTINCT FROM 'PDKJ College';

-- Align stored student college_name with the canonical label.
UPDATE public.students s
SET college_name = 'PDKJ College'
WHERE
  s.college_name ILIKE '%pdkj%'
  AND s.college_name ILIKE '%prof%chandra%shekhar%jha%';

-- Roster rows use college_id (public.college_student_rosters); renaming colleges above is enough.


-- --------------------------------------------------------
-- Migration: 20260522120000_college_admin_multi_college.sql
-- --------------------------------------------------------
-- College admins: multiple colleges per user; RPCs accept college id arrays.

ALTER TABLE public.college_admin_assignments
  DROP CONSTRAINT IF EXISTS college_admin_assignments_pkey;

ALTER TABLE public.college_admin_assignments
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

UPDATE public.college_admin_assignments
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.college_admin_assignments
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.college_admin_assignments
  ADD CONSTRAINT college_admin_assignments_pkey PRIMARY KEY (id);

ALTER TABLE public.college_admin_assignments
  DROP CONSTRAINT IF EXISTS college_admin_assignments_user_college_key;

ALTER TABLE public.college_admin_assignments
  ADD CONSTRAINT college_admin_assignments_user_college_key UNIQUE (user_id, college_id);

CREATE INDEX IF NOT EXISTS idx_college_admin_assignments_user
  ON public.college_admin_assignments (user_id);

COMMENT ON TABLE public.college_admin_assignments IS
  'College portal scope: one row per (user, college). college_admin_code is the shared sign-in secret.';

-- Replace single-college finalize with multi-college version.
DROP FUNCTION IF EXISTS public.finalize_college_admin_creation(uuid, text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.finalize_college_admin_creation(
  target_user_id uuid,
  staff_email text,
  staff_full_name text,
  p_college_ids uuid[],
  p_college_admin_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_ok boolean := EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  );
  v_code text := trim(p_college_admin_code);
BEGIN
  IF NOT v_caller_ok THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_college_ids IS NULL OR cardinality(p_college_ids) < 1 THEN
    RAISE EXCEPTION 'At least one college is required' USING ERRCODE = '22023';
  END IF;

  IF v_code IS NULL OR length(v_code) < 6 THEN
    RAISE EXCEPTION 'College admin code must be at least 6 characters' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_college_ids) AS cid
    WHERE NOT EXISTS (SELECT 1 FROM public.colleges c WHERE c.id = cid)
  ) THEN
    RAISE EXCEPTION 'One or more college ids are invalid' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = target_user_id
    AND role IN (
      'student'::public.app_role,
      'admin'::public.app_role,
      'staff'::public.app_role,
      'college_admin'::public.app_role
    );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'college_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.college_admin_assignments WHERE user_id = target_user_id;

  INSERT INTO public.college_admin_assignments (user_id, college_id, college_admin_code)
  SELECT target_user_id, cid, v_code
  FROM unnest(p_college_ids) AS cid;

  BEGIN
    UPDATE public.profiles
    SET
      full_name = COALESCE(NULLIF(trim(staff_full_name), ''), full_name),
      email = lower(trim(staff_email))
    WHERE id = target_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('ok', true, 'role', 'college_admin', 'college_count', cardinality(p_college_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_college_admin_creation(uuid, text, text, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_college_admin_creation(uuid, text, text, uuid[], text) TO authenticated;

-- Edit assignments / profile without re-signup.
CREATE OR REPLACE FUNCTION public.update_college_admin_assignments(
  target_user_id uuid,
  staff_email text,
  staff_full_name text,
  p_college_ids uuid[],
  p_college_admin_code text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_ok boolean := EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  );
  v_code text;
  v_existing text;
BEGIN
  IF NOT v_caller_ok THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = target_user_id
      AND ur.role = 'college_admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'User is not a college administrator' USING ERRCODE = '22023';
  END IF;

  IF p_college_ids IS NULL OR cardinality(p_college_ids) < 1 THEN
    RAISE EXCEPTION 'At least one college is required' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_college_ids) AS cid
    WHERE NOT EXISTS (SELECT 1 FROM public.colleges c WHERE c.id = cid)
  ) THEN
    RAISE EXCEPTION 'One or more college ids are invalid' USING ERRCODE = '22023';
  END IF;

  SELECT caa.college_admin_code INTO v_existing
  FROM public.college_admin_assignments caa
  WHERE caa.user_id = target_user_id
  ORDER BY caa.created_at ASC
  LIMIT 1;

  v_code := COALESCE(NULLIF(trim(p_college_admin_code), ''), v_existing);
  IF v_code IS NULL OR length(v_code) < 6 THEN
    RAISE EXCEPTION 'College admin code must be at least 6 characters' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.college_admin_assignments WHERE user_id = target_user_id;

  INSERT INTO public.college_admin_assignments (user_id, college_id, college_admin_code)
  SELECT target_user_id, cid, v_code
  FROM unnest(p_college_ids) AS cid;

  BEGIN
    UPDATE public.profiles
    SET
      full_name = COALESCE(NULLIF(trim(staff_full_name), ''), full_name),
      email = lower(trim(staff_email))
    WHERE id = target_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('ok', true, 'college_count', cardinality(p_college_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.update_college_admin_assignments(uuid, text, text, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_college_admin_assignments(uuid, text, text, uuid[], text) TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260523120000_college_admin_code_not_unique.sql
-- --------------------------------------------------------
-- One college admin has the same sign-in code on every assigned college row.
-- Global UNIQUE(college_admin_code) caused: duplicate key violates unique constraint
-- "college_admin_assignments_code_key" when assigning 2+ colleges.

ALTER TABLE public.college_admin_assignments
  DROP CONSTRAINT IF EXISTS college_admin_assignments_code_key;


-- --------------------------------------------------------
-- Migration: 20260524120000_college_admin_student_match.sql
-- --------------------------------------------------------
-- College admin students: match assigned colleges to student.college_name reliably
-- (handles display aliases, commas in college names, PDKJ rename).

CREATE OR REPLACE FUNCTION public.canonical_college_display_name(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN coalesce(t, '') ~* 'prof'
      AND coalesce(t, '') ~* 'chandra'
      AND coalesce(t, '') ~* 'shekhar'
      AND coalesce(t, '') ~* 'jha'
      AND coalesce(t, '') ~* 'pdkj'
      THEN 'PDKJ College'
    ELSE trim(coalesce(t, ''))
  END
$$;

CREATE OR REPLACE FUNCTION public.college_names_match(college_ref text, student_college text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    coalesce(trim(student_college), '') <> ''
    AND (
      public.normalize_space_label(college_ref) = public.normalize_space_label(student_college)
      OR public.normalize_space_label(public.canonical_college_display_name(college_ref))
        = public.normalize_space_label(student_college)
      OR public.normalize_space_label(split_part(college_ref, ',', 1))
        = public.normalize_space_label(student_college)
      OR (
        length(public.normalize_space_label(split_part(college_ref, ',', 1))) >= 8
        AND length(public.normalize_space_label(student_college)) >= 8
        AND (
          public.normalize_space_label(student_college)
            LIKE '%' || public.normalize_space_label(split_part(college_ref, ',', 1)) || '%'
          OR public.normalize_space_label(split_part(college_ref, ',', 1))
            LIKE '%' || public.normalize_space_label(student_college) || '%'
        )
      )
    )
$$;

DROP POLICY IF EXISTS "College admins view their college students" ON public.students;
CREATE POLICY "College admins view their college students"
  ON public.students
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'college_admin'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.college_admin_assignments caa
      JOIN public.colleges c ON c.id = caa.college_id
      WHERE caa.user_id = auth.uid()
        AND public.college_names_match(c.name, public.students.college_name)
    )
  );

DROP POLICY IF EXISTS "College admins view profiles of their college students" ON public.profiles;
CREATE POLICY "College admins view profiles of their college students"
  ON public.profiles
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'college_admin'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.college_admin_assignments caa ON caa.user_id = auth.uid()
      JOIN public.colleges c ON c.id = caa.college_id
      WHERE s.id = public.profiles.id
        AND public.college_names_match(c.name, s.college_name)
    )
  );

CREATE OR REPLACE FUNCTION public.college_admin_list_students()
RETURNS SETOF public.students
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.students s
  WHERE public.has_role(auth.uid(), 'college_admin'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.college_admin_assignments caa
      JOIN public.colleges c ON c.id = caa.college_id
      WHERE caa.user_id = auth.uid()
        AND public.college_names_match(c.name, s.college_name)
    )
  ORDER BY s.created_at DESC
  LIMIT 10000;
$$;

REVOKE ALL ON FUNCTION public.college_admin_list_students() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.college_admin_list_students() TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260525120000_registration_unique_email_phone.sql
-- --------------------------------------------------------
-- Public registration: one email and one mobile number per student account.
-- Callable with anon key before payment / signup.

CREATE OR REPLACE FUNCTION public.check_student_registration_available(
  p_email text,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text := lower(trim(COALESCE(p_email, '')));
  v_tail text := public.normalize_phone_tail(p_phone);
  v_email_taken boolean := false;
  v_phone_taken boolean := false;
BEGIN
  IF v_email = '' THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', 'invalid',
      'message', 'Enter a valid email address.'
    );
  END IF;

  IF v_tail IS NULL THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', 'invalid',
      'message', 'Enter a valid 10-digit mobile number.'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.students s
    WHERE lower(trim(s.email)) = v_email
  ) THEN
    v_email_taken := true;
  ELSIF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE lower(trim(u.email)) = v_email
  ) THEN
    v_email_taken := true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.students s
    WHERE public.normalize_phone_tail(s.contact_number) = v_tail
  ) THEN
    v_phone_taken := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE public.normalize_phone_tail(p.contact_number) = v_tail
      AND p.email IS NOT NULL
      AND lower(trim(p.email)) <> v_email
  ) THEN
    v_phone_taken := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.referral_partners rp
    WHERE public.normalize_phone_tail(rp.contact_number) = v_tail
      AND rp.email IS NOT NULL
      AND lower(trim(rp.email)) <> v_email
  ) THEN
    v_phone_taken := true;
  END IF;

  IF v_email_taken AND v_phone_taken THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', 'both',
      'email_taken', true,
      'phone_taken', true,
      'message',
        'This email and mobile number are already registered. Use the sign-in page if you already have an account, or use a different email and phone for a new registration.'
    );
  END IF;

  IF v_email_taken THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', 'email',
      'email_taken', true,
      'phone_taken', false,
      'message',
        'This email is already registered. Sign in with this email or use a different email address to create a new account.'
    );
  END IF;

  IF v_phone_taken THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', 'phone',
      'email_taken', false,
      'phone_taken', true,
      'message',
        'This mobile number is already linked to another account. Sign in with the email for that number, or use a different mobile number.'
    );
  END IF;

  RETURN jsonb_build_object(
    'available', true,
    'email_taken', false,
    'phone_taken', false,
    'message', ''
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_student_registration_available(text, text) TO anon, authenticated, service_role;


-- --------------------------------------------------------
-- Migration: 20260525200000_college_admin_match_improve.sql
-- --------------------------------------------------------
-- Stronger college name matching for college admin portal (LNMU Darbhanga abbreviations,
-- commas, dots in "M. L. S. M. College", etc.) + optional university alignment.

CREATE OR REPLACE FUNCTION public.normalize_college_match_key(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(trim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'))),
      '\.', '', 'g'
    ),
    '[^a-z0-9]', '', 'g'
  )
$$;

CREATE OR REPLACE FUNCTION public.college_name_match_keys(t text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  raw text := trim(coalesce(t, ''));
  keys text[] := ARRAY[]::text[];
  part text;
  stripped text;
  k text;
BEGIN
  IF raw = '' THEN
    RETURN keys;
  END IF;

  FOR k IN SELECT unnest(ARRAY[
    public.normalize_college_match_key(raw),
    public.normalize_college_match_key(public.canonical_college_display_name(raw)),
    public.normalize_college_match_key(split_part(raw, ',', 1))
  ]) LOOP
    IF k IS NOT NULL AND k <> '' AND NOT (k = ANY (keys)) THEN
      keys := array_append(keys, k);
    END IF;
  END LOOP;

  stripped := regexp_replace(raw, ',?\s*darbhanga\s*$', '', 'i');
  IF stripped <> raw THEN
    k := public.normalize_college_match_key(stripped);
    IF k <> '' AND NOT (k = ANY (keys)) THEN keys := array_append(keys, k); END IF;
    k := public.normalize_college_match_key(split_part(stripped, ',', 1));
    IF k <> '' AND NOT (k = ANY (keys)) THEN keys := array_append(keys, k); END IF;
  END IF;

  stripped := regexp_replace(stripped, ',?\s*laheriasarai\s*$', '', 'i');
  IF stripped <> '' THEN
    k := public.normalize_college_match_key(stripped);
    IF k <> '' AND NOT (k = ANY (keys)) THEN keys := array_append(keys, k); END IF;
    k := public.normalize_college_match_key(split_part(stripped, ',', 1));
    IF k <> '' AND NOT (k = ANY (keys)) THEN keys := array_append(keys, k); END IF;
  END IF;

  RETURN keys;
END;
$$;

CREATE OR REPLACE FUNCTION public.university_names_match(ref text, student_uni text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    coalesce(trim(student_uni), '') = ''
    OR coalesce(trim(ref), '') = ''
    OR public.normalize_college_match_key(ref) = public.normalize_college_match_key(student_uni)
    OR (
      length(public.normalize_college_match_key(ref)) >= 4
      AND length(public.normalize_college_match_key(student_uni)) >= 4
      AND (
        public.normalize_college_match_key(ref)
          LIKE '%' || public.normalize_college_match_key(student_uni) || '%'
        OR public.normalize_college_match_key(student_uni)
          LIKE '%' || public.normalize_college_match_key(ref) || '%'
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.college_names_match(college_ref text, student_college text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    coalesce(trim(student_college), '') <> ''
    AND EXISTS (
      SELECT 1
      FROM unnest(public.college_name_match_keys(college_ref)) AS rk
      CROSS JOIN unnest(public.college_name_match_keys(student_college)) AS sk
      WHERE rk = sk
         OR (
           length(rk) >= 6
           AND length(sk) >= 6
           AND (rk LIKE '%' || sk || '%' OR sk LIKE '%' || rk || '%')
         )
    )
$$;

DROP POLICY IF EXISTS "College admins view their college students" ON public.students;
CREATE POLICY "College admins view their college students"
  ON public.students
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'college_admin'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.college_admin_assignments caa
      JOIN public.colleges c ON c.id = caa.college_id
      LEFT JOIN public.universities u ON u.id = c.university_id
      WHERE caa.user_id = auth.uid()
        AND public.college_names_match(c.name, public.students.college_name)
        AND public.university_names_match(u.name, public.students.university_name)
    )
  );

DROP POLICY IF EXISTS "College admins view profiles of their college students" ON public.profiles;
CREATE POLICY "College admins view profiles of their college students"
  ON public.profiles
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'college_admin'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.college_admin_assignments caa ON caa.user_id = auth.uid()
      JOIN public.colleges c ON c.id = caa.college_id
      LEFT JOIN public.universities u ON u.id = c.university_id
      WHERE s.id = public.profiles.id
        AND public.college_names_match(c.name, s.college_name)
        AND public.university_names_match(u.name, s.university_name)
    )
  );

CREATE OR REPLACE FUNCTION public.college_admin_list_students()
RETURNS SETOF public.students
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.students s
  WHERE public.has_role(auth.uid(), 'college_admin'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.college_admin_assignments caa
      JOIN public.colleges c ON c.id = caa.college_id
      LEFT JOIN public.universities u ON u.id = c.university_id
      WHERE caa.user_id = auth.uid()
        AND public.college_names_match(c.name, s.college_name)
        AND public.university_names_match(u.name, s.university_name)
    )
  ORDER BY s.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.college_admin_list_students() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.college_admin_list_students() TO authenticated;

GRANT EXECUTE ON FUNCTION public.normalize_college_match_key(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.college_name_match_keys(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.university_names_match(text, text) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260526120000_referral_system_full.sql
-- --------------------------------------------------------
-- Referral system: public validation RPC (fixes anon registration attribution),
-- click tracking, partner metadata, paginated list RPCs, case-normalized codes.

ALTER TABLE public.referral_partners
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS college_name text,
  ADD COLUMN IF NOT EXISTS referral_type text NOT NULL DEFAULT 'other';

COMMENT ON COLUMN public.referral_partners.referral_type IS
  'student_ambassador | influencer | partner | other';

CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  session_id text
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_code_lower
  ON public.referral_clicks (lower(trim(referral_code)));
CREATE INDEX IF NOT EXISTS idx_referral_clicks_clicked_at
  ON public.referral_clicks (clicked_at DESC);

ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;

-- Normalize existing student attribution to canonical partner codes (case-insensitive match).
UPDATE public.students s
SET referral_code = rp.referral_code
FROM public.referral_partners rp
WHERE s.referral_code IS NOT NULL
  AND lower(trim(s.referral_code)) = lower(trim(rp.referral_code))
  AND s.referral_code IS DISTINCT FROM rp.referral_code;

-- ---------------------------------------------------------------------------
-- validate_referral_code: callable by anon during registration (no partner PII).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rp.referral_code
  FROM public.referral_partners rp
  WHERE lower(trim(rp.referral_code)) = lower(trim(nullif(p_code, '')))
    AND rp.active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.validate_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- log_referral_click: record link opens (only for valid active codes).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_referral_click(
  p_code text,
  p_session_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  v_code := public.validate_referral_code(p_code);
  IF v_code IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.referral_clicks (referral_code, session_id)
  VALUES (v_code, nullif(trim(p_session_id), ''));
END;
$$;

REVOKE ALL ON FUNCTION public.log_referral_click(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_referral_click(text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- referral_partner_stats: dashboard counters for logged-in promoter.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_partner_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_clicks bigint;
  v_total bigint;
  v_approved bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT rp.referral_code INTO v_code
  FROM public.referral_partners rp
  WHERE rp.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_code IS NULL THEN
    RETURN json_build_object('error', 'no_partner');
  END IF;

  SELECT count(*)::bigint INTO v_clicks
  FROM public.referral_clicks rc
  WHERE lower(trim(rc.referral_code)) = lower(trim(v_code));

  SELECT count(*)::bigint INTO v_total
  FROM public.students s
  WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code));

  SELECT count(*)::bigint INTO v_approved
  FROM public.students s
  WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code))
    AND lower(coalesce(s.status, '')) IN ('active', 'approved');

  RETURN json_build_object(
    'referral_code', v_code,
    'total_clicks', coalesce(v_clicks, 0),
    'total_students', coalesce(v_total, 0),
    'approved_students', coalesce(v_approved, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.referral_partner_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_partner_stats() TO authenticated;

-- ---------------------------------------------------------------------------
-- referral_partner_list_students: paginated student list for promoter portal.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_partner_list_students(
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_limit int;
  v_offset int;
  v_search text;
  v_total bigint;
  v_rows json;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated', 'rows', '[]'::json, 'total', 0);
  END IF;

  SELECT rp.referral_code INTO v_code
  FROM public.referral_partners rp
  WHERE rp.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_code IS NULL THEN
    RETURN json_build_object('error', 'no_partner', 'rows', '[]'::json, 'total', 0);
  END IF;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset := greatest(coalesce(p_offset, 0), 0);
  v_search := nullif(lower(trim(coalesce(p_search, ''))), '');

  SELECT count(*)::bigint INTO v_total
  FROM public.students s
  WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code))
    AND (
      v_search IS NULL
      OR lower(coalesce(s.full_name, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(s.email, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(s.contact_number, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(s.college_name, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(s.university_name, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(s.registration_id, '')) LIKE '%' || v_search || '%'
    );

  SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) INTO v_rows
  FROM (
    SELECT
      s.id,
      s.full_name,
      s.email,
      s.contact_number,
      s.college_name,
      s.university_name,
      s.course,
      s.degree,
      s.department,
      s.gender,
      s.class_semester,
      s.academic_session,
      s.roll_number,
      s.parent_name,
      s.registration_id,
      s.internship_domain,
      s.emergency_name,
      s.emergency_contact,
      s.emergency_relation,
      s.status,
      s.created_at,
      s.referral_code
    FROM public.students s
    WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code))
      AND (
        v_search IS NULL
        OR lower(coalesce(s.full_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(s.email, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(s.contact_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(s.college_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(s.university_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(s.registration_id, '')) LIKE '%' || v_search || '%'
      )
    ORDER BY s.created_at DESC NULLS LAST
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN json_build_object(
    'rows', coalesce(v_rows, '[]'::json),
    'total', coalesce(v_total, 0),
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.referral_partner_list_students(int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_partner_list_students(int, int, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- admin_referral_overview: analytics table for admin referrals panel.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_referral_overview()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_rows json;
BEGIN
  v_ok := public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role);
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.total_students DESC, t.full_name ASC), '[]'::json)
  INTO v_rows
  FROM (
    SELECT
      rp.id,
      rp.full_name,
      rp.email,
      rp.contact_number,
      rp.referral_code,
      rp.city,
      rp.college_name,
      rp.referral_type,
      rp.active,
      rp.created_at,
      rp.auth_user_id,
      (
        SELECT count(*)::bigint
        FROM public.referral_clicks rc
        WHERE lower(trim(rc.referral_code)) = lower(trim(rp.referral_code))
      ) AS total_clicks,
      (
        SELECT count(*)::bigint
        FROM public.students s
        WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(rp.referral_code))
      ) AS total_students,
      (
        SELECT count(*)::bigint
        FROM public.students s
        WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(rp.referral_code))
          AND lower(coalesce(s.status, '')) IN ('active', 'approved')
      ) AS approved_students
    FROM public.referral_partners rp
  ) t;

  RETURN coalesce(v_rows, '[]'::json);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_referral_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_referral_overview() TO authenticated;

-- ---------------------------------------------------------------------------
-- admin_referral_partner_students: paginated signups for one partner (admin).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_referral_partner_students(
  p_partner_id uuid,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_code text;
  v_limit int;
  v_offset int;
  v_search text;
  v_total bigint;
  v_rows json;
BEGIN
  v_ok := public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role);
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT rp.referral_code INTO v_code
  FROM public.referral_partners rp
  WHERE rp.id = p_partner_id;

  IF v_code IS NULL THEN
    RETURN json_build_object('error', 'partner_not_found', 'rows', '[]'::json, 'total', 0);
  END IF;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset := greatest(coalesce(p_offset, 0), 0);
  v_search := nullif(lower(trim(coalesce(p_search, ''))), '');

  SELECT count(*)::bigint INTO v_total
  FROM public.students s
  WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code))
    AND (
      v_search IS NULL
      OR lower(coalesce(s.full_name, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(s.email, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(s.contact_number, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(s.college_name, '')) LIKE '%' || v_search || '%'
    );

  SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) INTO v_rows
  FROM (
    SELECT
      s.id,
      s.full_name,
      s.email,
      s.contact_number,
      s.college_name,
      s.university_name,
      s.course,
      s.status,
      s.registration_id,
      s.created_at
    FROM public.students s
    WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code))
      AND (
        v_search IS NULL
        OR lower(coalesce(s.full_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(s.email, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(s.contact_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(s.college_name, '')) LIKE '%' || v_search || '%'
      )
    ORDER BY s.created_at DESC NULLS LAST
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN json_build_object(
    'rows', coalesce(v_rows, '[]'::json),
    'total', coalesce(v_total, 0),
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_referral_partner_students(uuid, int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_referral_partner_students(uuid, int, int, text) TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260527120000_referral_partner_link_existing_auth.sql
-- --------------------------------------------------------
-- Admin-only: resolve auth.users.id by email when provisioning promoter portals for
-- existing referral partners whose email already has an Auth account (e.g. student).

CREATE OR REPLACE FUNCTION public.resolve_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_ok boolean := EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role, 'staff'::public.app_role)
  );
  v_uid uuid;
BEGIN
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT u.id INTO v_uid
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;

  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_auth_user_id_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_auth_user_id_by_email(text) TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260530120000_students_directory_password_metadata_only.sql
-- --------------------------------------------------------
-- students.password column removed for security; directory credential copy lives in metadata.password only.
-- Also refreshes forgot-password RPCs (OTP reset) and admin password reset helpers.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.students DROP COLUMN IF EXISTS password;

CREATE OR REPLACE FUNCTION public.sync_student_directory_password(p_plain TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plain TEXT := trim(p_plain);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_plain IS NULL OR length(v_plain) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE public.students
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('password', v_plain)
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id UUID, new_pass TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin'::public.app_role, 'admin'::public.app_role, 'staff'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(new_pass::text, extensions.gen_salt('bf'::text)),
    updated_at = now()
  WHERE id = target_user_id;

  UPDATE public.students
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('password', new_pass::text)
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_user_password(p_identifier text, p_otp text, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_email text;
  v_otp text := trim(p_otp);
  v_pass text := trim(p_new_password);
BEGIN
  v_email := public.resolve_login_email(p_identifier);
  IF v_email IS NULL OR v_otp = '' OR v_pass IS NULL OR length(v_pass) < 6 THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.password_resets
    WHERE lower(trim(email)) = v_email
      AND trim(otp) = v_otp
      AND expires_at > now()
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(trim(email)) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(v_pass::text, extensions.gen_salt('bf'::text)),
    updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.students
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('password', v_pass)
  WHERE id = v_user_id;

  DELETE FROM public.password_resets WHERE lower(trim(email)) = v_email;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_student_directory_password(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_student_directory_password(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_reset_user_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_user_password(text, text, text) TO anon, authenticated;

-- Ensure verify OTP RPC exists (used by Login forgot-password step 2).
CREATE OR REPLACE FUNCTION public.verify_password_reset_otp(p_identifier text, p_otp text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := public.resolve_login_email(p_identifier);
  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.password_resets
    WHERE lower(trim(email)) = v_email
      AND trim(otp) = trim(p_otp)
      AND expires_at > now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_password_reset_otp(text, text) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260530130000_students_insert_rls_fix.sql
-- --------------------------------------------------------
-- Fix "new row violates row-level security policy" on public.students during registration.
-- Self-service: auth.uid() must equal students.id.
-- Staff/admin manual enrollment: may insert rows for other user ids.

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own student record" ON public.students;
DROP POLICY IF EXISTS "Students insert own record" ON public.students;
CREATE POLICY "Students insert own record"
  ON public.students
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own student record" ON public.students;
DROP POLICY IF EXISTS "Students update own record" ON public.students;
CREATE POLICY "Students update own record"
  ON public.students
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users view own student record" ON public.students;
DROP POLICY IF EXISTS "Students view own record" ON public.students;
CREATE POLICY "Students view own record"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Staff and admins insert students" ON public.students;
CREATE POLICY "Staff and admins insert students"
  ON public.students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT public.auth_is_referral_partner_scoped_only(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN (
          'admin'::public.app_role,
          'super_admin'::public.app_role,
          'staff'::public.app_role
        )
    )
  );

GRANT INSERT, UPDATE, SELECT ON public.students TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260530140000_upsert_student_directory_row_rpc.sql
-- --------------------------------------------------------
-- Bypass RLS for student self-registration and staff/admin enrollment when JWT is present.

CREATE OR REPLACE FUNCTION public.upsert_student_directory_row(p_row jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := NULLIF(trim(p_row->>'id'), '')::uuid;
  v_staff boolean := false;
  v_reg text;
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Student id required';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_staff := EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'admin'::public.app_role,
        'super_admin'::public.app_role,
        'staff'::public.app_role
      )
  );

  IF auth.uid() IS DISTINCT FROM v_id AND NOT v_staff THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN public.complete_student_registration(p_row, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_student_directory_row(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_student_directory_row(jsonb) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260530150000_register_student_directory_no_service_role.sql
-- --------------------------------------------------------
-- Post-signup enrollment without Vercel service role: SECURITY DEFINER RPC callable by anon + authenticated.

CREATE OR REPLACE FUNCTION public.assert_can_write_student_directory(p_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_auth_email text;
  v_created timestamptz;
BEGIN
  IF p_id IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Student id and email required';
  END IF;

  IF auth.uid() = p_id THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'admin'::public.app_role,
        'super_admin'::public.app_role,
        'staff'::public.app_role
      )
  ) THEN
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT lower(trim(u.email)), u.created_at
  INTO v_auth_email, v_created
  FROM auth.users u
  WHERE u.id = p_id;

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'Auth account not found';
  END IF;

  IF v_auth_email <> v_email THEN
    RAISE EXCEPTION 'Email does not match auth account';
  END IF;

  IF v_created IS NULL OR v_created < now() - interval '3 hours' THEN
    RAISE EXCEPTION 'Registration window expired; sign in or contact support';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_student_registration(
  p_student jsonb,
  p_profile jsonb DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id uuid := NULLIF(trim(p_student->>'id'), '')::uuid;
  v_email text := trim(p_student->>'email');
  v_reg text;
  v_meta jsonb := COALESCE(p_student->'metadata', '{}'::jsonb);
BEGIN
  PERFORM public.assert_can_write_student_directory(v_id, v_email);

  INSERT INTO public.students (
    id, email, full_name, gender, parent_name, contact_number,
    university_name, college_name, course, internship_domain, degree, department,
    class_semester, academic_session, roll_number,
    emergency_name, emergency_contact, emergency_relation,
    status, cybercafe_shop_name, cybercafe_email, referral_code,
    registration_id, metadata
  )
  VALUES (
    v_id,
    lower(trim(p_student->>'email')),
    NULLIF(trim(p_student->>'full_name'), ''),
    NULLIF(trim(p_student->>'gender'), ''),
    NULLIF(trim(p_student->>'parent_name'), ''),
    NULLIF(trim(p_student->>'contact_number'), ''),
    NULLIF(trim(p_student->>'university_name'), ''),
    NULLIF(trim(p_student->>'college_name'), ''),
    NULLIF(trim(p_student->>'course'), ''),
    NULLIF(trim(COALESCE(p_student->>'internship_domain', p_student->>'course')), ''),
    NULLIF(trim(p_student->>'degree'), ''),
    NULLIF(trim(p_student->>'department'), ''),
    NULLIF(trim(p_student->>'class_semester'), ''),
    NULLIF(trim(p_student->>'academic_session'), ''),
    NULLIF(trim(p_student->>'roll_number'), ''),
    NULLIF(trim(p_student->>'emergency_name'), ''),
    NULLIF(trim(p_student->>'emergency_contact'), ''),
    NULLIF(trim(p_student->>'emergency_relation'), ''),
    COALESCE(NULLIF(trim(p_student->>'status'), ''), 'Active'),
    NULLIF(trim(p_student->>'cybercafe_shop_name'), ''),
    NULLIF(trim(p_student->>'cybercafe_email'), ''),
    NULLIF(trim(p_student->>'referral_code'), ''),
    NULLIF(trim(p_student->>'registration_id'), ''),
    v_meta
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    registration_id = COALESCE(EXCLUDED.registration_id, public.students.registration_id),
    gender = EXCLUDED.gender,
    parent_name = EXCLUDED.parent_name,
    contact_number = EXCLUDED.contact_number,
    university_name = EXCLUDED.university_name,
    college_name = EXCLUDED.college_name,
    course = EXCLUDED.course,
    internship_domain = EXCLUDED.internship_domain,
    degree = EXCLUDED.degree,
    department = EXCLUDED.department,
    class_semester = EXCLUDED.class_semester,
    academic_session = EXCLUDED.academic_session,
    roll_number = EXCLUDED.roll_number,
    emergency_name = EXCLUDED.emergency_name,
    emergency_contact = EXCLUDED.emergency_contact,
    emergency_relation = EXCLUDED.emergency_relation,
    status = EXCLUDED.status,
    cybercafe_shop_name = EXCLUDED.cybercafe_shop_name,
    cybercafe_email = EXCLUDED.cybercafe_email,
    referral_code = EXCLUDED.referral_code,
    metadata = EXCLUDED.metadata;

  IF p_profile IS NOT NULL AND p_profile <> '{}'::jsonb THEN
    INSERT INTO public.profiles (id, full_name, email, contact_number, gender, parent_name)
    VALUES (
      COALESCE(NULLIF(trim(p_profile->>'id'), '')::uuid, v_id),
      COALESCE(NULLIF(trim(p_profile->>'full_name'), ''), 'Student'),
      lower(trim(COALESCE(p_profile->>'email', p_student->>'email'))),
      COALESCE(NULLIF(trim(p_profile->>'contact_number'), ''), ''),
      COALESCE(NULLIF(trim(p_profile->>'gender'), ''), ''),
      COALESCE(NULLIF(trim(p_profile->>'parent_name'), ''), '')
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      contact_number = EXCLUDED.contact_number,
      gender = EXCLUDED.gender,
      parent_name = EXCLUDED.parent_name;
  END IF;

  SELECT registration_id INTO v_reg FROM public.students WHERE id = v_id;
  RETURN v_reg;
END;
$$;

-- Keep legacy name; delegate to complete_student_registration.
CREATE OR REPLACE FUNCTION public.upsert_student_directory_row(p_row jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.complete_student_registration(p_row, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.assert_can_write_student_directory(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_student_registration(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_student_directory_row(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.complete_student_registration(jsonb, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_student_directory_row(jsonb) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260530160000_fix_complete_student_registration_sql.sql
-- --------------------------------------------------------
-- Fix complete_student_registration: explicit jsonb columns (no jsonb_populate_record).

CREATE OR REPLACE FUNCTION public.complete_student_registration(
  p_student jsonb,
  p_profile jsonb DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id uuid := NULLIF(trim(p_student->>'id'), '')::uuid;
  v_email text := trim(p_student->>'email');
  v_reg text;
  v_meta jsonb := COALESCE(p_student->'metadata', '{}'::jsonb);
BEGIN
  PERFORM public.assert_can_write_student_directory(v_id, v_email);

  INSERT INTO public.students (
    id,
    email,
    full_name,
    gender,
    parent_name,
    contact_number,
    university_name,
    college_name,
    course,
    internship_domain,
    degree,
    department,
    class_semester,
    academic_session,
    roll_number,
    emergency_name,
    emergency_contact,
    emergency_relation,
    status,
    cybercafe_shop_name,
    cybercafe_email,
    referral_code,
    registration_id,
    metadata
  )
  VALUES (
    v_id,
    lower(trim(p_student->>'email')),
    NULLIF(trim(p_student->>'full_name'), ''),
    NULLIF(trim(p_student->>'gender'), ''),
    NULLIF(trim(p_student->>'parent_name'), ''),
    NULLIF(trim(p_student->>'contact_number'), ''),
    NULLIF(trim(p_student->>'university_name'), ''),
    NULLIF(trim(p_student->>'college_name'), ''),
    NULLIF(trim(p_student->>'course'), ''),
    NULLIF(trim(COALESCE(p_student->>'internship_domain', p_student->>'course')), ''),
    NULLIF(trim(p_student->>'degree'), ''),
    NULLIF(trim(p_student->>'department'), ''),
    NULLIF(trim(p_student->>'class_semester'), ''),
    NULLIF(trim(p_student->>'academic_session'), ''),
    NULLIF(trim(p_student->>'roll_number'), ''),
    NULLIF(trim(p_student->>'emergency_name'), ''),
    NULLIF(trim(p_student->>'emergency_contact'), ''),
    NULLIF(trim(p_student->>'emergency_relation'), ''),
    COALESCE(NULLIF(trim(p_student->>'status'), ''), 'Active'),
    NULLIF(trim(p_student->>'cybercafe_shop_name'), ''),
    NULLIF(trim(p_student->>'cybercafe_email'), ''),
    NULLIF(trim(p_student->>'referral_code'), ''),
    NULLIF(trim(p_student->>'registration_id'), ''),
    v_meta
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    registration_id = COALESCE(EXCLUDED.registration_id, public.students.registration_id),
    gender = EXCLUDED.gender,
    parent_name = EXCLUDED.parent_name,
    contact_number = EXCLUDED.contact_number,
    university_name = EXCLUDED.university_name,
    college_name = EXCLUDED.college_name,
    course = EXCLUDED.course,
    internship_domain = EXCLUDED.internship_domain,
    degree = EXCLUDED.degree,
    department = EXCLUDED.department,
    class_semester = EXCLUDED.class_semester,
    academic_session = EXCLUDED.academic_session,
    roll_number = EXCLUDED.roll_number,
    emergency_name = EXCLUDED.emergency_name,
    emergency_contact = EXCLUDED.emergency_contact,
    emergency_relation = EXCLUDED.emergency_relation,
    status = EXCLUDED.status,
    cybercafe_shop_name = EXCLUDED.cybercafe_shop_name,
    cybercafe_email = EXCLUDED.cybercafe_email,
    referral_code = EXCLUDED.referral_code,
    metadata = EXCLUDED.metadata;

  IF p_profile IS NOT NULL AND p_profile <> '{}'::jsonb THEN
    INSERT INTO public.profiles (
      id,
      full_name,
      email,
      contact_number,
      gender,
      parent_name
    )
    VALUES (
      COALESCE(NULLIF(trim(p_profile->>'id'), '')::uuid, v_id),
      COALESCE(NULLIF(trim(p_profile->>'full_name'), ''), 'Student'),
      lower(trim(COALESCE(p_profile->>'email', p_student->>'email'))),
      COALESCE(NULLIF(trim(p_profile->>'contact_number'), ''), ''),
      COALESCE(NULLIF(trim(p_profile->>'gender'), ''), ''),
      COALESCE(NULLIF(trim(p_profile->>'parent_name'), ''), '')
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      contact_number = EXCLUDED.contact_number,
      gender = EXCLUDED.gender,
      parent_name = EXCLUDED.parent_name;
  END IF;

  SELECT registration_id INTO v_reg FROM public.students WHERE id = v_id;
  RETURN v_reg;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_student_directory_row(p_row jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.complete_student_registration(p_row, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_student_registration(jsonb, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_student_directory_row(jsonb) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260530170000_public_payment_config_view.sql
-- --------------------------------------------------------
-- Registration checkout: anon-readable payment settings (no secret column).

DROP VIEW IF EXISTS public.public_payment_config;

CREATE VIEW public.public_payment_config AS
SELECT
  razorpay_key_id,
  amount_paise,
  COALESCE(currency, 'INR') AS currency,
  is_active
FROM public.payment_config
WHERE id = 1;

GRANT SELECT ON public.public_payment_config TO anon, authenticated;

ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active config" ON public.payment_config;
DROP POLICY IF EXISTS "anon_read_payment_config" ON public.payment_config;
DROP POLICY IF EXISTS "Public read payment config for checkout" ON public.payment_config;

CREATE POLICY "anon_read_payment_config"
  ON public.payment_config
  FOR SELECT
  TO anon, authenticated
  USING (id = 1);

GRANT SELECT ON public.payment_config TO anon;

CREATE OR REPLACE FUNCTION public.get_public_payment_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'razorpay_key_id', razorpay_key_id,
    'amount_paise', amount_paise,
    'is_active', COALESCE(is_active, true),
    'currency', COALESCE(currency, 'INR')
  )
  FROM public.payment_config
  WHERE id = 1
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_payment_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_payment_config() TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260531120000_registration_simple_password.sql
-- --------------------------------------------------------
-- Let students choose simple passwords (e.g. 12345) at registration without Supabase Auth strength API.
-- Browser signUp uses a temporary strong password; this RPC sets the real password in auth.users.

CREATE OR REPLACE FUNCTION public.apply_student_registration_password(
  p_user_id uuid,
  p_email text,
  p_plain text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_plain text := trim(p_plain);
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id required';
  END IF;
  IF v_plain IS NULL OR length(v_plain) < 5 THEN
    RAISE EXCEPTION 'Password must be at least 5 characters';
  END IF;

  PERFORM public.assert_can_write_student_directory(p_user_id, p_email);

  PERFORM public.assert_can_write_student_directory(p_user_id, p_email);

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(v_plain::text, extensions.gen_salt('bf'::text)),
    updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.students
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('password', v_plain)
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_student_registration_password(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_student_registration_password(uuid, text, text) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260531130000_fix_referral_admin_search.sql
-- --------------------------------------------------------
-- Fix referral admin / promoter student search by phone (digits only, ignores spaces/+91).

CREATE OR REPLACE FUNCTION public.referral_text_matches_search(p_haystack text, p_search text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_search IS NULL
    OR trim(p_search) = ''
    OR lower(coalesce(p_haystack, '')) LIKE '%' || lower(trim(p_search)) || '%'
    OR (
      length(regexp_replace(trim(p_search), '[^0-9]', '', 'g')) >= 3
      AND regexp_replace(coalesce(p_haystack, ''), '[^0-9]', '', 'g')
        LIKE '%' || regexp_replace(trim(p_search), '[^0-9]', '', 'g') || '%'
    );
$$;

CREATE OR REPLACE FUNCTION public.referral_partner_list_students(
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_limit int;
  v_offset int;
  v_search text;
  v_total bigint;
  v_rows json;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated', 'rows', '[]'::json, 'total', 0);
  END IF;

  SELECT rp.referral_code INTO v_code
  FROM public.referral_partners rp
  WHERE rp.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_code IS NULL THEN
    RETURN json_build_object('error', 'no_partner', 'rows', '[]'::json, 'total', 0);
  END IF;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset := greatest(coalesce(p_offset, 0), 0);
  v_search := nullif(trim(coalesce(p_search, '')), '');

  SELECT count(*)::bigint INTO v_total
  FROM public.students s
  WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code))
    AND (
      v_search IS NULL
      OR public.referral_text_matches_search(s.full_name, v_search)
      OR public.referral_text_matches_search(s.email, v_search)
      OR public.referral_text_matches_search(s.contact_number, v_search)
      OR public.referral_text_matches_search(s.college_name, v_search)
      OR public.referral_text_matches_search(s.university_name, v_search)
      OR public.referral_text_matches_search(s.registration_id, v_search)
    );

  SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) INTO v_rows
  FROM (
    SELECT
      s.id,
      s.full_name,
      s.email,
      s.contact_number,
      s.college_name,
      s.university_name,
      s.course,
      s.degree,
      s.department,
      s.gender,
      s.class_semester,
      s.academic_session,
      s.roll_number,
      s.parent_name,
      s.registration_id,
      s.internship_domain,
      s.emergency_name,
      s.emergency_contact,
      s.emergency_relation,
      s.status,
      s.created_at,
      s.referral_code
    FROM public.students s
    WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code))
      AND (
        v_search IS NULL
        OR public.referral_text_matches_search(s.full_name, v_search)
        OR public.referral_text_matches_search(s.email, v_search)
        OR public.referral_text_matches_search(s.contact_number, v_search)
        OR public.referral_text_matches_search(s.college_name, v_search)
        OR public.referral_text_matches_search(s.university_name, v_search)
        OR public.referral_text_matches_search(s.registration_id, v_search)
      )
    ORDER BY s.created_at DESC NULLS LAST
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN json_build_object(
    'rows', coalesce(v_rows, '[]'::json),
    'total', coalesce(v_total, 0),
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_referral_partner_students(
  p_partner_id uuid,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_code text;
  v_limit int;
  v_offset int;
  v_search text;
  v_total bigint;
  v_rows json;
BEGIN
  v_ok := public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role);
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT rp.referral_code INTO v_code
  FROM public.referral_partners rp
  WHERE rp.id = p_partner_id;

  IF v_code IS NULL THEN
    RETURN json_build_object('error', 'partner_not_found', 'rows', '[]'::json, 'total', 0);
  END IF;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset := greatest(coalesce(p_offset, 0), 0);
  v_search := nullif(trim(coalesce(p_search, '')), '');

  SELECT count(*)::bigint INTO v_total
  FROM public.students s
  WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code))
    AND (
      v_search IS NULL
      OR public.referral_text_matches_search(s.full_name, v_search)
      OR public.referral_text_matches_search(s.email, v_search)
      OR public.referral_text_matches_search(s.contact_number, v_search)
      OR public.referral_text_matches_search(s.college_name, v_search)
    );

  SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) INTO v_rows
  FROM (
    SELECT
      s.id,
      s.full_name,
      s.email,
      s.contact_number,
      s.college_name,
      s.university_name,
      s.course,
      s.status,
      s.registration_id,
      s.created_at
    FROM public.students s
    WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code))
      AND (
        v_search IS NULL
        OR public.referral_text_matches_search(s.full_name, v_search)
        OR public.referral_text_matches_search(s.email, v_search)
        OR public.referral_text_matches_search(s.contact_number, v_search)
        OR public.referral_text_matches_search(s.college_name, v_search)
      )
    ORDER BY s.created_at DESC NULLS LAST
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN json_build_object(
    'rows', coalesce(v_rows, '[]'::json),
    'total', coalesce(v_total, 0),
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.referral_text_matches_search(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_text_matches_search(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.referral_partner_list_students(int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_partner_list_students(int, int, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_referral_partner_students(uuid, int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_referral_partner_students(uuid, int, int, text) TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260601120000_security_rpc_registration_fees_payment.sql
-- --------------------------------------------------------
-- Security RPCs: run in Supabase SQL Editor BEFORE hotfix_security_lockdown_after_frontend.sql
-- Frontend uses these instead of reading secrets / grading client-side.

-- ─── Payment config (public vs admin) ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_public_payment_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'razorpay_key_id', razorpay_key_id,
    'amount_paise', amount_paise,
    'is_active', COALESCE(is_active, true),
    'currency', COALESCE(currency, 'INR')
  )
  FROM public.payment_config
  WHERE id = 1
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.assert_payment_config_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_payment_config()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.payment_config%ROWTYPE;
BEGIN
  PERFORM public.assert_payment_config_admin();
  SELECT * INTO v_row FROM public.payment_config WHERE id = 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'id', v_row.id,
    'razorpay_key_id', v_row.razorpay_key_id,
    'razorpay_key_secret', v_row.razorpay_key_secret,
    'razorpay_webhook_secret', v_row.razorpay_webhook_secret,
    'amount_paise', v_row.amount_paise,
    'is_active', v_row.is_active,
    'currency', COALESCE(v_row.currency, 'INR'),
    'updated_at', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_payment_config(p_config jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_payment_config_admin();
  INSERT INTO public.payment_config (
    id,
    razorpay_key_id,
    razorpay_key_secret,
    razorpay_webhook_secret,
    amount_paise,
    is_active,
    currency,
    updated_at
  )
  VALUES (
    1,
    NULLIF(trim(p_config->>'razorpay_key_id'), ''),
    NULLIF(trim(p_config->>'razorpay_key_secret'), ''),
    NULLIF(trim(p_config->>'razorpay_webhook_secret'), ''),
    COALESCE((p_config->>'amount_paise')::bigint, 9900),
    COALESCE((p_config->>'is_active')::boolean, true),
    COALESCE(NULLIF(trim(p_config->>'currency'), ''), 'INR'),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    razorpay_key_id = EXCLUDED.razorpay_key_id,
    razorpay_key_secret = EXCLUDED.razorpay_key_secret,
    razorpay_webhook_secret = EXCLUDED.razorpay_webhook_secret,
    amount_paise = EXCLUDED.amount_paise,
    is_active = EXCLUDED.is_active,
    currency = EXCLUDED.currency,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_payment_config() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_save_payment_config(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_payment_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_payment_config(jsonb) TO authenticated;

-- ─── Registration fee catalog (anon + authenticated) ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_registration_universities()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'name', u.name,
        'pisa_fee', u.pisa_fee
      )
      ORDER BY u.name
    ),
    '[]'::jsonb
  )
  FROM public.universities u;
$$;

CREATE OR REPLACE FUNCTION public.get_registration_colleges(p_university_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'university_id', c.university_id,
        'pisa_fee', c.pisa_fee,
        'fee_base_paise', c.fee_base_paise,
        'fee_processing_paise', c.fee_processing_paise,
        'show_fee_breakdown', c.show_fee_breakdown,
        'fees_managed', c.fees_managed
      )
      ORDER BY c.name
    ),
    '[]'::jsonb
  )
  FROM public.colleges c
  WHERE c.university_id = p_university_id;
$$;

CREATE OR REPLACE FUNCTION public.list_public_universities()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name) ORDER BY u.name),
    '[]'::jsonb
  )
  FROM public.universities u;
$$;

CREATE OR REPLACE FUNCTION public.list_public_colleges(p_university_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'university_id', c.university_id
      )
      ORDER BY c.name
    ),
    '[]'::jsonb
  )
  FROM public.colleges c
  WHERE p_university_id IS NULL OR c.university_id = p_university_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_payment_config() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_registration_universities() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_registration_colleges(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_universities() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_colleges(uuid) TO anon, authenticated;

-- ─── Assignments: server grading, hide answer keys ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_assignment_take_payload(p_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assgn public.assignments%ROWTYPE;
  v_questions jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  SELECT * INTO v_assgn
  FROM public.assignments
  WHERE id = p_assignment_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found or inactive';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'assignment_id', q.assignment_id,
        'question_text', q.question_text,
        'options', q.options,
        'marks', q.marks,
        'order_index', q.order_index
      )
      ORDER BY q.order_index
    ),
    '[]'::jsonb
  )
  INTO v_questions
  FROM public.assignment_questions q
  WHERE q.assignment_id = p_assignment_id;

  RETURN jsonb_build_object(
    'assignment', jsonb_build_object(
      'id', v_assgn.id,
      'title', v_assgn.title,
      'description', v_assgn.description,
      'duration_minutes', v_assgn.duration_minutes,
      'total_marks', v_assgn.total_marks,
      'passing_marks', v_assgn.passing_marks,
      'is_active', v_assgn.is_active
    ),
    'questions', v_questions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_assignment_graded(
  p_assignment_id uuid,
  p_answers jsonb,
  p_warnings_received integer DEFAULT 0,
  p_cheating_detected boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_assgn public.assignments%ROWTYPE;
  v_score integer := 0;
  v_passing integer;
  v_is_passed boolean;
  v_q record;
  v_selected integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.assignment_submissions s
    WHERE s.assignment_id = p_assignment_id AND s.student_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Assignment already submitted';
  END IF;

  SELECT * INTO v_assgn
  FROM public.assignments
  WHERE id = p_assignment_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found or inactive';
  END IF;

  v_passing := COALESCE(v_assgn.passing_marks, 0);

  FOR v_q IN
    SELECT id, correct_option_index, marks
    FROM public.assignment_questions
    WHERE assignment_id = p_assignment_id
  LOOP
    BEGIN
      v_selected := (p_answers->>v_q.id::text)::integer;
    EXCEPTION WHEN OTHERS THEN
      v_selected := NULL;
    END;
    IF v_selected IS NOT NULL AND v_selected = v_q.correct_option_index THEN
      v_score := v_score + COALESCE(v_q.marks, 0);
    END IF;
  END LOOP;

  v_is_passed := v_score >= v_passing;

  INSERT INTO public.assignment_submissions (
    assignment_id,
    student_id,
    answers,
    score,
    is_passed,
    warnings_received,
    cheating_detected
  )
  VALUES (
    p_assignment_id,
    v_uid,
    p_answers,
    v_score,
    v_is_passed,
    GREATEST(0, COALESCE(p_warnings_received, 0)),
    COALESCE(p_cheating_detected, false)
  );

  RETURN jsonb_build_object(
    'score', v_score,
    'is_passed', v_is_passed,
    'total_marks', v_assgn.total_marks
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_assignment_take_payload(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_assignment_graded(uuid, jsonb, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_assignment_take_payload(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_assignment_graded(uuid, jsonb, integer, boolean) TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260601130000_student_attendance_rls.sql
-- --------------------------------------------------------
-- Students can view and mark their own attendance (hold-to-mark on dashboard).

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students view own attendance" ON public.attendance;
CREATE POLICY "Students view own attendance"
  ON public.attendance
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students insert own attendance" ON public.attendance;
CREATE POLICY "Students insert own attendance"
  ON public.attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

GRANT SELECT, INSERT ON public.attendance TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260601140000_fix_student_auth_login.sql
-- --------------------------------------------------------
-- Reliable student login: confirm email, ensure auth.identities, repair auth hash from directory metadata.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.ensure_auth_email_identity(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  IF p_user_id IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = p_user_id AND i.provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      p_user_id::text,
      p_user_id,
      jsonb_build_object(
        'sub', p_user_id::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    );
  END IF;

  UPDATE auth.users
  SET
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._set_auth_user_password_internal(
  p_user_id uuid,
  p_email text,
  p_plain text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_plain text := trim(p_plain);
  v_email text := lower(trim(p_email));
BEGIN
  IF p_user_id IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'User id and email required';
  END IF;
  IF v_plain IS NULL OR length(v_plain) < 5 THEN
    RAISE EXCEPTION 'Password must be at least 5 characters';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(v_plain::text, extensions.gen_salt('bf'::text)),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.ensure_auth_email_identity(p_user_id, v_email);

  UPDATE public.students
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('password', v_plain)
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_student_registration_password(
  p_user_id uuid,
  p_email text,
  p_plain text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
BEGIN
  PERFORM public.assert_can_write_student_directory(p_user_id, p_email);
  PERFORM public._set_auth_user_password_internal(p_user_id, p_email, p_plain);
  RETURN TRUE;
END;
$$;

-- When Auth hash drifted but students.metadata.password matches (welcome email), fix and allow login.
CREATE OR REPLACE FUNCTION public.repair_student_auth_login(
  p_email text,
  p_plain text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_plain text := trim(p_plain);
  v_uid uuid;
  v_meta_pw text;
BEGIN
  IF v_email = '' OR v_plain = '' OR length(v_plain) < 5 THEN
    RETURN FALSE;
  END IF;

  SELECT u.id INTO v_uid
  FROM auth.users u
  WHERE lower(trim(u.email)) = v_email;

  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT NULLIF(trim(s.metadata->>'password'), '') INTO v_meta_pw
  FROM public.students s
  WHERE lower(trim(s.email)) = v_email
    AND NULLIF(trim(s.metadata->>'password'), '') = v_plain
  ORDER BY (s.id = v_uid) DESC, s.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_meta_pw IS NULL THEN
    SELECT NULLIF(trim(po.metadata->>'password'), '') INTO v_meta_pw
    FROM public.payment_orders po
    WHERE lower(trim(COALESCE(po.user_email, po.metadata->>'email', ''))) = v_email
      AND po.status = 'success'
      AND NULLIF(trim(po.metadata->>'password'), '') = v_plain
    ORDER BY po.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_meta_pw IS NULL OR v_meta_pw <> v_plain THEN
    RETURN FALSE;
  END IF;

  PERFORM public._set_auth_user_password_internal(v_uid, v_email, v_plain);
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_auth_email_identity(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._set_auth_user_password_internal(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_student_registration_password(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repair_student_auth_login(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.apply_student_registration_password(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repair_student_auth_login(text, text) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260601140000_staff_user_roles_rls.sql
-- --------------------------------------------------------
-- Restore user_roles SELECT so staff can read own role (fix_staff_rls.sql regression).

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  );


-- --------------------------------------------------------
-- Migration: 20260601150000_admin_payment_success_log.sql
-- --------------------------------------------------------
-- Idempotent payment_success row for registration / verify (shows in admin revenue).

ALTER TABLE public.payment_success ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.payment_success ADD COLUMN IF NOT EXISTS college_name TEXT;
ALTER TABLE public.payment_success ADD COLUMN IF NOT EXISTS cybercafe_shop_name TEXT;
ALTER TABLE public.payment_success ADD COLUMN IF NOT EXISTS cybercafe_email TEXT;

CREATE OR REPLACE FUNCTION public.ensure_payment_success_log(p_row jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_payment_id text := NULLIF(trim(p_row->>'payment_id'), '');
  v_user_id uuid := NULLIF(trim(p_row->>'user_id'), '')::uuid;
  v_email text := lower(trim(COALESCE(p_row->>'email', '')));
  v_amount bigint;
  v_id uuid;
BEGIN
  IF v_payment_id IS NULL OR v_payment_id = '' THEN
    RAISE EXCEPTION 'payment_id required';
  END IF;
  IF v_email = '' THEN
    RAISE EXCEPTION 'email required';
  END IF;

  v_amount := COALESCE((p_row->>'amount_paise')::bigint, 0);
  IF v_amount < 0 THEN
    v_amount := 0;
  END IF;

  SELECT id INTO v_id
  FROM public.payment_success
  WHERE payment_id = v_payment_id
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.payment_success
    SET
      user_id = COALESCE(v_user_id, user_id),
      amount_paise = CASE WHEN v_amount > 0 THEN v_amount ELSE amount_paise END,
      email = v_email,
      full_name = COALESCE(NULLIF(trim(p_row->>'full_name'), ''), full_name),
      college_name = COALESCE(NULLIF(trim(p_row->>'college_name'), ''), college_name),
      status = COALESCE(NULLIF(trim(p_row->>'status'), ''), status, 'success'),
      cybercafe_shop_name = COALESCE(NULLIF(trim(p_row->>'cybercafe_shop_name'), ''), cybercafe_shop_name),
      cybercafe_email = COALESCE(NULLIF(trim(p_row->>'cybercafe_email'), ''), cybercafe_email)
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.payment_success (
    user_id,
    payment_id,
    amount_paise,
    email,
    full_name,
    college_name,
    status,
    cybercafe_shop_name,
    cybercafe_email
  )
  VALUES (
    v_user_id,
    v_payment_id,
    v_amount,
    v_email,
    COALESCE(NULLIF(trim(p_row->>'full_name'), ''), 'Student'),
    NULLIF(trim(p_row->>'college_name'), ''),
    COALESCE(NULLIF(trim(p_row->>'status'), ''), 'success'),
    NULLIF(trim(p_row->>'cybercafe_shop_name'), ''),
    NULLIF(trim(p_row->>'cybercafe_email'), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_payment_success_log(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_payment_success_log(jsonb) TO anon, authenticated, service_role;


-- --------------------------------------------------------
-- Migration: 20260601160000_cybercafe_partner_registration.sql
-- --------------------------------------------------------
-- Cyber cafe partner self-registration (see hotfix_cybercafe_partner_registration.sql).

CREATE OR REPLACE FUNCTION public.register_cybercafe_partner(
  p_user_id uuid,
  p_owner_name text,
  p_email text,
  p_phone text,
  p_shop_name text,
  p_location text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id required';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Sign in required to complete partner registration' USING ERRCODE = '42501';
  END IF;
  IF v_email = '' OR trim(p_shop_name) = '' THEN
    RAISE EXCEPTION 'Email and shop name are required';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, contact_number)
  VALUES (
    p_user_id,
    COALESCE(NULLIF(trim(p_owner_name), ''), 'Partner'),
    v_email,
    COALESCE(NULLIF(trim(p_phone), ''), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    email = EXCLUDED.email,
    contact_number = COALESCE(NULLIF(EXCLUDED.contact_number, ''), public.profiles.contact_number);

  INSERT INTO public.cybercafe_profiles (
    id,
    owner_name,
    email,
    phone,
    shop_name,
    location,
    status
  )
  VALUES (
    p_user_id,
    COALESCE(NULLIF(trim(p_owner_name), ''), 'Owner'),
    v_email,
    COALESCE(NULLIF(trim(p_phone), ''), ''),
    trim(p_shop_name),
    COALESCE(NULLIF(trim(p_location), ''), ''),
    'pending_approval'
  )
  ON CONFLICT (id) DO UPDATE SET
    owner_name = EXCLUDED.owner_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    shop_name = EXCLUDED.shop_name,
    location = EXCLUDED.location,
    status = COALESCE(public.cybercafe_profiles.status, 'pending_approval');

  RETURN jsonb_build_object('ok', true, 'id', p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.register_cybercafe_partner(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_cybercafe_partner(uuid, text, text, text, text, text) TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260601170000_complete_student_registration_preserve_fields.sql
-- --------------------------------------------------------
-- Preserve existing student columns on upsert; merge metadata (fixes empty dashboard after payment).
-- Same as supabase/hotfix_complete_student_registration_merge_metadata.sql

CREATE OR REPLACE FUNCTION public.complete_student_registration(
  p_student jsonb,
  p_profile jsonb DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id uuid := NULLIF(trim(p_student->>'id'), '')::uuid;
  v_email text := trim(p_student->>'email');
  v_reg text;
  v_meta jsonb := COALESCE(p_student->'metadata', '{}'::jsonb);
BEGIN
  PERFORM public.assert_can_write_student_directory(v_id, v_email);

  INSERT INTO public.students (
    id,
    email,
    full_name,
    gender,
    parent_name,
    contact_number,
    university_name,
    college_name,
    course,
    internship_domain,
    degree,
    department,
    class_semester,
    academic_session,
    roll_number,
    emergency_name,
    emergency_contact,
    emergency_relation,
    status,
    cybercafe_shop_name,
    cybercafe_email,
    referral_code,
    registration_id,
    metadata
  )
  VALUES (
    v_id,
    lower(trim(p_student->>'email')),
    NULLIF(trim(p_student->>'full_name'), ''),
    NULLIF(trim(p_student->>'gender'), ''),
    NULLIF(trim(p_student->>'parent_name'), ''),
    NULLIF(trim(p_student->>'contact_number'), ''),
    NULLIF(trim(p_student->>'university_name'), ''),
    NULLIF(trim(p_student->>'college_name'), ''),
    NULLIF(trim(p_student->>'course'), ''),
    NULLIF(trim(COALESCE(p_student->>'internship_domain', p_student->>'course')), ''),
    NULLIF(trim(p_student->>'degree'), ''),
    NULLIF(trim(p_student->>'department'), ''),
    NULLIF(trim(p_student->>'class_semester'), ''),
    NULLIF(trim(p_student->>'academic_session'), ''),
    NULLIF(trim(p_student->>'roll_number'), ''),
    NULLIF(trim(p_student->>'emergency_name'), ''),
    NULLIF(trim(p_student->>'emergency_contact'), ''),
    NULLIF(trim(p_student->>'emergency_relation'), ''),
    COALESCE(NULLIF(trim(p_student->>'status'), ''), 'Active'),
    NULLIF(trim(p_student->>'cybercafe_shop_name'), ''),
    NULLIF(trim(p_student->>'cybercafe_email'), ''),
    NULLIF(trim(p_student->>'referral_code'), ''),
    NULLIF(trim(p_student->>'registration_id'), ''),
    v_meta
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.students.full_name),
    registration_id = COALESCE(EXCLUDED.registration_id, public.students.registration_id),
    gender = COALESCE(NULLIF(EXCLUDED.gender, ''), public.students.gender),
    parent_name = COALESCE(NULLIF(EXCLUDED.parent_name, ''), public.students.parent_name),
    contact_number = COALESCE(NULLIF(EXCLUDED.contact_number, ''), public.students.contact_number),
    university_name = COALESCE(NULLIF(EXCLUDED.university_name, ''), public.students.university_name),
    college_name = COALESCE(NULLIF(EXCLUDED.college_name, ''), public.students.college_name),
    course = COALESCE(NULLIF(EXCLUDED.course, ''), public.students.course),
    internship_domain = COALESCE(NULLIF(EXCLUDED.internship_domain, ''), public.students.internship_domain),
    degree = COALESCE(NULLIF(EXCLUDED.degree, ''), public.students.degree),
    department = COALESCE(NULLIF(EXCLUDED.department, ''), public.students.department),
    class_semester = COALESCE(NULLIF(EXCLUDED.class_semester, ''), public.students.class_semester),
    academic_session = COALESCE(NULLIF(EXCLUDED.academic_session, ''), public.students.academic_session),
    roll_number = COALESCE(NULLIF(EXCLUDED.roll_number, ''), public.students.roll_number),
    emergency_name = COALESCE(NULLIF(EXCLUDED.emergency_name, ''), public.students.emergency_name),
    emergency_contact = COALESCE(NULLIF(EXCLUDED.emergency_contact, ''), public.students.emergency_contact),
    emergency_relation = COALESCE(NULLIF(EXCLUDED.emergency_relation, ''), public.students.emergency_relation),
    status = COALESCE(NULLIF(EXCLUDED.status, ''), public.students.status),
    cybercafe_shop_name = COALESCE(EXCLUDED.cybercafe_shop_name, public.students.cybercafe_shop_name),
    cybercafe_email = COALESCE(EXCLUDED.cybercafe_email, public.students.cybercafe_email),
    referral_code = COALESCE(EXCLUDED.referral_code, public.students.referral_code),
    metadata = COALESCE(public.students.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb);

  IF p_profile IS NOT NULL AND p_profile <> '{}'::jsonb THEN
    INSERT INTO public.profiles (
      id,
      full_name,
      email,
      contact_number,
      gender,
      parent_name
    )
    VALUES (
      COALESCE(NULLIF(trim(p_profile->>'id'), '')::uuid, v_id),
      COALESCE(NULLIF(trim(p_profile->>'full_name'), ''), 'Student'),
      lower(trim(COALESCE(p_profile->>'email', p_student->>'email'))),
      COALESCE(NULLIF(trim(p_profile->>'contact_number'), ''), ''),
      COALESCE(NULLIF(trim(p_profile->>'gender'), ''), ''),
      COALESCE(NULLIF(trim(p_profile->>'parent_name'), ''), '')
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
      email = EXCLUDED.email,
      contact_number = COALESCE(NULLIF(EXCLUDED.contact_number, ''), public.profiles.contact_number),
      gender = COALESCE(NULLIF(EXCLUDED.gender, ''), public.profiles.gender),
      parent_name = COALESCE(NULLIF(EXCLUDED.parent_name, ''), public.profiles.parent_name);
  END IF;

  SELECT registration_id INTO v_reg FROM public.students WHERE id = v_id;
  RETURN v_reg;
END;
$$;


-- --------------------------------------------------------
-- Migration: 20260601180000_complete_student_registration_safe_reg_id.sql
-- --------------------------------------------------------
-- Safe registration_id on complete_student_registration (fixes PostgREST 409 after payment).

CREATE OR REPLACE FUNCTION public.allocate_next_registration_id(p_year integer DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer := COALESCE(p_year, extract(year FROM now())::integer);
  v_next integer;
BEGIN
  SELECT COALESCE(
    MAX(
      CASE
        WHEN registration_id ~ ('^EZY/' || v_year::text || '/INT/[0-9]+$')
        THEN NULLIF(split_part(registration_id, '/', 4), '')::integer
        ELSE NULL
      END
    ),
    10000
  ) + 1
  INTO v_next
  FROM public.students;

  RETURN format('EZY/%s/INT/%s', v_year, v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_next_registration_id(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_next_registration_id(integer) TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.complete_student_registration(
  p_student jsonb,
  p_profile jsonb DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id uuid := NULLIF(trim(p_student->>'id'), '')::uuid;
  v_email text := lower(trim(p_student->>'email'));
  v_reg text;
  v_requested_reg text := NULLIF(trim(p_student->>'registration_id'), '');
  v_meta jsonb := COALESCE(p_student->'metadata', '{}'::jsonb) - 'registration_id';
  v_legacy public.students%ROWTYPE;
  v_year integer := extract(year FROM now())::integer;
BEGIN
  PERFORM public.assert_can_write_student_directory(v_id, v_email);

  SELECT NULLIF(trim(s.registration_id), '')
  INTO v_reg
  FROM public.students s
  WHERE s.id = v_id;

  IF v_reg IS NULL THEN
    IF v_requested_reg IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.registration_id = v_requested_reg AND s.id <> v_id
      ) THEN
      v_reg := v_requested_reg;
    ELSE
      SELECT s.*
      INTO v_legacy
      FROM public.students s
      WHERE lower(trim(s.email)) = v_email
        AND s.id <> v_id
      ORDER BY s.created_at DESC
      LIMIT 1;

      IF FOUND
        AND NULLIF(trim(v_legacy.registration_id), '') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.registration_id = trim(v_legacy.registration_id)
            AND s.id <> v_id
        ) THEN
        v_reg := trim(v_legacy.registration_id);
      ELSE
        v_reg := public.allocate_next_registration_id(v_year);
        WHILE EXISTS (
          SELECT 1 FROM public.students s WHERE s.registration_id = v_reg AND s.id <> v_id
        ) LOOP
          v_reg := public.allocate_next_registration_id(v_year);
        END LOOP;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.students (
    id,
    email,
    full_name,
    gender,
    parent_name,
    contact_number,
    university_name,
    college_name,
    course,
    internship_domain,
    degree,
    department,
    class_semester,
    academic_session,
    roll_number,
    emergency_name,
    emergency_contact,
    emergency_relation,
    status,
    cybercafe_shop_name,
    cybercafe_email,
    referral_code,
    registration_id,
    metadata
  )
  VALUES (
    v_id,
    v_email,
    NULLIF(trim(p_student->>'full_name'), ''),
    NULLIF(trim(p_student->>'gender'), ''),
    NULLIF(trim(p_student->>'parent_name'), ''),
    NULLIF(trim(p_student->>'contact_number'), ''),
    NULLIF(trim(p_student->>'university_name'), ''),
    NULLIF(trim(p_student->>'college_name'), ''),
    NULLIF(trim(p_student->>'course'), ''),
    NULLIF(trim(COALESCE(p_student->>'internship_domain', p_student->>'course')), ''),
    NULLIF(trim(p_student->>'degree'), ''),
    NULLIF(trim(p_student->>'department'), ''),
    NULLIF(trim(p_student->>'class_semester'), ''),
    NULLIF(trim(p_student->>'academic_session'), ''),
    NULLIF(trim(p_student->>'roll_number'), ''),
    NULLIF(trim(p_student->>'emergency_name'), ''),
    NULLIF(trim(p_student->>'emergency_contact'), ''),
    NULLIF(trim(p_student->>'emergency_relation'), ''),
    COALESCE(NULLIF(trim(p_student->>'status'), ''), 'Active'),
    NULLIF(trim(p_student->>'cybercafe_shop_name'), ''),
    NULLIF(trim(p_student->>'cybercafe_email'), ''),
    NULLIF(trim(p_student->>'referral_code'), ''),
    v_reg,
    v_meta
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.students.full_name),
    gender = COALESCE(NULLIF(EXCLUDED.gender, ''), public.students.gender),
    parent_name = COALESCE(NULLIF(EXCLUDED.parent_name, ''), public.students.parent_name),
    contact_number = COALESCE(NULLIF(EXCLUDED.contact_number, ''), public.students.contact_number),
    university_name = COALESCE(NULLIF(EXCLUDED.university_name, ''), public.students.university_name),
    college_name = COALESCE(NULLIF(EXCLUDED.college_name, ''), public.students.college_name),
    course = COALESCE(NULLIF(EXCLUDED.course, ''), public.students.course),
    internship_domain = COALESCE(NULLIF(EXCLUDED.internship_domain, ''), public.students.internship_domain),
    degree = COALESCE(NULLIF(EXCLUDED.degree, ''), public.students.degree),
    department = COALESCE(NULLIF(EXCLUDED.department, ''), public.students.department),
    class_semester = COALESCE(NULLIF(EXCLUDED.class_semester, ''), public.students.class_semester),
    academic_session = COALESCE(NULLIF(EXCLUDED.academic_session, ''), public.students.academic_session),
    roll_number = COALESCE(NULLIF(EXCLUDED.roll_number, ''), public.students.roll_number),
    emergency_name = COALESCE(NULLIF(EXCLUDED.emergency_name, ''), public.students.emergency_name),
    emergency_contact = COALESCE(NULLIF(EXCLUDED.emergency_contact, ''), public.students.emergency_contact),
    emergency_relation = COALESCE(NULLIF(EXCLUDED.emergency_relation, ''), public.students.emergency_relation),
    status = COALESCE(NULLIF(EXCLUDED.status, ''), public.students.status),
    cybercafe_shop_name = COALESCE(EXCLUDED.cybercafe_shop_name, public.students.cybercafe_shop_name),
    cybercafe_email = COALESCE(EXCLUDED.cybercafe_email, public.students.cybercafe_email),
    referral_code = COALESCE(EXCLUDED.referral_code, public.students.referral_code),
    registration_id = COALESCE(public.students.registration_id, EXCLUDED.registration_id),
    metadata = COALESCE(public.students.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb);

  IF p_profile IS NOT NULL AND p_profile <> '{}'::jsonb THEN
    INSERT INTO public.profiles (
      id,
      full_name,
      email,
      contact_number,
      gender,
      parent_name
    )
    VALUES (
      COALESCE(NULLIF(trim(p_profile->>'id'), '')::uuid, v_id),
      COALESCE(NULLIF(trim(p_profile->>'full_name'), ''), 'Student'),
      lower(trim(COALESCE(p_profile->>'email', p_student->>'email'))),
      COALESCE(NULLIF(trim(p_profile->>'contact_number'), ''), ''),
      COALESCE(NULLIF(trim(p_profile->>'gender'), ''), ''),
      COALESCE(NULLIF(trim(p_profile->>'parent_name'), ''), '')
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
      email = EXCLUDED.email,
      contact_number = COALESCE(NULLIF(EXCLUDED.contact_number, ''), public.profiles.contact_number),
      gender = COALESCE(NULLIF(EXCLUDED.gender, ''), public.profiles.gender),
      parent_name = COALESCE(NULLIF(EXCLUDED.parent_name, ''), public.profiles.parent_name);
  END IF;

  SELECT registration_id INTO v_reg FROM public.students WHERE id = v_id;
  RETURN v_reg;
EXCEPTION
  WHEN unique_violation THEN
    IF SQLERRM LIKE '%students_registration_id_key%' THEN
      UPDATE public.students
      SET
        email = v_email,
        full_name = COALESCE(NULLIF(trim(p_student->>'full_name'), ''), full_name),
        gender = COALESCE(NULLIF(trim(p_student->>'gender'), ''), gender),
        parent_name = COALESCE(NULLIF(trim(p_student->>'parent_name'), ''), parent_name),
        contact_number = COALESCE(NULLIF(trim(p_student->>'contact_number'), ''), contact_number),
        university_name = COALESCE(NULLIF(trim(p_student->>'university_name'), ''), university_name),
        college_name = COALESCE(NULLIF(trim(p_student->>'college_name'), ''), college_name),
        course = COALESCE(NULLIF(trim(p_student->>'course'), ''), course),
        internship_domain = COALESCE(
          NULLIF(trim(COALESCE(p_student->>'internship_domain', p_student->>'course')), ''),
          internship_domain
        ),
        degree = COALESCE(NULLIF(trim(p_student->>'degree'), ''), degree),
        department = COALESCE(NULLIF(trim(p_student->>'department'), ''), department),
        class_semester = COALESCE(NULLIF(trim(p_student->>'class_semester'), ''), class_semester),
        academic_session = COALESCE(NULLIF(trim(p_student->>'academic_session'), ''), academic_session),
        roll_number = COALESCE(NULLIF(trim(p_student->>'roll_number'), ''), roll_number),
        emergency_name = COALESCE(NULLIF(trim(p_student->>'emergency_name'), ''), emergency_name),
        emergency_contact = COALESCE(NULLIF(trim(p_student->>'emergency_contact'), ''), emergency_contact),
        emergency_relation = COALESCE(NULLIF(trim(p_student->>'emergency_relation'), ''), emergency_relation),
        status = COALESCE(NULLIF(trim(p_student->>'status'), ''), status, 'Active'),
        cybercafe_shop_name = COALESCE(
          NULLIF(trim(p_student->>'cybercafe_shop_name'), ''),
          cybercafe_shop_name
        ),
        cybercafe_email = COALESCE(NULLIF(trim(p_student->>'cybercafe_email'), ''), cybercafe_email),
        referral_code = COALESCE(NULLIF(trim(p_student->>'referral_code'), ''), referral_code),
        metadata = COALESCE(metadata, '{}'::jsonb) || v_meta
      WHERE id = v_id;

      SELECT registration_id INTO v_reg FROM public.students WHERE id = v_id;
      RETURN v_reg;
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_student_registration(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_student_registration(jsonb, jsonb) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260601180000_student_paid_enrollment_check.sql
-- --------------------------------------------------------
-- Paid students: link payment_success to auth user + reliable enrollment check (fixes login → dashboard bounce).

-- Backfill user_id on payment rows logged by email only
UPDATE public.payment_success ps
SET user_id = u.id
FROM auth.users u
WHERE ps.user_id IS NULL
  AND lower(trim(ps.email)) = lower(trim(u.email));

-- Resolve user_id from email when logging new payments
CREATE OR REPLACE FUNCTION public.ensure_payment_success_log(p_row jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_payment_id text := NULLIF(trim(p_row->>'payment_id'), '');
  v_user_id uuid := NULLIF(trim(p_row->>'user_id'), '')::uuid;
  v_email text := lower(trim(COALESCE(p_row->>'email', '')));
  v_amount bigint;
  v_id uuid;
BEGIN
  IF v_payment_id IS NULL OR v_payment_id = '' THEN
    RAISE EXCEPTION 'payment_id required';
  END IF;
  IF v_email = '' THEN
    RAISE EXCEPTION 'email required';
  END IF;

  IF v_user_id IS NULL THEN
    SELECT u.id INTO v_user_id
    FROM auth.users u
    WHERE lower(trim(u.email)) = v_email
    LIMIT 1;
  END IF;

  v_amount := COALESCE((p_row->>'amount_paise')::bigint, 0);
  IF v_amount < 0 THEN
    v_amount := 0;
  END IF;

  SELECT id INTO v_id
  FROM public.payment_success
  WHERE payment_id = v_payment_id
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.payment_success
    SET
      user_id = COALESCE(v_user_id, user_id),
      amount_paise = CASE WHEN v_amount > 0 THEN v_amount ELSE amount_paise END,
      email = v_email,
      full_name = COALESCE(NULLIF(trim(p_row->>'full_name'), ''), full_name),
      college_name = COALESCE(NULLIF(trim(p_row->>'college_name'), ''), college_name),
      status = COALESCE(NULLIF(trim(p_row->>'status'), ''), status, 'success'),
      cybercafe_shop_name = COALESCE(NULLIF(trim(p_row->>'cybercafe_shop_name'), ''), cybercafe_shop_name),
      cybercafe_email = COALESCE(NULLIF(trim(p_row->>'cybercafe_email'), ''), cybercafe_email)
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.payment_success (
    user_id,
    payment_id,
    amount_paise,
    email,
    full_name,
    college_name,
    status,
    cybercafe_shop_name,
    cybercafe_email
  )
  VALUES (
    v_user_id,
    v_payment_id,
    v_amount,
    v_email,
    COALESCE(NULLIF(trim(p_row->>'full_name'), ''), 'Student'),
    NULLIF(trim(p_row->>'college_name'), ''),
    COALESCE(NULLIF(trim(p_row->>'status'), ''), 'success'),
    NULLIF(trim(p_row->>'cybercafe_shop_name'), ''),
    NULLIF(trim(p_row->>'cybercafe_email'), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_payment_success_log(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_payment_success_log(jsonb) TO anon, authenticated, service_role;

-- Students can read payment rows tied to their account (by user_id or email)
DROP POLICY IF EXISTS "Users can view own payments" ON public.payment_success;
CREATE POLICY "Users can view own payments"
  ON public.payment_success
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      user_id IS NULL
      AND lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
    OR lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );

-- SECURITY DEFINER check used by dashboard gate (same rules as the app)
CREATE OR REPLACE FUNCTION public.student_has_paid_enrollment(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := p_user_id;
  v_email text;
  v_row record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT lower(trim(u.email)) INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid;

  FOR v_row IN
    SELECT ps.payment_id, ps.amount_paise, ps.status
    FROM public.payment_success ps
    WHERE ps.user_id = v_uid
       OR (v_email <> '' AND lower(trim(ps.email)) = v_email)
    ORDER BY ps.created_at DESC
    LIMIT 5
  LOOP
    IF v_row.payment_id IS NULL OR trim(v_row.payment_id) = '' THEN
      CONTINUE;
    END IF;

    IF lower(coalesce(v_row.status, 'success')) NOT IN ('', 'success') THEN
      CONTINUE;
    END IF;

    IF v_row.payment_id ~* '^(pay_admin_|admin_|ADMIN_TRANS_)' THEN
      RETURN TRUE;
    END IF;

    IF v_row.payment_id ~* '^pay_'
       AND coalesce(v_row.amount_paise, 0) >= 100 THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.student_has_paid_enrollment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_has_paid_enrollment(uuid) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260601190000_student_recover_paid_enrollment.sql
-- --------------------------------------------------------
-- Let signed-in students recover dashboard access when Razorpay paid but payment_success was never logged.

CREATE OR REPLACE FUNCTION public.student_recover_paid_enrollment(
  p_payment_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_pay_id text := NULLIF(trim(p_payment_id), '');
  v_amount bigint;
  v_order_email text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT lower(trim(u.email)) INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN FALSE;
  END IF;

  IF public.student_has_paid_enrollment(v_uid) THEN
    RETURN TRUE;
  END IF;

  IF v_pay_id IS NOT NULL THEN
    SELECT po.amount, lower(trim(coalesce(po.user_email, po.metadata->>'email', '')))
    INTO v_amount, v_order_email
    FROM public.payment_orders po
    WHERE po.status = 'success'
      AND (po.payment_id = v_pay_id OR po.order_id = v_pay_id)
    ORDER BY po.created_at DESC
    LIMIT 1;
  ELSE
    SELECT po.payment_id, po.amount, lower(trim(coalesce(po.user_email, po.metadata->>'email', '')))
    INTO v_pay_id, v_amount, v_order_email
    FROM public.payment_orders po
    WHERE po.status = 'success'
      AND (
        lower(trim(coalesce(po.user_email, ''))) = v_email
        OR lower(trim(coalesce(po.metadata->>'email', ''))) = v_email
      )
    ORDER BY po.created_at DESC
    LIMIT 1;
  END IF;

  IF v_pay_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_order_email IS NOT NULL AND v_order_email <> '' AND v_order_email <> v_email THEN
    RETURN FALSE;
  END IF;

  PERFORM public.ensure_payment_success_log(
    jsonb_build_object(
      'user_id', v_uid::text,
      'payment_id', v_pay_id,
      'amount_paise', GREATEST(coalesce(v_amount, 0), 100),
      'email', v_email,
      'full_name', 'Student',
      'status', 'success'
    )
  );

  RETURN public.student_has_paid_enrollment(v_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.student_recover_paid_enrollment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_recover_paid_enrollment(text) TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260601200000_cybercafe_dashboard_access.sql
-- --------------------------------------------------------
-- Cyber cafe dashboard RPCs + RLS (same as hotfix_cybercafe_dashboard_access.sql).

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS cybercafe_shop_name TEXT,
  ADD COLUMN IF NOT EXISTS cybercafe_email TEXT;

ALTER TABLE public.payment_cancelled
  ADD COLUMN IF NOT EXISTS cybercafe_shop_name TEXT,
  ADD COLUMN IF NOT EXISTS cybercafe_email TEXT;

CREATE INDEX IF NOT EXISTS idx_students_cybercafe_email_lower
  ON public.students (lower(trim(cybercafe_email)))
  WHERE cybercafe_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_success_cybercafe_email_lower
  ON public.payment_success (lower(trim(cybercafe_email)))
  WHERE cybercafe_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_cancelled_cybercafe_email_lower
  ON public.payment_cancelled (lower(trim(cybercafe_email)))
  WHERE cybercafe_email IS NOT NULL;

CREATE OR REPLACE FUNCTION public._cybercafe_partner_email(p_uid uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(cp.email))
  FROM public.cybercafe_profiles cp
  WHERE cp.id = p_uid
    AND cp.status = 'approved'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.cybercafe_list_students()
RETURNS SETOF public.students
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.students s
  WHERE public._cybercafe_partner_email() IS NOT NULL
    AND (
      lower(trim(COALESCE(s.cybercafe_email, ''))) = public._cybercafe_partner_email()
      OR lower(trim(COALESCE(s.metadata->>'cybercafe_email', ''))) = public._cybercafe_partner_email()
    )
  ORDER BY s.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.cybercafe_get_student_by_email(p_student_email text)
RETURNS SETOF public.students
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.students s
  WHERE public._cybercafe_partner_email() IS NOT NULL
    AND lower(trim(COALESCE(p_student_email, ''))) <> ''
    AND lower(trim(s.email)) = lower(trim(p_student_email))
    AND (
      lower(trim(COALESCE(s.cybercafe_email, ''))) = public._cybercafe_partner_email()
      OR lower(trim(COALESCE(s.metadata->>'cybercafe_email', ''))) = public._cybercafe_partner_email()
    )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.cybercafe_list_payment_success(p_status text DEFAULT 'success')
RETURNS SETOF public.payment_success
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.*
  FROM public.payment_success ps
  WHERE public._cybercafe_partner_email() IS NOT NULL
    AND lower(trim(COALESCE(ps.cybercafe_email, ''))) = public._cybercafe_partner_email()
    AND (
      p_status IS NULL
      OR trim(p_status) = ''
      OR lower(trim(COALESCE(ps.status, 'success'))) = lower(trim(p_status))
    )
  ORDER BY ps.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.cybercafe_list_payment_cancelled()
RETURNS SETOF public.payment_cancelled
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pc.*
  FROM public.payment_cancelled pc
  WHERE public._cybercafe_partner_email() IS NOT NULL
    AND (
      lower(trim(COALESCE(pc.cybercafe_email, ''))) = public._cybercafe_partner_email()
      OR lower(trim(COALESCE(pc.metadata->>'cybercafe_email', ''))) = public._cybercafe_partner_email()
    )
  ORDER BY pc.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.cybercafe_list_failed_payments()
RETURNS SETOF public.payment_success
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.*
  FROM public.payment_success ps
  WHERE public._cybercafe_partner_email() IS NOT NULL
    AND lower(trim(COALESCE(ps.cybercafe_email, ''))) = public._cybercafe_partner_email()
    AND lower(trim(COALESCE(ps.status, 'success'))) NOT IN ('', 'success')
  ORDER BY ps.created_at DESC;
$$;

DROP POLICY IF EXISTS "Cybercafe partners view their students" ON public.students;
CREATE POLICY "Cybercafe partners view their students"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cybercafe_profiles cp
      WHERE cp.id = auth.uid()
        AND cp.status = 'approved'
        AND (
          lower(trim(cp.email)) = lower(trim(COALESCE(public.students.cybercafe_email, '')))
          OR lower(trim(cp.email)) = lower(trim(COALESCE(public.students.metadata->>'cybercafe_email', '')))
        )
    )
  );

DROP POLICY IF EXISTS "Cybercafe partners view their payment success" ON public.payment_success;
CREATE POLICY "Cybercafe partners view their payment success"
  ON public.payment_success
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cybercafe_profiles cp
      WHERE cp.id = auth.uid()
        AND cp.status = 'approved'
        AND lower(trim(cp.email)) = lower(trim(COALESCE(public.payment_success.cybercafe_email, '')))
    )
  );

DROP POLICY IF EXISTS "Cybercafe partners view their cancelled payments" ON public.payment_cancelled;
CREATE POLICY "Cybercafe partners view their cancelled payments"
  ON public.payment_cancelled
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cybercafe_profiles cp
      WHERE cp.id = auth.uid()
        AND cp.status = 'approved'
        AND (
          lower(trim(cp.email)) = lower(trim(COALESCE(public.payment_cancelled.cybercafe_email, '')))
          OR lower(trim(cp.email)) = lower(trim(COALESCE(public.payment_cancelled.metadata->>'cybercafe_email', '')))
        )
    )
  );

REVOKE ALL ON FUNCTION public._cybercafe_partner_email(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cybercafe_list_students() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cybercafe_get_student_by_email(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cybercafe_list_payment_success(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cybercafe_list_payment_cancelled() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cybercafe_list_failed_payments() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public._cybercafe_partner_email(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cybercafe_list_students() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cybercafe_get_student_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cybercafe_list_payment_success(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cybercafe_list_payment_cancelled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cybercafe_list_failed_payments() TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260601200000_student_update_own_profile.sql
-- --------------------------------------------------------
-- Student dashboard Edit Profile (never changes registration_id on update).

-- Empty registration_id breaks UNIQUE — normalize and dedupe NULL slots.
UPDATE public.students
SET registration_id = NULL
WHERE registration_id IS NOT NULL AND trim(registration_id) = '';

UPDATE public.students s
SET registration_id = 'EZY/PENDING/' || upper(replace(s.id::text, '-', ''))
WHERE s.registration_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.students o
    WHERE o.registration_id IS NULL
      AND o.id <> s.id
  );

CREATE OR REPLACE FUNCTION public.student_update_own_profile(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id uuid := auth.uid();
  v_email text := lower(trim(COALESCE(p_row->>'email', '')));
  v_meta jsonb := COALESCE(p_row->'metadata', '{}'::jsonb) - 'registration_id';
  v_reg text;
  v_legacy public.students%ROWTYPE;
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_email = '' THEN
    SELECT lower(trim(u.email)) INTO v_email
    FROM auth.users u
    WHERE u.id = v_id;
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Student email required';
  END IF;

  SELECT NULLIF(trim(s.registration_id), '')
  INTO v_reg
  FROM public.students s
  WHERE s.id = v_id;

  IF v_reg IS NULL THEN
    v_reg := 'EZY/PENDING/' || upper(replace(v_id::text, '-', ''));
    WHILE EXISTS (
      SELECT 1 FROM public.students s WHERE s.registration_id = v_reg AND s.id <> v_id
    ) LOOP
      v_reg := v_reg || 'X';
    END LOOP;
  END IF;

  IF EXISTS (SELECT 1 FROM public.students s WHERE s.id = v_id) THEN
    UPDATE public.students
    SET
      email = v_email,
      full_name = COALESCE(NULLIF(trim(p_row->>'full_name'), ''), full_name),
      gender = COALESCE(NULLIF(trim(p_row->>'gender'), ''), gender),
      parent_name = COALESCE(NULLIF(trim(p_row->>'parent_name'), ''), parent_name),
      contact_number = COALESCE(NULLIF(trim(p_row->>'contact_number'), ''), contact_number),
      university_name = CASE
        WHEN p_row ? 'university_name' THEN NULLIF(trim(p_row->>'university_name'), '')
        ELSE university_name
      END,
      college_name = CASE
        WHEN p_row ? 'college_name' THEN NULLIF(trim(p_row->>'college_name'), '')
        ELSE college_name
      END,
      degree = CASE WHEN p_row ? 'degree' THEN NULLIF(trim(p_row->>'degree'), '') ELSE degree END,
      department = CASE
        WHEN p_row ? 'department' THEN NULLIF(trim(p_row->>'department'), '')
        ELSE department
      END,
      academic_session = CASE
        WHEN p_row ? 'academic_session' THEN NULLIF(trim(p_row->>'academic_session'), '')
        ELSE academic_session
      END,
      class_semester = CASE
        WHEN p_row ? 'class_semester' THEN NULLIF(trim(p_row->>'class_semester'), '')
        ELSE class_semester
      END,
      roll_number = CASE
        WHEN p_row ? 'roll_number' THEN NULLIF(trim(p_row->>'roll_number'), '')
        ELSE roll_number
      END,
      course = CASE WHEN p_row ? 'course' THEN NULLIF(trim(p_row->>'course'), '') ELSE course END,
      internship_domain = CASE
        WHEN p_row ? 'internship_domain' OR p_row ? 'course' THEN NULLIF(trim(COALESCE(p_row->>'internship_domain', p_row->>'course')), '')
        ELSE internship_domain
      END,
      internship_duration = COALESCE(NULLIF(trim(p_row->>'internship_duration'), ''), internship_duration),
      joining_date = COALESCE(NULLIF(trim(p_row->>'joining_date'), ''), joining_date),
      completion_date = COALESCE(NULLIF(trim(p_row->>'completion_date'), ''), completion_date),
      emergency_name = COALESCE(NULLIF(trim(p_row->>'emergency_name'), ''), emergency_name),
      emergency_contact = COALESCE(NULLIF(trim(p_row->>'emergency_contact'), ''), emergency_contact),
      emergency_relation = COALESCE(NULLIF(trim(p_row->>'emergency_relation'), ''), emergency_relation),
      status = COALESCE(NULLIF(trim(p_row->>'status'), ''), status, 'Active'),
      metadata = COALESCE(metadata, '{}'::jsonb) || v_meta
    WHERE id = v_id;

    RETURN jsonb_build_object('id', v_id::text, 'email', v_email);
  END IF;

  SELECT s.*
  INTO v_legacy
  FROM public.students s
  WHERE lower(trim(s.email)) = v_email
    AND s.id <> v_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF FOUND
    AND NULLIF(trim(v_legacy.registration_id), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.registration_id = trim(v_legacy.registration_id)
        AND s.id <> v_id
    ) THEN
    v_reg := trim(v_legacy.registration_id);
  END IF;

  INSERT INTO public.students (
    id,
    email,
    full_name,
    gender,
    parent_name,
    contact_number,
    university_name,
    college_name,
    degree,
    department,
    academic_session,
    class_semester,
    roll_number,
    course,
    internship_domain,
    internship_duration,
    joining_date,
    completion_date,
    emergency_name,
    emergency_contact,
    emergency_relation,
    status,
    registration_id,
    metadata
  )
  VALUES (
    v_id,
    v_email,
    COALESCE(NULLIF(trim(p_row->>'full_name'), ''), CASE WHEN FOUND THEN v_legacy.full_name END),
    COALESCE(NULLIF(trim(p_row->>'gender'), ''), CASE WHEN FOUND THEN v_legacy.gender END),
    COALESCE(NULLIF(trim(p_row->>'parent_name'), ''), CASE WHEN FOUND THEN v_legacy.parent_name END),
    COALESCE(NULLIF(trim(p_row->>'contact_number'), ''), CASE WHEN FOUND THEN v_legacy.contact_number END),
    COALESCE(NULLIF(trim(p_row->>'university_name'), ''), CASE WHEN FOUND THEN v_legacy.university_name END),
    COALESCE(NULLIF(trim(p_row->>'college_name'), ''), CASE WHEN FOUND THEN v_legacy.college_name END),
    COALESCE(NULLIF(trim(p_row->>'degree'), ''), CASE WHEN FOUND THEN v_legacy.degree END),
    COALESCE(NULLIF(trim(p_row->>'department'), ''), CASE WHEN FOUND THEN v_legacy.department END),
    COALESCE(NULLIF(trim(p_row->>'academic_session'), ''), CASE WHEN FOUND THEN v_legacy.academic_session END),
    COALESCE(NULLIF(trim(p_row->>'class_semester'), ''), CASE WHEN FOUND THEN v_legacy.class_semester END),
    COALESCE(NULLIF(trim(p_row->>'roll_number'), ''), CASE WHEN FOUND THEN v_legacy.roll_number END),
    COALESCE(NULLIF(trim(p_row->>'course'), ''), CASE WHEN FOUND THEN v_legacy.course END),
    COALESCE(
      NULLIF(trim(COALESCE(p_row->>'internship_domain', p_row->>'course')), ''),
      CASE WHEN FOUND THEN v_legacy.internship_domain END
    ),
    COALESCE(NULLIF(trim(p_row->>'internship_duration'), ''), CASE WHEN FOUND THEN v_legacy.internship_duration END),
    COALESCE(NULLIF(trim(p_row->>'joining_date'), ''), CASE WHEN FOUND THEN v_legacy.joining_date END),
    COALESCE(NULLIF(trim(p_row->>'completion_date'), ''), CASE WHEN FOUND THEN v_legacy.completion_date END),
    COALESCE(NULLIF(trim(p_row->>'emergency_name'), ''), CASE WHEN FOUND THEN v_legacy.emergency_name END),
    COALESCE(NULLIF(trim(p_row->>'emergency_contact'), ''), CASE WHEN FOUND THEN v_legacy.emergency_contact END),
    COALESCE(NULLIF(trim(p_row->>'emergency_relation'), ''), CASE WHEN FOUND THEN v_legacy.emergency_relation END),
    COALESCE(NULLIF(trim(p_row->>'status'), ''), CASE WHEN FOUND THEN v_legacy.status END, 'Active'),
    v_reg,
    (CASE WHEN FOUND THEN COALESCE(v_legacy.metadata, '{}'::jsonb) ELSE '{}'::jsonb END) || v_meta
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.students.full_name),
    gender = COALESCE(NULLIF(EXCLUDED.gender, ''), public.students.gender),
    parent_name = COALESCE(NULLIF(EXCLUDED.parent_name, ''), public.students.parent_name),
    contact_number = COALESCE(NULLIF(EXCLUDED.contact_number, ''), public.students.contact_number),
    university_name = CASE
      WHEN p_row ? 'university_name' THEN COALESCE(NULLIF(EXCLUDED.university_name, ''), public.students.university_name)
      ELSE public.students.university_name
    END,
    college_name = CASE
      WHEN p_row ? 'college_name' THEN COALESCE(NULLIF(EXCLUDED.college_name, ''), public.students.college_name)
      ELSE public.students.college_name
    END,
    degree = CASE
      WHEN p_row ? 'degree' THEN COALESCE(NULLIF(EXCLUDED.degree, ''), public.students.degree)
      ELSE public.students.degree
    END,
    department = CASE
      WHEN p_row ? 'department' THEN COALESCE(NULLIF(EXCLUDED.department, ''), public.students.department)
      ELSE public.students.department
    END,
    academic_session = CASE
      WHEN p_row ? 'academic_session' THEN COALESCE(NULLIF(EXCLUDED.academic_session, ''), public.students.academic_session)
      ELSE public.students.academic_session
    END,
    class_semester = CASE
      WHEN p_row ? 'class_semester' THEN COALESCE(NULLIF(EXCLUDED.class_semester, ''), public.students.class_semester)
      ELSE public.students.class_semester
    END,
    roll_number = CASE
      WHEN p_row ? 'roll_number' THEN COALESCE(NULLIF(EXCLUDED.roll_number, ''), public.students.roll_number)
      ELSE public.students.roll_number
    END,
    course = CASE
      WHEN p_row ? 'course' OR p_row ? 'internship_domain' THEN COALESCE(NULLIF(EXCLUDED.course, ''), public.students.course)
      ELSE public.students.course
    END,
    internship_domain = CASE
      WHEN p_row ? 'internship_domain' OR p_row ? 'course' THEN COALESCE(NULLIF(EXCLUDED.internship_domain, ''), public.students.internship_domain)
      ELSE public.students.internship_domain
    END,
    internship_duration = COALESCE(NULLIF(EXCLUDED.internship_duration, ''), public.students.internship_duration),
    joining_date = COALESCE(NULLIF(EXCLUDED.joining_date, ''), public.students.joining_date),
    completion_date = COALESCE(NULLIF(EXCLUDED.completion_date, ''), public.students.completion_date),
    emergency_name = COALESCE(NULLIF(EXCLUDED.emergency_name, ''), public.students.emergency_name),
    emergency_contact = COALESCE(NULLIF(EXCLUDED.emergency_contact, ''), public.students.emergency_contact),
    emergency_relation = COALESCE(NULLIF(EXCLUDED.emergency_relation, ''), public.students.emergency_relation),
    status = COALESCE(NULLIF(EXCLUDED.status, ''), public.students.status, 'Active'),
    metadata = COALESCE(public.students.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb);

  RETURN jsonb_build_object('id', v_id::text, 'email', v_email);
EXCEPTION
  WHEN unique_violation THEN
    IF SQLERRM LIKE '%students_registration_id_key%' THEN
      UPDATE public.students
      SET
        email = v_email,
        full_name = COALESCE(NULLIF(trim(p_row->>'full_name'), ''), full_name),
        gender = COALESCE(NULLIF(trim(p_row->>'gender'), ''), gender),
        parent_name = COALESCE(NULLIF(trim(p_row->>'parent_name'), ''), parent_name),
        contact_number = COALESCE(NULLIF(trim(p_row->>'contact_number'), ''), contact_number),
        university_name = CASE
          WHEN p_row ? 'university_name' THEN NULLIF(trim(p_row->>'university_name'), '')
          ELSE university_name
        END,
        college_name = CASE
          WHEN p_row ? 'college_name' THEN NULLIF(trim(p_row->>'college_name'), '')
          ELSE college_name
        END,
        degree = CASE WHEN p_row ? 'degree' THEN NULLIF(trim(p_row->>'degree'), '') ELSE degree END,
        department = CASE
          WHEN p_row ? 'department' THEN NULLIF(trim(p_row->>'department'), '')
          ELSE department
        END,
        academic_session = CASE
          WHEN p_row ? 'academic_session' THEN NULLIF(trim(p_row->>'academic_session'), '')
          ELSE academic_session
        END,
        class_semester = CASE
          WHEN p_row ? 'class_semester' THEN NULLIF(trim(p_row->>'class_semester'), '')
          ELSE class_semester
        END,
        roll_number = CASE
          WHEN p_row ? 'roll_number' THEN NULLIF(trim(p_row->>'roll_number'), '')
          ELSE roll_number
        END,
        course = CASE WHEN p_row ? 'course' THEN NULLIF(trim(p_row->>'course'), '') ELSE course END,
        internship_domain = CASE
          WHEN p_row ? 'internship_domain' OR p_row ? 'course' THEN NULLIF(trim(COALESCE(p_row->>'internship_domain', p_row->>'course')), '')
          ELSE internship_domain
        END,
        internship_duration = COALESCE(NULLIF(trim(p_row->>'internship_duration'), ''), internship_duration),
        joining_date = COALESCE(NULLIF(trim(p_row->>'joining_date'), ''), joining_date),
        completion_date = COALESCE(NULLIF(trim(p_row->>'completion_date'), ''), completion_date),
        emergency_name = COALESCE(NULLIF(trim(p_row->>'emergency_name'), ''), emergency_name),
        emergency_contact = COALESCE(NULLIF(trim(p_row->>'emergency_contact'), ''), emergency_contact),
        emergency_relation = COALESCE(NULLIF(trim(p_row->>'emergency_relation'), ''), emergency_relation),
        status = COALESCE(NULLIF(trim(p_row->>'status'), ''), status, 'Active'),
        metadata = COALESCE(metadata, '{}'::jsonb) || v_meta
      WHERE id = v_id;

      RETURN jsonb_build_object('id', v_id::text, 'email', v_email);
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.student_update_own_profile(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_update_own_profile(jsonb) TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260601210000_admin_student_directory_performance.sql
-- --------------------------------------------------------
-- Fix student directory timeout (57014): bypass heavy RLS for admin/staff paginated list.

CREATE OR REPLACE FUNCTION public.assert_may_admin_list_students()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.auth_is_referral_partner_scoped_only(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'admin'::public.app_role,
        'super_admin'::public.app_role,
        'staff'::public.app_role
      )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_count_students_directory(
  p_search text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_university text DEFAULT NULL,
  p_college text DEFAULT NULL,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := NULLIF(trim(p_search), '');
BEGIN
  PERFORM public.assert_may_admin_list_students();

  RETURN (
    SELECT count(*)::bigint
    FROM public.students s
    WHERE (
      v_search IS NULL
      OR s.full_name ILIKE '%' || v_search || '%'
      OR s.email ILIKE '%' || v_search || '%'
      OR s.registration_id ILIKE '%' || v_search || '%'
      OR s.contact_number ILIKE '%' || v_search || '%'
      OR s.roll_number ILIKE '%' || v_search || '%'
      OR s.college_name ILIKE '%' || v_search || '%'
      OR s.parent_name ILIKE '%' || v_search || '%'
    )
    AND (p_domain IS NULL OR p_domain = '' OR p_domain = 'all' OR s.internship_domain = p_domain)
    AND (p_university IS NULL OR p_university = '' OR p_university = 'all' OR s.university_name = p_university)
    AND (p_college IS NULL OR p_college = '' OR p_college = 'all' OR s.college_name = p_college)
    AND (p_start IS NULL OR s.created_at >= p_start)
    AND (p_end IS NULL OR s.created_at <= p_end)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_students_directory(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_university text DEFAULT NULL,
  p_college text DEFAULT NULL,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS SETOF public.students
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := NULLIF(trim(p_search), '');
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 500));
  v_offset integer := GREATEST(0, COALESCE(p_offset, 0));
BEGIN
  PERFORM public.assert_may_admin_list_students();

  RETURN QUERY
  SELECT s.*
  FROM public.students s
  WHERE (
    v_search IS NULL
    OR s.full_name ILIKE '%' || v_search || '%'
    OR s.email ILIKE '%' || v_search || '%'
    OR s.registration_id ILIKE '%' || v_search || '%'
    OR s.contact_number ILIKE '%' || v_search || '%'
    OR s.roll_number ILIKE '%' || v_search || '%'
    OR s.college_name ILIKE '%' || v_search || '%'
    OR s.parent_name ILIKE '%' || v_search || '%'
  )
  AND (p_domain IS NULL OR p_domain = '' OR p_domain = 'all' OR s.internship_domain = p_domain)
  AND (p_university IS NULL OR p_university = '' OR p_university = 'all' OR s.university_name = p_university)
  AND (p_college IS NULL OR p_college = '' OR p_college = 'all' OR s.college_name = p_college)
  AND (p_start IS NULL OR s.created_at >= p_start)
  AND (p_end IS NULL OR s.created_at <= p_end)
  ORDER BY s.created_at DESC NULLS LAST, s.id DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_students_light()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  college_name text,
  university_name text,
  created_at timestamptz,
  status text,
  internship_domain text,
  registration_id text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_may_admin_list_students();

  RETURN QUERY
  SELECT
    s.id,
    s.full_name,
    s.email,
    s.college_name,
    s.university_name,
    s.created_at,
    s.status,
    s.internship_domain,
    s.registration_id
  FROM public.students s
  ORDER BY s.created_at DESC NULLS LAST, s.id DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_site_visit_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_may_admin_list_students();

  RETURN jsonb_build_object(
    'total_visits', (SELECT count(*)::bigint FROM public.site_visits),
    'unique_visitors', (
      SELECT count(DISTINCT visitor_id)::bigint
      FROM public.site_visits
      WHERE visitor_id IS NOT NULL AND trim(visitor_id) <> ''
    )
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_students_created_at_id_desc
  ON public.students (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_site_visits_created_at
  ON public.site_visits (created_at DESC);

REVOKE ALL ON FUNCTION public.assert_may_admin_list_students() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_count_students_directory(text, text, text, text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_students_directory(integer, integer, text, text, text, text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_students_light() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_site_visit_stats() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_count_students_directory(text, text, text, text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_students_directory(integer, integer, text, text, text, text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_students_light() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_site_visit_stats() TO authenticated;


-- --------------------------------------------------------
-- Migration: 20260602120000_registration_leads_cybercafe.sql
-- --------------------------------------------------------
-- Cyber café partners register students while authenticated; direct registration_leads upsert was 403 (anon-only write policy).

CREATE OR REPLACE FUNCTION public.assert_may_upsert_registration_lead(p_cybercafe_email text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cybercafe_profiles cp WHERE cp.id = auth.uid()
  ) THEN
    SELECT lower(trim(cp.email)) INTO v_partner_email
    FROM public.cybercafe_profiles cp
    WHERE cp.id = auth.uid();

    IF p_cybercafe_email IS NOT NULL AND trim(p_cybercafe_email) <> '' THEN
      IF lower(trim(p_cybercafe_email)) IS DISTINCT FROM v_partner_email THEN
        RAISE EXCEPTION 'Cyber cafe email mismatch' USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'admin'::public.app_role,
        'super_admin'::public.app_role,
        'staff'::public.app_role
      )
  ) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Not allowed to save registration draft' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_registration_lead(
  p_email text,
  p_phone text DEFAULT NULL,
  p_step integer DEFAULT 1,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_cybercafe_shop_name text DEFAULT NULL,
  p_cybercafe_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_id uuid;
BEGIN
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Valid email required';
  END IF;

  PERFORM public.assert_may_upsert_registration_lead(p_cybercafe_email);

  INSERT INTO public.registration_leads (
    email,
    phone,
    step,
    payload,
    cybercafe_shop_name,
    cybercafe_email,
    updated_at
  )
  VALUES (
    v_email,
    NULLIF(trim(p_phone), ''),
    GREATEST(1, COALESCE(p_step, 1)),
    COALESCE(p_payload, '{}'::jsonb),
    NULLIF(trim(p_cybercafe_shop_name), ''),
    NULLIF(lower(trim(p_cybercafe_email)), ''),
    now()
  )
  ON CONFLICT (email) DO UPDATE SET
    phone = EXCLUDED.phone,
    step = EXCLUDED.step,
    payload = EXCLUDED.payload,
    cybercafe_shop_name = COALESCE(EXCLUDED.cybercafe_shop_name, public.registration_leads.cybercafe_shop_name),
    cybercafe_email = COALESCE(EXCLUDED.cybercafe_email, public.registration_leads.cybercafe_email),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_registration_lead(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  IF v_email = '' THEN
    RETURN;
  END IF;

  PERFORM public.assert_may_upsert_registration_lead(NULL);

  DELETE FROM public.registration_leads WHERE email = v_email;
END;
$$;

DROP POLICY IF EXISTS "Cyber cafe partners manage registration leads" ON public.registration_leads;
CREATE POLICY "Cyber cafe partners manage registration leads"
  ON public.registration_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cybercafe_profiles cp WHERE cp.id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.cybercafe_profiles cp WHERE cp.id = auth.uid())
  );

REVOKE ALL ON FUNCTION public.assert_may_upsert_registration_lead(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_registration_lead(text, text, integer, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_registration_lead(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.assert_may_upsert_registration_lead(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_registration_lead(text, text, integer, jsonb, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_registration_lead(text) TO anon, authenticated;


-- --------------------------------------------------------
-- Migration: 20260602130000_student_recover_payment_success_by_email.sql
-- --------------------------------------------------------
-- Recover dashboard access: link payment_success by email and fix rows with amount_paise < 100.

CREATE OR REPLACE FUNCTION public.student_recover_paid_enrollment(
  p_payment_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_pay_id text := NULLIF(trim(p_payment_id), '');
  v_amount bigint;
  v_order_email text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT lower(trim(u.email)) INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN FALSE;
  END IF;

  IF public.student_has_paid_enrollment(v_uid) THEN
    RETURN TRUE;
  END IF;

  -- Link Razorpay rows logged by email before user_id was known (legacy / failed enrollment).
  UPDATE public.payment_success ps
  SET
    user_id = v_uid,
    amount_paise = CASE
      WHEN coalesce(ps.amount_paise, 0) < 100 THEN 100
      ELSE ps.amount_paise
    END
  WHERE lower(trim(ps.email)) = v_email
    AND ps.payment_id ~* '^pay_[a-z0-9]'
    AND (ps.user_id IS NULL OR ps.user_id <> v_uid);

  IF public.student_has_paid_enrollment(v_uid) THEN
    RETURN TRUE;
  END IF;

  IF v_pay_id IS NOT NULL THEN
    SELECT po.amount, lower(trim(coalesce(po.user_email, po.metadata->>'email', '')))
    INTO v_amount, v_order_email
    FROM public.payment_orders po
    WHERE po.status = 'success'
      AND (po.payment_id = v_pay_id OR po.order_id = v_pay_id)
    ORDER BY po.created_at DESC
    LIMIT 1;
  ELSE
    SELECT po.payment_id, po.amount, lower(trim(coalesce(po.user_email, po.metadata->>'email', '')))
    INTO v_pay_id, v_amount, v_order_email
    FROM public.payment_orders po
    WHERE po.status = 'success'
      AND (
        lower(trim(coalesce(po.user_email, ''))) = v_email
        OR lower(trim(coalesce(po.metadata->>'email', ''))) = v_email
      )
    ORDER BY po.created_at DESC
    LIMIT 1;
  END IF;

  IF v_pay_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_order_email IS NOT NULL AND v_order_email <> '' AND v_order_email <> v_email THEN
    RETURN FALSE;
  END IF;

  PERFORM public.ensure_payment_success_log(
    jsonb_build_object(
      'user_id', v_uid::text,
      'payment_id', v_pay_id,
      'amount_paise', GREATEST(coalesce(v_amount, 0), 100),
      'email', v_email,
      'full_name', 'Student',
      'status', 'success'
    )
  );

  RETURN public.student_has_paid_enrollment(v_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.student_recover_paid_enrollment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_recover_paid_enrollment(text) TO authenticated;


