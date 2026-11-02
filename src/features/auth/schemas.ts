/** Shared state for the auth forms (validation itself lives in src/server/services/auth.ts). */
export type AuthField = "email" | "password" | "confirmPassword" | "firstName" | "lastName" | "currentPassword";

export type AuthFormState = {
  /** Form-level error (wrong password, locked account…). */
  message?: string;
  /** Success notice (e.g. "check your email"). */
  notice?: string;
  fieldErrors?: Partial<Record<AuthField, string>>;
  values?: { email?: string; firstName?: string; lastName?: string };
};
