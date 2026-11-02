/**
 * Unit tests for the pure backend pieces (pricing, JWT sessions, password hashing, templates).
 * Run: npm test   (uses Node's built-in test runner through tsx)
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { signJwt, verifyJwt } from "../src/server/auth/jwt";
import { hashPassword, hashToken, createToken, PASSWORD_RULES, verifyPassword } from "../src/server/auth/password";
import { priceOrder } from "../src/server/services/pricing";
import { renderTemplate } from "../src/server/integrations/template";

test("pricing: README worked example (£1,450 + £369 add-ons)", () => {
  const price = priceOrder({ basePence: 145_000, addonPence: [24_900, 12_000] });
  assert.equal(price.subtotalPence, 181_900);
  assert.equal(price.vatPence, 36_380);
  assert.equal(price.totalPence, 218_280);
  assert.equal(price.discountSource, "NONE");
});

test("pricing: discount code applies before VAT", () => {
  const price = priceOrder({ basePence: 100_000, addonPence: [], codePercent: 10 });
  assert.equal(price.discountPence, 10_000);
  assert.equal(price.vatPence, 18_000);
  assert.equal(price.totalPence, 108_000);
  assert.equal(price.discountSource, "CODE");
});

test("pricing: Priority plan 15% and a code never stack — the larger wins", () => {
  const planWins = priceOrder({ basePence: 100_000, addonPence: [], codePercent: 10, plan: "PRIORITY" });
  assert.equal(planWins.discountPercent, 15);
  assert.equal(planWins.discountSource, "PLAN");
  const codeWins = priceOrder({ basePence: 100_000, addonPence: [], codePercent: 20, plan: "PRIORITY" });
  assert.equal(codeWins.discountPercent, 20);
  assert.equal(codeWins.discountSource, "CODE");
});

test("pricing: pennies round half-up", () => {
  const price = priceOrder({ basePence: 333, addonPence: [], codePercent: 10 });
  assert.equal(price.discountPence, 33);
  assert.equal(price.vatPence, 60); // 20% of 300
  assert.equal(price.totalPence, 360);
});

const SECRET = "x".repeat(40);

test("jwt: round-trips claims", async () => {
  const token = await signJwt({ sub: "user_1", role: "CLIENT", sv: 3 }, SECRET, 60);
  const claims = await verifyJwt(token, SECRET);
  assert.equal(claims?.sub, "user_1");
  assert.equal(claims?.sv, 3);
});

test("jwt: rejects tampering, wrong secret and expiry", async () => {
  const token = await signJwt({ sub: "user_1", role: "CLIENT", sv: 0 }, SECRET, 60);
  const [header, payload, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "user_1", role: "ADMIN", sv: 0, iat: 0, exp: 9_999_999_999 })).toString("base64url");
  assert.equal(await verifyJwt(`${header}.${forged}.${signature}`, SECRET), null);
  assert.equal(await verifyJwt(token, "y".repeat(40)), null);
  assert.equal(await verifyJwt(await signJwt({ sub: "u", role: "CLIENT", sv: 0 }, SECRET, -1), SECRET), null);
  assert.equal(await verifyJwt("garbage", SECRET), null);
});

test("password: hash verifies, wrong password fails, hashes are salted", async () => {
  const hash = await hashPassword("Retrofit123!");
  assert.ok(hash.startsWith("scrypt$"));
  assert.equal(await verifyPassword("Retrofit123!", hash), true);
  assert.equal(await verifyPassword("retrofit123!", hash), false);
  assert.notEqual(hash, await hashPassword("Retrofit123!"));
  assert.equal(await verifyPassword("anything", null), false);
});

test("password: policy and one-time tokens", () => {
  assert.equal(PASSWORD_RULES.test("short1"), "Use at least 8 characters.");
  assert.equal(PASSWORD_RULES.test("12345678"), "Include at least one letter.");
  assert.equal(PASSWORD_RULES.test("abcdefgh"), "Include at least one number.");
  assert.equal(PASSWORD_RULES.test("Retrofit123!"), null);
  const { token, tokenHash } = createToken();
  assert.equal(hashToken(token), tokenHash);
});

test("templates: placeholders are filled and HTML-escaped", () => {
  const html = renderTemplate("<p>Hello {{user_name}}, see {{ link }} {{missing}}</p>", { user_name: "<b>Sam</b>", link: "https://x.test/?a=1&b=2" });
  assert.equal(html, "<p>Hello &lt;b&gt;Sam&lt;/b&gt;, see https://x.test/?a=1&amp;b=2 </p>");
  assert.equal(renderTemplate("Order {{order_ref}}", { order_ref: "ORD-1" }, false), "Order ORD-1");
});
