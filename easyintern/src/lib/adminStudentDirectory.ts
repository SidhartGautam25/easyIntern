import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllSupabaseRows, fetchAllSupabaseRpcRows } from "@/lib/fetchAllSupabaseRows";
import { sanitizeStudentSearchTerm } from "@/lib/studentDirectorySearch";

export type AdminStudentDirectoryFilters = {
  searchTerm?: string;
  domainFilter?: string;
  uniFilter?: string;
  collegeFilter?: string;
  startDate?: string;
  endDate?: string;
  dateFilter?: string;
};

function directoryDateRange(filters: AdminStudentDirectoryFilters): {
  p_start: string | null;
  p_end: string | null;
} {
  const { startDate, endDate, dateFilter } = filters;
  if (startDate) {
    return {
      p_start: `${startDate}T00:00:00`,
      p_end: endDate ? `${endDate}T23:59:59` : null,
    };
  }
  if (dateFilter) {
    return {
      p_start: `${dateFilter}T00:00:00`,
      p_end: `${dateFilter}T23:59:59`,
    };
  }
  return { p_start: null, p_end: null };
}

function rpcFilterArgs(filters: AdminStudentDirectoryFilters) {
  const { p_start, p_end } = directoryDateRange(filters);
  const domain = filters.domainFilter && filters.domainFilter !== "all" ? filters.domainFilter : null;
  const university = filters.uniFilter && filters.uniFilter !== "all" ? filters.uniFilter : null;
  const college = filters.collegeFilter && filters.collegeFilter !== "all" ? filters.collegeFilter : null;
  const search = sanitizeStudentSearchTerm(filters.searchTerm || "") || null;

  return {
    p_search: search,
    p_domain: domain,
    p_university: university,
    p_college: college,
    p_start,
    p_end,
  };
}

function isMissingRpc(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = String(err.message || "").toLowerCase();
  return err.code === "PGRST202" || msg.includes("could not find") || msg.includes("does not exist");
}

/** Paginated student directory for admin/staff (SECURITY DEFINER RPC — avoids RLS timeout). */
export async function fetchAdminStudentDirectoryPage(
  client: SupabaseClient,
  page: number,
  pageSize: number,
  filters: AdminStudentDirectoryFilters
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const filterArgs = rpcFilterArgs(filters);
  const p_limit = pageSize;
  const p_offset = page * pageSize;

  const [listRes, countRes] = await Promise.all([
    client.rpc("admin_list_students_directory", {
      p_limit,
      p_offset,
      ...filterArgs,
    }),
    client.rpc("admin_count_students_directory", filterArgs),
  ]);

  if (!listRes.error && !countRes.error) {
    return {
      rows: (listRes.data as Record<string, unknown>[]) || [],
      total: Number(countRes.data) || 0,
    };
  }

  if (isMissingRpc(listRes.error) || isMissingRpc(countRes.error)) {
    return fetchAdminStudentDirectoryPageFallback(client, page, pageSize, filters);
  }

  throw listRes.error || countRes.error;
}

async function fetchAdminStudentDirectoryPageFallback(
  client: SupabaseClient,
  page: number,
  pageSize: number,
  filters: AdminStudentDirectoryFilters
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  let query = client
    .from("students")
    .select(
      "id, full_name, email, contact_number, gender, parent_name, university_name, college_name, degree, department, class_semester, academic_session, roll_number, course, internship_domain, internship_duration, joining_date, completion_date, emergency_name, emergency_contact, emergency_relation, referral_code, cybercafe_shop_name, cybercafe_email, status, registration_id, metadata, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  const search = sanitizeStudentSearchTerm(filters.searchTerm || "");
  if (search) {
    const pattern = `%${search.replace(/"/g, '\\"')}%`;
    query = query.or(
      [
        `full_name.ilike."${pattern}"`,
        `email.ilike."${pattern}"`,
        `registration_id.ilike."${pattern}"`,
      ].join(",")
    );
  }
  if (filters.domainFilter && filters.domainFilter !== "all") {
    query = query.eq("internship_domain", filters.domainFilter);
  }
  if (filters.uniFilter && filters.uniFilter !== "all") {
    query = query.eq("university_name", filters.uniFilter);
  }
  if (filters.collegeFilter && filters.collegeFilter !== "all") {
    query = query.eq("college_name", filters.collegeFilter);
  }

  const { p_start, p_end } = directoryDateRange(filters);
  if (p_start) query = query.gte("created_at", p_start);
  if (p_end) query = query.lte("created_at", p_end);

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  return { rows: (data as Record<string, unknown>[]) || [], total: count || 0 };
}

/** Light student list for attendance/comms (paginates past PostgREST 1000-row cap). */
export async function fetchAdminStudentsLight(
  client: SupabaseClient
): Promise<Record<string, unknown>[]> {
  try {
    return await fetchAllSupabaseRpcRows<Record<string, unknown>>(
      client,
      "admin_list_students_light",
      { orderBy: "created_at", ascending: false, tieBreaker: "id" }
    );
  } catch (rpcErr) {
    if (!isMissingRpc(rpcErr as { code?: string; message?: string })) {
      throw rpcErr;
    }
  }

  return fetchAllSupabaseRows<Record<string, unknown>>(client, "students", {
    select:
      "id, full_name, email, college_name, university_name, created_at, status, internship_domain, registration_id",
    orderBy: "created_at",
    ascending: false,
  });
}

export async function fetchAdminSiteVisitStats(
  client: SupabaseClient
): Promise<{ totalVisits: number; uniqueVisitors: number }> {
  const { data, error } = await client.rpc("admin_site_visit_stats");
  if (!error && data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    return {
      totalVisits: Number(o.total_visits) || 0,
      uniqueVisitors: Number(o.unique_visitors) || 0,
    };
  }
  if (isMissingRpc(error)) {
    const { count } = await client.from("site_visits").select("*", { count: "exact", head: true });
    return { totalVisits: count || 0, uniqueVisitors: 0 };
  }
  throw error;
}
