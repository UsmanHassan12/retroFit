/**
 * Minimal HS256 JWT (RFC 7519) on top of WebCrypto, so the same code runs in route
 * handlers, server actions and proxy.ts. No dependencies; signatures are compared in
 * constant time by crypto.subtle.verify.
 */

export type SessionClaims = {
  /** User id. */
  sub: string;
  role: string;
  /** User.sessionVersion at sign-in; bumping it revokes every outstanding token. */
  sv: number;
  /** Admin user id while impersonating. */
  imp?: string;
  /** Issued-at / expiry, seconds since epoch. */
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

const keys = new Map<string, Promise<CryptoKey>>();

function keyFor(secret: string) {
  let key = keys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
      "verify",
    ]);
    keys.set(secret, key);
  }
  return key;
}

const HEADER = base64url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));

export async function signJwt(claims: Omit<SessionClaims, "iat" | "exp">, secret: string, ttlSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(encoder.encode(JSON.stringify({ ...claims, iat: now, exp: now + ttlSeconds })));
  const signingInput = `${HEADER}.${payload}`;
  const signature = await crypto.subtle.sign("HMAC", await keyFor(secret), encoder.encode(signingInput));
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

export async function verifyJwt(token: string | undefined | null, secret: string): Promise<SessionClaims | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  if (header !== HEADER) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await keyFor(secret),
      fromBase64url(signature),
      encoder.encode(`${header}.${payload}`),
    );
    if (!valid) return null;
    const claims = JSON.parse(decoder.decode(fromBase64url(payload))) as SessionClaims;
    if (typeof claims.sub !== "string" || typeof claims.exp !== "number") return null;
    if (claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
