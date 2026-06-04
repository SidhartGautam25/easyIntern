import { supabase } from "@/integrations/supabase/client";

/**
 * Send a registration confirmation email to a newly registered student.
 */
export async function sendRegistrationEmail(data: any) {
  try {
    const { data: result, error } = await supabase.functions.invoke('resend-email', {
      body: {
        type: 'registration_confirmation',
        to: data.to,
        data: data
      }
    });
    
    if (error) throw error;
    console.log("Registration email sent to:", data.to);
  } catch (err) {
    console.error("Failed to send registration email:", err);
  }
}

/**
 * Send a certificate-ready notification email to a student.
 */
export async function sendCertificateEmail(data: any) {
  try {
    const { data: result, error } = await supabase.functions.invoke('resend-email', {
      body: {
        type: 'certificate_generated',
        to: data.to,
        data: data
      }
    });

    if (error) throw error;
    console.log("Certificate email sent to:", data.to);
  } catch (err) {
    console.error("Failed to send certificate email:", err);
  }
}
