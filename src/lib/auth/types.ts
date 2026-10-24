export const SESSION_COOKIE = "rp_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Roles from the requirements doc. Staff roles share the admin console for now. */
export const ROLES = ["client", "installer", "admin", "coordinator", "assessor", "designer"] as const;
export type Role = (typeof ROLES)[number];

export type Session = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  expiresAt: number;
};

export const STAFF_ROLES: readonly Role[] = ["admin", "coordinator", "assessor", "designer"];

export const isStaff = (role: Role) => STAFF_ROLES.includes(role);

/** Where each role lands after signing in. */
export const homeForRole = (role: Role) => (isStaff(role) ? "/admin" : "/dashboard");
