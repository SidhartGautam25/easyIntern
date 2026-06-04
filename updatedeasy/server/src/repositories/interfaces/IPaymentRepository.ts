export interface IPaymentRepository {
  saveOrder(order: {
    order_id: string;
    user_email: string;
    user_phone: string;
    amount: number;
    status: string;
    metadata: any;
  }): Promise<void>;
  findOrderById(orderId: string): Promise<any | null>;
  updateOrderStatus(orderId: string, status: string, paymentId?: string): Promise<void>;
  insertPaymentSuccess(paySuccess: {
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
  }): Promise<void>;
  findPaymentSuccessLog(paymentId: string): Promise<any | null>;
  validateReferralCode(code: string): Promise<string | null>;
}
