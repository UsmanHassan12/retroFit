import { randomBytes, scrypt, timingSafeEqual, createHash, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt (memory-hard, no native addon to install).
 * Stored format: scrypt$N$r$p$saltB64$hashB64 — parameters travel with the hash so they
 * can be raised later without breaking existing accounts.
 */

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, options: ScryptOptions, keyLength: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, { ...options, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, { N, r: R, p: P }, KEY_LENGTH);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), { N: Number(n), r: Number(r), p: Number(p) }, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Opaque one-time tokens (password reset, invites): the raw value is emailed, only the hash is stored. */
export function createToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Password policy shared by register, reset, invite acceptance and password change. */
export const PASSWORD_RULES = {
  min: 8,
  test(password: string) {
    if (password.length < 8) return "Use at least 8 characters.";
    if (!/[A-Za-z]/.test(password)) return "Include at least one letter.";
    if (!/[0-9]/.test(password)) return "Include at least one number.";
    return null;
  },
};
