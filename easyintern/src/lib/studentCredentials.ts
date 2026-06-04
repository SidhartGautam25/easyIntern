import type { SupabaseClient } from "@supabase/supabase-js";

/** Radix Select placeholders for optional student edit fields */
export const EDIT_GENDER_SENTINEL = "__edit_gender_unset__";
export const EDIT_DOMAIN_SENTINEL = "__edit_domain_unset__";

/** Latest directory row for credential emails — always fetch from DB; do not trust paginated table cache. */
export async function fetchLatestStudentCredentialRow(
  client: SupabaseClient,
  studentId: string
): Promise<{
  password: string | null;
  registration_id: string | null;
  metadata: unknown;
  email: string | null;
  full_name: string | null;
} | null> {
  const { data, error } = await client
    .from("students")
    .select("password, registration_id, metadata, email, full_name")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    password: string | null;
    registration_id: string | null;
    metadata: unknown;
    email: string | null;
    full_name: string | null;
  } | null;
}

/** Plaintext password stored for admin emailed credentials (never auth hash). */
export function getStudentDirectoryPassword(row: any): string | undefined {
  const direct = row?.password;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const m = row?.metadata;
  if (m && typeof m === "object" && typeof (m as Record<string, unknown>).password === "string") {
    const p = String((m as Record<string, unknown>).password).trim();
    if (p) return p;
  }
  return undefined;
}

/**
 * Persist plaintext password on `students.password` and `metadata.password` so admins can resend credentials.
 * Auth still uses `auth.users`; this is an optional directory copy only.
 */
export function withStoredDirectoryPassword<T extends { metadata?: unknown }>(
  payload: T,
  plainPassword: string | undefined | null
): T & { password?: string } {
  const p = typeof plainPassword === "string" ? plainPassword.trim() : "";
  if (!p) return payload as T & { password?: string };
  const prevMeta =
    typeof payload.metadata === "object" && payload.metadata !== null
      ? { ...(payload.metadata as Record<string, unknown>) }
      : {};
  return {
    ...payload,
    password: p,
    metadata: { ...prevMeta, password: p },
  };
}

/**
 * After the learner changes password in Auth (e.g. Dashboard), mirror it here so "Resend credentials" stays accurate.
 * Best-effort: ignores failures (no students row, RLS edge cases).
 */
export async function syncStudentDirectoryPassword(
  client: SupabaseClient,
  userId: string,
  plainPassword: string
): Promise<void> {
  const p = typeof plainPassword === "string" ? plainPassword.trim() : "";
  if (!userId || !p) return;

  const { data: prevRow } = await client.from("students").select("metadata").eq("id", userId).maybeSingle();
  const prevMeta =
    typeof prevRow?.metadata === "object" && prevRow.metadata !== null
      ? { ...(prevRow.metadata as Record<string, unknown>) }
      : {};

  const { error } = await client
    .from("students")
    .update({
      password: p,
      metadata: { ...prevMeta, password: p },
    })
    .eq("id", userId);

  if (error) console.warn("[syncStudentDirectoryPassword]", error.message);
}

/**
 * After `auth.updateUser({ password })`, keep directory copy in sync (admin "Resend credentials").
 * Prefer SECURITY DEFINER RPC; fall back to direct update if migration not applied yet.
 */
export async function syncDirectoryPasswordAfterAuthChange(
  client: SupabaseClient,
  plainPassword: string
): Promise<void> {
  const p = typeof plainPassword === "string" ? plainPassword.trim() : "";
  if (p.length < 6) throw new Error("Password must be at least 6 characters");

  const { error: rpcErr } = await client.rpc("sync_student_directory_password", { p_plain: p });
  if (!rpcErr) return;

  const msg = rpcErr.message || "";
  if (/sync_student_directory_password|does not exist|42883|PGRST202|404/i.test(msg)) {
    const { data: u } = await client.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) throw rpcErr;
    await syncStudentDirectoryPassword(client, uid, p);
    return;
  }
  throw rpcErr;
}

/** Readable temporary password for reset + email flows. */
export function generateTempPassword(length = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[arr[i]! % chars.length];
  return out;
}
