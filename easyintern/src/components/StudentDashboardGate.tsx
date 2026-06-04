import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  canAccessStudentDashboard,
  STUDENT_PAYMENT_REQUIRED_PATH,
} from "@/lib/studentPaymentAccess";

/**
 * Blocks /dashboard until payment_success exists (strict paid enrollment).
 * Admin impersonation and VITE_REGISTRATION_PAYMENT_OPTIONAL bypass the gate.
 */
export function StudentDashboardGate({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (authLoading) return;
      if (!user?.id) {
        if (!cancelled) {
          setAllowed(false);
          setChecking(false);
        }
        return;
      }

      setChecking(true);
      const ok = await canAccessStudentDashboard(supabase, user.id, user.email || undefined);
      if (!cancelled) {
        setAllowed(ok);
        setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="size-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">
            Verifying enrollment...
          </p>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to={STUDENT_PAYMENT_REQUIRED_PATH} replace />;
  }

  return <>{children}</>;
}
