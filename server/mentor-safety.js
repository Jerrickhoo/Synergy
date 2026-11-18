import { randomUUID } from "node:crypto";
import {
  dayMs,
  isMentorRoom,
  mentorSessions,
} from "../src/data/mentor-room.js";
import {
  flagMessage,
  mentorshipSafetyWarning,
} from "../src/data/safety-rules.js";
import { mentorshipTrust } from "../src/data/mentor-impact.js";

export const safetyActions = new Set([
  "lift-limit",
  "suspend-mentor",
  "reinstate-mentor",
]);

export function createMentorSafety({
  accounts,
  config,
  now,
  event,
  audit,
  fail,
  isAdmin,
  mirror,
  endRoom,
  returnRequests,
  similarMentors,
}) {
  const stamp = () => new Date(now()).toISOString();
  const active = (value) => Date.parse(value || "") > now();
  const localDay = (time, timeZone = "Asia/Manila") =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(time);
  const normalized = (value) =>
    typeof value === "string" ? value.trim().slice(0, 500) : "";

  function check(text, acknowledgement) {
    const flags = flagMessage(text);
    if (flags.length && acknowledgement !== true)
      fail(mentorshipSafetyWarning, 409, undefined, {
        reason: "mentor-safety-warning",
        flags,
      });
    return flags;
  }

  function record(account, role, flags, reference, roomId) {
    if (!flags.length) return;
    account.mentorSafetyFlags ||= [];
    if (
      account.mentorSafetyFlags.some((entry) => entry.reference === reference)
    )
      return;
    account.mentorSafetyFlags.push({
      id: randomUUID(),
      at: stamp(),
      role,
      flags,
      reference,
      roomId,
    });
  }

  function clearLimit(account, role) {
    delete account.state.mentorshipLimits[role];
    if (role === "mentor" && account.mentorSafetyPause) {
      Object.assign(account.state.profiles.mentor, account.mentorSafetyPause);
      delete account.mentorSafetyPause;
    }
  }

  function liftSuspension(account, moderator) {
    delete account.mentorSuspension;
    event(
      account,
      "mentor",
      "Your mentor profile has been reinstated.",
      undefined,
      { kind: "mentor-reinstated", page: "settings" },
    );
    audit(
      moderator || { email: "system" },
      "mentor-suspension",
      account.id,
      "reinstated",
    );
  }

  function applyLimit(account, role, entries) {
    const c = config();
    if (entries.length < c.noShowLimit) return false;
    const latest = entries.reduce((latest, entry) =>
      entry.at > latest.at ? entry : latest,
    );
    account.mentorshipLimitTriggers ||= {};
    if (
      account.mentorshipLimitTriggers[role] === latest.id ||
      active(account.state.mentorshipLimits?.[role])
    )
      return false;
    account.mentorshipLimitTriggers[role] = latest.id;
    account.state.mentorshipLimits ||= {};
    const until = now() + c.noShowLimitDays * dayMs;
    account.state.mentorshipLimits[role] = new Date(until).toISOString();
    if (role === "mentor") {
      const profile = account.state.profiles.mentor;
      const { paused, pausedAt, pausedUntil } = profile;
      account.mentorSafetyPause = { paused, pausedAt, pausedUntil };
      Object.assign(profile, {
        paused: true,
        pausedAt: stamp(),
        pausedUntil: localDay(until, profile.timeZone),
      });
      returnRequests(account, "mentor-paused");
    }
    event(
      account,
      role,
      role === "mentor"
        ? `New mentorship requests are paused for ${c.noShowLimitDays} days after repeated missed sessions.`
        : `You can have one pending mentorship request at a time for ${c.noShowLimitDays} days after repeated missed sessions. Office Hours booking is paused.`,
      undefined,
      { kind: "no-show-limit", page: "settings" },
    );
    audit(
      { email: "system" },
      "attendance-limit",
      account.id,
      role,
      "Repeated missed sessions.",
    );
    return true;
  }

  function sweep() {
    let changed = false;
    const cutoff = now() - config().noShowWindowDays * dayMs;
    for (const account of Object.values(accounts())) {
      if (account.deletedAt) continue;
      if (
        account.mentorSuspension?.until &&
        Date.parse(account.mentorSuspension.until) <= now()
      ) {
        liftSuspension(account);
        changed = true;
      }
      for (const role of ["mentor", "founder"]) {
        const expires = account.state.mentorshipLimits?.[role];
        if (expires && !active(expires)) {
          clearLimit(account, role);
          changed = true;
        }
        const entries = Object.values(account.state.rooms)
          .filter((room) => isMentorRoom(room) && room.role === role)
          .flatMap((room) => [
            ...mentorSessions(room),
            ...(room.mentorship.sessionHistory || []),
          ])
          .filter(
            (session) =>
              ["no-show-both", `no-show-${role}`].includes(session.outcome) &&
              Date.parse(session.resolvedAt) >= cutoff,
          );
        const unique = [
          ...new Map(
            entries.map((session) => [
              session.id,
              { id: session.id, at: session.resolvedAt },
            ]),
          ).values(),
        ];
        if (applyLimit(account, role, unique)) changed = true;
      }
    }
    return changed;
  }

  function act(admin, state, input) {
    if (!isAdmin(admin)) fail("Moderator access required.", 403);
    const id = input.id;
    const account = Object.hasOwn(accounts(), id) ? accounts()[id] : null;
    if (!account || account.deletedAt || account.id === admin.id)
      fail("Choose an available account.", 404);
    const role = input.values?.role;
    if (input.action === "lift-limit") {
      if (
        !["mentor", "founder"].includes(role) ||
        !active(account.state.mentorshipLimits?.[role])
      )
        fail("This attendance limit is unavailable.", 409);
      clearLimit(account, role);
      audit(
        admin,
        "attendance-limit",
        id,
        "lifted",
        normalized(input.values?.reason),
      );
      event(
        account,
        role,
        "A moderator lifted your mentorship attendance limit.",
        undefined,
        { kind: "limit-lifted", page: "settings" },
      );
      state.toast = "Attendance limit lifted.";
      return;
    }
    if (input.action === "reinstate-mentor") {
      if (!account.mentorSuspension) fail("This mentor is not suspended.", 409);
      liftSuspension(account, admin);
      state.toast = "Mentor reinstated.";
      return;
    }
    if (account.mentorSuspension)
      fail("This mentor is already suspended.", 409);
    const reason = normalized(input.values?.reason);
    const until = normalized(input.values?.until);
    const deadline =
      until && Date.parse(until.length === 10 ? until + "T16:00:00Z" : until);
    if (!reason || (until && (!Number.isFinite(deadline) || deadline <= now())))
      fail("Record a reason and, if temporary, a future end date.");
    account.mentorSuspension = {
      reason,
      until: deadline ? new Date(deadline).toISOString() : null,
      at: stamp(),
      by: admin.id,
    };
    returnRequests(account, "mentor-suspended");
    for (const room of Object.values(account.state.rooms)) {
      if (
        !isMentorRoom(room) ||
        room.role !== "mentor" ||
        ["cancelled", "reviewed"].includes(room.status)
      )
        continue;
      endRoom(room, "mentor", reason);
      room.status = "cancelled";
      room.closeCategory = "moderator";
      mirror(account, account.state, room);
      const founder = accounts()[room.partnerAccountId];
      if (founder && !founder.deletedAt)
        event(
          founder,
          "founder",
          "Your mentor is unavailable. Any upcoming sessions were cancelled. Browse similar mentors for support.",
          undefined,
          {
            kind: "mentor-unavailable",
            page: "discover",
            alternatives: similarMentors(founder, `${account.id}:mentor`),
          },
        );
    }
    event(
      account,
      "mentor",
      `Your mentor profile was suspended${deadline ? ` until ${localDay(deadline)}` : ""}. ${reason}`,
      undefined,
      { kind: "mentor-suspended", page: "home" },
    );
    audit(admin, "mentor-suspension", id, "suspended", reason);
    state.toast = "Mentor suspended.";
  }

  function queue() {
    const cutoff = now() - config().flaggedMessageWindowDays * dayMs;
    const rows = Object.values(accounts()).filter(
      (account) => !account.deletedAt,
    );
    const flags = rows.flatMap((account) => {
      const flagged = (account.mentorSafetyFlags || []).filter(
        (entry) => Date.parse(entry.at) >= cutoff,
      );
      return flagged.length >= config().flaggedMessageLimit
        ? [
            {
              id: account.id,
              name: account.state.accountName,
              count: flagged.length,
              categories: [...new Set(flagged.flatMap((entry) => entry.flags))],
            },
          ]
        : [];
    });
    const limits = rows.flatMap((account) =>
      Object.entries(account.state.mentorshipLimits || {})
        .filter(([, until]) => active(until))
        .map(([role, until]) => ({
          id: account.id,
          name: account.state.accountName,
          role,
          until,
        })),
    );
    const suspensions = rows
      .filter((account) => account.mentorSuspension)
      .map((account) => ({
        id: account.id,
        name: account.state.accountName,
        ...account.mentorSuspension,
      }));
    const ratings = rows.flatMap((account) =>
      ["mentor", "founder"].flatMap((role) => {
        const trust = mentorshipTrust(account.state.rooms, role, {
          now: now(),
          config: config(),
        });
        return trust.ratingPattern
          ? [
              {
                id: account.id,
                name: account.state.accountName,
                role,
                reason: trust.ratingPattern,
              },
            ]
          : [];
      }),
    );
    return { flags, limits, suspensions, ratings };
  }

  function appeal(account) {
    const suspension = account.mentorSuspension;
    if (!suspension || suspension.appealedAt)
      fail("This suspension appeal is unavailable.", 409);
    suspension.appealedAt = stamp();
  }

  return { act, sweep, check, record, queue, appeal };
}
