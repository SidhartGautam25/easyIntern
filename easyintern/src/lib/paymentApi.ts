import { apiClient, ApiError } from "./apiClient";

export type PaymentJson = Record<string, any>;

/**
 * Creates an order in Razorpay using the Koa backend server.
 */
export async function paymentCreateOrder(body: {
  studentData: Record<string, unknown>;
  amount: number;
}): Promise<{ ok: boolean; status: number; data: PaymentJson }> {
  try {
    const res = await apiClient.post("/payment/create-order", body);
    return { ok: true, status: 200, data: res as any };
  } catch (err: any) {
    console.error("paymentCreateOrder error:", err);
    return {
      ok: false,
      status: err.status || 500,
      data: { success: false, message: err.message || "Failed to create order" },
    };
  }
}

/**
 * Verifies a Razorpay payment signature using the Koa backend server.
 */
export async function paymentVerify(body: {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}): Promise<{ ok: boolean; status: number; data: PaymentJson }> {
  try {
    const res = await apiClient.post("/payment/verify", body);
    return { ok: true, status: 200, data: res as any };
  } catch (err: any) {
    console.error("paymentVerify error:", err);
    return {
      ok: false,
      status: err.status || 500,
      data: { success: false, message: err.message || "Payment verification failed" },
    };
  }
}

/**
 * Checks enrollment/order status from the Koa backend server.
 */
export async function paymentGetStatus(orderId: string): Promise<{ ok: boolean; status: number; data: PaymentJson }> {
  try {
    const res = await apiClient.get(`/payment/status/${orderId}`);
    return { ok: true, status: 200, data: res as any };
  } catch (err: any) {
    console.error("paymentGetStatus error:", err);
    return {
      ok: false,
      status: err.status || 500,
      data: { success: false, message: err.message || "Failed to get order status" },
    };
  }
}

/**
 * Razorpay webhook URL endpoint.
 */
export function getPaymentWebhookUrl(): string {
  const fromEnv = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  return `${fromEnv.replace(/\/$/, "")}/payment/webhook`;
}
