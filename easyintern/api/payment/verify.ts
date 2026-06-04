import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { fulfillPaidOrder } from '../lib/paymentEnrollment';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Missing payment details' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ success: false, message: 'Supabase credentials missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: config } = await supabase
      .from('payment_config')
      .select('razorpay_key_id, razorpay_key_secret')
      .eq('id', 1)
      .maybeSingle();

    const razorpaySecret = config?.razorpay_key_secret;
    const razorpayKeyId = config?.razorpay_key_id;
    if (!razorpaySecret || !razorpayKeyId) {
      throw new Error('Razorpay keys not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn('Invalid Payment Signature!');
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    const { data: existingOrder, error: fetchError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_id', razorpay_order_id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpaySecret,
    });

    let result: { userId?: string; alreadyComplete: boolean };
    try {
      result = await fulfillPaidOrder(supabase, existingOrder, razorpay_payment_id, {
        razorpay,
      });
    } catch (capErr: unknown) {
      const msg = capErr instanceof Error ? capErr.message : String(capErr);
      console.error('Payment fulfill failed after signature verify:', msg);
      return res.status(502).json({
        success: false,
        message: `Could not complete registration: ${msg}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.alreadyComplete
        ? 'Payment already processed'
        : 'Payment verified and registration complete',
      userId: result.userId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Verification Error:', error);
    return res.status(500).json({ success: false, message });
  }
}
