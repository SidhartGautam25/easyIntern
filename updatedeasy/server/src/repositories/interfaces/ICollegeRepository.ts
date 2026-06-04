export interface ICollegeRepository {
  claimCollegeRosterRow(collegeId: string, userId: string, email: string, phone: string): Promise<void>;
  claimPrefilledStudent(referenceNumber: string, userId: string): Promise<void>;
  findPaymentConfig(): Promise<{
    razorpay_key_id: string;
    razorpay_key_secret: string;
    razorpay_webhook_secret?: string;
  } | null>;
}
