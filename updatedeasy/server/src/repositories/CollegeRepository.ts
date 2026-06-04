import { ICollegeRepository } from './interfaces/ICollegeRepository.js';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';

export class CollegeRepository implements ICollegeRepository {
  async claimCollegeRosterRow(collegeId: string, userId: string, email: string, phone: string) {
    const { error } = await supabase.rpc('claim_college_roster_row', {
      p_college_id: collegeId,
      p_user_id: userId,
      p_email: email.trim().toLowerCase(),
      p_phone: phone.trim(),
    });

    if (error) {
      logger.error({ error, collegeId, userId, email, phone }, 'claimCollegeRosterRow RPC failed');
      throw error;
    }
  }

  async claimPrefilledStudent(referenceNumber: string, userId: string) {
    const { error } = await supabase.rpc('claim_prefilled_student', {
      p_reference_number: referenceNumber,
      p_user_id: userId,
    });

    if (error) {
      logger.error({ error, referenceNumber, userId }, 'claimPrefilledStudent RPC failed');
      throw error;
    }
  }

  async findPaymentConfig() {
    const { data, error } = await supabase
      .from('payment_config')
      .select('razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      logger.error({ error }, 'findPaymentConfig failed');
      throw error;
    }

    return data;
  }
}
