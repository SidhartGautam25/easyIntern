-- Fix RLS so students can view their own payment receipts
DROP POLICY IF EXISTS "Users can view own payments" ON public.payment_success;
CREATE POLICY "Users can view own payments" ON public.payment_success 
FOR SELECT USING (auth.uid() = user_id);
