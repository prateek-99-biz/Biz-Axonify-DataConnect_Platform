export type Role = "ADMIN" | "MEMBER";

export type Permission =
  | "portfolio:read"
  | "clients:read"
  | "clients:notes:write"
  | "clients:tasks:write"
  | "reliability:read"
  | "export:csv"
  | "commercial:read"
  | "settings:manage"
  | "sync:run";

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", MEMBER: "Member" };

const MEMBER_PERMS: readonly Permission[] = [
  "portfolio:read", "clients:read", "clients:notes:write", "clients:tasks:write",
  "reliability:read", "export:csv", "commercial:read",
];

const MATRIX: Record<Role, readonly Permission[]> = {
  ADMIN: [...MEMBER_PERMS, "settings:manage", "sync:run"],
  MEMBER: MEMBER_PERMS,
};

export function can(role: Role | undefined | null, perm: Permission): boolean {
  return !!role && MATRIX[role].includes(perm);
}

export function parseRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  return v === "ADMIN" || v === "MEMBER" ? v : null;
}
