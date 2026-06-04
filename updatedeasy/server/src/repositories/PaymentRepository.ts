import { IPaymentRepository } from './interfaces/IPaymentRepository.js';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';

export class PaymentRepository implements IPaymentRepository {
  async saveOrder(order: {
    order_id: string;
    user_email: string;
    user_phone: string;
    amount: number;
    status: string;
    metadata: any;
  }) {
    const { error } = await supabase.from('payment_orders').insert(order);
    if (error) {
      logger.error({ error, order }, 'saveOrder failed');
      throw error;
    }
  }

  async findOrderById(orderId: string) {
    const { data, error } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) {
      logger.error({ error, orderId }, 'findOrderById failed');
      throw error;
    }
    return data;
  }

  async updateOrderStatus(orderId: string, status: string, paymentId?: string) {
    const updatePayload: any = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (paymentId) {
      updatePayload.payment_id = paymentId;
    }

    const { error } = await supabase
      .from('payment_orders')
      .update(updatePayload)
      .eq('order_id', orderId);

    if (error) {
      logger.error({ error, orderId, status }, 'updateOrderStatus failed');
      throw error;
    }
  }

  async insertPaymentSuccess(paySuccess: {
    user_id: string | null;
    payment_id: string;
    amount_paise: number;
    email: string;
    full_name: string;
    college_name: string | null;
    cybercafe_shop_name?: string | null;
    cybercafe_email?: string | null;
    status?: string;
    failure_reason?: string;
    metadata?: any;
  }) {
    // We try to call RPC ensure_payment_success_log first (as in original recordPaymentSuccess.ts)
    const { error: rpcErr } = await supabase.rpc('ensure_payment_success_log', {
      p_row: paySuccess,
    });

    if (!rpcErr) return;

    // Fallback to direct insert
    const { error: insErr } = await supabase.from('payment_success').insert(paySuccess);
    if (insErr && !String(insErr.message || '').includes('duplicate')) {
      logger.error({ insErr, paySuccess }, 'insertPaymentSuccess direct insert failed');
      throw insErr;
    }
  }

  async findPaymentSuccessLog(paymentId: string) {
    const { data, error } = await supabase
      .from('payment_success')
      .select('*')
      .eq('payment_id', paymentId)
      .maybeSingle();

    if (error) {
      logger.error({ error, paymentId }, 'findPaymentSuccessLog failed');
      throw error;
    }
    return data;
  }

  async validateReferralCode(code: string) {
    const rawRef = code.trim().toLowerCase();
    if (!rawRef) return null;

    const { data: validated, error: valErr } = await supabase.rpc('validate_referral_code', {
      p_code: rawRef,
    });

    if (!valErr && typeof validated === 'string' && validated.length > 0) {
      return validated;
    }

    const { data: rp, error: rpErr } = await supabase
      .from('referral_partners')
      .select('referral_code')
      .ilike('referral_code', rawRef)
      .eq('active', true)
      .maybeSingle();

    if (rpErr) {
      logger.warn({ rpErr, code }, 'Error checking referral_partners table');
    }

    return rp?.referral_code ?? null;
  }
}
