import type { SupabaseClient } from "@supabase/supabase-js";

export type AssignmentTakePayload = {
  assignment: {
    id: string;
    title: string;
    description?: string | null;
    duration_minutes: number;
    total_marks: number;
    passing_marks: number;
    is_active: boolean;
  };
  questions: Array<{
    id: string;
    assignment_id: string;
    question_text: string;
    options: unknown;
    marks: number;
    order_index: number;
  }>;
};

function isMissingRpc(err: { code?: string; message?: string } | null): boolean {
  const msg = String(err?.message || "").toLowerCase();
  return err?.code === "PGRST202" || msg.includes("could not find") || msg.includes("does not exist");
}

export async function fetchAssignmentTakePayload(
  client: SupabaseClient,
  assignmentId: string
): Promise<AssignmentTakePayload> {
  const { data, error } = await client.rpc("get_assignment_take_payload", {
    p_assignment_id: assignmentId,
  });
  if (error) {
    if (isMissingRpc(error)) {
      throw new Error(
        "Run supabase/migrations/20260601120000_security_rpc_registration_fees_payment.sql in Supabase SQL Editor."
      );
    }
    throw error;
  }
  if (!data || typeof data !== "object") {
    throw new Error("Assignment payload empty");
  }
  return data as AssignmentTakePayload;
}

export async function submitAssignmentGraded(
  client: SupabaseClient,
  params: {
    assignmentId: string;
    answers: Record<string, number>;
    warningsReceived: number;
    cheatingDetected: boolean;
  }
): Promise<{ score: number; is_passed: boolean; total_marks: number }> {
  const { data, error } = await client.rpc("submit_assignment_graded", {
    p_assignment_id: params.assignmentId,
    p_answers: params.answers,
    p_warnings_received: params.warningsReceived,
    p_cheating_detected: params.cheatingDetected,
  });
  if (error) {
    if (isMissingRpc(error)) {
      throw new Error(
        "Run supabase/migrations/20260601120000_security_rpc_registration_fees_payment.sql in Supabase SQL Editor."
      );
    }
    throw error;
  }
  const row = (data || {}) as { score?: number; is_passed?: boolean; total_marks?: number };
  return {
    score: Number(row.score ?? 0),
    is_passed: Boolean(row.is_passed),
    total_marks: Number(row.total_marks ?? 0),
  };
}
