import "server-only";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { cached, clearCache, PROFILE_TTL_MS } from "@/server/cache";
import { devLoginEnabled } from "@/server/env";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { parseRole, seedRole, type Role } from "./rbac";

export const DEV_COOKIE = "ci_dev_user";

export interface SessionUser { id: string; email: string; name: string | null; role: Role; clientId: string | null }
export interface Session { user: SessionUser }

const adminEmails = () => (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/**
 * Current user, or null. Production identity is Supabase Auth (JWT verified with Supabase on every call).
 * The cookie-based dev login only works when NODE_ENV !== "production" and AUTH_DEV_LOGIN=true.
 */
export async function auth(): Promise<Session | null> {
  const store = await cookies();

  if (devLoginEnabled()) {
    const raw = store.get(DEV_COOKIE)?.value;
    if (raw) {
      const [email, roleRaw, devClient] = decodeURIComponent(raw).split("|");
      const role = parseRole(roleRaw);
      if (email?.endsWith("@bizgroup.ae") && role) {
        const row = await upsertProfile(`dev-${email}`, email, email.split("@")[0], role);
        // Dev only: the cookie can name the client for CLIENT users without a stored assignment.
        return row.active ? { user: { id: row.id, email: row.email, name: row.name, role: row.role, clientId: row.clientId ?? (devClient || null) } } : null;
      }
    }
  }

  if (!supabaseConfigured()) return null;
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user?.email) return null;
  const email = data.user.email.toLowerCase();
  const name = (data.user.user_metadata?.full_name as string | undefined) ?? null;
  const row = await upsertProfile(data.user.id, email, name, seedRole(email, adminEmails(), !!data.user.email_confirmed_at));
  return row.active ? { user: { id: row.id, email: row.email, name: row.name, role: row.role, clientId: row.clientId } } : null;
}

/** Creates the profile on first sight. After that the stored role (managed in Settings) wins; ADMIN_EMAILS and the company domain only seed the first role. */
async function upsertProfile(id: string, email: string, name: string | null, initialRole: Role) {
  const existing = await cached(`user:${id}`, PROFILE_TTL_MS, () => db.appUser.findUnique({ where: { id } }));
  if (existing) return existing;
  try {
    const created = await db.appUser.create({ data: { id, email, name, role: initialRole, lastLogin: new Date() } });
    clearCache(`user:${id}`);
    return created;
  } catch (e) {
    // Parallel requests on first sign-in (layout + page) can race to create the same profile.
    if ((e as { code?: string }).code === "P2002") {
      const row = await db.appUser.findFirst({ where: { OR: [{ id }, { email }] } });
      if (row) return row;
    }
    throw e;
  }
}

export async function signOut() {
  (await cookies()).delete(DEV_COOKIE);
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut();
}
