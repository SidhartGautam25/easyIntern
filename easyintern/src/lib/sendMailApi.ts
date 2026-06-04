import { siteApiUrl } from "@/lib/siteApi";

/**
 * Mail uses `/api/send-mail`. Override with full URL via `VITE_SEND_MAIL_API_URL`; otherwise same origin rules as `siteApiUrl`.
 */
export function getSendMailApiUrl(): string {
  if (typeof window === "undefined") return "/api/send-mail";
  const fromEnv = import.meta.env.VITE_SEND_MAIL_API_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim();
  return siteApiUrl("/api/send-mail");
}

export async function assertSendMailOk(res: Response): Promise<void> {
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  let detail = "";
  try {
    const j = JSON.parse(text) as { message?: string; error?: string };
    // Prefer `error` — handler sets generic message + SMTP/nodemailer detail in error
    detail = (j.error || j.message || "").trim();
  } catch {
    if (text.trim()) detail = text.replace(/<[^>]+>/g, "").slice(0, 280).trim();
  }
  throw new Error(detail || `Email request failed (${res.status})`);
}
