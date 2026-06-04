import type { SupabaseClient } from "@supabase/supabase-js";

/** When false (dev only), students may use the dashboard without a payment_success row. */
export function isStudentPaymentGateEnforced(): boolean {
  return import.meta.env.VITE_REGISTRATION_PAYMENT_OPTIONAL !== "true";
}

export function isImpersonatingStudent(): boolean {
  return typeof localStorage !== "undefined" && !!localStorage.getItem("impersonate_id");
}

export const STUDENT_PAYMENT_REQUIRED_PATH = "/register?payment=required";

type PaymentSuccessRow = {
  payment_id?: string | null;
  amount_paise?: number | null;
  status?: string | null;
};

/** Whether a payment_success row counts as paid enrollment. */
export function paymentRowQualifiesAsPaid(row: PaymentSuccessRow | null | undefined): boolean {
  if (!row?.payment_id) return false;
  const paymentId = String(row.payment_id).trim();
  if (!paymentId) return false;

  const status = String(row.status ?? "success").trim().toLowerCase();
  if (status && status !== "success") return false;

  // Admin / lead transfer (no Razorpay charge)
  if (
    /^pay_admin_/i.test(paymentId) ||
    /^admin_/i.test(paymentId) ||
    /^ADMIN_TRANS_/i.test(paymentId)
  ) {
    return true;
  }

  const amountPaise = Number(row.amount_paise);
  return /^pay_[a-z0-9]/i.test(paymentId) && Number.isFinite(amountPaise) && amountPaise >= 100;
}

async function fetchQualifyingPaymentRow(
  client: SupabaseClient,
  userId: string,
  email?: string
): Promise<PaymentSuccessRow | null> {
  const { data: byUser, error: userErr } = await client
    .from("payment_success")
    .select("payment_id, amount_paise, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (userErr) {
    console.warn("[payment-gate] payment_success by user_id:", userErr.message);
  } else if (paymentRowQualifiesAsPaid(byUser)) {
    return byUser;
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail.includes("@")) return null;

  const { data: byEmail, error: emailErr } = await client
    .from("payment_success")
    .select("payment_id, amount_paise, status")
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (emailErr) {
    console.warn("[payment-gate] payment_success by email:", emailErr.message);
    return null;
  }

  return paymentRowQualifiesAsPaid(byEmail) ? byEmail : null;
}

/** True when the student has a successful registration payment logged. */
export async function studentHasPaidEnrollment(
  client: SupabaseClient,
  userId: string,
  email?: string
): Promise<boolean> {
  if (!userId) return false;

  const { data: rpcPaid, error: rpcErr } = await client.rpc("student_has_paid_enrollment", {
    p_user_id: userId,
  });

  if (!rpcErr && rpcPaid === true) return true;
  if (rpcErr) {
    const msg = String(rpcErr.message || "");
    if (!/student_has_paid_enrollment|could not find|42883/i.test(msg)) {
      console.warn("[payment-gate] student_has_paid_enrollment:", rpcErr.message);
    }
  }

  const row = await fetchQualifyingPaymentRow(client, userId, email);
  if (paymentRowQualifiesAsPaid(row)) return true;

  const { data: recovered, error: recoverErr } = await client.rpc(
    "student_recover_paid_enrollment",
    { p_payment_id: null }
  );
  if (!recoverErr && recovered === true) return true;
  if (
    recoverErr &&
    !/student_recover_paid_enrollment|could not find|42883/i.test(
      String(recoverErr.message || "")
    )
  ) {
    console.warn("[payment-gate] student_recover_paid_enrollment:", recoverErr.message);
  }

  const rowAfter = await fetchQualifyingPaymentRow(client, userId, email);
  return paymentRowQualifiesAsPaid(rowAfter);
}

export async function canAccessStudentDashboard(
  client: SupabaseClient,
  userId: string,
  email?: string
): Promise<boolean> {
  if (!isStudentPaymentGateEnforced()) return true;
  if (isImpersonatingStudent()) return true;
  return studentHasPaidEnrollment(client, userId, email);
}
