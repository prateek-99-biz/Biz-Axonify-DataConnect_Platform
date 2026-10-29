/**
 * Small in-process cache for data that changes rarely (the synced snapshots, the client list, user profiles).
 * Every uncached read is a database round trip of about 190 ms, and a page used to make three to five of them.
 *
 * - Entries expire after `ttlMs`; concurrent requests for the same key share one load.
 * - A failed load is never kept.
 * - Cached values are shared between requests, so callers must treat them as read-only.
 * - `clearCache` is called after a sync and after a settings change. Other server instances, and scripts that run in
 *   their own process, pick up changes when the entry expires.
 */
interface Entry { at: number; value?: unknown; pending?: Promise<unknown> }

const g = globalThis as unknown as { __ciCache?: Map<string, Entry> };
const store = (g.__ciCache ??= new Map<string, Entry>());

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit?.pending) return hit.pending as Promise<T>;
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  const pending = load().then(
    (value) => { store.set(key, { at: Date.now(), value }); return value; },
    (e) => { store.delete(key); throw e; },
  );
  store.set(key, { at: hit?.at ?? 0, value: hit?.value, pending });
  return pending;
}

/** Drops every entry whose key starts with `prefix`, or all of them. */
export function clearCache(prefix = "") {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}

/** How long snapshot data may be served without asking the database. */
export const SNAPSHOT_TTL_MS = 60_000;
/** Profiles are cached more briefly so a role change or deactivation takes effect quickly. */
export const PROFILE_TTL_MS = 15_000;
