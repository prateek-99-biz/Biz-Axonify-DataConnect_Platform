export type Role = "ADMIN" | "MEMBER" | "CLIENT";

export type Permission =
  | "dashboard:read"
  | "dashboard:internal"
  | "portfolio:read"
  | "clients:read"
  | "clients:notes:write"
  | "clients:tasks:write"
  | "reliability:read"
  | "export:csv"
  | "commercial:read"
  | "settings:manage"
  | "sync:run";

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", MEMBER: "Member", CLIENT: "Client (external)" };

const MEMBER_PERMS: readonly Permission[] = [
  "dashboard:read", "dashboard:internal", "portfolio:read", "clients:read", "clients:notes:write", "clients:tasks:write",
  "reliability:read", "export:csv", "commercial:read",
];

/** External client users see only the QBR dashboard for their own client. */
const CLIENT_PERMS: readonly Permission[] = ["dashboard:read"];

const MATRIX: Record<Role, readonly Permission[]> = {
  ADMIN: [...MEMBER_PERMS, "settings:manage", "sync:run"],
  MEMBER: MEMBER_PERMS,
  CLIENT: CLIENT_PERMS,
};

export function can(role: Role | undefined | null, perm: Permission): boolean {
  return !!role && MATRIX[role].includes(perm);
}

export function parseRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  return v === "ADMIN" || v === "MEMBER" || v === "CLIENT" ? v : null;
}

export const STAFF_DOMAIN = "@bizgroup.ae";

/**
 * Role given to a profile on first sign-in. Anyone not recognised as staff starts as an unlinked CLIENT, which can see
 * nothing until an admin links them to a client in Settings. Staff roles need the admin list or a confirmed company email.
 */
export function seedRole(email: string, adminEmails: readonly string[], emailConfirmed: boolean): Role {
  const e = email.trim().toLowerCase();
  if (adminEmails.includes(e) && emailConfirmed) return "ADMIN";
  if (e.endsWith(STAFF_DOMAIN) && emailConfirmed) return "MEMBER";
  return "CLIENT";
}
