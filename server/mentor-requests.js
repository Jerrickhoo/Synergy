import { randomUUID } from "node:crypto";
import { terminalStatuses } from "../src/data/collaboration.js";
import { followupEngagement } from "../src/data/mentor-room.js";
import { profileCompleteness } from "../src/data/selectors.js";
import {
  cooldownText,
  ownUnavailableText,
  unavailableText,
} from "../src/data/mentor-rules.js";
import {
  declineMessageLimit,
  requestFields,
  requestLink,
  requestQuality,
} from "../src/data/request-assistant.js";

const day = 86400000;
export const requestActions = new Set([
  "send-request",
  "accept-request",
  "decline-request",
  "refer-request",
  "withdraw-request",
]);

export function createMentorRequests({
  accounts,
  now,
  config,
  identity,
  displayName,
  capacity,
  similarMentors,
  conflict,
  fail,
  event,
  connect,
  legacyWindow,
  options,
  approvedMentor,
  safetyCheck = () => [],
  recordSafety = () => {},
}) {
  const history = (account, role) =>
    (account.state.mentorRequestsByRole ||= { founder: [], mentor: [] })[role];
  const entries = (account, role) =>
    account.state.mentorRequestsByRole?.[role] || [];
  const pending = (account, role, from, to) =>
    account.state.introductionMetaByRole?.[role]?.[
      identity(
        role === "mentor" ? from : to,
        role === "mentor" ? "founder" : "mentor",
      )
    ];
  const stamp = () => new Date(now()).toISOString();
  const name = (account, role) => displayName(account, role);

  function setPending(founder, mentor, meta) {
    const mentorId = identity(mentor, "mentor");
    const founderId = identity(founder, "founder");
    founder.state.waitingByRole.founder.add(mentorId);
    founder.state.interestByRole.founder.add(mentorId);
    mentor.state.incomingByRole.mentor.add(founderId);
    for (const [account, role, id, otherName] of [
      [founder, "founder", mentorId, name(mentor, "mentor")],
      [mentor, "mentor", founderId, name(founder, "founder")],
    ]) {
      account.state.introductionMetaByRole ||= { founder: {}, mentor: {} };
      account.state.introductionMetaByRole[role][id] = {
        ...meta,
        name: otherName,
      };
    }
  }

  function settle(founder, mentor, meta, status, details = {}) {
    const mentorId = identity(mentor, "mentor");
    const founderId = identity(founder, "founder");
    founder.state.waitingByRole.founder.delete(mentorId);
    founder.state.interestByRole.founder.delete(mentorId);
    mentor.state.incomingByRole.mentor.delete(founderId);
    const at = stamp();
    for (const [account, role, id, otherName] of [
      [founder, "founder", mentorId, name(mentor, "mentor")],
      [mentor, "mentor", founderId, name(founder, "founder")],
    ]) {
      delete account.state.introductionMetaByRole?.[role]?.[id];
      delete account.state.introductionTypesByRole?.[role]?.[id];
      const { alternatives, message, cooldownUntil, ...common } = details;
      const content =
        role === "founder" ||
        ["declined", "expired", "returned"].includes(status)
          ? meta
          : {};
      history(account, role).unshift({
        ...content,
        ...common,
        ...(role === "founder" && { alternatives, message, cooldownUntil }),
        id: meta.id,
        format: meta.format,
        sentAt: meta.sentAt,
        expiresAt: meta.expiresAt,
        partnerId: id,
        name: otherName,
        status,
        at,
      });
    }
    if (status !== "withdrawn") {
      const text = {
        accepted: `${name(mentor, "mentor")} accepted your mentorship request.`,
        declined: `${name(mentor, "mentor")} declined your mentorship request.`,
        referred: `${name(mentor, "mentor")} suggested other mentors for your request.`,
        returned: `Your mentorship request to ${name(mentor, "mentor")} was returned.`,
        expired: `Your mentorship request to ${name(mentor, "mentor")} expired without a reply.`,
      }[status];
      event(founder, "founder", text, details.roomId, {
        kind: status,
        page: "waiting",
        requestId: meta.id,
      });
    }
  }

  function sweep() {
    let changed = false;
    for (const founder of Object.values(accounts())) {
      for (const id of founder.state.waitingByRole.founder) {
        if (!id.endsWith(":mentor")) continue;
        const mentor = accounts()[id.slice(0, -7)];
        const raw = founder.state.introductionMetaByRole?.founder?.[id];
        if (!mentor || !raw) continue;
        let meta = raw;
        if (!meta.kind) {
          const sent = Date.parse(raw.sentAt);
          if (!Number.isFinite(sent)) continue;
          meta = {
            id: randomUUID(),
            kind: "legacy-note",
            note: raw.note || "",
            format: "single-session",
            price: 0,
            sentAt: raw.sentAt,
            expiresAt: new Date(sent + legacyWindow).toISOString(),
          };
          setPending(founder, mentor, meta);
          changed = true;
        }
        if (now() >= Date.parse(meta.expiresAt)) {
          const alternatives = similarMentors(founder, id);
          settle(founder, mentor, meta, "expired", { alternatives });
          changed = true;
        }
      }
      const cutoff = now() - config().requestContentRetentionDays * day;
      for (const entry of entries(founder, "mentor")) {
        if (Date.parse(entry.at) > cutoff) continue;
        for (const field of [
          "problem",
          "tried",
          "question",
          "desiredOutcome",
          "note",
          "links",
          "sharpenedFrom",
          "quality",
          "qualityReasons",
          "safetyFlags",
          "consentAt",
          "referredFrom",
          "price",
          "kind",
        ]) {
          if (Object.hasOwn(entry, field)) {
            delete entry[field];
            changed = true;
          }
        }
      }
    }
    return changed;
  }

  function returned(mentor, reason, onlyFounder) {
    let count = 0;
    for (const id of [...mentor.state.incomingByRole.mentor]) {
      if (!id.endsWith(":founder")) continue;
      const founder = accounts()[id.slice(0, -8)];
      if (!founder || (onlyFounder && founder.id !== onlyFounder.id)) continue;
      const meta = pending(mentor, "mentor", founder, mentor);
      if (
        !meta?.kind ||
        !founder.state.waitingByRole.founder.has(identity(mentor, "mentor"))
      )
        continue;
      settle(founder, mentor, meta, "returned", {
        reason,
        alternatives: similarMentors(founder, identity(mentor, "mentor")),
      });
      count += 1;
    }
    return count;
  }

  function decorate(account, state) {
    const role = state.role;
    const people =
      role === "mentor"
        ? state.directory.mentorStartups
        : state.directory.mentors;
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const active =
      role === "mentor"
        ? state.incomingByRole.mentor
        : state.waitingByRole.founder;
    const records = [...active].flatMap((id) => {
      const meta = state.introductionMetaByRole[role]?.[id];
      if (!meta?.kind) return [];
      const person = peopleById.get(id);
      return [
        {
          ...meta,
          partnerId: id,
          status: "pending",
          score: person?.score || 0,
          conflictWarning: person?.conflictWarning,
          trackRecord: person?.founderTrackRecord,
          matchReason: person?.why?.[0],
          rank:
            (person?.score || 0) +
            Math.round(((meta.quality || 0) / 100) * config().qualityBonusMax) +
            (person?.founderTrackRecord?.prepared
              ? config().preparedFounderBonus
              : 0),
        },
      ];
    });
    state.mentorRequests =
      role === "mentor"
        ? records.sort(
            (a, b) => b.rank - a.rank || a.expiresAt.localeCompare(b.expiresAt),
          )
        : [...records, ...entries(account, role)]
            .map((entry) => ({
              ...entry,
              alternatives:
                entry.status === "referred"
                  ? (entry.alternatives || []).filter(
                      ({ id }) => peopleById.get(id)?.available,
                    )
                  : ["expired", "returned", "declined"].includes(entry.status)
                    ? similarMentors(account, entry.partnerId)
                    : [],
            }))
            .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    if (role === "mentor")
      state.referralChoices = Object.fromEntries(
        records.map((entry) => {
          const founder = accounts()[entry.partnerId.slice(0, -8)];
          return [
            entry.id,
            founder
              ? similarMentors(founder, identity(account, "mentor"), 5)
              : [],
          ];
        }),
      );
    state.mentorRequestLimit = role === "founder" ? founderLimit(state) : null;
  }

  function founderLimit(state) {
    const limited =
      Object.values(state.rooms || {}).some((room) => {
        if (room.role !== "founder") return false;
        const followup = followupEngagement(room)?.followup;
        return (
          followup &&
          !followup.submittedAt &&
          (followup.overdue || Date.parse(followup.overdueAt) <= now())
        );
      }) || Date.parse(state.mentorshipLimits?.founder || "") > now();
    return limited
      ? config().founderLimitedPending
      : config().founderMaxPending;
  }

  function act(account, state, input) {
    const action = input.action;
    const sending = action === "send-request";
    const asFounder = state.role === "founder";
    if (
      asFounder !== (sending || action === "withdraw-request") &&
      action !== "simulate-acceptance"
    )
      fail("This action is unavailable for your role.", 403);
    const partnerRole = asFounder ? "mentor" : "founder";
    if (typeof input.id !== "string" || !input.id.endsWith(`:${partnerRole}`))
      fail("Choose an available collaborator.", 404);
    const otherId = input.id.slice(0, -partnerRole.length - 1);
    const other = Object.hasOwn(accounts(), otherId)
      ? accounts()[otherId]
      : null;
    if (!other || other.deletedAt)
      fail("This collaborator is unavailable.", 404);
    const founder = asFounder ? { ...account, state } : other;
    const mentor = asFounder ? other : { ...account, state };
    const mentorId = identity(mentor, "mentor");
    const alternatives = () => similarMentors(founder, mentorId);
    const blocked = (message, reason) =>
      fail(message, 409, undefined, { reason, alternatives: alternatives() });
    const values = input.values || {};
    if (typeof values !== "object" || Array.isArray(values))
      fail("Invalid request values.");
    const meta = pending({ state }, state.role, founder, mentor);
    const pairIssue = () => {
      if (conflict(mentor, founder)?.level === "block")
        blocked("A conflict of interest prevents this request.", "conflict");
      if (
        founder.blockedAccounts?.includes(mentor.id) ||
        mentor.blockedAccounts?.includes(founder.id)
      )
        blocked("This collaborator is unavailable.", "blocked");
    };
    if (sending) {
      pairIssue();
      const person = state.directory.mentors.find(
        (item) => item.id === input.id,
      );
      if (!person)
        blocked(
          "This mentor is unavailable. Explore the suggested mentors.",
          "unavailable",
        );
      if (
        Object.values(state.rooms).some(
          (room) =>
            room.role === "founder" &&
            room.partnerId === input.id &&
            !terminalStatuses.includes(room.status),
        )
      )
        blocked(
          "Open your existing mentorship room to continue working with this mentor.",
          "active-room",
        );
      const limit = founderLimit(state);
      if (meta && founder.state.waitingByRole.founder.has(mentorId))
        blocked(
          "You already have a pending request with this mentor. View it in Introductions.",
          "already-pending",
        );
      if (
        [...state.waitingByRole.founder].filter((id) => id.endsWith(":mentor"))
          .length >= limit
      )
        blocked(
          `You can have ${limit} pending mentorship requests. Withdraw a request or wait for a reply${limit < config().founderMaxPending ? ", or complete any overdue follow-up" : ""}.`,
          "founder-limit",
        );
      const cooled = entries(founder, "founder").find(
        (entry) =>
          entry.partnerId === input.id &&
          Date.parse(entry.cooldownUntil) > now(),
      );
      if (cooled)
        blocked(
          `${cooldownText(cooled.cooldownUntil, { now: now(), timeZone: mentor.state.profiles.mentor.timeZone })}. Try another mentor in the meantime.`,
          "cooldown",
        );
      const format = values.format;
      if (
        !person.availableFormats.includes(format) ||
        format === "office-hours"
      ) {
        const reason =
          person.reason || person.formatReasons[format] || "format-unavailable";
        blocked(
          unavailableText(reason, person.name, {
            format: person.reason ? undefined : format,
            month: person.reason
              ? person.reasonMonth
              : person.formatReasonMonths?.[format],
          }) || "Choose another available format.",
          reason,
        );
      }
      const draft = Object.fromEntries(
        Object.keys(requestFields).map((key) => [
          key,
          typeof values[key] === "string" ? values[key].trim() : "",
        ]),
      );
      const errors = Object.fromEntries(
        Object.entries(draft)
          .filter(([, value]) => value.length < 20 || value.length > 1000)
          .map(([key]) => [key, "Enter between 20 and 1,000 characters."]),
      );
      const desiredOutcome =
        typeof values.desiredOutcome === "string"
          ? values.desiredOutcome.trim()
          : "";
      if (desiredOutcome.length > 1000)
        errors.desiredOutcome = "Enter up to 1,000 characters.";
      const links = Array.isArray(values.links) ? values.links : [];
      if (
        (values.links != null && !Array.isArray(values.links)) ||
        links.length > 5 ||
        links.some(
          (link) =>
            typeof link !== "string" ||
            link.length > 2048 ||
            !requestLink(link),
        )
      )
        errors.links = "Enter up to five complete HTTP or HTTPS links.";
      if (Object.keys(errors).length)
        fail("Check the request details.", 400, errors);
      const flags = safetyCheck(
        [...Object.values(draft), desiredOutcome, ...links].join("\n"),
        values.acknowledgeSafety,
      );
      const quality = requestQuality({ ...draft, links });
      const referral = entries(founder, "founder").find(
        (entry) =>
          entry.id === values.referralId &&
          entry.status === "referred" &&
          entry.alternatives.some((item) => item.id === mentorId),
      );
      const request = {
        ...draft,
        ...(desiredOutcome && { desiredOutcome }),
        id: randomUUID(),
        kind: "mentor-request",
        format,
        links,
        price: person.formats.find((item) => item.id === format).price,
        quality: quality.score,
        qualityReasons: quality.reasons,
        sharpenedFrom:
          typeof values.sharpenedFrom === "string"
            ? values.sharpenedFrom.slice(0, 1000)
            : null,
        sentAt: stamp(),
        expiresAt: new Date(now() + person.responseDays * day).toISOString(),
        consentAt: stamp(),
        referredFrom: referral?.partnerId.split(":")[0] || null,
      };
      if (flags.length) request.safetyFlags = flags;
      setPending(founder, mentor, request);
      recordSafety(account, state.role, flags, `request:${request.id}`);
      event(
        mentor,
        "mentor",
        `${name(founder, "founder")} sent a mentorship request.`,
        undefined,
        { kind: "request", page: "requests", requestId: request.id },
      );
      state.page = "waiting";
      state.activeMentorRequest = request.id;
      state.toast = `Request sent to ${person.name}.`;
      return;
    }
    if (!meta?.kind)
      blocked("This request is no longer pending.", "request-closed");
    if (input.requestId && input.requestId !== meta.id)
      blocked(
        "This request has changed. Open the latest request.",
        "request-changed",
      );
    if (action === "withdraw-request") {
      settle(founder, mentor, meta, "withdrawn");
      state.toast = "Request withdrawn.";
    } else if (action === "decline-request") {
      pairIssue();
      const { reason } = values;
      if (!Object.hasOwn(config().cooldownDays, reason))
        fail("Choose a reason for declining.");
      const days = config().cooldownDays[reason];
      const message =
        typeof values.message === "string" ? values.message.trim() : "";
      // Never cut a message off silently; the mentor shortens it instead.
      if (message.length > declineMessageLimit)
        fail(
          `Message to the founder: shorten it to ${declineMessageLimit} characters (now ${message.length}).`,
          400,
          {
            message: `Shorten it to ${declineMessageLimit} characters (now ${message.length}).`,
          },
        );
      settle(founder, mentor, meta, "declined", {
        reason,
        message,
        cooldownUntil: days ? new Date(now() + days * day).toISOString() : null,
        alternatives: alternatives(),
      });
      state.toast = "Request declined.";
    } else if (action === "refer-request") {
      pairIssue();
      const choices = similarMentors(founder, mentorId, 5);
      const ids = values.mentorIds;
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > config().maxReferrals ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !choices.some((item) => item.id === id))
      )
        blocked(
          `Choose up to ${config().maxReferrals} available mentors from the suggestions.`,
          "invalid-referral",
        );
      settle(founder, mentor, meta, "referred", {
        alternatives: choices.filter((item) => ids.includes(item.id)),
      });
      state.toast = "Referral sent.";
    } else {
      pairIssue();
      if (
        founder.suspended ||
        mentor.suspended ||
        mentor.mentorSuspension ||
        mentor.profileVisible === false ||
        founder.profileVisible === false
      )
        blocked(
          "A profile is unavailable. Refresh the request list.",
          "unavailable",
        );
      const usage = capacity(mentor.state);
      const format = meta.format;
      const reason = [
        "paused",
        "guidelines",
        "approval-required",
        "no-show-limit",
      ].includes(usage.reason)
        ? usage.reason
        : !usage.offeredFormats.includes(format) && meta.kind !== "legacy-note"
          ? "format-unavailable"
          : usage.fitReasons?.[format] || usage.formatReasons[format];
      if (reason)
        blocked(
          ownUnavailableText(reason) ||
            "This format is unavailable. Update mentoring settings or decline the request.",
          reason,
        );
      const person = {
        id: input.id,
        accountId: other.id,
        role: partnerRole,
        name: name(other, partnerRole),
      };
      const room = connect(
        account,
        state,
        person,
        action === "simulate-acceptance",
        meta,
      );
      settle(founder, mentor, meta, "accepted", { roomId: room.id });
    }
  }

  function verify(account, state, input) {
    if (!["send-request", "accept-request"].includes(input.action)) return;
    if (
      options.requireVerification &&
      !account.demo &&
      account.affiliation?.status !== "verified" &&
      !(
        state.role === "mentor" &&
        account.mentorApplication?.status === "approved"
      )
    )
      fail(
        "Verify your affiliation before sending or accepting requests. Open Verification on your profile.",
        403,
      );
    if (state.role === "mentor" && !approvedMentor(account))
      fail(
        "Complete mentor approval before accepting requests.",
        409,
        undefined,
        { reason: "approval-required" },
      );
    if (
      account.profileVisible === false ||
      ((account.mentorApplication?.status !== "approved" ||
        state.role !== "mentor") &&
        profileCompleteness(state.profiles[state.role], state.role) !== 100)
    )
      fail(
        "Complete your profile and make it visible before sending or accepting a request.",
        403,
      );
  }

  // Prototype only: a new preview mentor starts with one request from a
  // fictional sample founder, so the inbox, acceptance and the mentorship
  // room can be tried without a second account.
  function seedSampleRequest(mentor, sample) {
    const founder = accounts()[sample.accountId];
    if (!founder?.demoSample || founder.deletedAt) return false;
    if (pending(mentor, "mentor", founder, mentor)) return false;
    const draft = {
      problem: sample.problem,
      tried: sample.tried,
      question: sample.question,
    };
    const quality = requestQuality({ ...draft, links: [] });
    const request = {
      ...draft,
      desiredOutcome: sample.desiredOutcome,
      id: randomUUID(),
      kind: "mentor-request",
      format: "single-session",
      links: [],
      price: 0,
      quality: quality.score,
      qualityReasons: quality.reasons,
      sharpenedFrom: null,
      sentAt: stamp(),
      expiresAt: new Date(now() + 7 * day).toISOString(),
      consentAt: stamp(),
      referredFrom: null,
      sample: true,
    };
    setPending(founder, mentor, request);
    event(
      mentor,
      "mentor",
      `${name(founder, "founder")} sent a mentorship request.`,
      undefined,
      { kind: "request", page: "requests", requestId: request.id },
    );
    // Shown at once rather than held for the daily request digest.
    if (mentor.state.activity[0]?.requestId === request.id)
      mentor.state.activity[0].requestDigestAt = null;
    return true;
  }

  return {
    act,
    verify,
    sweep,
    decorate,
    returned,
    founderLimit,
    seedSampleRequest,
  };
}
