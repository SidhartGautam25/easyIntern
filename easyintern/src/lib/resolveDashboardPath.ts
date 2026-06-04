import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  COLLEGE_DASHBOARD_PATH,
  REFERRAL_DASHBOARD_PATH,
} from "@/lib/authRoutes";
import {
  canAccessStudentDashboard,
  STUDENT_PAYMENT_REQUIRED_PATH,
} from "@/lib/studentPaymentAccess";

/** Post-login destination from {@link public.user_roles} (never trust user_metadata for access). */
export async function resolveDashboardPath(user: User): Promise<string> {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const rolesList = (roles || []).map((r: { role: string }) => r.role);
  const { data: cybercafe } = await supabase
    .from("cybercafe_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (rolesList.includes("super_admin")) return "/super-admin";
  if (rolesList.includes("staff")) return "/staff-dashboard";
  if (rolesList.includes("admin")) return "/admin";
  if (rolesList.includes("college_admin")) return COLLEGE_DASHBOARD_PATH;
  if (rolesList.includes("referral_partner")) return REFERRAL_DASHBOARD_PATH;
  if (cybercafe) return "/cybercafe/dashboard";

  const mayUseStudentDashboard = await canAccessStudentDashboard(
    supabase,
    user.id,
    user.email || undefined
  );
  return mayUseStudentDashboard ? "/dashboard" : STUDENT_PAYMENT_REQUIRED_PATH;
}
