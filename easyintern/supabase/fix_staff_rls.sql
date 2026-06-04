-- FIX RLS POLICIES FOR STAFF ROLE
-- Run this in your Supabase SQL Editor

-- 1. Payment Success
DROP POLICY IF EXISTS "Admins view all successful payments" ON public.payment_success;
CREATE POLICY "Admins view all successful payments" ON public.payment_success 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'staff')
  )
);

-- 2. Payment Cancelled (Leads)
DROP POLICY IF EXISTS "Admins view all cancelled payments" ON public.payment_cancelled;
CREATE POLICY "Admins view all cancelled payments" ON public.payment_cancelled 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'staff')
  )
);

DROP POLICY IF EXISTS "Admins manage leads" ON public.payment_cancelled;
CREATE POLICY "Admins manage leads" ON public.payment_cancelled
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'staff')
  )
);

-- 3. Students
DROP POLICY IF EXISTS "Admins view all students" ON public.students;
CREATE POLICY "Admins view all students" ON public.students 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'staff')
  )
);

DROP POLICY IF EXISTS "Admins update all students" ON public.students;
CREATE POLICY "Admins update all students" ON public.students 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'staff')
  )
);

-- 4. Classes
DROP POLICY IF EXISTS "Admins can manage classes" ON public.classes;
CREATE POLICY "Admins can manage classes" ON public.classes 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'staff')
  )
);

-- 5. Certificates
DROP POLICY IF EXISTS "Admins manage certificates" ON public.certificates;
CREATE POLICY "Admins manage certificates" ON public.certificates 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'staff')
  )
);

-- 6. Notifications
DROP POLICY IF EXISTS "Admins manage notifications" ON public.notifications;
CREATE POLICY "Admins manage notifications" ON public.notifications
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'staff')
  )
);

-- 7. User Roles (Staff need to see roles to verify others)
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles" ON public.user_roles 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'staff')
  )
);
