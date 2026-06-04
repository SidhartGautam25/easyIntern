/**
 * `vite` proxies `/api/*` → localhost:3000. If nothing listens there, fetch often returns an **empty body**,
 * and `response.json()` throws `Unexpected end of JSON input`.
 *
 * On localhost we default to the deployed origin (`www` avoids apex→www redirect issues with CORS preflight).
 * Override with `VITE_SITE_API_ORIGIN` (e.g. `http://localhost:3000` when running `vercel dev`).
 */
const DEFAULT_LOCALHOST_API_ORIGIN = "https://www.ezyintern.in";

export function getSiteApiOrigin(): string {
  if (typeof window === "undefined") return "";
  const fromEnv = import.meta.env.VITE_SITE_API_ORIGIN as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim().replace(/\/$/, "");
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return DEFAULT_LOCALHOST_API_ORIGIN;
  return "";
}

/** Absolute URL in local dev when needed; relative path when the app is served from production. */
export function siteApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origin = getSiteApiOrigin();
  return origin ? `${origin}${p}` : p;
}
