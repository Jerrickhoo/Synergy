// The Activity page: a dated record of every request, mentorship
// request and deal, a plain-language meaning for each status, and the full
// activity log. Everything here is read from the workspace state.
import { roleRooms } from "./selectors.js";
import { roomFinished } from "./room-progress.js";

const dayMs = 86400000;
// How long a request waits for a reply.
export const replyWindowDays = 14;

// Requests, in the order the guide lists them.
export const introductionStatuses = [
  {
    id: "needs-reply",
    label: "Needs your reply",
    meaning: `Someone asked to work with you. Accept or decline within ${replyWindowDays} days.`,
  },
  {
    id: "waiting",
    label: "Waiting for reply",
    meaning: `You sent it. The other side has ${replyWindowDays} days to accept or decline.`,
  },
  {
    id: "accepted",
    label: "Accepted",
    meaning: "Both of you agreed, so a room opened for the work together.",
  },
  {
    id: "declined",
    label: "Declined",
    meaning: "The person who received it said no. Nothing else happens.",
  },
  {
    id: "withdrawn",
    label: "Withdrawn",
    meaning: "The sender cancelled it before anyone replied.",
  },
  {
    id: "expired",
    label: "Expired",
    meaning: `Nobody replied within ${replyWindowDays} days, so it closed by itself.`,
  },
  {
    id: "referred",
    label: "Mentor suggested others",
    meaning:
      "The mentor couldn't take it on and suggested other mentors to ask.",
  },
  {
    id: "returned",
    label: "Returned",
    meaning:
      "The mentor paused mentoring, so requests still waiting were sent back.",
  },
];

// Deals (Deal Rooms and mentorship rooms), in the order work moves through.
export const dealStatuses = [
  {
    id: "matched",
    label: "Matched",
    meaning:
      "The request was accepted and the room opened. Agree the terms next.",
  },
  {
    id: "in-progress",
    label: "In progress",
    meaning:
      "You both accepted the terms. Finish each milestone and confirm it together.",
  },
  {
    id: "launched",
    label: "Launched",
    meaning: `Every milestone is confirmed by both of you. Leave your private review within ${replyWindowDays} days. Mentorships call this Completed.`,
  },
  {
    id: "reviewed",
    label: "Reviewed",
    meaning:
      "Both reviews are in, or the review window closed. The deal is finished.",
  },
  {
    id: "cancelled",
    label: "Closed",
    meaning: "The room was closed before the work finished.",
  },
];

const statusOrder = ["needs-reply", "waiting"];
const latest = (row) => row.closedAt || row.requestedAt || "";

// A request saved before its send date was kept: the time of the activity
// entry that recorded it ("You sent a request to …", "… wants to connect
// with you"), the latest one before it closed.
function loggedSentAt(state, personId, direction, before) {
  const limit = before ? Date.parse(before) : Infinity;
  const recorded = (item) =>
    direction === "sent"
      ? item.text.startsWith("You sent a request to ") ||
        item.text.startsWith("You sent an introduction to ")
      : item.text.endsWith(" wants to connect with you.");
  const found = (state.activity || [])
    .filter(
      (item) =>
        item.role === state.role &&
        item.matchId === personId &&
        typeof item.text === "string" &&
        recorded(item) &&
        Date.parse(item.timestamp) <= limit,
    )
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))[0];
  return found?.timestamp || "";
}

// Every request and mentorship request for the current role: waiting
// ones first, then closed ones, newest first.
export function introductionRecords(state) {
  const role = state.role;
  const meta = state.introductionMetaByRole?.[role] || {};
  const rows = [];
  const pending = (ids, direction) => {
    for (const id of ids || []) {
      const item = meta[id];
      // Mentorship requests are listed from their own records below.
      if (!item || item.kind) continue;
      rows.push({
        id: `${direction}:${id}`,
        personId: id,
        name: item.name || "Unknown",
        kind: "Request",
        direction,
        status: direction === "sent" ? "waiting" : "needs-reply",
        requestedAt: item.sentAt || loggedSentAt(state, id, direction),
        expiresAt: item.sentAt
          ? new Date(
              Date.parse(item.sentAt) + replyWindowDays * dayMs,
            ).toISOString()
          : "",
        closedAt: "",
        note: item.note || "",
      });
    }
  };
  pending(state.waitingByRole?.[role], "sent");
  pending(state.incomingByRole?.[role], "received");

  // A founder's requests arrive with their status; a mentor's pending ones
  // are in mentorRequests and the closed ones in their request history.
  const requests = [
    ...(state.mentorRequests || []),
    ...(role === "mentor" ? state.mentorRequestsByRole?.mentor || [] : []),
  ];
  const requestKeys = new Set();
  for (const request of requests) {
    const direction = role === "mentor" ? "received" : "sent";
    const status =
      request.status === "pending"
        ? direction === "sent"
          ? "waiting"
          : "needs-reply"
        : request.status;
    const key = `${request.partnerId}:${status}`;
    if (requestKeys.has(`${key}:${request.id}`)) continue;
    requestKeys.add(`${key}:${request.id}`);
    requestKeys.add(key);
    rows.push({
      id: `request:${request.id}:${status}`,
      personId: request.partnerId,
      name: request.name || "Unknown",
      kind: "Mentorship request",
      direction,
      status,
      requestedAt: request.sentAt || "",
      expiresAt: request.status === "pending" ? request.expiresAt || "" : "",
      closedAt: request.status === "pending" ? "" : request.at || "",
      requestId: request.id,
    });
  }

  for (const [index, item] of (
    state.introHistoryByRole?.[role] || []
  ).entries()) {
    // Already listed from the request's own record.
    if (requestKeys.has(`${item.id}:${item.status}`)) continue;
    rows.push({
      id: `closed:${item.id}:${index}`,
      personId: item.id,
      name: item.name || "Unknown",
      kind: "Request",
      direction: item.direction === "received" ? "received" : "sent",
      status: item.status,
      requestedAt:
        item.sentAt ||
        loggedSentAt(
          state,
          item.id,
          item.direction === "received" ? "received" : "sent",
          item.at,
        ),
      expiresAt: "",
      closedAt: item.at || "",
      reason: item.reason || "",
    });
  }
  return rows.sort((a, b) => {
    const rank = (row) => {
      const at = statusOrder.indexOf(row.status);
      return at === -1 ? statusOrder.length : at;
    };
    return rank(a) - rank(b) || latest(b).localeCompare(latest(a));
  });
}

// Every room for the current role, most recently changed first.
export function dealRecords(state, nameOf) {
  return roleRooms(state)
    .map((room) => {
      const status = room.status === "terms" ? "matched" : room.status;
      const finished = roomFinished(room)?.at || "";
      return {
        id: room.id,
        room,
        name: nameOf(room),
        kind:
          room.type === "mentorship"
            ? "Mentorship"
            : room.engagementType || "Collaboration",
        status,
        openedAt: room.createdAt || "",
        updatedAt: room.updatedAt || room.createdAt || "",
        finishedAt: finished,
      };
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

// The label a deal's status shows; a finished mentorship is "Completed".
export function dealStatusLabel(record) {
  if (record.status === "launched" && record.room?.type === "mentorship")
    return "Completed";
  return (
    dealStatuses.find((item) => item.id === record.status)?.label ||
    record.status
  );
}

export function introductionStatusLabel(status) {
  return (
    introductionStatuses.find((item) => item.id === status)?.label ||
    String(status || "")
      .replaceAll("-", " ")
      .replace(/^./, (letter) => letter.toUpperCase())
  );
}

export function statusMeaning(status, kind = "introduction") {
  const list = kind === "deal" ? dealStatuses : introductionStatuses;
  return list.find((item) => item.id === status)?.meaning || "";
}

// The activity log for the current role, grouped by local day:
// [["Today", [...]], ["Yesterday", [...]], ["Mon, 3 Nov 2026", [...]]].
export function activityDays(state, limit = Infinity, now = new Date()) {
  const items = (state.activity || [])
    .filter((item) => item.role === state.role)
    .slice(0, limit);
  const dayKey = (date) =>
    `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - dayMs));
  const groups = new Map();
  for (const item of items) {
    const when = new Date(item.timestamp);
    const valid = Number.isFinite(when.getTime());
    const key = valid ? dayKey(when) : "earlier";
    const label = !valid
      ? "Earlier"
      : key === today
        ? "Today"
        : key === yesterday
          ? "Yesterday"
          : when.toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }
  return [...groups.entries()];
}
