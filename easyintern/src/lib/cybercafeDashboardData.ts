import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichStudentProfileForDisplay } from "@/lib/studentProfileDisplay";

export type CybercafeLeadRow = Record<string, unknown> & {
  status_label?: string;
};

async function rpcRows<T>(
  client: SupabaseClient,
  fn: string,
  args?: Record<string, unknown>
): Promise<T[]> {
  const { data, error } = await client.rpc(fn, args ?? {});
  if (error) throw error;
  return (data as T[]) || [];
}

/** Load students, leads, and transactions for an approved cyber cafe partner. */
export async function fetchCybercafeDashboardData(
  client: SupabaseClient,
  partnerEmail?: string
): Promise<{
  applications: Record<string, unknown>[];
  leads: CybercafeLeadRow[];
  transactions: Record<string, unknown>[];
}> {
  let applications: Record<string, unknown>[] = [];
  let transactions: Record<string, unknown>[] = [];
  let cancelled: Record<string, unknown>[] = [];
  let failed: Record<string, unknown>[] = [];

  try {
    applications = await rpcRows<Record<string, unknown>>(client, "cybercafe_list_students");
  } catch (rpcErr) {
    console.warn("[cybercafe] cybercafe_list_students RPC:", rpcErr);
    const cafeEmail = partnerEmail?.trim().toLowerCase();
    if (cafeEmail) {
      const { data, error } = await client
        .from("students")
        .select("*")
        .eq("cybercafe_email", cafeEmail)
        .order("created_at", { ascending: false });
      if (error) throw error;
      applications = (data as Record<string, unknown>[]) || [];
    }
  }

  try {
    transactions = await rpcRows<Record<string, unknown>>(client, "cybercafe_list_payment_success", {
      p_status: "success",
    });
  } catch (rpcErr) {
    console.warn("[cybercafe] cybercafe_list_payment_success RPC:", rpcErr);
    const { data, error } = await client
      .from("payment_success")
      .select("*")
      .eq("status", "success")
      .order("created_at", { ascending: false });
    if (!error && data) transactions = data as Record<string, unknown>[];
  }

  try {
    cancelled = await rpcRows<Record<string, unknown>>(client, "cybercafe_list_payment_cancelled");
  } catch (rpcErr) {
    console.warn("[cybercafe] cybercafe_list_payment_cancelled RPC:", rpcErr);
  }

  try {
    failed = await rpcRows<Record<string, unknown>>(client, "cybercafe_list_failed_payments");
  } catch (rpcErr) {
    console.warn("[cybercafe] cybercafe_list_failed_payments RPC:", rpcErr);
  }

  const leads: CybercafeLeadRow[] = [
    ...cancelled.map((l) => ({ ...l, status_label: "Cancelled" as const })),
    ...failed.map((l) => ({ ...l, status_label: "Failed" as const })),
  ].sort(
    (a, b) =>
      new Date(String(b.created_at || 0)).getTime() -
      new Date(String(a.created_at || 0)).getTime()
  );

  return {
    applications: applications.map((row) => enrichStudentProfileForDisplay(row) || row),
    leads,
    transactions,
  };
}

export async function fetchCybercafeStudentByEmail(
  client: SupabaseClient,
  studentEmail: string
): Promise<Record<string, unknown> | null> {
  const normalized = studentEmail.trim().toLowerCase();
  if (!normalized.includes("@")) return null;

  try {
    const rows = await rpcRows<Record<string, unknown>>(client, "cybercafe_get_student_by_email", {
      p_student_email: normalized,
    });
    const row = rows[0];
    return row ? enrichStudentProfileForDisplay(row) || row : null;
  } catch (rpcErr) {
    console.warn("[cybercafe] cybercafe_get_student_by_email RPC:", rpcErr);
    const { data, error } = await client
      .from("students")
      .select("*")
      .eq("email", normalized)
      .maybeSingle();
    if (error) throw error;
    return data ? enrichStudentProfileForDisplay(data as Record<string, unknown>) || data : null;
  }
}
