import { getSendMailApiUrl } from "@/lib/sendMailApi";

export type BulkCustomMailResult = {
  sent: number;
  failed: number;
  rateLimited: boolean;
  stoppedEarly: boolean;
  lastError?: string;
};

/** Match server BULK_BATCH_MAX — small batches avoid Vercel 10s timeouts on production. */
export const BULK_MAIL_BATCH_SIZE = 5;
const BATCH_GAP_MS = 250;
const RATE_LIMIT_PAUSE_MS = 45_000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Rough seconds left for UI (batch API + Hostinger pacing). */
export function estimateBulkMailSeconds(recipientCount: number): number {
  if (recipientCount <= 0) return 0;
  if (recipientCount === 1) return 8;
  if (recipientCount <= 5) return 12 + recipientCount * 2;
  const batches = Math.ceil(recipientCount / BULK_MAIL_BATCH_SIZE);
  const secondsPerBatch = 12;
  return batches * secondsPerBatch + (batches - 1) * (BATCH_GAP_MS / 1000);
}

export function formatBulkMailEta(totalSeconds: number): string {
  if (totalSeconds < 90) return `~${Math.max(30, totalSeconds)}s`;
  const min = Math.ceil(totalSeconds / 60);
  return `~${min} min`;
}

async function sendOneBulkMail(
  to: string,
  subject: string,
  message: string
): Promise<{ ok: boolean; rateLimited: boolean; error?: string }> {
  try {
    const response = await fetch(getSendMailApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "bulk_custom_mail",
        to,
        email: to,
        subject,
        message,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
    };
    if (response.ok && result.success) return { ok: true, rateLimited: false };
    const errMsg = result.message || `HTTP ${response.status}`;
    return {
      ok: false,
      rateLimited: response.status === 429,
      error: errMsg,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      rateLimited: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Fallback when batch action is not deployed yet (one request per recipient). */
async function sendBatchOneByOne(
  recipients: string[],
  subject: string,
  message: string
): Promise<{
  sent: number;
  failed: number;
  rateLimited: boolean;
  error?: string;
}> {
  let sent = 0;
  let failed = 0;
  let rateLimited = false;
  let lastError: string | undefined;

  const gap = recipients.length <= 5 ? 400 : 1_500;
  for (let i = 0; i < recipients.length; i++) {
    if (i > 0) await sleep(gap);
    const outcome = await sendOneBulkMail(recipients[i], subject, message);
    if (outcome.ok) sent++;
    else {
      failed++;
      lastError = outcome.error;
      if (outcome.rateLimited) {
        rateLimited = true;
        break;
      }
    }
  }

  return { sent, failed, rateLimited, error: lastError };
}

function isBatchTimeoutResponse(status: number, errText: string): boolean {
  const low = errText.toLowerCase();
  return (
    status === 502 ||
    status === 504 ||
    status === 408 ||
    low.includes("timeout") ||
    low.includes("timed out") ||
    low.includes("function_invocation") ||
    low.includes("maximum duration")
  );
}

async function sendBatch(
  recipients: string[],
  subject: string,
  message: string
): Promise<{
  sent: number;
  failed: number;
  rateLimited: boolean;
  error?: string;
}> {
  if (recipients.length === 0) {
    return { sent: 0, failed: 0, rateLimited: false };
  }

  let response: Response;
  try {
    response = await fetch(getSendMailApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "bulk_custom_mail_batch",
        recipients,
        subject,
        message,
      }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (recipients.length > 1 && msg.toLowerCase().includes("fetch")) {
      const mid = Math.ceil(recipients.length / 2);
      const left = await sendBatch(recipients.slice(0, mid), subject, message);
      const right = await sendBatch(recipients.slice(mid), subject, message);
      return {
        sent: left.sent + right.sent,
        failed: left.failed + right.failed,
        rateLimited: left.rateLimited || right.rateLimited,
        error: right.error || left.error,
      };
    }
    if (msg.toLowerCase().includes("fetch")) {
      console.warn("[bulk-mail] network error; falling back to one-by-one");
      return sendBatchOneByOne(recipients, subject, message);
    }
    return {
      sent: 0,
      failed: recipients.length,
      rateLimited: false,
      error: msg,
    };
  }

  const result = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    sent?: number;
    failed?: number;
    rateLimited?: boolean;
    message?: string;
    error?: string;
  };

  const errText = String(result.message || result.error || "");
  if (
    !response.ok &&
    (errText.toLowerCase().includes("unknown mail action") ||
      response.status === 404 ||
      response.status === 405)
  ) {
    console.warn("[bulk-mail] batch action missing on server; using one-by-one");
    return sendBatchOneByOne(recipients, subject, message);
  }

  if (!response.ok && recipients.length > 1 && isBatchTimeoutResponse(response.status, errText)) {
    console.warn("[bulk-mail] batch timed out; splitting", recipients.length);
    const mid = Math.ceil(recipients.length / 2);
    const left = await sendBatch(recipients.slice(0, mid), subject, message);
    const right = await sendBatch(recipients.slice(mid), subject, message);
    return {
      sent: left.sent + right.sent,
      failed: left.failed + right.failed,
      rateLimited: left.rateLimited || right.rateLimited,
      error: right.error || left.error,
    };
  }

  const sent = Number(result.sent) || 0;
  const failed = Number(result.failed) || 0;
  const rateLimited = Boolean(result.rateLimited) || response.status === 429;
  const error = result.message || result.error || (response.ok ? undefined : `HTTP ${response.status}`);

  return { sent, failed, rateLimited, error };
}

/** Send bulk announcements in server batches via /api/send-mail (CORS-safe, already deployed). */
export async function sendBulkCustomMail(
  targets: string[],
  subject: string,
  message: string,
  onProgress?: (completed: number, total: number) => void
): Promise<BulkCustomMailResult> {
  const unique = Array.from(
    new Set(targets.map((e) => String(e || "").trim()).filter((e) => e.includes("@")))
  );

  let sent = 0;
  let failed = 0;
  let rateLimited = false;
  let stoppedEarly = false;
  let lastError: string | undefined;

  if (unique.length === 1) {
    const outcome = await sendOneBulkMail(unique[0], subject, message);
    onProgress?.(1, 1);
    return {
      sent: outcome.ok ? 1 : 0,
      failed: outcome.ok ? 0 : 1,
      rateLimited: outcome.rateLimited,
      stoppedEarly: outcome.rateLimited,
      lastError: outcome.error,
    };
  }

  for (let i = 0; i < unique.length; i += BULK_MAIL_BATCH_SIZE) {
    const batch = unique.slice(i, i + BULK_MAIL_BATCH_SIZE);

    let outcome = await sendBatch(batch, subject, message);

    if (outcome.rateLimited && outcome.sent === 0) {
      await sleep(RATE_LIMIT_PAUSE_MS);
      outcome = await sendBatch(batch, subject, message);
    }

    sent += outcome.sent;
    failed += outcome.failed;
    lastError = outcome.error;
    onProgress?.(sent + failed, unique.length);

    if (outcome.rateLimited) {
      rateLimited = true;
      stoppedEarly = true;
      break;
    }

    if (i + BULK_MAIL_BATCH_SIZE < unique.length) {
      await sleep(BATCH_GAP_MS);
    }
  }

  return { sent, failed, rateLimited, stoppedEarly, lastError };
}
