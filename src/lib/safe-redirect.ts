/**
 * Post-login redirects may only go to a path on this site. "//host" and "/\host" are rejected because browsers read
 * a backslash as a slash, which would turn the redirect into a link to another site.
 */
export function safeCallbackUrl(url: string | null | undefined, fallback = "/portfolio"): string {
  return url && /^\/(?![/\\])/.test(url) ? url : fallback;
}
