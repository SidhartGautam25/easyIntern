/**
 * Payment: try same-origin Vercel API first, then Supabase Edge Functions.
 * Cyber cafe / student registration must work when edge functions are not deployed.
 */

function supabaseProjectUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url?.trim()) throw new Error("Missing VITE_SUPABASE_URL");
  return url.replace(/\/$/, "");
}

function supabaseAnonKey(): string {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!key?.trim()) throw new Error("Missing VITE_SUPABASE_PUBLISHABLE_KEY");
  return key;
}

function paymentFunctionUrl(name: string): string {
  return `${supabaseProjectUrl()}/functions/v1/${name}`;
}

function edgeHeaders(): HeadersInit {
  const anon = supabaseAnonKey();
  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  };
}

function apiPaymentUrl(path: "create-order" | "verify"): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim().replace(/\/$/, "");
  if (fromEnv) return `${fromEnv}/api/payment/${path}`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/payment/${path}`;
  }
  return `/api/payment/${path}`;
}

type PaymentJson = Record<string, unknown>;

async function postPaymentJson(
  apiPath: "create-order" | "verify",
  edgeName: string,
  body: unknown
): Promise<{ ok: boolean; status: number; data: PaymentJson }> {
  const payload = JSON.stringify(body);

  const attempts: Array<{ label: string; url: string; headers: HeadersInit }> = [
    { label: "api", url: apiPaymentUrl(apiPath), headers: { "Content-Type": "application/json" } },
    { label: "edge", url: paymentFunctionUrl(edgeName), headers: edgeHeaders() },
  ];

  let last: { ok: boolean; status: number; data: PaymentJson } = {
    ok: false,
    status: 0,
    data: { success: false, message: "Payment service unavailable" },
  };

  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, {
        method: "POST",
        headers: attempt.headers,
        body: payload,
      });
      const data = (await res.json().catch(() => ({}))) as PaymentJson;
      last = { ok: res.ok, status: res.status, data };

      if (res.ok && data.success) {
        return last;
      }

      // Client/business errors (duplicate email, invalid amount) — do not retry other host.
      if (res.status >= 400 && res.status < 500) {
        return last;
      }

      console.warn(`[payment] ${attempt.label} ${apiPath} HTTP ${res.status}`, data.message || data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch";
      last = { ok: false, status: 0, data: { success: false, message } };
      console.warn(`[payment] ${attempt.label} ${apiPath} network error:`, message);
    }
  }

  return last;
}

export async function paymentCreateOrder(body: {
  studentData: Record<string, unknown>;
  amount: number;
}): Promise<{ ok: boolean; status: number; data: PaymentJson }> {
  return postPaymentJson("create-order", "payment-create-order", body);
}

export async function paymentVerify(body: {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}): Promise<{ ok: boolean; status: number; data: PaymentJson }> {
  return postPaymentJson("verify", "payment-verify", body);
}

/** Razorpay dashboard webhook URL (append ?apikey= if Supabase gateway requires it). */
export function getPaymentWebhookUrl(includeAnonApiKey = true): string {
  const base = paymentFunctionUrl("payment-webhook");
  if (!includeAnonApiKey) return base;
  return `${base}?apikey=${encodeURIComponent(supabaseAnonKey())}`;
}
