import { createHmac, timingSafeEqual } from "node:crypto";

// Shared by the mentorship and sign-in email modules so neither imports the
// other.
export function equalSecret(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string" || !expected)
    return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The token from an Authorization header. The scheme is case-insensitive
// (RFC 9110 §11.1); Brevo's built-in token option sends lowercase "bearer".
export function bearerToken(header) {
  return typeof header === "string"
    ? /^bearer[ \t]+(\S+)$/i.exec(header.trim())?.[1] || null
    : null;
}

// A URL-safe HMAC of `value`. `purpose` keeps signatures for one kind of link
// from being accepted as another.
export const signed = (purpose, value, secret) =>
  createHmac("sha256", secret)
    .update(`${purpose}:${value}`)
    .digest("base64url");
