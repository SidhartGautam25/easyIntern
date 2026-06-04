import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Never persists session — safe for signing up another user while an admin stays logged in on the main client. */
export function createEphemeralSupabaseAuthClient() {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  if (!url || !key) throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
  });
}

export type SubUserPermissionsInput = Record<string, boolean>;

/**
 * Creates staff/sub-admin using anon-key Auth.signUp + DB trigger (handle_new_user),
 * then applies granular permissions via SECURITY DEFINER RPC — no service role key required.
 */
export async function createSubUserWithoutServiceRole(
  sessionSupabase: SupabaseClient,
  params: {
    email: string;
    password: string;
    roleTag: string;
    role: "staff" | "admin";
    permissions: SubUserPermissionsInput;
  }
): Promise<{ userId: string }> {
  const email = params.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required");
  if (!params.password || params.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const appRole = params.role === "staff" ? "staff" : "admin";
  const ephemeral = createEphemeralSupabaseAuthClient();

  // The signup trigger always assigns the 'student' role. Role / is_staff are
  // NEVER sent in metadata — they are not trusted server-side and elevation
  // happens inside finalize_sub_admin_creation under the caller's admin JWT.
  const { data, error } = await ephemeral.auth.signUp({
    email,
    password: params.password,
    options: {
      data: {
        full_name: params.roleTag,
      },
    },
  });

  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) {
    throw new Error(
      "Signup did not return a user id. Check Supabase Auth: disable “Confirm email” for invite-style accounts, or confirm the user completed verification."
    );
  }

  const { error: rpcError } = await sessionSupabase.rpc("finalize_sub_admin_creation", {
    target_user_id: userId,
    staff_email: email,
    staff_full_name: params.roleTag,
    p_permissions: params.permissions as Record<string, unknown>,
    p_role: appRole,
  });

  if (rpcError) {
    const msg = rpcError.message || "";
    if (/finalize_sub_admin_creation|does not exist|42883/i.test(msg)) {
      throw new Error(
        "Database function finalize_sub_admin_creation is missing. Run the migration supabase/migrations/20260509200000_finalize_sub_admin_creation_rpc.sql on your Supabase project (SQL Editor or CLI)."
      );
    }
    throw rpcError;
  }

  return { userId };
}

const COLLEGE_ADMIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Human-facing College Admin ID; also used as the initial Supabase password (min 6 chars). */
export function generateCollegeAdminCode(): string {
  let s = "CA-";
  for (let i = 0; i < 10; i++) {
    s += COLLEGE_ADMIN_CODE_CHARS[Math.floor(Math.random() * COLLEGE_ADMIN_CODE_CHARS.length)];
  }
  return s;
}

function friendlyCollegeAdminError(err: unknown): string {
  const msg = String((err as { message?: string })?.message || err || "");
  if (/college_admin_assignments_code_key|duplicate key/i.test(msg)) {
    return (
      "Could not save college assignments (duplicate College Admin ID in database). " +
      "Run migration supabase/migrations/20260523120000_college_admin_code_not_unique.sql in Supabase, " +
      "then click Generate ID again and retry."
    );
  }
  if (/already registered|already exists|user already/i.test(msg)) {
    return (
      "This email already has an account. Use a different email for a new college admin, " +
      "or find them in the College administrators table below and click Edit to update colleges."
    );
  }
  return msg || "Failed to create college administrator";
}

async function resolveProfileIdByEmail(
  sessionSupabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const { data } = await sessionSupabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

async function resolveAuthUserIdByEmail(
  sessionSupabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const fromProfile = await resolveProfileIdByEmail(sessionSupabase, email);
  if (fromProfile) return fromProfile;

  const { data: student } = await sessionSupabase
    .from("students")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (student?.id) return student.id;

  const { data: authId, error } = await sessionSupabase.rpc("resolve_auth_user_id_by_email", {
    p_email: email,
  });
  if (error) {
    const msg = error.message || "";
    if (/resolve_auth_user_id_by_email|does not exist|42883/i.test(msg)) {
      return null;
    }
    throw error;
  }
  return (authId as string | null) ?? null;
}

function friendlyReferralPartnerError(err: unknown): string {
  const msg = String((err as { message?: string })?.message || err || "");
  if (/portal already provisioned|already has portal/i.test(msg)) {
    return "This partner already has promoter portal access.";
  }
  if (/Invalid partner|email mismatch/i.test(msg)) {
    return "Partner record email does not match. Edit the partner email and try again.";
  }
  return msg || "Failed to create promoter portal";
}

async function assertReferralPartnerEmailLinkable(
  sessionSupabase: SupabaseClient,
  email: string,
  partnerId: string,
  existingUserId: string
): Promise<void> {
  const { data: linkedElsewhere } = await sessionSupabase
    .from("referral_partners")
    .select("id, full_name")
    .eq("auth_user_id", existingUserId)
    .neq("id", partnerId)
    .maybeSingle();
  if (linkedElsewhere) {
    throw new Error(
      `This email is already linked to another referral partner (${linkedElsewhere.full_name}). Use a different email.`
    );
  }

  const { data: roles } = await sessionSupabase
    .from("user_roles")
    .select("role")
    .eq("user_id", existingUserId);
  const roleList = (roles || []).map((r) => r.role);

  if (roleList.some((r) => ["admin", "super_admin", "staff", "college_admin"].includes(r))) {
    throw new Error(
      "This email belongs to a staff or college admin account. Use a different email for the promoter portal."
    );
  }

  const { data: cyber } = await sessionSupabase
    .from("cybercafe_profiles")
    .select("id")
    .eq("id", existingUserId)
    .maybeSingle();
  if (cyber) {
    throw new Error("This email belongs to a cyber cafe account. Use a different email.");
  }

  const { data: selfLinked } = await sessionSupabase
    .from("referral_partners")
    .select("id")
    .eq("id", partnerId)
    .eq("auth_user_id", existingUserId)
    .maybeSingle();
  if (selfLinked) {
    throw new Error("This partner already has promoter portal access.");
  }
}

async function setPromoterLoginPassword(
  sessionSupabase: SupabaseClient,
  userId: string,
  secret: string
): Promise<void> {
  const { error } = await sessionSupabase.rpc("admin_reset_user_password", {
    target_user_id: userId,
    new_pass: secret,
  });
  if (error) {
    throw new Error(error.message || "Could not set promoter login password");
  }
}

async function finalizeReferralPartnerPortal(
  sessionSupabase: SupabaseClient,
  params: {
    userId: string;
    partnerId: string;
    loginSecret: string;
    fullName: string;
    email: string;
  }
): Promise<void> {
  const { error: rpcError } = await sessionSupabase.rpc("finalize_referral_partner_creation", {
    target_user_id: params.userId,
    p_partner_id: params.partnerId,
    p_login_secret: params.loginSecret,
    partner_full_name: params.fullName.trim() || params.email,
    partner_email: params.email,
  });

  if (rpcError) {
    const msg = rpcError.message || "";
    if (/finalize_referral_partner_creation|does not exist|42883/i.test(msg)) {
      throw new Error(
        "Database function finalize_referral_partner_creation is missing. Apply referral partner migrations (20260515135500 + 20260515140000)."
      );
    }
    throw new Error(friendlyReferralPartnerError(rpcError));
  }
}

export async function createCollegeAdminWithoutServiceRole(
  sessionSupabase: SupabaseClient,
  params: {
    email: string;
    collegeAdminCode: string;
    fullName: string;
    collegeIds: string[];
  }
): Promise<{ userId: string; updatedExisting: boolean }> {
  const email = params.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required");
  const code = params.collegeAdminCode.trim();
  if (code.length < 6) throw new Error("College Admin ID must be at least 6 characters");
  const collegeIds = [...new Set(params.collegeIds.filter(Boolean))];
  if (collegeIds.length < 1) throw new Error("Add at least one college (tick boxes, then press Add)");

  const existingId = await resolveProfileIdByEmail(sessionSupabase, email);
  if (existingId) {
    const { data: roles } = await sessionSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", existingId);
    const roleList = (roles || []).map((r) => r.role);
    if (roleList.includes("college_admin")) {
      await updateCollegeAdminAssignments(sessionSupabase, {
        userId: existingId,
        email,
        fullName: params.fullName.trim() || email,
        collegeIds,
        collegeAdminCode: code,
      });
      return { userId: existingId, updatedExisting: true };
    }
    if (roleList.some((r) => ["admin", "super_admin", "staff"].includes(r))) {
      throw new Error(
        "This email belongs to a staff/admin account. Use a different email for the college portal."
      );
    }
    throw new Error(
      "This email is already registered as a student or another user. " +
        "Use a different email, or contact support to convert the account."
    );
  }

  const ephemeral = createEphemeralSupabaseAuthClient();

  const { data, error } = await ephemeral.auth.signUp({
    email,
    password: code,
    options: {
      data: {
        full_name: params.fullName.trim() || email,
      },
    },
  });

  let userId = data.user?.id ?? null;

  if (error) {
    const msg = error.message || "";
    if (/already registered|already exists/i.test(msg)) {
      userId = await resolveProfileIdByEmail(sessionSupabase, email);
      if (!userId) {
        throw new Error(
          "This email already exists in Auth but has no profile yet. Use a different email or fix the account in Supabase."
        );
      }
    } else {
      throw error;
    }
  }

  if (!userId) {
    throw new Error(
      "Signup did not return a user id. Check Supabase Auth email confirmation settings for invite-style accounts."
    );
  }

  const { error: rpcError } = await sessionSupabase.rpc("finalize_college_admin_creation", {
    target_user_id: userId,
    staff_email: email,
    staff_full_name: params.fullName.trim() || email,
    p_college_ids: collegeIds,
    p_college_admin_code: code,
  });

  if (rpcError) {
    const msg = rpcError.message || "";
    if (/finalize_college_admin_creation|does not exist|42883/i.test(msg)) {
      throw new Error(
        "Database function finalize_college_admin_creation is missing. Apply supabase/migrations/20260522120000_college_admin_multi_college.sql on your Supabase project."
      );
    }
    throw new Error(friendlyCollegeAdminError(rpcError));
  }

  return { userId, updatedExisting: false };
}

export async function updateCollegeAdminAssignments(
  sessionSupabase: SupabaseClient,
  params: {
    userId: string;
    email: string;
    fullName: string;
    collegeIds: string[];
    collegeAdminCode?: string;
  }
): Promise<void> {
  const collegeIds = [...new Set(params.collegeIds.filter(Boolean))];
  if (collegeIds.length < 1) throw new Error("Select at least one college");

  const { error: rpcError } = await sessionSupabase.rpc("update_college_admin_assignments", {
    target_user_id: params.userId,
    staff_email: params.email.trim().toLowerCase(),
    staff_full_name: params.fullName.trim() || params.email,
    p_college_ids: collegeIds,
    p_college_admin_code: params.collegeAdminCode?.trim() || null,
  });

  if (rpcError) {
    const msg = rpcError.message || "";
    if (/update_college_admin_assignments|does not exist|42883/i.test(msg)) {
      throw new Error(
        "Database function update_college_admin_assignments is missing. Apply supabase/migrations/20260522120000_college_admin_multi_college.sql on your Supabase project."
      );
    }
    throw new Error(friendlyCollegeAdminError(rpcError));
  }
}

export function generateReferralPartnerLoginCode(): string {
  let s = "RP-";
  for (let i = 0; i < 10; i++) {
    s += COLLEGE_ADMIN_CODE_CHARS[Math.floor(Math.random() * COLLEGE_ADMIN_CODE_CHARS.length)];
  }
  return s;
}

export async function createReferralPartnerWithoutServiceRole(
  sessionSupabase: SupabaseClient,
  params: {
    email: string;
    loginSecret: string;
    partnerId: string;
    fullName: string;
  }
): Promise<{ userId: string; linkedExisting: boolean }> {
  const email = params.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required");
  const secret = params.loginSecret.trim();
  if (secret.length < 6) throw new Error("Promoter login ID must be at least 6 characters");

  let userId = await resolveAuthUserIdByEmail(sessionSupabase, email);
  let linkedExisting = false;

  if (userId) {
    await assertReferralPartnerEmailLinkable(sessionSupabase, email, params.partnerId, userId);
    linkedExisting = true;
  } else {
    const ephemeral = createEphemeralSupabaseAuthClient();
    const { data, error } = await ephemeral.auth.signUp({
      email,
      password: secret,
      options: {
        data: {
          full_name: params.fullName.trim() || email,
        },
      },
    });

    if (error) {
      const msg = error.message || "";
      if (/already registered|already exists|user already/i.test(msg)) {
        userId = await resolveAuthUserIdByEmail(sessionSupabase, email);
        if (!userId) {
          throw new Error(
            "This email already exists in Auth but could not be linked. Run migration 20260527120000_referral_partner_link_existing_auth.sql, or use a different email."
          );
        }
        await assertReferralPartnerEmailLinkable(sessionSupabase, email, params.partnerId, userId);
        linkedExisting = true;
      } else {
        throw error;
      }
    } else {
      userId = data.user?.id ?? null;
    }
  }

  if (!userId) {
    throw new Error(
      "Signup did not return a user id. Check Supabase Auth email confirmation settings for invite-style accounts."
    );
  }

  await setPromoterLoginPassword(sessionSupabase, userId, secret);
  await finalizeReferralPartnerPortal(sessionSupabase, {
    userId,
    partnerId: params.partnerId,
    loginSecret: secret,
    fullName: params.fullName,
    email,
  });

  return { userId, linkedExisting };
}
