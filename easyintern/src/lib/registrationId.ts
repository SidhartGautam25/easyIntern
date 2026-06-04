import type { SupabaseClient } from "@supabase/supabase-js";

/** Next EZY/{year}/INT/{seq} — prefers SECURITY DEFINER RPC (avoids RLS 500 on students list). */
export async function allocateNextRegistrationId(
  client: SupabaseClient,
  year?: number
): Promise<string> {
  const currentYear = year ?? new Date().getFullYear();

  const { data: fromRpc, error: rpcErr } = await client.rpc("allocate_next_registration_id", {
    p_year: currentYear,
  });
  if (!rpcErr && typeof fromRpc === "string" && fromRpc.trim()) {
    return fromRpc.trim();
  }
  if (rpcErr) {
    const msg = String(rpcErr.message || "").toLowerCase();
    if (rpcErr.code !== "PGRST202" && !msg.includes("could not find")) {
      console.warn("[registration_id] RPC:", rpcErr.message);
    }
  }

  let nextSeq = 10001;
  const { data, error } = await client
    .from("students")
    .select("registration_id")
    .order("created_at", { ascending: false })
    .limit(25);

  if (!error && data?.length) {
    const seqs = data
      .map((row) => {
        const reg = String(row.registration_id || "").trim();
        const parts = reg.split("/");
        return parts.length === 4 && parts[0] === "EZY" && parts[1] === String(currentYear)
          ? parseInt(parts[3], 10)
          : 0;
      })
      .filter((n) => !isNaN(n) && n > 0);
    if (seqs.length > 0) nextSeq = Math.max(...seqs) + 1;
  } else if (error) {
    console.warn("[registration_id] lookup:", error.message);
  }

  return `EZY/${currentYear}/INT/${nextSeq}`;
}
