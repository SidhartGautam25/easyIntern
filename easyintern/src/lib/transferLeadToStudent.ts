import type { SupabaseClient } from "@supabase/supabase-js";
import { adminUpsertStudentProfile } from "@/lib/adminProfileUpsert";
import { createEphemeralSupabaseAuthClient } from "@/lib/createSubUser";
import { completeStudentDirectoryRegistration } from "@/lib/registerStudentDirectory";
import { signUpStudentWithChosenPassword } from "@/lib/registrationPassword";

export type LeadTransferInput = {
  directoryClient: SupabaseClient;
  lead: Record<string, unknown>;
  password: string;
  /** Prefix for synthetic payment_success.payment_id (e.g. ADMIN_TRANS_). */
  paymentIdPrefix?: string;
};

function isRegistrationIdCollision(err: unknown): boolean {
  const e = err as { code?: string; message?: string; details?: string };
  const blob = `${e.code || ""} ${e.message || ""} ${e.details || ""}`.toLowerCase();
  return e.code === "23505" && blob.includes("registration_id");
}

/** Resolve a real auth.users id (retries briefly after signUp). */
export async function ensureAuthUserIdForEmail(
  client: SupabaseClient,
  email: string,
  hintId?: string
): Promise<string> {
  const normalized = email.trim().toLowerCase();

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: rpcId, error: rpcErr } = await client.rpc("get_user_id_by_email", {
      email_text: normalized,
    });
    if (!rpcErr && rpcId) {
      return String(rpcId);
    }

    const { data: prof } = await client
      .from("profiles")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();
    if (prof?.id) {
      return prof.id;
    }

    if (attempt < 5) {
      await new Promise((r) => setTimeout(r, 300 + attempt * 200));
    }
  }

  if (hintId) {
    const { data: rpcId } = await client.rpc("get_user_id_by_email", {
      email_text: normalized,
    });
    if (rpcId && String(rpcId) === hintId) {
      return hintId;
    }
  }

  throw new Error(
    "Auth account was not found after signup. In Supabase Auth, disable “Confirm email” for new signups, or confirm the account, then retry."
  );
}

async function allocateNextRegistrationId(client: SupabaseClient): Promise<string> {
  const { data: latestStudents } = await client
    .from("students")
    .select("registration_id")
    .not("registration_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  let nextSeq = 10001;
  if (latestStudents && latestStudents.length > 0) {
    const seqs = latestStudents
      .map((s) => {
        const parts = String(s.registration_id || "").split("/");
        return parts.length === 4 ? parseInt(parts[3], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    if (seqs.length > 0) {
      nextSeq = Math.max(...seqs) + 1;
    }
  }

  const currentYear = new Date().getFullYear();
  return `EZY/${currentYear}/INT/${nextSeq}`;
}

function buildStudentRow(
  userId: string,
  normalizedEmail: string,
  leadName: string,
  lead: Record<string, unknown>,
  metadata: Record<string, unknown>,
  registrationId: string,
  enrichedMeta: Record<string, unknown>
): Record<string, unknown> {
  return {
    id: userId,
    email: normalizedEmail,
    full_name: leadName,
    gender: metadata.gender,
    parent_name: metadata.parentName,
    contact_number: lead.user_phone || lead.contact_number || metadata.contact,
    university_name: lead.university_name || metadata.university,
    college_name: lead.college_name || metadata.college,
    course: metadata.course,
    internship_domain: metadata.course,
    degree: metadata.degree,
    department: metadata.department,
    class_semester: metadata.semester,
    academic_session: metadata.session,
    roll_number: metadata.rollNo,
    emergency_name: metadata.emName,
    emergency_contact: metadata.emPhone,
    emergency_relation: metadata.emRel,
    status: "Active",
    cybercafe_shop_name: lead.cybercafe_shop_name,
    cybercafe_email: lead.cybercafe_email,
    registration_id: registrationId,
    metadata: enrichedMeta,
  };
}

/**
 * Lead Hub → Students Directory: create/link auth user, profile, then student row via RPC.
 */
export async function transferLeadToStudentDirectory(
  input: LeadTransferInput
): Promise<{ userId: string; registrationId: string }> {
  const { directoryClient, lead, password, paymentIdPrefix = "ADMIN_TRANS_" } = input;

  const leadEmail = String(lead.email || lead.user_email || "").trim();
  if (!leadEmail) {
    throw new Error("Lead has no email address.");
  }
  const normalizedEmail = leadEmail.toLowerCase();
  const leadName = String(lead.full_name || (lead.metadata as Record<string, unknown>)?.fullName || leadEmail);
  const metadata = ((lead.metadata || {}) as Record<string, unknown>) || {};
  const enrichedMeta = { ...metadata, password };

  const transferClient = createEphemeralSupabaseAuthClient();
  const { userId: signUpId } = await signUpStudentWithChosenPassword(transferClient, directoryClient, {
    email: normalizedEmail,
    password,
    fullName: leadName,
  });

  const userId = await ensureAuthUserIdForEmail(directoryClient, normalizedEmail, signUpId);

  await adminUpsertStudentProfile(directoryClient, {
    id: userId,
    full_name: leadName,
    email: normalizedEmail,
    contact_number: String(lead.user_phone || lead.contact_number || metadata.contact || ""),
    gender: (metadata.gender as string) || null,
    parent_name: (metadata.parentName as string) || null,
  });

  let regId = await allocateNextRegistrationId(directoryClient);
  const profileRow = {
    id: userId,
    full_name: leadName,
    email: normalizedEmail,
    contact_number: lead.user_phone || lead.contact_number || metadata.contact,
    gender: metadata.gender,
    parent_name: metadata.parentName,
  };

  let retryCount = 0;
  while (retryCount < 10) {
    const studentRow = buildStudentRow(
      userId,
      normalizedEmail,
      leadName,
      lead,
      metadata,
      regId,
      enrichedMeta
    );

    try {
      await completeStudentDirectoryRegistration({
        client: directoryClient,
        studentRow,
        profileRow,
      });
      break;
    } catch (err) {
      if (isRegistrationIdCollision(err)) {
        const parts = regId.split("/");
        const seq = parts.length === 4 ? parseInt(parts[3], 10) : 10001;
        const year = parts.length === 4 ? parts[1] : String(new Date().getFullYear());
        regId = `EZY/${year}/INT/${(isNaN(seq) ? 10001 : seq) + 1}`;
        retryCount++;
        continue;
      }
      const msg = String((err as { message?: string })?.message || "");
      if (msg.includes("students_id_fkey") || msg.includes("violates foreign key")) {
        throw new Error(
          "Could not link student record to auth account. Confirm the email is not already registered under another id, then retry."
        );
      }
      throw err;
    }
  }

  if (retryCount >= 10) {
    throw new Error("Could not allocate a unique registration ID. Try again.");
  }

  await directoryClient
    .from("user_roles")
    .upsert({ user_id: userId, role: "student" }, { onConflict: "user_id,role" });

  const { error: paymentError } = await directoryClient.from("payment_success").insert({
    user_id: userId,
    payment_id: `${paymentIdPrefix}${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    amount_paise: Number(lead.amount_paise || lead.amount || 9900),
    email: normalizedEmail,
    full_name: leadName,
    college_name: lead.college_name || metadata.college,
    status: "success",
  });
  if (paymentError) {
    console.error("Payment log error:", paymentError);
  }

  return { userId, registrationId: regId };
}
