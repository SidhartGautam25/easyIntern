import { useEffect } from "react";
import { RegistrationForm } from "@/components/RegistrationForm";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { NoticePopup } from "@/components/NoticePopup";
import { captureReferralFromUrl, logReferralClickFromUrl } from "@/lib/referral";
import { supabase } from "@/integrations/supabase/client";

const Register = () => {
  useEffect(() => {
    captureReferralFromUrl();
    logReferralClickFromUrl(supabase);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteNav />
      <NoticePopup />
      <main className="flex-1 gradient-soft py-10 md:py-16">
        <div className="container mx-auto px-4">
          <Card className="max-w-3xl mx-auto p-6 md:p-10 shadow-elegant animate-fade-in-up">
            <div className="text-center mb-6">
              <div className="inline-flex size-14 items-center justify-center rounded-xl overflow-hidden mb-3 shadow-soft">
                <img src="/logo.png" alt="EzyIntern" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-1">Student Registration</h1>
              <p className="text-sm text-muted-foreground">
                Complete your registration for the UGC-mandated internship program
              </p>
            </div>
            <RegistrationForm />
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Register;
