import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AssignedCollege,
  filterStudentsForAssignedColleges,
} from "@/lib/collegeAdminScope";

export type CollegeAdminBootstrap = {
  assignedColleges: AssignedCollege[];
  students: Record<string, unknown>[];
};

const RPC_PAGE = 1000;

async function fetchAllCollegeAdminRpcStudents(
  supabase: SupabaseClient
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .rpc("college_admin_list_students")
      .range(from, from + RPC_PAGE - 1);

    if (error) throw error;
    const batch = (data || []) as Record<string, unknown>[];
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < RPC_PAGE) break;
    from += RPC_PAGE;
  }

  return all;
}

async function loadAssignedColleges(
  supabase: SupabaseClient,
  userId: string
): Promise<AssignedCollege[]> {
  const { data: assignments, error: assignErr } = await supabase
    .from("college_admin_assignments")
    .select("college_id, colleges(id, name, universities(name))")
    .eq("user_id", userId);

  if (assignErr) throw assignErr;

  return (assignments || [])
    .map(
      (a: {
        college_id: string;
        colleges?: { id: string; name: string; universities?: { name: string } | null } | null;
      }) => {
        const c = a.colleges;
        if (!c?.id || !c?.name) return null;
        return {
          id: c.id,
          name: c.name,
          universityName: c.universities?.name ?? null,
        };
      }
    )
    .filter(Boolean) as AssignedCollege[];
}

/** Load assigned colleges + students (scoped to those colleges under their university). */
export async function fetchCollegeAdminPortalData(
  supabase: SupabaseClient,
  userId: string
): Promise<CollegeAdminBootstrap> {
  const assignedColleges = await loadAssignedColleges(supabase, userId);

  if (!assignedColleges.length) {
    return { assignedColleges: [], students: [] };
  }

  try {
    const rpcRows = await fetchAllCollegeAdminRpcStudents(supabase);
    return { assignedColleges, students: rpcRows };
  } catch (rpcErr) {
    console.warn("college_admin_list_students RPC:", rpcErr);
  }

  const allStudents: Record<string, unknown>[] = [];
  let from = 0;
  const page = 1000;

  for (;;) {
    const { data: rows, error: stuErr } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + page - 1);

    if (stuErr) throw stuErr;
    const batch = (rows || []) as Record<string, unknown>[];
    if (!batch.length) break;
    allStudents.push(...batch);
    if (batch.length < page) break;
    from += page;
  }

  const students = filterStudentsForAssignedColleges(allStudents, assignedColleges);

  return { assignedColleges, students };
}
