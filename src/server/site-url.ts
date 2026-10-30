import "server-only";
import { headers } from "next/headers";

/** Public address of this site, for links in emails. SITE_URL wins; otherwise it is read from the request. */
export async function siteUrl(): Promise<string> {
  const fixed = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
