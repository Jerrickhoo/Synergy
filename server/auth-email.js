import { randomBytes } from "node:crypto";
import { enqueueDelivery } from "./delivery.js";
import { equalSecret, signed } from "./secrets.js";

const hour = 3600000;

// Sign-in emails. A link email keeps one live nonce on the account under
// `field`. Asking again while it is live sends the same link with a fresh
// expiry, so every email in the inbox works (mail apps thread them together);
// using the link or letting it expire ends it. The link itself is signed with
// the workspace secret, so the database alone never holds a usable link.
export const authEmails = {
  "verify-email": {
    field: "emailVerification",
    lifetime: 24 * hour,
    route: "#/verify-email",
  },
  "password-reset": {
    field: "passwordReset",
    lifetime: hour,
    route: "#/reset-password",
  },
  "sign-in-alert": {},
};
// Asking for another link within this time does nothing.
export const linkCooldown = 60000;

const iso = (time) => new Date(time).toISOString();

export function authLinkToken(accountId, kind, nonce, secret) {
  const payload = Buffer.from(
    JSON.stringify([accountId, kind, nonce]),
  ).toString("base64url");
  return `${payload}.${signed("auth-email", payload, secret)}`;
}

// The account and nonce a link names, or null when it is malformed, forged
// or made for another kind of link.
export function readAuthLinkToken(token, kind, secret) {
  if (typeof token !== "string" || token.length > 512 || !secret) return null;
  const [payload, signature, extra] = token.split(".");
  if (
    extra !== undefined ||
    !payload ||
    !equalSecret(signature, signed("auth-email", payload, secret))
  )
    return null;
  try {
    const [accountId, linkKind, nonce] = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return linkKind === kind &&
      typeof accountId === "string" &&
      typeof nonce === "string"
      ? { accountId, nonce }
      : null;
  } catch {
    return null;
  }
}

// Sign-in emails ignore mentorship email preferences: the person asked for
// the link, or the alert protects their account. A dead address still stops
// them, and a spam complaint or full unsubscribe also stops the alert.
export function authEmailAllowed(account, kind) {
  const status = account?.emailDeliveryStatus;
  return Boolean(
    account?.email &&
    !account.demo &&
    !account.deletedAt &&
    !account.suspended &&
    !status?.bouncedAt &&
    (kind !== "sign-in-alert" || !status?.unsubscribedAt),
  );
}

// The live link record for a link, or null once the link was used or has
// expired.
export function liveLink(account, kind, nonce, now) {
  const field = authEmails[kind]?.field;
  const record = field && account?.[field];
  return record && record.nonce === nonce && Date.parse(record.expiresAt) > now
    ? record
    : null;
}

// Whether a queued sign-in email should still go out.
export function authEmailWanted(account, entry, now) {
  if (!authEmailAllowed(account, entry.kind)) return false;
  if (entry.kind === "sign-in-alert") return true;
  if (entry.kind === "verify-email" && account.emailVerifiedAt) return false;
  return Boolean(liveLink(account, entry.kind, entry.payload.nonce, now));
}

// True while the previous link of this kind is still inside the cooldown.
export const linkRecentlySent = (account, kind, now) => {
  const sentAt = Date.parse(account?.[authEmails[kind].field]?.sentAt);
  return Number.isFinite(sentAt) && now - sentAt < linkCooldown;
};

export function queueAuthEmail(db, account, kind, now, payload = {}) {
  const { field, lifetime } = authEmails[kind];
  const live = field && liveLink(account, kind, account[field]?.nonce, now);
  const nonce = live ? live.nonce : randomBytes(18).toString("base64url");
  if (field)
    account[field] = {
      nonce,
      sentAt: iso(now),
      expiresAt: iso(now + lifetime),
    };
  return enqueueDelivery(
    db,
    {
      key: `${account.id}:auth-email:${kind}:${nonce}:${now}`,
      accountId: account.id,
      kind,
      payload: { ...payload, nonce },
    },
    now,
  );
}

const signInTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

// Subject and plain-text body for a sign-in email, or null for other kinds.
export function authEmailContent(entry, account, { publicUrl, secret }) {
  const spec = authEmails[entry.kind];
  if (!spec) return null;
  const link = (route, kind) =>
    new URL(
      kind
        ? `${route}?token=${authLinkToken(account.id, kind, entry.payload.nonce, secret)}`
        : route,
      publicUrl,
    ).href;
  if (entry.kind === "verify-email")
    return {
      subject: "Verify your email for Synergy",
      text: [
        "Confirm this is your email address to start sending and accepting requests on Synergy.",
        `Verify your email: ${link(spec.route, entry.kind)}`,
        "This link expires in 24 hours. If you didn't create a Synergy account, you can ignore this email.",
      ].join("\n\n"),
    };
  if (entry.kind === "password-reset")
    return {
      subject: "Reset your Synergy password",
      text: [
        "We received a request to reset the password for your Synergy account.",
        `Choose a new password: ${link(spec.route, entry.kind)}`,
        "This link expires in 1 hour and works once. If you didn't ask for it, ignore this email and your password stays the same.",
      ].join("\n\n"),
    };
  const at = Date.parse(entry.payload.at);
  const when = Number.isFinite(at)
    ? `${signInTime.format(at)} UTC`
    : "just now";
  const device = entry.payload.device ? ` from ${entry.payload.device}` : "";
  return {
    subject: "New sign-in to your Synergy account",
    text: [
      `Your Synergy account was signed in on ${when}${device}.`,
      "If this was you, there's nothing to do.",
      `If it wasn't, reset your password now: ${link("#/forgot-password")}`,
      "Resetting your password signs out every other session.",
    ].join("\n\n"),
  };
}

// "Chrome on Windows" from a User-Agent header, or "" when unclear. Only the
// browser family and platform go into the alert, never the raw header.
export function describeDevice(userAgent) {
  if (typeof userAgent !== "string") return "";
  const ua = userAgent.slice(0, 512);
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /(Chrome|CriOS)\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "";
  const platform = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Mac OS X|Macintosh/.test(ua)
              ? "macOS"
              : /Linux/.test(ua)
                ? "Linux"
                : "";
  return browser && platform
    ? `${browser} on ${platform}`
    : browser || platform;
}
