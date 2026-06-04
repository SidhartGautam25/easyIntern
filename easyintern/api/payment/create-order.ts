import type { VercelRequest, VercelResponse } from '@vercel/node';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';
import { assertStudentRegistrationAvailableServer } from '../lib/registrationAvailability';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const reqId = `co_${Date.now()}`;

  // ── Top-level CORS — always set these first so errors also have CORS headers ──
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // ── Always respond with JSON — wrap everything so 500s still have a body ─────
  try {
    console.log(`[${reqId}] ▶ create-order called | method=${req.method}`);

    if (req.method === 'OPTIONS') {
      console.log(`[${reqId}] CORS preflight — OK`);
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      console.warn(`[${reqId}] Method not allowed: ${req.method}`);
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { studentData, amount } = req.body || {};
    console.log(`[${reqId}] Payload received | email=${studentData?.email} | amount=${amount}`);

    const parsedAmount = Number(amount);
    if (!studentData || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      console.error(`[${reqId}] Missing studentData or amount`);
      return res.status(400).json({ success: false, message: 'Missing student data or amount' });
    }

    // ── Env checks ─────────────────────────────────────────────────────────────
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    console.log(`[${reqId}] ENV | SUPABASE_URL=${supabaseUrl ? '✅ present' : '❌ MISSING'}`);
    console.log(`[${reqId}] ENV | SERVICE_ROLE_KEY=${supabaseServiceKey ? '✅ present' : '❌ MISSING'}`);
    console.log(`[${reqId}] ENV | All env keys available: ${Object.keys(process.env).filter(k => !k.startsWith('npm_')).join(', ')}`);

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[${reqId}] FATAL: Supabase env vars missing — check Vercel environment variables`);
      return res.status(500).json({
        success: false,
        message: 'Server misconfiguration: Supabase credentials missing. Check Vercel env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log(`[${reqId}] Supabase client created`);

    const regEmail = String(studentData?.email || '').trim();
    const regPhone = String(
      studentData?.contact_number || studentData?.contact || ''
    ).trim();
    if (regEmail && regPhone) {
      try {
        await assertStudentRegistrationAvailableServer(supabase, regEmail, regPhone);
      } catch (availErr: unknown) {
        const msg =
          availErr instanceof Error ? availErr.message : 'Email or mobile already registered.';
        console.warn(`[${reqId}] Registration blocked: ${msg}`);
        return res.status(400).json({ success: false, message: msg });
      }
    }

    // ── Fetch Razorpay credentials from DB ────────────────────────────────────
    console.log(`[${reqId}] Fetching Razorpay config from payment_config (id=1)...`);
    const { data: config, error: configError } = await supabase
      .from('payment_config')
      .select('razorpay_key_id, razorpay_key_secret')
      .eq('id', 1)
      .maybeSingle();

    if (configError) {
      console.error(`[${reqId}] ❌ DB error fetching payment_config:`, configError);
      return res.status(500).json({ success: false, message: `DB error: ${configError.message}` });
    }

    if (!config?.razorpay_key_id || !config?.razorpay_key_secret) {
      console.error(`[${reqId}] ❌ Razorpay keys missing in payment_config. Row:`, config);
      return res.status(500).json({
        success: false,
        message: 'Razorpay credentials not found in payment_config table (id=1). Add razorpay_key_id and razorpay_key_secret.',
      });
    }

    const razorpayKeyId = config.razorpay_key_id;
    const maskedSecret = config.razorpay_key_secret.slice(0, 8) + '****';
    console.log(`[${reqId}] ✅ Config loaded | key_id=${razorpayKeyId} | secret=${maskedSecret}`);
    console.log(`[${reqId}] Key mode: ${razorpayKeyId.startsWith('rzp_test') ? '🧪 TEST' : '🔴 LIVE'}`);

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: config.razorpay_key_secret,
    });

    // ── Create Razorpay order ─────────────────────────────────────────────────
    const amountPaise = Math.round(parsedAmount);
    const receipt = `rcpt_${Date.now()}`;
    console.log(`[${reqId}] Creating Razorpay order | amount_paise=${amountPaise} | receipt=${receipt}`);

    /** Auto-capture on successful payment — avoids authorised-but-never-settled refunds. */
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      payment_capture: 1,
    });

    console.log(`[${reqId}] ✅ Razorpay order created | order_id=${order.id} | status=${order.status}`);

    // ── Save order in Supabase ────────────────────────────────────────────────
    console.log(`[${reqId}] Inserting order into payment_orders...`);
    const { error: insertError } = await supabase.from('payment_orders').insert({
      order_id: order.id,
      user_email: studentData.email,
      user_phone: studentData.contact || studentData.contact_number,
      amount: amountPaise,
      status: 'pending',
      metadata: studentData,
    });

    if (insertError) {
      console.error(`[${reqId}] ❌ payment_orders insert failed:`, insertError);
      return res.status(500).json({ success: false, message: `DB insert error: ${insertError.message}` });
    }

    console.log(`[${reqId}] ✅ Order saved | order_id=${order.id}`);
    console.log(`[${reqId}] ✅ create-order done — responding to frontend`);

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: razorpayKeyId,
    });

  } catch (err: any) {
    // This catch ensures the response ALWAYS has a JSON body — never an empty 500
    console.error(`[${reqId}] ❌ UNHANDLED error in create-order:`, err?.message || err);
    console.error(`[${reqId}] Stack:`, err?.stack);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Unknown server error in create-order',
    });
  }
}