import { randomUUID } from "node:crypto";
import { ensureCycle, terminalStatuses } from "../src/data/collaboration.js";
import { mentorFormat, canUpgrade } from "../src/data/mentor-formats.js";
import { scheduleInstant } from "../src/data/selectors.js";
import {
  cyclePlan,
  mentorCommitments,
  mentorMinutesFit,
  ownUnavailableText,
  validTimeZone,
} from "../src/data/mentor-rules.js";
import {
  appointment,
  attendanceReports,
  checkInsConfirmedText,
  dayMs,
  deliveredMilestone,
  followupEngagement,
  followupTasks,
  goalMilestone,
  hourMs,
  isMentorRoom,
  mentorSessions,
  mentorTemplate,
  milestoneSet,
  noteSessions,
  resolvedOutcomes,
  resolveAttendance,
  reviewCategories,
  roomFormat,
  sessionMilestone,
  setMentorMilestone,
} from "../src/data/mentor-room.js";
import { simulatedOutcome } from "./demo-directory.js";

export const mentorshipActions = new Set([
  "confirm-goal",
  "simulate-goal-confirmation",
  "simulate-session-held",
  "simulate-delivery",
  "simulate-check-in-confirmation",
  "simulate-cycle-review",
  "simulate-upgrade-acceptance",
  "simulate-upgrade-decline",
  "simulate-founder-rating",
  "simulate-doc-upload",
  "simulate-revisions",
  "simulate-check-in-proposal",
  "confirm-check-in-time",
  "report-attendance",
  "reschedule-session",
  "cancel-session",
  "resolve-session-dispute",
  "deliver-answer",
  "rate-answer",
  "log-revision",
  "submit-followup",
  "propose-upgrade",
  "accept-upgrade",
  "decline-upgrade",
  "end-mentorship",
  "set-testimonial-public",
]);
export const mentorshipForms = new Set([
  "session-note",
  "prep-checklist",
  "propose-check-in-time",
]);
const genericActions = new Set([
  "lock-terms",
  "accept-terms",
  "reopen-terms",
  "accept-reopen",
  "decline-reopen",
  "confirm-milestone",
  "dispute",
  "resolve-dispute",
  "launch-room",
  "undo-launch",
  "withdraw-dispute",
  "escalate-dispute",
  "send-back",
]);
const genericForms = new Set(["terms-form", "send-back", "milestone-date"]);
const text = (values, key, max = 3000) =>
  typeof values[key] === "string" ? values[key].trim().slice(0, max) : "";
const sessionEnd = (schedule) =>
  scheduleInstant(schedule).getTime() + schedule.durationMinutes * 60000;
const between = (a, b) =>
  scheduleInstant(a).getTime() < sessionEnd(b) &&
  scheduleInstant(b).getTime() < sessionEnd(a);

function preserveSessions(room) {
  const sessions = mentorSessions(room);
  for (const note of room.notes || []) {
    if (note.sessionId || note.sessionIndex == null) continue;
    note.sessionId = sessions[note.sessionIndex]?.id || null;
  }
  room.mentorship.sessionHistory.push(...sessions);
}

export function createMentorshipRooms({
  accounts,
  canSimulatePartner = () => false,
  config,
  now,
  capacity,
  event,
  mirror,
  fail,
  isAdmin,
  audit,
  officeAllocation,
  safetyCheck = () => [],
  recordSafety = () => {},
}) {
  const stamp = () => new Date(now()).toISOString();
  const mentorAccount = (account, state, room) =>
    room.role === "mentor"
      ? { ...account, state }
      : accounts()[room.partnerAccountId];
  const founderAccount = (account, state, room) =>
    room.role === "founder"
      ? { ...account, state }
      : accounts()[room.partnerAccountId];

  // The one confirm-goal rule, shared by the mentor's action and the
  // prototype simulation.
  function confirmGoal(room, proposed) {
    const field = goalMilestone(room);
    if (!room.milestones[field] || room.milestones[field].me)
      fail("The goal is already confirmed.");
    const goal = proposed || room.terms.draft.goal;
    if (!goal) fail("Add a goal to confirm.");
    room.terms.draft.goal = goal;
    if (room.cycle) room.cycle.goals = goal;
    setMentorMilestone(room, field);
  }

  // The one rule for delivering a Quick Ask answer or a document review,
  // shared by the mentor's action and the prototype simulation. Returns the
  // founder's update.
  function deliver(room, answer, byAccountId, simulated = false) {
    const info = room.mentorship;
    const format = roomFormat(room);
    if (mentorFormat(format).sync || info.deliveredAt || info.answerExpiredAt)
      fail("An answer or review is no longer needed.", 400);
    if (!answer) fail("Write your answer or review.", 400);
    const item = room.milestones[deliveredMilestone(room)];
    item.attachment = answer;
    (item.evidenceItems ||= []).push({
      label: answer,
      at: stamp(),
      byAccountId,
      ...(simulated && { simulated: true }),
    });
    info.answer = answer;
    info.deliveredAt = stamp();
    if (simulated) info.answerSimulated = true;
    setMentorMilestone(room, deliveredMilestone(room));
    startReview(room);
    return format === "quick-ask"
      ? "The mentor answered the Quick Ask."
      : "The mentor delivered the document review.";
  }

  // The one rule for confirming the proposed advisory check-in time, which
  // books every check-in of the cycle. Returns the update for both sides.
  function confirmCheckIns(room, mentor, founder) {
    const cycle = room.cycle;
    const { date, time, timeZone } = cycle.proposedTime;
    const period = Math.floor(
      (Date.parse(cycle.dueAt) - Date.parse(cycle.startsAt)) /
        dayMs /
        cycle.checkIns,
    );
    const proposed = Array.from({ length: cycle.checkIns }, (_, index) => {
      const localDay = new Date(
        Date.parse(date + "T00:00:00Z") + index * period * dayMs,
      )
        .toISOString()
        .slice(0, 10);
      return makeSession(
        { date: localDay, time },
        timeZone,
        cycle.checkInMinutes,
      );
    });
    if (
      !proposed.every(
        (session) =>
          scheduleInstant(session).getTime() < Date.parse(cycle.dueAt),
      )
    )
      fail(
        "The proposed check-ins do not fit before the cycle ends. Propose an earlier start.",
        400,
      );
    checkSchedule(mentor, founder, proposed, { reservationRoomId: room.id });
    sessionMilestone(room).schedules = proposed;
    cycle.confirmedAt = stamp();
    return checkInsConfirmedText(proposed, now());
  }

  // The one rule for answering an upgrade proposal, shared by the person
  // asked and the prototype simulation of a fictional partner.
  function replyToUpgrade(room, accept, mentor, role) {
    const info = room.mentorship;
    const format = roomFormat(room);
    const upgrade = info.upgrade;
    if (accept) {
      const usage = capacity(mentor.state);
      const reason = [
        "paused",
        "guidelines",
        "suspended",
        "approval-required",
        "no-show-limit",
      ].includes(usage.reason)
        ? usage.reason
        : usage.fitReasons[upgrade.format];
      if (reason)
        fail(
          ownUnavailableText(reason) ||
            "The mentor has no capacity for this upgrade.",
          409,
          undefined,
          { reason },
        );
      if (!usage.offeredFormats.includes(upgrade.format))
        fail("The mentor does not offer this format.", 409);
      if (info.followup)
        info.followup.actionItemIds = followupTasks(room, info.followup).map(
          ({ id }) => id,
        );
      info.history.push({
        format,
        price: room.terms.draft.price || 0,
        milestones: room.milestones,
        role,
        review: room.review,
        reviewOpenedAt: info.reviewOpenedAt,
        deliveredAt: info.deliveredAt,
        acceptedAt: info.acceptedAt,
        followup: info.followup,
      });
      preserveSessions(room);
      room.template = mentorTemplate(upgrade.format);
      room.terms.draft.format = upgrade.format;
      room.milestones = milestoneSet(upgrade.format);
      room.status = "in-progress";
      room.review = { me: false, partner: false };
      for (const key of [
        "deliveredAt",
        "followup",
        "reviewOpenedAt",
        "reviewClosesAt",
        "slotReleased",
        "answer",
        "answerSimulated",
        "upgradeSimulated",
        "answerRating",
        "revisions",
      ])
        delete info[key];
      info.acceptedAt = stamp();
      if (upgrade.format === "ongoing-advisory")
        ensureCycle(room, now(), config());
      delete room.completedAt;
      delete info.upgrade;
      return {
        kind: "upgrade-accepted",
        message: "Mentorship upgrade accepted.",
      };
    }
    delete info.upgrade;
    return {
      kind: "upgrade-declined",
      message: "Mentorship upgrade declined.",
    };
  }

  // Founder steps, each shared by the founder's own action and the
  // prototype simulation of a fictional founder.
  function rateAnswer(room, rating) {
    const info = room.mentorship;
    if (
      mentorFormat(roomFormat(room)).sync ||
      !info.deliveredAt ||
      info.answerRating ||
      !["helpful", "not-helpful"].includes(rating)
    )
      fail("Choose Helpful or Not helpful after delivery.", 400);
    info.answerRating = rating;
    info.answerRatedAt = stamp();
    setMentorMilestone(room, "helpful");
    return "Answer feedback saved.";
  }
  function logRevisions(room, summary) {
    const info = room.mentorship;
    if (
      roomFormat(room) !== "doc-review" ||
      !info.deliveredAt ||
      now() > Date.parse(info.deliveredAt) + config().revisionWindowDays * dayMs
    )
      fail("The revision window has closed.", 400);
    if (!summary) fail("Describe what you revised.", 400);
    info.revisions = { summary, at: stamp() };
    setMentorMilestone(room, "revisions");
    return "Document revisions logged.";
  }
  function shareDocument(room, evidence) {
    const item = room.milestones.uploaded;
    (item.evidenceItems ||= []).push(evidence);
    item.attachment = evidence.label;
    setMentorMilestone(room, "uploaded");
    return "Preparation material shared.";
  }
  function proposeCheckIn(room, session, role) {
    if (
      roomFormat(room) !== "ongoing-advisory" ||
      room.cycle?.phase !== "active" ||
      room.cycle.confirmedAt ||
      !room.milestones.goals.me
    )
      fail("Confirm the advisory goal before proposing check-ins.", 400);
    if (role === "founder") room.mentorship.founderTimeZone = session.timeZone;
    room.cycle.proposedTime = {
      date: session.date,
      time: session.time,
      timeZone: session.timeZone,
      proposedBy: role,
    };
    return role === "founder"
      ? "Founder proposed a regular advisory check-in time. Confirm it in the room."
      : "Your mentor suggested another advisory check-in time. Confirm it in the room.";
  }

  // The one rule for saving a private cycle review, for either participant.
  function saveCycleReview(room, accountId, scores, note, simulated = false) {
    const cycle = room.cycle;
    cycle.reviews[accountId] = {
      scores,
      rating:
        Object.values(scores).reduce((sum, rating) => sum + rating, 0) /
        Object.keys(scores).length,
      note,
      at: stamp(),
      ...(simulated && { simulated: true }),
    };
    setMentorMilestone(room, "progress");
    if (room.mentorship.endedAt && Object.keys(cycle.reviews).length === 2) {
      room.status = "reviewed";
      room.completedAt = stamp();
    }
  }

  // The one rule for choosing Continue or Finish at the end of a cycle, for
  // either participant. Returns the update for both sides.
  function decideCycle(room, accountId, decision, mentor) {
    const cycle = room.cycle;
    const info = room.mentorship;
    const format = roomFormat(room);
    cycle.decisions[accountId] = decision;
    if (decision === "finish") {
      info.endedAt ||= stamp();
      info.slotReleased = true;
      room.status = "launched";
      info.cycleReviewClosesAt = new Date(
        now() + config().reviewWindowDays * dayMs,
      ).toISOString();
      if (Object.keys(cycle.reviews).length === 2) {
        room.status = "reviewed";
        room.completedAt = stamp();
        cycle.endedAt ||= stamp();
      }
      return "The advisory cycle ended.";
    }
    if (
      Object.values(cycle.decisions).filter((choice) => choice === "continue")
        .length !== 2
    )
      return "Cycle decision saved.";
    if (info.endedAt) fail("This advisory has ended.", 409);
    if (
      !mentorMinutesFit(
        mentor.state,
        cyclePlan(now(), config()),
        config(),
        officeAllocation?.(mentor.state, now(), config()).months ||
          mentorCommitments(mentor.state, now(), config()),
      )
    )
      fail("The next cycle exceeds the mentor's monthly hours.", 409);
    (room.cycleHistory ||= []).push({
      ...cycle,
      milestones: room.milestones,
    });
    preserveSessions(room);
    room.milestones = milestoneSet(format);
    const number = cycle.number + 1;
    delete room.cycle;
    ensureCycle(room, now(), config()).number = number;
    return `Advisory cycle ${number} started.`;
  }

  function startReview(room, at = stamp()) {
    if (room.mentorship.reviewOpenedAt) return;
    room.mentorship.reviewOpenedAt = at;
    room.mentorship.reviewClosesAt = new Date(
      Date.parse(at) + config().reviewWindowDays * dayMs,
    ).toISOString();
  }

  function beginCycleReview(room, at = stamp()) {
    const cycle = ensureCycle(room, now(), config());
    cycle.phase = "review";
    cycle.endedAt ||= at;
    cycle.reviewClosesAt ||= new Date(
      Date.parse(at) + config().reviewWindowDays * dayMs,
    ).toISOString();
    return cycle;
  }

  function cancel(session, role, reason, forceLate = false) {
    if (session.outcome || session.cancelledAt) return false;
    session.cancelledAt = stamp();
    session.cancelledBy = role;
    session.cancelReason = reason;
    session.lateCancel =
      forceLate ||
      scheduleInstant(session).getTime() - now() <
        config().lateNoticeHours * hourMs;
    return true;
  }

  function end(room, role, reason) {
    const ongoing = roomFormat(room) === "ongoing-advisory";
    for (const session of mentorSessions(room))
      if (scheduleInstant(session).getTime() > now())
        cancel(session, role, reason, Boolean(session.lateCancel));
    room.mentorship.endedAt = room.closedAt = stamp();
    room.mentorship.slotReleased = true;
    room.closeReason = reason;
    room.closeCategory = "mutual";
    if (ongoing) {
      const cycle = beginCycleReview(room);
      cycle.summary ||= reason;
      room.status = "launched";
      room.mentorship.cycleReviewClosesAt = new Date(
        now() + config().reviewWindowDays * dayMs,
      ).toISOString();
    } else room.status = "cancelled";
  }

  function applyOutcome(account, state, room, schedule, outcome) {
    schedule.outcome = outcome;
    schedule.resolvedAt = stamp();
    const format = roomFormat(room);
    if (outcome === "disputed") {
      schedule.disputedAt ||= stamp();
      for (const recipient of [
        account,
        accounts()[room.partnerAccountId],
      ].filter(Boolean))
        event(
          recipient.id === account.id ? { state } : recipient,
          recipient.id === account.id ? room.role : room.partnerRole,
          "Attendance reports disagree. A moderator will review this session.",
          room.id,
          { kind: "session-disputed", tab: "schedule" },
        );
      return;
    }
    if (format !== "ongoing-advisory") room.mentorship.slotReleased = true;
    if (outcome !== "held") return;
    if (format === "ongoing-advisory") {
      if (
        mentorSessions(room).length &&
        mentorSessions(room).every((entry) => entry.outcome === "held")
      ) {
        setMentorMilestone(room, "checkins");
        beginCycleReview(room);
      }
      return;
    }
    setMentorMilestone(room, "held");
    startReview(room, schedule.resolvedAt);
    if (format === "single-session")
      room.mentorship.followup ||= {
        availableAt: new Date(
          now() + config().followupAfterDays * dayMs,
        ).toISOString(),
        overdueAt: new Date(
          now() + config().followupOverdueDays * dayMs,
        ).toISOString(),
        heldAt: stamp(),
      };
  }

  function sweep(account, state, room) {
    if (!isMentorRoom(room) || ["cancelled", "reviewed"].includes(room.status))
      return false;
    let changed = false;
    for (const schedule of mentorSessions(room)) {
      if (schedule.outcome || schedule.cancelledAt) continue;
      const outcome = resolveAttendance(
        schedule,
        now(),
        config().attendanceAutoConfirmHours,
      );
      if (outcome) {
        applyOutcome(account, state, room, schedule, outcome);
        changed = true;
      }
    }
    const format = roomFormat(room);
    const info = room.mentorship;
    const followup = followupEngagement(room)?.followup;
    if (
      followup &&
      Date.parse(followup.overdueAt) <= now() &&
      !followup.overdue &&
      !followup.submittedAt
    ) {
      followup.overdue = true;
      followup.status = "No follow-up";
      changed = true;
    }
    if (
      !mentorFormat(format).sync &&
      !room.payment?.amount &&
      !info.deliveredAt &&
      !info.answerExpiredAt &&
      now() >=
        Date.parse(info.acceptedAt) + config().asyncAutoCompleteDays * dayMs
    ) {
      info.answerExpiredAt = stamp();
      room.status = "reviewed";
      room.completedAt = stamp();
      changed = true;
    }
    if (info.upgrade && now() >= Date.parse(info.upgrade.expiresAt)) {
      delete info.upgrade;
      changed = true;
    }
    if (
      format === "ongoing-advisory" &&
      room.cycle?.phase === "active" &&
      now() >= Date.parse(room.cycle.dueAt)
    ) {
      beginCycleReview(room, room.cycle.dueAt);
      changed = true;
    }
    if (
      room.cycle?.reviewClosesAt &&
      !room.cycle.reviewWindowClosed &&
      now() >= Date.parse(room.cycle.reviewClosesAt)
    ) {
      room.cycle.reviewWindowClosed = true;
      changed = true;
    }
    const deadline = info.cycleReviewClosesAt || info.reviewClosesAt;
    if (
      !room.review.windowClosed &&
      deadline &&
      now() >= Date.parse(deadline)
    ) {
      room.review.windowClosed = true;
      changed = true;
    }
    if (
      format === "ongoing-advisory" &&
      info.endedAt &&
      room.review.windowClosed
    ) {
      room.status = "reviewed";
      room.completedAt ||= stamp();
      changed = true;
    } else if (finalize(room)) changed = true;
    return changed;
  }

  function finalize(room) {
    const format = roomFormat(room);
    if (format === "ongoing-advisory" && !room.mentorship.endedAt) return false;
    if (!(room.review.windowClosed || (room.review.me && room.review.partner)))
      return false;
    const followup = room.mentorship.followup;
    if (followup && !followup.submittedAt && !followup.overdue) return false;
    room.status = "reviewed";
    room.completedAt ||= stamp();
    setMentorMilestone(room, "reviewed");
    return true;
  }

  function makeSession(values, timeZone, durationMinutes) {
    const date = text(values, "date", 10);
    const time = text(values, "time", 5);
    const parsed = new Date(`${date}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date ||
      !/^\d{2}:\d{2}$/.test(time) ||
      !validTimeZone(timeZone) ||
      ![15, 30, 45, 60].includes(durationMinutes)
    )
      fail("Choose a valid session date, time, duration and time zone.", 400, {
        date: "Choose a valid date and time.",
      });
    const schedule = {
      id: randomUUID(),
      date,
      time,
      timeZone,
      durationMinutes,
    };
    const starts = scheduleInstant(schedule).getTime();
    if (!Number.isFinite(starts) || starts <= now())
      fail("Choose a time in the future.", 400, {
        date: "Choose a date and time in the future.",
      });
    return appointment(schedule);
  }

  function checkSchedule(mentor, founder, proposed, exclude = {}) {
    for (const actor of [mentor, founder]) {
      if (!actor) fail("This mentorship is unavailable.", 409);
      const schedules = Object.values(actor.state.rooms)
        .filter((room) => !terminalStatuses.includes(room.status))
        .flatMap((room) =>
          isMentorRoom(room)
            ? mentorSessions(room)
            : room.milestones.session?.schedules || [],
        );
      if (
        schedules.some(
          (schedule) =>
            !schedule.cancelledAt &&
            !schedule.outcome &&
            (!exclude.scheduleId || schedule.id !== exclude.scheduleId) &&
            proposed.some((candidate) => between(candidate, schedule)),
        )
      )
        fail(
          "That time overlaps an existing session. Choose another time.",
          409,
        );
    }
    const minutes = proposed.map((session) => ({
      instant: scheduleInstant(session).getTime(),
      minutes: session.durationMinutes,
    }));
    const commitments = mentorCommitments(
      mentor.state,
      now(),
      config(),
      exclude,
    );
    const reserved =
      officeAllocation?.(mentor.state, now(), config(), undefined, proposed)
        .unbooked || {};
    for (const [month, slots] of Object.entries(reserved))
      commitments[month] =
        (commitments[month] || 0) +
        slots
          .filter(
            (slot) =>
              slot.id !== exclude.unbookedOfficeOccurrence &&
              !proposed.some((session) => between(session, slot)),
          )
          .reduce((sum, slot) => sum + slot.durationMinutes, 0);
    if (!mentorMinutesFit(mentor.state, minutes, config(), commitments))
      fail(
        "Those sessions exceed the mentor's monthly hours. Choose another date or shorter session.",
        409,
      );
  }

  function referencedSession(room, input) {
    const index = Number(input.values?.scheduleIndex ?? input.scheduleIndex);
    const session = mentorSessions(room)[index];
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      !session ||
      (input.values?.scheduleId && session.id !== input.values.scheduleId)
    )
      fail("This session changed. Open the schedule to refresh it.", 409);
    return { session, index };
  }

  function chooseDispute(account, state, input) {
    if (!isAdmin(account)) fail("Moderator access required.", 403);
    const ownerId = input.values?.accountId;
    const owner = Object.hasOwn(accounts(), ownerId)
      ? accounts()[ownerId]
      : null;
    const ownerState = owner?.id === account.id ? state : owner?.state;
    const room = ownerState?.rooms[input.values?.roomId || input.activeRoomId];
    if (!isMentorRoom(room)) fail("Session dispute unavailable.", 404);
    const { session } = referencedSession(room, input);
    const { outcome } = input.values;
    if (session.outcome !== "disputed" || !resolvedOutcomes.includes(outcome))
      fail("Choose an open dispute and a valid outcome.");
    applyOutcome(owner, ownerState, room, session, outcome);
    mirror(
      owner,
      ownerState,
      room,
      "A moderator resolved your session dispute.",
      { kind: "session-resolved", tab: "schedule" },
    );
    if (room.partnerAccountId === account.id)
      state.rooms[room.id] = account.state.rooms[room.id];
    event(
      { state: ownerState },
      room.role,
      "A moderator resolved your session dispute.",
      room.id,
      { kind: "session-resolved", tab: "schedule" },
    );
    audit(account, "session-dispute", room.id, outcome);
    state.toast = "Session dispute resolved.";
  }

  function act(account, state, input, uploadedFile) {
    const command = input.action || input.form;
    if (command === "resolve-session-dispute")
      return chooseDispute(account, state, input);
    const room = state.rooms[input.activeRoomId];
    if (!isMentorRoom(room) || room.role !== state.role)
      fail("This mentorship room is unavailable for your role.", 404);
    if (genericActions.has(command) || genericForms.has(command))
      fail(
        "Use the mentorship room controls for goals, sessions and follow-up.",
        409,
      );
    const values = input.values || {};
    if (typeof values !== "object" || Array.isArray(values))
      fail("Invalid mentorship values.");
    const role = room.role;
    const format = roomFormat(room);
    const info = room.mentorship;
    const mentor = mentorAccount(account, state, room);
    const founder = founderAccount(account, state, room);
    const allowedAfter = [
      "submit-followup",
      "log-revision",
      "propose-upgrade",
      "accept-upgrade",
      "decline-upgrade",
      "rate-answer",
      "set-testimonial-public",
      "cycle-review",
      "cycle-decision",
      "simulate-cycle-review",
      "simulate-upgrade-acceptance",
      "simulate-upgrade-decline",
      "simulate-founder-rating",
      "simulate-revisions",
    ].includes(command);
    if (
      terminalStatuses.includes(room.status) &&
      (!allowedAfter ||
        (room.status === "cancelled" && command !== "submit-followup")) &&
      !(command === "review-form" && room.status === "launched")
    )
      fail("This mentorship room is read-only.", 409);
    const requireRole = (required) => {
      if (role !== required)
        fail("Only the " + required + " can do this.", 403);
    };
    const need = (condition, message, status = 400) => {
      if (!condition) fail(message, status);
    };
    let kind = "mentoring";
    // `message` becomes the counterpart's notification; `toast`, when set,
    // addresses the person who acted (Nov 22, round 2).
    let message = "";
    let toast = "";
    let tab = "overview";
    const counterpartName =
      (role === "founder" ? mentor : founder)?.state.accountName ||
      (role === "founder" ? "your mentor" : "the founder");
    // Prototype only: a step a fictional partner takes reaches the person
    // here as the partner's own update; the fictional account gets none.
    const partnerUpdate = (update, toastText, options) => {
      event({ state }, room.role, update, room.id, options);
      room.updatedAt = stamp();
      state.toast = toastText;
      mirror(account, state, room, "", options);
    };
    const fictionalMentor = (what) => {
      requireRole("founder");
      need(
        canSimulatePartner(account, room),
        `${what} can be simulated only with a fictional prototype mentor.`,
        403,
      );
    };
    const fictionalFounder = (what) => {
      requireRole("mentor");
      need(
        canSimulatePartner(account, room),
        `${what} can be simulated only with a fictional prototype founder.`,
        403,
      );
    };
    const sample = () => simulatedOutcome(founder?.id, room.terms?.draft?.goal);
    if (command === "confirm-goal") {
      requireRole("mentor");
      confirmGoal(room, text(values, "goal", 1000));
      message = "Mentorship goal confirmed.";
    } else if (command === "simulate-goal-confirmation") {
      // Prototype only: the fictional mentor confirms the goal the founder
      // already sent, through the same rule as a real confirmation.
      fictionalMentor("Goal confirmation");
      confirmGoal(room, "");
      const mentorName = mentor?.state.accountName || "The mentor";
      message = `${mentorName} confirmed the mentorship goal.`;
      partnerUpdate(message, message, { kind, tab });
      return;
    } else if (command === "simulate-delivery") {
      // Prototype only: the fictional mentor answers the Quick Ask or reviews
      // the document, through the same rule as a real delivery.
      fictionalMentor("An answer or review");
      need(
        format !== "doc-review" || room.milestones.uploaded?.me,
        "Share your document before simulating the review.",
        409,
      );
      const sample = simulatedOutcome(founder?.id, room.terms?.draft?.goal);
      message = deliver(
        room,
        format === "quick-ask" ? sample.answer : sample.docReview,
        room.partnerAccountId,
        true,
      );
      partnerUpdate(message, message, { kind: "answer-delivered", tab });
      return;
    } else if (command === "simulate-check-in-confirmation") {
      // Prototype only: the fictional mentor confirms the founder's proposed
      // check-in time, through the same rule as a real confirmation.
      fictionalMentor("Check-in confirmation");
      const cycle = room.cycle;
      need(
        format === "ongoing-advisory" &&
          cycle?.phase === "active" &&
          cycle.proposedTime &&
          (cycle.proposedTime.proposedBy || "founder") === "founder" &&
          !cycle.confirmedAt,
        "No check-in time is awaiting the mentor's confirmation.",
        409,
      );
      message = confirmCheckIns(room, mentor, founder);
      cycle.confirmedSimulated = true;
      partnerUpdate(message, "Check-in time confirmed.", {
        kind,
        tab: "schedule",
      });
      return;
    } else if (command === "simulate-cycle-review") {
      // Prototype only: once this person has reviewed the cycle, the
      // fictional partner reviews it too and agrees with Continue, through
      // the same rules as the partner's own review and decision.
      need(
        canSimulatePartner(account, room),
        "A cycle review can be simulated only with a fictional prototype partner.",
        403,
      );
      const cycle = room.cycle;
      const partnerRole = role === "founder" ? "mentor" : "founder";
      const mentorId = room.partnerAccountId;
      const reviewDue =
        cycle?.phase === "review" &&
        cycle.reviews[account.id] &&
        !cycle.reviews[mentorId] &&
        !cycle.reviewWindowClosed;
      const decisionDue =
        cycle?.phase === "review" &&
        cycle.decisions[account.id] === "continue" &&
        !cycle.decisions[mentorId];
      need(
        format === "ongoing-advisory" && (reviewDue || decisionDue),
        "Submit your own cycle review first.",
        409,
      );
      const said = [];
      if (reviewDue) {
        const review =
          sample()[partnerRole === "mentor" ? "mentorReview" : "founderReview"];
        const scores = Object.fromEntries(
          reviewCategories({ ...room, role: partnerRole }, now(), {
            cycle: true,
          }).map(({ id }) => [id, review.scores[id] || 4]),
        );
        saveCycleReview(room, mentorId, scores, review.note, true);
        said.push("submitted a private cycle review");
      }
      if (decisionDue) {
        message = decideCycle(room, mentorId, "continue", mentor);
        said.push("agreed to continue");
      }
      partnerUpdate(
        `Prototype: ${counterpartName} ${said.join(" and ")}. This is a simulated response from a fictional ${partnerRole}.`,
        message ||
          (room.status === "reviewed"
            ? "Both cycle reviews are in. The mentorship is reviewed."
            : `${counterpartName} submitted a cycle review.`),
        { kind, tab },
      );
      return;
    } else if (command === "simulate-founder-rating") {
      // Prototype only: the fictional founder marks the answer or review
      // helpful, through the same rule as the founder's own rating.
      fictionalFounder("A rating");
      message = rateAnswer(room, "helpful");
      info.answerRatingSimulated = true;
      partnerUpdate(message, `${counterpartName} marked it helpful.`, {
        kind,
        tab,
      });
      return;
    } else if (command === "simulate-doc-upload") {
      // Prototype only: the fictional founder shares the document to review.
      fictionalFounder("A document upload");
      need(
        format === "doc-review" && !room.milestones.uploaded?.me,
        "The document is already shared.",
        409,
      );
      message = shareDocument(room, {
        label: sample().document,
        file: null,
        at: stamp(),
        byAccountId: room.partnerAccountId,
        simulated: true,
      });
      partnerUpdate(message, `${counterpartName} shared the document.`, {
        kind,
        tab,
      });
      return;
    } else if (command === "simulate-revisions") {
      // Prototype only: the fictional founder logs what they revised.
      fictionalFounder("Revisions");
      need(!info.revisions, "Revisions are already logged.", 409);
      message = logRevisions(room, sample().revisions);
      info.revisions.simulated = true;
      partnerUpdate(message, `${counterpartName} logged their revisions.`, {
        kind,
        tab,
      });
      return;
    } else if (command === "simulate-check-in-proposal") {
      // Prototype only: the fictional founder proposes the first check-in,
      // three days ahead at 10:00 in the mentor's time zone.
      fictionalFounder("A check-in proposal");
      need(
        !room.cycle?.proposedTime,
        "A check-in time is already proposed.",
        409,
      );
      const timeZone = validTimeZone(mentor?.state.profiles.mentor.timeZone)
        ? mentor.state.profiles.mentor.timeZone
        : "UTC";
      need(room.cycle, "Confirm the advisory goal before proposing check-ins.");
      const session = makeSession(
        {
          date: new Date(now() + 3 * dayMs).toISOString().slice(0, 10),
          time: "10:00",
        },
        timeZone,
        room.cycle.checkInMinutes,
      );
      message = proposeCheckIn(room, session, "founder");
      room.cycle.proposedTime.simulated = true;
      partnerUpdate(message, `${counterpartName} proposed a check-in time.`, {
        kind: "check-in-time",
        tab: "schedule",
      });
      return;
    } else if (
      ["simulate-upgrade-acceptance", "simulate-upgrade-decline"].includes(
        command,
      )
    ) {
      // Prototype only: a fictional partner answers the upgrade this person
      // proposed, through the same rule as a real answer.
      need(
        canSimulatePartner(account, room),
        "An upgrade answer can be simulated only with a fictional prototype partner.",
        403,
      );
      const upgrade = info.upgrade;
      need(
        upgrade &&
          upgrade.proposedBy === role &&
          now() < Date.parse(upgrade.expiresAt),
        "No upgrade you proposed is awaiting an answer.",
        409,
      );
      const accepted = command === "simulate-upgrade-acceptance";
      const label = mentorFormat(upgrade.format).label;
      const reply = replyToUpgrade(room, accepted, mentor, role);
      if (accepted) info.upgradeSimulated = true;
      partnerUpdate(
        reply.message,
        accepted
          ? `${counterpartName} accepted the upgrade to ${label}.`
          : `${counterpartName} declined the upgrade to ${label}.`,
        { kind: reply.kind, tab },
      );
      return;
    } else if (command === "simulate-session-held") {
      // Prototype only: the next booked session or check-in with a fictional
      // partner takes place now, so either side can reach follow-up and
      // review without waiting for the session time, the attendance window
      // and the 14-day follow-up delay.
      need(
        canSimulatePartner(account, room),
        "A session can be simulated only with a fictional prototype partner.",
        403,
      );
      need(
        mentorFormat(format).sync,
        "Session simulation is available for formats with sessions.",
      );
      const session = mentorSessions(room).find(
        (entry) => !entry.cancelledAt && !entry.outcome,
      );
      need(session, "Schedule a session before simulating it.", 409);
      const at = stamp();
      session.attendance = {
        ...session.attendance,
        mentor: "held",
        founder: "held",
        at: { ...session.attendance?.at, mentor: at, founder: at },
      };
      // The booked time may still be ahead; the room says this was simulated.
      session.simulated = true;
      applyOutcome(account, state, room, session, "held");
      if (info.followup && !info.followup.submittedAt)
        info.followup.availableAt = at;
      // A fictional founder never submits a follow-up, which a Single Session
      // needs before it can finish, so the simulation shares one for them.
      if (role === "mentor" && info.followup && !info.followup.submittedAt) {
        const outcomes = Object.fromEntries(
          followupTasks(room, info.followup).map(({ id }) => [id, "done"]),
        );
        Object.assign(info.followup, {
          outcomes,
          summary: simulatedOutcome(founder?.id, room.terms?.draft?.goal)
            .followup,
          shareable: false,
          submittedAt: at,
          overdue: false,
        });
        setMentorMilestone(room, "followup");
      }
      const partnerName =
        (role === "founder" ? mentor : founder)?.state.accountName ||
        (role === "founder" ? "your mentor" : "the founder");
      const sessions = mentorSessions(room);
      const heldCount = sessions.filter(
        (entry) => entry.outcome === "held",
      ).length;
      const next =
        format === "ongoing-advisory"
          ? room.cycle?.phase === "review"
            ? "The cycle review is open."
            : `${heldCount} of ${sessions.length} check-ins held.`
          : format === "single-session" && role === "founder"
            ? "Follow-up and review are open."
            : role === "founder"
              ? "Your review is open."
              : info.followup
                ? `${partnerName} shared a simulated follow-up, and your review is open.`
                : "Your review is open.";
      message = `Prototype: your ${format === "ongoing-advisory" ? "check-in" : "session"} with ${partnerName} was marked as held. ${next}`;
      partnerUpdate(
        message,
        format === "ongoing-advisory"
          ? "Check-in marked as held."
          : "Session marked as held.",
        { kind, tab: "overview" },
      );
      return;
    } else if (command === "schedule") {
      need(
        format === "single-session",
        "Use the check-in proposal or the original Office Hours booking for this format.",
      );
      need(room.milestones.goal?.me, "Confirm the goal before scheduling.");
      need(
        !mentorSessions(room).some(
          (session) => !session.cancelledAt && !session.outcome,
        ),
        "Use Reschedule on the existing session.",
        409,
      );
      need(!room.milestones.held.me, "This session has already been held.");
      const schedule = makeSession(
        values,
        text(values, "timeZone") || input.timeZone,
        Number(values.durationMinutes || 60),
      );
      const usage = capacity(mentor.state);
      if (info.slotReleased && usage.activeMentees >= usage.capacity.maxMentees)
        fail("The mentor has no session slots open right now.", 409);
      checkSchedule(mentor, founder, [schedule]);
      (sessionMilestone(room).schedules ||= []).push(schedule);
      if (role === "founder") info.founderTimeZone = schedule.timeZone;
      info.slotReleased = false;
      message = "Session scheduled.";
      tab = "schedule";
    } else if (command === "report-attendance") {
      const { session } = referencedSession(room, input);
      const status = values.status;
      need(attendanceReports.includes(status), "Choose an attendance report.");
      const otherRole = role === "mentor" ? "founder" : "mentor";
      const admitted =
        session.attendance[otherRole] === "i-missed" &&
        session.outcome === `no-show-${otherRole}` &&
        now() <
          Date.parse(session.attendance.at[otherRole]) +
            config().attendanceAutoConfirmHours * hourMs;
      need(
        !session.cancelledAt &&
          (!session.outcome || admitted) &&
          scheduleInstant(session).getTime() <= now(),
        "Attendance reporting is closed or the session has not started.",
        409,
      );
      need(!session.attendance[role], "You already reported attendance.", 409);
      session.attendance[role] = status;
      session.attendance.at[role] = stamp();
      if (admitted) session.outcome = null;
      const outcome = resolveAttendance(
        session,
        now(),
        config().attendanceAutoConfirmHours,
      );
      if (outcome) applyOutcome(account, state, room, session, outcome);
      message = "Attendance report saved.";
      tab = "schedule";
    } else if (["reschedule-session", "cancel-session"].includes(command)) {
      const { session, index } = referencedSession(room, input);
      const replacingCheckIn =
        command === "reschedule-session" &&
        format === "ongoing-advisory" &&
        room.cycle?.phase === "active" &&
        (session.cancelledAt || session.outcome?.startsWith("no-show-"));
      need(
        replacingCheckIn ||
          (!session.cancelledAt &&
            !session.outcome &&
            scheduleInstant(session).getTime() > now()),
        "This session can no longer be changed.",
        409,
      );
      const reason = text(values, "reason", 280);
      if (command === "cancel-session") {
        need(reason, "Add a cancellation reason.");
        cancel(session, role, reason, Boolean(session.lateCancel));
        if (format !== "ongoing-advisory") info.slotReleased = true;
        kind = "cancelled";
        message = `The session was cancelled. ${reason}`;
      } else {
        const schedule = makeSession(
          values,
          text(values, "timeZone") || session.timeZone,
          session.durationMinutes,
        );
        if (
          room.cycle &&
          scheduleInstant(schedule).getTime() >= Date.parse(room.cycle.dueAt)
        )
          fail("Choose a date within the current advisory cycle.");
        checkSchedule(mentor, founder, [schedule], {
          roomId: room.id,
          scheduleId: replacingCheckIn ? undefined : session.id,
          ...(replacingCheckIn && { roomId: undefined }),
        });
        schedule.reschedules = {
          ...session.reschedules,
          [role]: (session.reschedules?.[role] || 0) + 1,
        };
        const late =
          schedule.reschedules[role] > config().freeReschedulesPerSide ||
          scheduleInstant(session).getTime() - now() <
            config().lateNoticeHours * hourMs;
        if (replacingCheckIn || late) {
          if (!replacingCheckIn) cancel(session, role, "Late reschedule", true);
          info.sessionHistory.push(session);
        } else {
          schedule.id = session.id || schedule.id;
        }
        sessionMilestone(room).schedules[index] = schedule;
        kind = "rescheduled";
        message = late
          ? "Session rescheduled. The change was recorded as a late cancellation."
          : "The session was rescheduled.";
      }
      tab = "schedule";
    } else if (command === "propose-check-in-time") {
      // The founder proposes the regular time. (Nov 22, round 2) The mentor
      // can suggest another time instead of confirming, and then the founder
      // confirms the mentor's time; whoever proposed last waits.
      need(
        role === "founder" || room.cycle?.proposedTime,
        "Wait for the founder to propose a check-in time first.",
        409,
      );
      need(
        format === "ongoing-advisory" &&
          room.cycle?.phase === "active" &&
          !room.cycle.confirmedAt &&
          room.milestones.goals.me,
        "Confirm the advisory goal before proposing check-ins.",
      );
      const session = makeSession(
        values,
        text(values, "timeZone") || input.timeZone,
        room.cycle.checkInMinutes,
      );
      kind = "check-in-time";
      message = proposeCheckIn(room, session, role);
      toast = `Check-in time sent to ${counterpartName}. You'll see it here once they confirm.`;
      tab = "schedule";
    } else if (command === "confirm-check-in-time") {
      const cycle = room.cycle;
      need(
        cycle?.phase === "active" && cycle.proposedTime && !cycle.confirmedAt,
        "No check-in time is awaiting confirmation.",
      );
      // The other participant confirms; a founder proposal waits for the
      // mentor and a mentor suggestion waits for the founder.
      requireRole(
        (cycle.proposedTime.proposedBy || "founder") === "founder"
          ? "mentor"
          : "founder",
      );
      message = confirmCheckIns(room, mentor, founder);
      tab = "schedule";
    } else if (command === "deliver-answer") {
      requireRole("mentor");
      message = deliver(room, text(values, "answer"), account.id);
      kind = "answer-delivered";
    } else if (command === "rate-answer") {
      requireRole("founder");
      message = rateAnswer(room, values.rating);
    } else if (command === "log-revision") {
      requireRole("founder");
      message = logRevisions(room, text(values, "summary"));
    } else if (command === "prep-checklist") {
      requireRole("founder");
      need(mentorFormat(format).sync, "Prep is used for scheduled sessions.");
      info.prep = {
        deck: text(values, "deck", 500),
        metrics: text(values, "metrics", 1000),
        links: text(values, "links", 1000),
        sharedAt: stamp(),
      };
      need(
        info.prep.deck ||
          info.prep.metrics ||
          info.prep.links ||
          info.prepFiles?.length,
        "Add your deck, metrics or links before sharing prep.",
      );
      message = "Session prep shared.";
    } else if (command === "evidence") {
      requireRole("founder");
      need(
        (input.id === "uploaded" && format === "doc-review") ||
          (input.id === "prep" && mentorFormat(format).sync),
        "Choose the document or session prep upload.",
      );
      const label = uploadedFile?.name || text(values, "attachment", 300);
      need(label, "Choose a file or enter a document link.");
      const evidence = {
        label,
        file: uploadedFile || null,
        at: stamp(),
        byAccountId: account.id,
      };
      if (input.id === "uploaded") shareDocument(room, evidence);
      else {
        (info.prepFiles ||= []).push(evidence);
        (info.prep ||= {}).sharedAt = stamp();
      }
      message = "Preparation material shared.";
    } else if (command === "session-note") {
      const noteText = text(values, "text");
      need(noteText, "Enter a session note.");
      const flags = safetyCheck(noteText, values.acknowledgeSafety);
      room.notes ||= [];
      const note = room.notes.find((entry) => entry.id === input.id);
      if (input.id) {
        need(
          note &&
            note.authorRole === role &&
            now() <= Date.parse(note.at) + 24 * hourMs,
          "Only the author can edit a note within 24 hours.",
          403,
        );
        note.text = noteText;
        note.safetyFlags = flags;
        recordSafety(account, role, flags, `note:${note.id}`, room.id);
        note.updatedAt = stamp();
      } else {
        const sessions = mentorSessions(room);
        const sessionIndex =
          values.sessionIndex === "" || values.sessionIndex == null
            ? null
            : Number(values.sessionIndex);
        const session = values.sessionId
          ? noteSessions(room).find(({ id }) => id === values.sessionId)
          : sessions[sessionIndex];
        need(
          session || (!values.sessionId && sessionIndex === null),
          "Choose a valid session.",
        );
        const id = randomUUID();
        room.notes.push({
          id,
          safetyFlags: flags,
          authorRole: role,
          text: noteText,
          at: stamp(),
          sessionIndex:
            session && sessions.includes(session)
              ? sessions.indexOf(session)
              : null,
          ...(session && { sessionId: session.id }),
        });
        recordSafety(account, role, flags, `note:${id}`, room.id);
      }
      message = "Session note saved.";
    } else if (command === "submit-followup") {
      requireRole("founder");
      const engagement = followupEngagement(room);
      const followup = engagement?.followup;
      need(
        followup &&
          !followup.submittedAt &&
          now() >= Date.parse(followup.availableAt),
        "Follow-up is not ready or was already submitted.",
      );
      const tasks = followupTasks(room, followup);
      const outcomes = Object.fromEntries(
        tasks.map(({ id }) => [id, values[id]]),
      );
      need(
        Object.values(outcomes).every((status) =>
          ["done", "in-progress", "did-not-do"].includes(status),
        ),
        "Select an outcome for every action item.",
      );
      Object.assign(followup, {
        outcomes,
        summary: text(values, "summary", 280),
        shareable: values.shareable === true || values.shareable === "on",
        submittedAt: stamp(),
        overdue: false,
      });
      if (engagement === info) {
        setMentorMilestone(room, "followup");
        if (room.status !== "cancelled") finalize(room);
      } else if (engagement.milestones?.followup) {
        engagement.milestones.followup.me = true;
        engagement.milestones.followup.partner = true;
      }
      kind = "followup-update";
      message = "The founder shared their mentorship follow-up.";
      toast =
        info.reviewOpenedAt && !room.review.me && !room.review.windowClosed
          ? `Follow-up shared with ${counterpartName}. Write your private review next.`
          : `Follow-up shared with ${counterpartName}.`;
    } else if (
      ["propose-upgrade", "accept-upgrade", "decline-upgrade"].includes(command)
    ) {
      if (command === "propose-upgrade") {
        need(
          !info.upgrade &&
            (info.deliveredAt || room.milestones.held?.me) &&
            canUpgrade(format, values.format),
          "Choose an available next format after the current work is delivered.",
        );
        info.upgrade = {
          format: values.format,
          proposedBy: role,
          expiresAt: new Date(
            now() + config().upgradeProposalDays * dayMs,
          ).toISOString(),
        };
        kind = "upgrade-proposed";
        message = `An upgrade to ${mentorFormat(values.format).label} was proposed.`;
        toast = `Upgrade to ${mentorFormat(values.format).label} sent to ${counterpartName}.`;
      } else {
        const upgrade = info.upgrade;
        need(
          upgrade &&
            upgrade.proposedBy !== role &&
            now() < Date.parse(upgrade.expiresAt),
          "This proposal is no longer awaiting your reply.",
          409,
        );
        ({ kind, message } = replyToUpgrade(
          room,
          command === "accept-upgrade",
          mentor,
          role,
        ));
        delete info.upgrade;
      }
    } else if (["end-mentorship", "close-room"].includes(command)) {
      const reason = text(values, "reason", 300);
      need(reason, "Add a short reason for ending the mentorship.");
      end(room, role, reason);
      kind = "engagement-ended";
      message = `The mentorship ended. ${reason}`;
    } else if (command === "review-form") {
      need(
        info.reviewOpenedAt &&
          !room.review.windowClosed &&
          !room.review.me &&
          now() < Date.parse(info.reviewClosesAt),
        "A private review is not open.",
        409,
      );
      const categories = reviewCategories(room, now()).map(({ id }) => id);
      const scores = Object.fromEntries(
        categories.map((key) => [key, Number(values[key] || values.rating)]),
      );
      need(
        Object.values(scores).every(
          (score) => Number.isInteger(score) && score >= 1 && score <= 5,
        ),
        "Rate every question from 1 to 5.",
      );
      Object.assign(room.review, {
        me: true,
        scores,
        rating:
          Object.values(scores).reduce((sum, score) => sum + score, 0) /
          categories.length,
        note: text(values, "note"),
        submittedAt: stamp(),
        testimonial: role === "founder" ? text(values, "testimonial", 500) : "",
        testimonialPublic:
          role === "founder" &&
          (values.testimonialPublic === "on" ||
            values.testimonialPublic === true),
      });
      // Prototype only: a fictional partner reviews back, as fictional
      // exchange partners already do, so blind reviews can be released.
      if (!room.review.partner && canSimulatePartner(account, room)) {
        const partnerRole = role === "founder" ? "mentor" : "founder";
        const outcome = simulatedOutcome(founder?.id, room.terms?.draft?.goal);
        const sample =
          partnerRole === "founder"
            ? outcome.founderReview
            : outcome.mentorReview;
        const partnerScores = Object.fromEntries(
          reviewCategories({ ...room, role: partnerRole }, now()).map(
            ({ id }) => [id, sample.scores[id] || 4],
          ),
        );
        const scoreList = Object.values(partnerScores);
        Object.assign(room.review, {
          partner: true,
          partnerScores,
          partnerRating:
            Math.round(
              (scoreList.reduce((sum, score) => sum + score, 0) /
                scoreList.length) *
                10,
            ) / 10,
          partnerNote: sample.note,
          partnerSubmittedAt: stamp(),
        });
        const partnerName =
          (role === "founder" ? mentor : founder)?.state.accountName ||
          (role === "founder" ? "Your mentor" : "The founder");
        event(
          { state },
          room.role,
          `Prototype: ${partnerName} submitted a review. This is a simulated response from a fictional ${partnerRole}.`,
          room.id,
          { kind: "review-release", review: true },
        );
      }
      finalize(room);
      kind = "review-release";
      message = room.review.partner
        ? "Both mentorship reviews are available."
        : "Private review saved.";
    } else if (command === "set-testimonial-public") {
      requireRole("mentor");
      need(
        room.review.partner &&
          (room.review.me || room.review.windowClosed) &&
          room.review.partnerTestimonial &&
          room.review.partnerTestimonialPublic,
        "A testimonial is not available for sharing.",
      );
      room.review.testimonialAccepted =
        values.public === true || values.public === "on";
      message = room.review.testimonialAccepted
        ? "Testimonial sharing enabled."
        : "Testimonial sharing turned off.";
    } else if (command === "cycle-details") {
      need(
        format === "ongoing-advisory" && room.cycle?.phase === "review",
        "A cycle review is not ready.",
      );
      const summary = text(values, "summary");
      need(summary, "Add a brief cycle summary.");
      room.cycle.summary = summary;
      setMentorMilestone(room, "progress");
      message = "Cycle summary saved.";
    } else if (command === "cycle-review") {
      const cycle = room.cycle;
      need(
        cycle?.phase === "review" &&
          !cycle.reviewWindowClosed &&
          !cycle.reviews[account.id],
        "Your cycle review is not open.",
      );
      const keys = reviewCategories(room, now(), { cycle: true }).map(
        ({ id }) => id,
      );
      const scores = Object.fromEntries(
        keys.map((key) => [key, Number(values[key] || values.rating)]),
      );
      need(
        Object.values(scores).every((rating) =>
          [1, 2, 3, 4, 5].includes(rating),
        ),
        "Rate every category from 1 to 5.",
      );
      saveCycleReview(room, account.id, scores, text(values, "note"));
      message = "Private cycle review saved.";
    } else if (command === "cycle-decision") {
      const cycle = room.cycle;
      need(
        cycle?.phase === "review" &&
          (cycle.reviews[account.id] || cycle.reviewWindowClosed) &&
          ["continue", "finish"].includes(values.decision),
        "Complete your cycle review and choose Continue or Finish.",
      );
      message = decideCycle(room, account.id, values.decision, mentor);
    } else fail("This mentorship action is unavailable.");
    room.updatedAt = stamp();
    state.toast = toast || message;
    mirror(
      account,
      state,
      room,
      command === "review-form" && !room.review.partner ? "" : message,
      { kind, tab },
    );
  }

  const handles = (input, account) => {
    if (mentorshipActions.has(input.action) || mentorshipForms.has(input.form))
      return true;
    const room = account.state.rooms[input.activeRoomId];
    if (!isMentorRoom(room)) return false;
    return (
      genericActions.has(input.action) ||
      genericForms.has(input.form) ||
      ["close-room", "cycle-decision"].includes(input.action) ||
      [
        "schedule",
        "evidence",
        "review-form",
        "cycle-details",
        "cycle-review",
      ].includes(input.form)
    );
  };
  return { act, handles, sweep, end, makeSession, checkSchedule };
}
