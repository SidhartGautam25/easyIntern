import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  type PublicPaymentSettings,
} from "@/lib/clientRazorpayPayment";
import { getRazorpayConstructor, loadRazorpayCheckout } from "@/lib/razorpayCheckout";
import { paymentCreateOrder, paymentVerify } from "@/lib/paymentApi";

export type RegistrationPaymentResult =
  | { success: true; mode: "verified"; payment_id: string; amount: number; userId?: string; orderId?: string }
  | { success: true; mode: "legacy"; payment_id: string; amount: number }
  | { success: false; cancelled?: boolean };

const PAYMENT_CONFIG_COLUMNS = "razorpay_key_id, amount_paise, is_active, currency";

/** Call on registration step 4+ so the Razorpay script is ready before pay click. */
export function prefetchRegistrationCheckout(): Promise<void> {
  return loadRazorpayCheckout().catch(() => {});
}

function envRazorpayKeyId(): string {
  return String(import.meta.env.VITE_RAZORPAY_KEY_ID || "").trim();
}

/** Normalize DB row + optional Vite public key fallback. */
export function normalizePaymentSettings(
  raw: PublicPaymentSettings | null | undefined
): PublicPaymentSettings | null {
  if (!raw) {
    const envKey = envRazorpayKeyId();
    if (!envKey) return null;
    return {
      razorpay_key_id: envKey,
      is_active: true,
      amount_paise: 9900,
      currency: "INR",
    };
  }

  const key = String(raw.razorpay_key_id || "").trim() || envRazorpayKeyId();
  return {
    ...raw,
    razorpay_key_id: key || raw.razorpay_key_id,
    is_active: raw.is_active === false ? false : true,
  };
}

/** Read payment settings for checkout (public RPC or safe view only — never payment_config secrets). */
export async function fetchPublicPaymentConfig(
  client: SupabaseClient
): Promise<PublicPaymentSettings | null> {
  const { data: fromRpc, error: rpcErr } = await client.rpc("get_public_payment_config");
  if (!rpcErr && fromRpc && typeof fromRpc === "object") {
    return normalizePaymentSettings(fromRpc as PublicPaymentSettings);
  }

  const { data: fromView, error: viewErr } = await client
    .from("public_payment_config")
    .select(PAYMENT_CONFIG_COLUMNS)
    .maybeSingle();

  if (!viewErr && fromView) {
    return normalizePaymentSettings(fromView as PublicPaymentSettings);
  }

  if (rpcErr) {
    const msg = String(rpcErr.message || "");
    if (rpcErr.code === "PGRST202" || msg.toLowerCase().includes("could not find")) {
      console.warn("[payment] get_public_payment_config missing; using env fallback if set");
    } else {
      console.warn("[payment] config RPC failed", rpcErr);
    }
  } else if (viewErr) {
    console.warn("[payment] public_payment_config view failed", viewErr);
  }

  return normalizePaymentSettings(null);
}

export type RegistrationPaymentOptions = {
  isAdmin?: boolean;
};

export function isRegistrationPaymentRequired(
  _settings: PublicPaymentSettings | null | undefined,
  opts?: RegistrationPaymentOptions
): boolean {
  if (opts?.isAdmin) return false;
  if (import.meta.env.VITE_REGISTRATION_PAYMENT_OPTIONAL === "true") return false;
  return true;
}

export function canOpenRegistrationCheckout(
  settings: PublicPaymentSettings | null | undefined
): boolean {
  const normalized = normalizePaymentSettings(settings);
  return Boolean(String(normalized?.razorpay_key_id || "").trim());
}

function openRazorpayCheckout(
  baseOptions: Record<string, unknown>,
  onPaid: (response: {
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  }) => Promise<RegistrationPaymentResult>,
  onModalOpen?: () => void
): Promise<RegistrationPaymentResult> {
  return new Promise((resolve) => {
    let settled = false;

    function finish(val: RegistrationPaymentResult) {
      if (settled) return;
      settled = true;
      resolve(val);
    }

    const RazorpayCtor = getRazorpayConstructor();
    if (!RazorpayCtor) {
      finish({ success: false });
      return;
    }

    const rzp = new RazorpayCtor({
      ...baseOptions,
      handler: (response: {
        razorpay_payment_id?: string;
        razorpay_order_id?: string;
        razorpay_signature?: string;
      }) => {
        void onPaid(response)
          .then(finish)
          .catch((err) => {
            console.error("Payment handler error:", err);
            finish({ success: false });
          });
      },
      modal: {
        ondismiss: () => finish({ success: false, cancelled: true }),
        escape: true,
        backdropclose: true,
      },
      theme: { color: "#4F46E5" },
    });

    rzp.on("payment.failed", () => finish({ success: false }));

    if (onModalOpen) {
      onModalOpen();
    }
    rzp.open();
  });
}

const ORDER_API_ENABLED = true;

async function tryCreateOrder(
  body: { studentData: Record<string, unknown>; amount: number }
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> } | null> {
  try {
    return await paymentCreateOrder(body);
  } catch {
    return null;
  }
}

/**
 * Opens Razorpay for registration. Force secure server-side order checkout.
 */
export async function runRegistrationRazorpayCheckout(opts: {
  paymentSettings: PublicPaymentSettings;
  amountPaise: number;
  prefill: { name: string; email: string; contact: string };
  studentData?: Record<string, unknown>;
  onModalOpen?: () => void;
}): Promise<RegistrationPaymentResult> {
  const settings = normalizePaymentSettings(opts.paymentSettings);
  const key = String(settings?.razorpay_key_id || "").trim();
  if (!key) {
    throw new Error("Payment gateway is not configured. Contact support.");
  }

  const amountPaise = Math.round(Number(opts.amountPaise));
  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    throw new Error("Invalid registration fee. Refresh the page and try again.");
  }

  const scriptReady = loadRazorpayCheckout();

  if (opts.studentData) {
    const [orderRes] = await Promise.all([
      tryCreateOrder({ studentData: opts.studentData, amount: amountPaise }),
      scriptReady,
    ]);

    if (!orderRes || !orderRes.ok || orderRes.data.success !== true) {
      const errorMsg = orderRes?.data?.message || "Failed to create secure payment order on server.";
      throw new Error(String(errorMsg));
    }

    const orderId = String(orderRes.data.orderId || "");
    const orderKey = String(orderRes.data.key || key);
    const orderAmount = Number(orderRes.data.amount) || amountPaise;
    const currency = String(orderRes.data.currency || settings?.currency || "INR");

    if (orderId) {
      const checkoutImage = "/logo.png";
      const checkoutResult = await openRazorpayCheckout(
        {
          key: orderKey,
          order_id: orderId,
          amount: orderAmount,
          currency,
          name: "EzyIntern",
          description: "Internship Registration Fee",
          image: checkoutImage,
          prefill: opts.prefill,
        },
        async (response) => {
          const paymentId = response?.razorpay_payment_id;
          const orderIdFromRzp = response?.razorpay_order_id;
          const signature = response?.razorpay_signature;
          if (!paymentId || !orderIdFromRzp || !signature) {
            return { success: false as const };
          }

          const verifyRes = await paymentVerify({
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderIdFromRzp,
            razorpay_signature: signature,
          });

          if (!verifyRes.ok || !verifyRes.data.success) {
            const raw = String(verifyRes.data?.message || "Payment verification failed");
            throw new Error(raw);
          }

          return {
            success: true as const,
            mode: "verified" as const,
            payment_id: paymentId,
            amount: orderAmount,
            userId: typeof verifyRes.data.userId === "string" ? verifyRes.data.userId : undefined,
            orderId,
          };
        },
        opts.onModalOpen
      );

      return checkoutResult;
    }
  }

  throw new Error("Registration student data is required to process secure payment.");
}
