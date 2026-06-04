import type { AuthError, Session, SupabaseClient } from "@supabase/supabase-js";

export type StudentSignInResult =
  | { ok: true; session: Session }
  | { ok: false; error: AuthError | Error };

function isInvalidLoginCredentials(err: AuthError | null | undefined): boolean {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid credentials") ||
    err?.code === "invalid_credentials"
  );
}

/** Sync Auth password from students.metadata when registration hash drifted. */
async function tryRepairStudentAuthLogin(
  client: SupabaseClient,
  email: string,
  password: string
): Promise<boolean> {
  const { data, error } = await client.rpc("repair_student_auth_login", {
    p_email: email,
    p_plain: password,
  });
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (error.code === "PGRST202" || msg.includes("could not find")) {
      return false;
    }
    console.warn("[auth] repair_student_auth_login:", error.message);
    return false;
  }
  return data === true;
}

/**
 * signInWithPassword with trim + one repair retry for student accounts.
 */
export async function signInStudentWithPassword(
  client: SupabaseClient,
  rawEmail: string,
  rawPassword: string,
  opts?: { tryRepair?: boolean }
): Promise<StudentSignInResult> {
  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword.trim();

  if (!email || !password) {
    return { ok: false, error: new Error("Please enter email and password.") };
  }

  const attempt = async () => {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { data: null as null, error };
    if (!data.session) {
      return {
        data: null as null,
        error: { message: "Authentication failed", name: "AuthError" } as AuthError,
      };
    }
    return { data, error: null };
  };

  let { data, error } = await attempt();

  if (error && isInvalidLoginCredentials(error) && opts?.tryRepair !== false) {
    const repaired = await tryRepairStudentAuthLogin(client, email, password);
    if (repaired) {
      ({ data, error } = await attempt());
    }
  }

  if (error) return { ok: false, error };
  if (!data?.session) {
    return { ok: false, error: new Error("Authentication failed") };
  }
  return { ok: true, session: data.session };
}
