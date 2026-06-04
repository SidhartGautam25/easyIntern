import type { SupabaseClient } from "@supabase/supabase-js";

export type RegistrationUniversity = {
  id: string;
  name: string;
  pisa_fee?: number | null;
};

export type RegistrationCollege = {
  id: string;
  name: string;
  university_id: string;
  pisa_fee?: number | null;
  fee_base_paise?: number | null;
  fee_processing_paise?: number | null;
  show_fee_breakdown?: boolean;
  fees_managed?: boolean;
};

export type PublicUniversity = { id: string; name: string };
export type PublicCollege = { id: string; name: string; university_id: string };

const COLLEGE_FEE_COLUMNS =
  "id, name, university_id, pisa_fee, fee_base_paise, fee_processing_paise, show_fee_breakdown, fees_managed";

function rpcArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  return [];
}

function isMissingRpc(err: { code?: string; message?: string } | null): boolean {
  const msg = String(err?.message || "").toLowerCase();
  return (
    err?.code === "PGRST202" ||
    msg.includes("could not find") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

/** Legacy direct read when RPCs are not deployed yet (no error toast). */
async function fallbackRegistrationUniversities(
  client: SupabaseClient
): Promise<RegistrationUniversity[]> {
  const { data, error } = await client
    .from("universities")
    .select("id, name, pisa_fee")
    .order("name");
  if (error) throw error;
  return (data || []) as RegistrationUniversity[];
}

async function fallbackRegistrationColleges(
  client: SupabaseClient,
  universityId: string
): Promise<RegistrationCollege[]> {
  const { data, error } = await client
    .from("colleges")
    .select(COLLEGE_FEE_COLUMNS)
    .eq("university_id", universityId)
    .order("name");
  if (error) throw error;
  return (data || []) as RegistrationCollege[];
}

async function fallbackPublicUniversities(client: SupabaseClient): Promise<PublicUniversity[]> {
  const { data, error } = await client.from("universities").select("id, name").order("name");
  if (error) throw error;
  return (data || []) as PublicUniversity[];
}

async function fallbackPublicColleges(
  client: SupabaseClient,
  universityId?: string | null
): Promise<PublicCollege[]> {
  let q = client.from("colleges").select("id, name, university_id").order("name");
  if (universityId) q = q.eq("university_id", universityId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as PublicCollege[];
}

export async function fetchRegistrationUniversities(
  client: SupabaseClient
): Promise<RegistrationUniversity[]> {
  const { data, error } = await client.rpc("get_registration_universities");
  if (!error) return rpcArray<RegistrationUniversity>(data);
  if (isMissingRpc(error)) {
    console.warn("[registration] get_registration_universities missing — using table fallback");
    return fallbackRegistrationUniversities(client);
  }
  throw error;
}

export async function fetchRegistrationColleges(
  client: SupabaseClient,
  universityId: string
): Promise<RegistrationCollege[]> {
  const { data, error } = await client.rpc("get_registration_colleges", {
    p_university_id: universityId,
  });
  if (!error) return rpcArray<RegistrationCollege>(data);
  if (isMissingRpc(error)) {
    console.warn("[registration] get_registration_colleges missing — using table fallback");
    return fallbackRegistrationColleges(client, universityId);
  }
  throw error;
}

export async function fetchPublicUniversities(client: SupabaseClient): Promise<PublicUniversity[]> {
  const { data, error } = await client.rpc("list_public_universities");
  if (!error) return rpcArray<PublicUniversity>(data);
  if (isMissingRpc(error)) {
    return fallbackPublicUniversities(client);
  }
  throw error;
}

export async function fetchPublicColleges(
  client: SupabaseClient,
  universityId?: string | null
): Promise<PublicCollege[]> {
  const { data, error } = await client.rpc("list_public_colleges", {
    p_university_id: universityId || null,
  });
  if (!error) return rpcArray<PublicCollege>(data);
  if (isMissingRpc(error)) {
    return fallbackPublicColleges(client, universityId);
  }
  throw error;
}
