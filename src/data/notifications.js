const kinds = {
  "payment-due": ["Payment due", "clock"],
  "payment-lapsed": ["Payment expired", "clock"],
  "payment-received": ["Payment received", "check"],
  "payout-released": ["Payout released", "check"],
  refund: ["Payment refund", "check"],
  "payment-dispute": ["Payment dispute", "clock"],
  match: ["Match suggestion", "spark"],
  activity: ["Collaboration activity", "handshake"],
  review: ["Review requested", "star"],
  "review-release": ["Reviews are in", "star"],
  confirmation: ["Needs your reply", "check"],
  reminder: ["Reminder", "clock"],
  "guidelines-required": ["Mentor guidelines", "check"],
  capacity: ["Mentoring capacity", "clock"],
  mentoring: ["Mentoring", "bell"],
  request: ["New mentorship request", "inbox"],
  "request-digest": ["Mentorship request digest", "inbox"],
  "request-expiring": ["Request expiring", "clock"],
  declined: ["Request declined", "inbox"],
  expired: ["Request expired", "clock"],
  returned: ["Request returned", "inbox"],
  referred: ["Mentor referral", "people"],
  accepted: ["Request accepted", "check"],
  "session-reminder": ["Session reminder", "calendar"],
  "attendance-needed": ["Attendance needed", "clock"],
  "prep-missing": ["Preparation needed", "clock"],
  "followup-due": ["Follow-up due", "check"],
  "review-open": ["Private review", "star"],
  badge: ["Badge earned", "star"],
  "mentor-approved": ["Mentor approved", "check"],
  "mentor-rejected": ["Mentor application", "inbox"],
  "approval-queue": ["Mentor approval queue", "clock"],
  "mentor-unavailable": ["Mentor unavailable", "people"],
};
// Items that ask the founder to do something, shown first on Updates.
export const needsAction = (item) =>
  !item.self &&
  [
    "confirmation",
    "review",
    "reminder",
    "guidelines-required",
    "request",
    "request-digest",
    "request-expiring",
    "referred",
  ].includes(item.kind) &&
  !item.read;
export const notificationKind = (kind) =>
  kinds[kind] || ["Workspace update", "bell"];
export function notificationDestination(item, state, people) {
  if (item.kind === "request-digest")
    return { label: "Open requests", command: { page: "requests" } };
  if (item.requestId && !item.roomId)
    return {
      label: "Open request",
      context: item.page === "requests" ? "Requests" : "Introductions",
      command: {
        action: "mentor-request-link",
        page: item.page,
        requestId: item.requestId,
      },
    };
  if (item.page === "home")
    return { label: "Open Home", command: { page: "home" } };
  if (item.page === "onboarding" || item.page === "moderation")
    return {
      label:
        item.page === "onboarding"
          ? "View mentor application"
          : "Open moderation",
      command: { page: item.page },
    };
  if (["impact", "profile"].includes(item.page))
    return {
      label: item.page === "impact" ? "View impact" : "View profile",
      command: { page: item.page },
    };
  if (item.page === "settings")
    return {
      label: "Open mentoring settings",
      context: "Settings",
      command: { page: "settings" },
    };
  if (item.page === "discover")
    return {
      label: "Find another mentor",
      context: "Matches",
      command: { page: "discover" },
    };
  if (item.roomId) {
    const room = state.rooms[item.roomId];
    if (room?.role === state.role) {
      const partner = people.find((p) => p.id === room.partnerId);
      const reviewLink =
        item.review ||
        ["review", "review-release", "review-open"].includes(item.kind);
      return {
        label:
          item.kind === "review-release" ||
          (item.review && room.status === "reviewed")
            ? "Read feedback"
            : item.kind === "review"
              ? "Write a review"
              : item.kind === "followup-due"
                ? "Add your follow-up"
                : room.type === "mentorship"
                  ? "Open mentorship room"
                  : "Open Deal Room",
        context: partner
          ? `With ${partner.name}`
          : room.engagementType || "Collaboration",
        command: {
          action: "open-room",
          id: room.id,
          tab: item.tab,
          review: reviewLink,
        },
      };
    }
    return {
      label: "View Deal Rooms",
      context: "This room is no longer available.",
      command: { page: "rooms" },
    };
  }
  if (item.matchId) {
    const person = people.find((p) => p.id === item.matchId);
    return person
      ? {
          label: "View match",
          context: person.sector || person.kind,
          command: { action: "match-detail", id: item.matchId },
        }
      : {
          label: "Browse matches",
          context: "This profile is no longer available in Matches.",
          command: { page: "discover" },
        };
  }
  return {};
}
export function relativeTime(timestamp, now = Date.now()) {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return "Time unavailable";
  const elapsed = now - time;
  if (Math.abs(elapsed) < 60000) return "Just now";
  const [unit, divisor] =
    Math.abs(elapsed) < 3600000
      ? ["minute", 60000]
      : Math.abs(elapsed) < 86400000
        ? ["hour", 3600000]
        : ["day", 86400000];
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    -Math.sign(elapsed) * Math.floor(Math.abs(elapsed) / divisor),
    unit,
  );
}
export function groupNotifications(items, now = Date.now()) {
  const dayKey = (date) =>
    `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const groups = new Map([
    ["Today", []],
    ["Yesterday", []],
    ["Earlier", []],
    ["Date unavailable", []],
  ]);
  for (const item of [...items].sort(
    (a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0),
  )) {
    const date = new Date(Date.parse(item.timestamp));
    const group = !Number.isFinite(date.getTime())
      ? "Date unavailable"
      : dayKey(date) === dayKey(today)
        ? "Today"
        : dayKey(date) === dayKey(yesterday)
          ? "Yesterday"
          : "Earlier";
    groups.get(group).push(item);
  }
  return [...groups].filter(([, values]) => values.length);
}
