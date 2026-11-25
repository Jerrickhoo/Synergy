import { scheduleInstant } from "../src/data/selectors.js";
import { mentorEmailKinds } from "../src/data/mentor-email.js";
import { dayMs } from "../src/data/mentor-room.js";
import { enqueueDelivery } from "./delivery.js";
import { authEmailContent, authEmails } from "./auth-email.js";
import { equalSecret, signed as sign } from "./secrets.js";

export { bearerToken, equalSecret } from "./secrets.js";

const emailText = {
  "payment-due": [
    "Mentorship payment due",
    "Complete checkout for your mentorship.",
  ],
  "payment-lapsed": [
    "Mentorship payment expired",
    "Your mentorship payment window expired.",
  ],
  "payment-received": [
    "Mentorship payment received",
    "A mentorship payment is held by the provider.",
  ],
  "payout-released": [
    "Mentorship payout released",
    "A mentorship payout was released.",
  ],
  refund: ["Mentorship refund", "Your mentorship payment was refunded."],
  "payment-dispute": [
    "Mentorship payment dispute",
    "A payment needs moderator review.",
  ],
  request: [
    "New mentorship request",
    "A founder sent you a new mentorship request.",
  ],
  "request-digest": [
    "Your mentorship request digest",
    "New requests are waiting for your review.",
  ],
  accepted: [
    "Mentorship request accepted",
    "Your mentor accepted your request.",
  ],
  "session-reminder": [
    "Mentorship session tomorrow",
    "Your scheduled mentorship session is coming up. Check your schedule and prep.",
  ],
  "attendance-needed": [
    "Mentorship attendance",
    "Please record attendance for your mentorship session.",
  ],
  "followup-due": [
    "Mentorship follow-up",
    "Please share what happened after your mentorship session.",
  ],
  "mentor-approved": [
    "Mentor profile approved",
    "Your mentor profile was approved. You can now receive requests.",
  ],
  "guidelines-required": [
    "Mentor guidelines",
    "Read and accept the current mentor guidelines.",
  ],
};
const kindFor = (kind) => (kind === "request-digest" ? "request" : kind);

export function emailKindAllowed(account, kind) {
  const preference = kindFor(kind);
  const status = account?.emailDeliveryStatus;
  return Boolean(
    account?.email &&
    !account.demo &&
    !account.showcase &&
    !account.devAccount &&
    !account.deletedAt &&
    !status?.bouncedAt &&
    !status?.unsubscribedAt &&
    !status?.unsubscribedKinds?.includes(preference) &&
    account.notificationPreferences?.mentorEmailKinds?.[preference] !== false,
  );
}

export function nextRequestDigest(time, timeZone, hour) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(time);
  const wallTime = String(hour).padStart(2, "0") + ":00";
  const check = (key) =>
    scheduleInstant({ date: key, time: wallTime, timeZone }).getTime();
  for (const delta of [0, 1, 2]) {
    const day = new Date(Date.parse(date + "T00:00:00Z") + delta * dayMs)
      .toISOString()
      .slice(0, 10);
    const instant = check(day);
    if (Number.isFinite(instant) && instant >= time)
      return new Date(instant).toISOString();
  }
  return new Date(time + dayMs).toISOString();
}

function destination(item) {
  if (item.kind === "request" && item.requestId)
    return `#/requests?request=${encodeURIComponent(item.requestId)}`;
  if (item.roomId)
    return `#/rooms/${encodeURIComponent(item.roomId)}${item.tab ? `?tab=${encodeURIComponent(item.tab)}` : ""}`;
  if (item.kind === "mentor-approved") return "#/onboarding";
  return "#/settings";
}

export function queueMentorEmail(db, account, item, config, now) {
  const kind = item.kind;
  if (!(
    Object.hasOwn(mentorEmailKinds, kind) && emailKindAllowed(account, kind)
  ))
    return false;
  if (kind === "session-reminder" && item.reminderHours !== 24) return false;
  const noticeKey = `${account.id}:mentor-email:${item.id}`;
  if (
    kind === "request" &&
    db.outbox?.some(
      (entry) =>
        entry.accountId === account.id &&
        (entry.key === noticeKey ||
          (entry.kind === "request-digest" &&
            entry.payload.ids.includes(item.id))),
    )
  )
    return false;
  if (
    kind === "request" &&
    (item.requestDigestAt ||
      (!Object.hasOwn(item, "requestDigestAt") &&
        account.notificationPreferences?.mentorRequestEmail !== "instant"))
  ) {
    const timeZone = account.state.profiles.mentor.timeZone || "Asia/Manila";
    const timestamp = Date.parse(item.timestamp);
    if (!Number.isFinite(timestamp)) return false;
    const availableAt =
      item.requestDigestAt ||
      nextRequestDigest(timestamp, timeZone, config.digestHour);
    const key = `${account.id}:mentor-email:request-digest:${availableAt}`;
    const prior = db.outbox?.find((entry) => entry.key === key);
    if (prior) {
      if (prior.status !== "pending" || prior.payload.ids.includes(item.id))
        return false;
      prior.payload.ids.push(item.id);
      return true;
    }
    return enqueueDelivery(
      db,
      {
        key,
        accountId: account.id,
        kind: "request-digest",
        payload: { ids: [item.id], route: "#/requests" },
        availableAt,
      },
      now,
    );
  }
  return enqueueDelivery(
    db,
    {
      key: noticeKey,
      accountId: account.id,
      kind,
      payload: { route: destination(item) },
    },
    now,
  );
}

export function unsubscribeToken(accountId, kind, secret) {
  const payload = Buffer.from(
    JSON.stringify([accountId, kindFor(kind)]),
  ).toString("base64url");
  return `${payload}.${sign("mentor-email", payload, secret)}`;
}

export function parseUnsubscribe(token, secret) {
  if (typeof token !== "string" || token.length > 512 || !secret) return null;
  const [payload, signature, extra] = token.split(".");
  if (
    extra ||
    !payload ||
    !equalSecret(signature, sign("mentor-email", payload, secret))
  )
    return null;
  try {
    const value = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return Array.isArray(value) &&
      typeof value[0] === "string" &&
      Object.hasOwn(mentorEmailKinds, value[1])
      ? value
      : null;
  } catch {
    return null;
  }
}

export function createBrevoSender({
  apiKey,
  from,
  publicUrl,
  webhookSecret,
  fetcher = fetch,
}) {
  // Mentorship notices link to the page and carry a per-kind unsubscribe link.
  function mentorshipContent(entry, account) {
    if (
      !emailKindAllowed(account, entry.kind) ||
      !Object.hasOwn(emailText, entry.kind)
    )
      return null;
    const [subject, copy] = emailText[entry.kind];
    const route = new URL(entry.payload.route, publicUrl);
    if (route.origin !== new URL(publicUrl).origin) return null;
    const unsubscribe = new URL("/api/email/unsubscribe", publicUrl);
    unsubscribe.searchParams.set(
      "token",
      unsubscribeToken(account.id, entry.kind, webhookSecret),
    );
    const message =
      entry.kind === "request-digest"
        ? `You received ${entry.payload.ids.length} mentorship ${entry.payload.ids.length === 1 ? "request" : "requests"}.`
        : copy;
    return {
      subject,
      text: `${message}\n\nOpen Synergy: ${route.href}\n\nUnsubscribe from this email: ${unsubscribe.href}`,
    };
  }
  return async (entry, account) => {
    // The caller already checked that a sign-in email is still wanted.
    const content = Object.hasOwn(authEmails, entry.kind)
      ? account?.email &&
        authEmailContent(entry, account, { publicUrl, secret: webhookSecret })
      : mentorshipContent(entry, account);
    if (!content) return { skipped: true };
    const { subject, text } = content;
    try {
      const response = await fetcher("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { email: from, name: "Synergy" },
          to: [{ email: account.email }],
          subject,
          textContent: text,
          headers: { IdempotencyKey: entry.id },
          tags: [`synergy-${entry.kind}`],
        }),
        signal: AbortSignal.timeout(10000),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok || body.code === "duplicate_parameter")
        return { delivered: true, messageId: body.messageId || null };
      // 401/403 mean Synergy's key or account is wrong, not this message:
      // retry so messages survive until the configuration is fixed.
      return {
        reason: `Brevo returned HTTP ${response.status}.`,
        status: response.status,
        permanent:
          response.status >= 400 &&
          response.status < 500 &&
          ![401, 403, 408, 429].includes(response.status),
      };
    } catch {
      return { reason: "Couldn't reach Brevo.", status: null };
    }
  };
}

export function applyEmailWebhook(db, raw, now) {
  const values = Array.isArray(raw) ? raw : [raw];
  let changed = false;
  for (const item of values) {
    const email =
      typeof item?.email === "string" ? item.email.trim().toLowerCase() : "";
    const type =
      typeof item?.event === "string"
        ? item.event.replace(/[_-]/g, "").toLowerCase()
        : "";
    // Webhook payloads say "invalid_email"; "invalid" is the subscription name.
    const key = ["hardbounce", "invalid", "invalidemail", "blocked"].includes(
      type,
    )
      ? "bouncedAt"
      : ["unsubscribed", "spam"].includes(type)
        ? "unsubscribedAt"
        : null;
    if (!email || !key) continue;
    const account = Object.values(db.accounts).find(
      (candidate) => !candidate.deletedAt && candidate.email === email,
    );
    if (!account || account.emailDeliveryStatus?.[key]) continue;
    account.emailDeliveryStatus ||= {};
    account.emailDeliveryStatus[key] = new Date(now).toISOString();
    changed = true;
  }
  return changed;
}
