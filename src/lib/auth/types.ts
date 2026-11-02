/** UI-facing session types. The server layer (src/server) uses the uppercase DB roles. */
export const SESSION_COOKIE = "rp_session";

export const ROLES = ["client", "assessor", "designer", "coordinator", "admin"] as const;
export type Role = (typeof ROLES)[number];

export type Session = {
  userId: string;
  name: string;
  firstName: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  plan: "free" | "priority" | "enterprise";
  /** True while an admin is signed in as this user. */
  impersonating: boolean;
  expiresAt: number;
};

export const STAFF_ROLES: readonly Role[] = ["admin", "coordinator", "assessor", "designer"];

export const isStaff = (role: string) => STAFF_ROLES.includes(role.toLowerCase() as Role);

export const ROLE_LABELS: Record<Role, string> = {
  client: "Client",
  assessor: "Assessor",
  designer: "Designer",
  coordinator: "Coordinator",
  admin: "Admin",
};

/** Where each role lands after signing in. */
export const homeForRole = (role: string) => (isStaff(role) ? "/admin" : "/dashboard");
