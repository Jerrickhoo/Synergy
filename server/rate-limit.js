// Sign-in, sign-up and password-reset attempts are limited twice: per visitor
// address and per email address. The address limit slows one visitor trying
// many accounts. The email limit slows anyone guessing one account's password,
// however many addresses they send from.
import { isIP } from "node:net";
import { createHmac, timingSafeEqual } from "node:crypto";

const windowMs = 60000;

// Whether Netlify proxied this request. A redirect with `signed` in
// netlify.toml makes Netlify add x-nf-sign: a JWS signed (HS256) with the
// secret, with the claims iss "netlify" and exp in seconds.
export function signedByNetlify(req, secret, now = Date.now()) {
  const parts = String(req.headers["x-nf-sign"] || "").split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return false;
  const [header, payload, signature] = parts;
  const expected = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return false;
  try {
    const { alg } = JSON.parse(Buffer.from(header, "base64url"));
    const claims = JSON.parse(Buffer.from(payload, "base64url"));
    // A minute's grace for clock differences between Netlify and this server.
    return (
      alg === "HS256" &&
      claims.iss === "netlify" &&
      Number(claims.exp) * 1000 + 60000 > now
    );
  } catch {
    return false;
  }
}

// The visitor's address. Behind a proxy the socket address is the proxy's, so
// every visitor would share one limit. `clientIpHeader` names the header the
// proxy overwrites with the visitor's address: cf-connecting-ip on Render
// (Cloudflare) or x-nf-client-connection-ip behind a Netlify proxy. With
// `proxySecret`, that header counts only on requests Netlify signed, so a
// visitor calling the server directly cannot choose it. Otherwise the last
// X-Forwarded-For entry is the one the nearest proxy added. The first entry is
// never used: proxies append to the header, so the first entry is whatever the
// visitor sent.
export function clientAddress(req, clientIpHeader, proxySecret) {
  if (clientIpHeader) {
    const named = String(req.headers[clientIpHeader] || "").trim();
    if (isIP(named) && (!proxySecret || signedByNetlify(req, proxySecret)))
      return named;
    const nearest = String(req.headers["x-forwarded-for"] || "")
      .split(",")
      .at(-1)
      .trim();
    if (isIP(nearest)) return nearest;
  }
  return req.socket.remoteAddress;
}

// The email an attempt is aimed at, if any, as one key per address.
export function attemptEmail(input) {
  return typeof input?.email === "string"
    ? input.email.trim().toLowerCase().slice(0, 320) || null
    : null;
}

export function createAttemptLimiter() {
  const attempts = new Map();
  const recent = (key, now) =>
    (attempts.get(key) || []).filter((time) => time > now - windowMs);
  // `limits` is a list of [key, attempts allowed per minute]. Records the
  // attempt under every key and returns true, or returns false without
  // recording it when any key has used up its minute.
  return function allow(limits) {
    const now = Date.now();
    if (limits.some(([key, limit]) => recent(key, now).length >= limit))
      return false;
    if (attempts.size > 10000)
      for (const [key, times] of attempts)
        if (!times.some((time) => time > now - windowMs)) attempts.delete(key);
    for (const [key] of limits) attempts.set(key, [...recent(key, now), now]);
    return true;
  };
}
