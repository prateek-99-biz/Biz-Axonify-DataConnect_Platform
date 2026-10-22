import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "./index";
import { can, type Permission } from "./rbac";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Server-side authorization. Use in every route handler / server action. */
export async function requirePermission(perm: Permission) {
  const session = await auth();
  if (!session?.user) throw new HttpError(401, "Unauthenticated");
  if (!can(session.user.role, perm)) throw new HttpError(403, `Missing permission ${perm}`);
  return session.user;
}

/** For pages: redirect instead of throwing. */
export async function requirePagePermission(perm: Permission) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (!can(session.user.role, perm)) redirect("/forbidden");
  return session.user;
}

export function toResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
