import { useState, useCallback } from 'react';
import { apiClient, ApiError } from '@/lib/apiClient';
import { toast } from 'sonner';

export function usePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const createOrder = useCallback(async (studentData: any, amount: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/payment/create-order', { studentData, amount });
      return res as any; // returns { success, orderId, amount, currency, keyId }
    } catch (err: any) {
      setError(err);
      toast.error(err.message || 'Failed to create payment order.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyPayment = useCallback(async (verificationData: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/payment/verify', verificationData);
      return res as any; // returns { success, message }
    } catch (err: any) {
      setError(err);
      toast.error(err.message || 'Payment verification failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const pollOrderStatus = useCallback(async (orderId: string, maxAttempts = 30, intervalMs = 2000) => {
    setLoading(true);
    setError(null);
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const res: any = await apiClient.get(`/payment/status/${orderId}`);
        if (res.status === 'fulfilled') {
          return res; // returns { status: 'fulfilled', registrationId }
        }
        if (res.status === 'failed') {
          throw new Error('Enrollment processing failed.');
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      throw new Error('Polling timed out. Enrollment is still processing in the background.');
    } catch (err: any) {
      setError(err);
      toast.error(err.message || 'Error checking enrollment status.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createOrder, verifyPayment, pollOrderStatus, loading, error };
}

export function useAdmin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const registerStudent = useCallback(async (payload: {
    admin_id: string;
    student_data: any;
    payment_amount?: number;
    transaction_id?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/admin/register', payload);
      toast.success('Student registered successfully.');
      return res as any;
    } catch (err: any) {
      setError(err);
      toast.error(err.message || 'Student registration failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const executeTask = useCallback(async (taskPayload: {
    action: 'create_sub_user' | 'force_logout';
    email?: string;
    password?: string;
    roleTag?: string;
    role?: string;
    permissions?: string[];
    target_user_id?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/admin/tasks', taskPayload);
      toast.success('Admin task completed successfully.');
      return res as any;
    } catch (err: any) {
      setError(err);
      toast.error(err.message || 'Admin task execution failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMail = useCallback(async (mailPayload: {
    action: string;
    to: string;
    subject?: string;
    data?: any;
    otp?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/admin/send-mail', mailPayload);
      toast.success('Mail request processed successfully.');
      return res as any;
    } catch (err: any) {
      setError(err);
      toast.error(err.message || 'Failed to send mail.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendBulkMail = useCallback(async (bulkPayload: {
    subject: string;
    message: string;
    recipients: string[];
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/admin/send-bulk-mail', bulkPayload);
      toast.success('Bulk email transmission initiated.');
      return res as any;
    } catch (err: any) {
      setError(err);
      toast.error(err.message || 'Failed to send bulk email.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { registerStudent, executeTask, sendMail, sendBulkMail, loading, error };
}

export function useAuthBackend() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const requestOtp = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/auth/forgot-password', { email });
      toast.success('OTP sent to email address.');
      return res as any;
    } catch (err: any) {
      setError(err);
      toast.error(err.message || 'Failed to request OTP.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string, otp: string, newPassword: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/auth/reset-password', { email, otp, newPassword });
      toast.success('Password updated successfully.');
      return res as any;
    } catch (err: any) {
      setError(err);
      toast.error(err.message || 'Password reset failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { requestOtp, resetPassword, loading, error };
}
