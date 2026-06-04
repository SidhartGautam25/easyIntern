import { getRazorpayConstructor, loadRazorpayCheckout } from "@/lib/razorpayCheckout";

export type PublicPaymentSettings = {
  razorpay_key_id?: string | null;
  currency?: string | null;
  is_active?: boolean | null;
  amount_paise?: number | null;
};

export type ClientCheckoutResult =
  | { success: true; payment_id: string; amount: number; mode: "legacy" }
  | { success: false; cancelled?: boolean };

/** Browser-only Razorpay checkout — no server order, no service role key. */
export async function runClientRazorpayCheckout(opts: {
  paymentSettings: PublicPaymentSettings;
  amountPaise: number;
  prefill: { name: string; email: string; contact: string };
  description?: string;
}): Promise<ClientCheckoutResult> {
  const key = opts.paymentSettings?.razorpay_key_id?.trim();
  if (!key) {
    throw new Error("Payment is not configured. Contact support.");
  }

  await loadRazorpayCheckout();
  const RazorpayCtor = getRazorpayConstructor();
  if (!RazorpayCtor) {
    throw new Error("Payment checkout could not load. Please refresh the page.");
  }

  return new Promise((resolve) => {
    const rzp = new RazorpayCtor({
      key,
      amount: opts.amountPaise,
      currency: opts.paymentSettings.currency || "INR",
      name: "EzyIntern",
      description: opts.description || "Student Registration Fee",
      image: "/logo.png",
      prefill: opts.prefill,
      handler: (response: { razorpay_payment_id?: string }) => {
        const paymentId = response?.razorpay_payment_id;
        if (!paymentId) {
          resolve({ success: false });
          return;
        }
        resolve({
          success: true,
          payment_id: paymentId,
          amount: opts.amountPaise,
          mode: "legacy",
        });
      },
      modal: {
        ondismiss: () => resolve({ success: false, cancelled: true }),
      },
      theme: { color: "#4F46E5" },
    });
    rzp.on("payment.failed", () => resolve({ success: false }));
    rzp.open();
  });
}
