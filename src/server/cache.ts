/**
 * Small in-process cache for data that changes rarely (the synced snapshots, the client list, user profiles).
 * Every uncached read is a database round trip of about 190 ms, and a page used to make three to five of them.
 *
 * - Entries expire after `ttlMs`; concurrent requests for the same key share one load.
 * - A failed load is never kept.
 * - With `staleMs`, an entry past its TTL but younger than `staleMs` is served at once while one background refresh runs, so
 *   nobody waits on a reload just because the TTL ran out. Only use it for data where that is acceptable (not for auth).
 * - Cached values are shared between requests, so callers must treat them as read-only.
 * - `clearCache` is called after a sync and after a settings change. Other server instances, and scripts that run in
 *   their own process, pick up changes when the entry expires.
 */
interface Entry { at: number; value?: unknown; pending?: Promise<unknown> }

const g = globalThis as unknown as { __ciCache?: Map<string, Entry>; __ciCacheGen?: number };
const store = (g.__ciCache ??= new Map<string, Entry>());

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>, staleMs = 0): Promise<T> {
  const hit = store.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  const hasValue = hit !== undefined && hit.at > 0;
  if (hit && !hit.pending && age < ttlMs) return hit.value as T;
  if (hit?.pending) return hasValue && age < staleMs ? (hit.value as T) : (hit.pending as Promise<T>);

  // A clear while this load is running means the result may predate the change; hand it to the caller but do not keep it.
  const gen = g.__ciCacheGen ?? 0;
  const pending = load().then(
    (value) => { if ((g.__ciCacheGen ?? 0) === gen) store.set(key, { at: Date.now(), value }); else store.delete(key); return value; },
    (e) => {
      // A failed refresh keeps the old copy for the next attempt; a failed first load leaves nothing behind.
      if (hasValue && hit) store.set(key, { at: hit.at, value: hit.value }); else store.delete(key);
      throw e;
    },
  );
  store.set(key, { at: hit?.at ?? 0, value: hit?.value, pending });
  if (hasValue && age < staleMs) {
    pending.catch(() => undefined);
    return hit!.value as T;
  }
  return pending;
}

/** Drops every entry whose key starts with `prefix`, or all of them. */
export function clearCache(prefix = "") {
  g.__ciCacheGen = (g.__ciCacheGen ?? 0) + 1;
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}

/** How long snapshot data may be served without asking the database. */
export const SNAPSHOT_TTL_MS = 60_000;
/** Past the TTL, snapshot data is still served at once (while it refreshes) for this long; after that a request waits for fresh data. */
export const SNAPSHOT_STALE_MS = 600_000;
/** Profiles are cached more briefly so a role change or deactivation takes effect quickly. */
export const PROFILE_TTL_MS = 15_000;
