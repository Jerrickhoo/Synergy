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
  roomFormat,
  sessionMilestone,
  setMentorMilestone,
} from "../src/data/mentor-room.js";

export const mentorshipActions = new Set([
  "confirm-goal",
  "simulate-goal-confirmation",
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
    let message = "";
    let tab = "overview";
    if (command === "confirm-goal") {
      requireRole("mentor");
      confirmGoal(room, text(values, "goal", 1000));
      message = "Mentorship goal confirmed.";
    } else if (command === "simulate-goal-confirmation") {
      // Prototype only: the fictional mentor confirms the goal the founder
      // already sent, through the same rule as a real confirmation.
      requireRole("founder");
      need(
        canSimulatePartner(account, room),
        "Goal confirmation can be simulated only with a fictional prototype mentor.",
        403,
      );
      confirmGoal(room, "");
      const mentorName = mentor?.state.accountName || "The mentor";
      message = `${mentorName} confirmed the mentorship goal.`;
      // The founder sees this as the mentor's update; the fixture gets none.
      event({ state }, room.role, message, room.id, { kind, tab });
      room.updatedAt = stamp();
      state.toast = message;
      mirror(account, state, room, "", { kind, tab });
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
        fail("The mentor has no mentee slots left for a new session.", 409);
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
      requireRole("founder");
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
      info.founderTimeZone = session.timeZone;
      room.cycle.proposedTime = {
        date: session.date,
        time: session.time,
        timeZone: session.timeZone,
      };
      kind = "check-in-time";
      message = "A regular advisory check-in time was proposed.";
      tab = "schedule";
    } else if (command === "confirm-check-in-time") {
      requireRole("mentor");
      const cycle = room.cycle;
      need(
        cycle?.phase === "active" && cycle.proposedTime && !cycle.confirmedAt,
        "No check-in time is awaiting confirmation.",
      );
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
      need(
        proposed.every(
          (session) =>
            scheduleInstant(session).getTime() < Date.parse(cycle.dueAt),
        ),
        "The proposed check-ins do not fit before the cycle ends. Propose an earlier start.",
      );
      checkSchedule(mentor, founder, proposed, { reservationRoomId: room.id });
      sessionMilestone(room).schedules = proposed;
      cycle.confirmedAt = stamp();
      message = "Advisory check-ins confirmed.";
      tab = "schedule";
    } else if (command === "deliver-answer") {
      requireRole("mentor");
      need(
        !mentorFormat(format).sync &&
          !info.deliveredAt &&
          !info.answerExpiredAt,
        "An answer or review is no longer needed.",
      );
      const answer = text(values, "answer");
      need(answer, "Write your answer or review.");
      const item = room.milestones[deliveredMilestone(room)];
      item.attachment = answer;
      (item.evidenceItems ||= []).push({
        label: answer,
        at: stamp(),
        byAccountId: account.id,
      });
      info.answer = answer;
      info.deliveredAt = stamp();
      setMentorMilestone(room, deliveredMilestone(room));
      startReview(room);
      kind = "answer-delivered";
      message =
        format === "quick-ask"
          ? "The mentor answered the Quick Ask."
          : "The mentor delivered the document review.";
    } else if (command === "rate-answer") {
      requireRole("founder");
      need(
        !mentorFormat(format).sync &&
          info.deliveredAt &&
          !info.answerRating &&
          ["helpful", "not-helpful"].includes(values.rating),
        "Choose Helpful or Not helpful after delivery.",
      );
      info.answerRating = values.rating;
      info.answerRatedAt = stamp();
      setMentorMilestone(room, "helpful");
      message = "Answer feedback saved.";
    } else if (command === "log-revision") {
      requireRole("founder");
      need(
        format === "doc-review" &&
          info.deliveredAt &&
          now() <=
            Date.parse(info.deliveredAt) + config().revisionWindowDays * dayMs,
        "The revision window has closed.",
      );
      const summary = text(values, "summary");
      need(summary, "Describe what you revised.");
      info.revisions = { summary, at: stamp() };
      setMentorMilestone(room, "revisions");
      message = "Document revisions logged.";
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
      if (input.id === "uploaded") {
        const item = room.milestones.uploaded;
        (item.evidenceItems ||= []).push(evidence);
        item.attachment = label;
        setMentorMilestone(room, "uploaded");
      } else {
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
      } else {
        const upgrade = info.upgrade;
        need(
          upgrade &&
            upgrade.proposedBy !== role &&
            now() < Date.parse(upgrade.expiresAt),
          "This proposal is no longer awaiting your reply.",
          409,
        );
        if (command === "accept-upgrade") {
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
            info.followup.actionItemIds = followupTasks(
              room,
              info.followup,
            ).map(({ id }) => id);
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
            "answerRating",
            "revisions",
          ])
            delete info[key];
          info.acceptedAt = stamp();
          if (upgrade.format === "ongoing-advisory")
            ensureCycle(room, now(), config());
          delete room.completedAt;
          kind = "upgrade-accepted";
          message = "Mentorship upgrade accepted.";
        } else {
          kind = "upgrade-declined";
          message = "Mentorship upgrade declined.";
        }
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
      const categories =
        role === "founder"
          ? [
              "usefulness",
              "clarity",
              "responsiveness",
              ...(room.payment?.amount ? ["valueForMoney"] : []),
            ]
          : ["preparedness", "followThrough"];
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
      const keys =
        role === "founder"
          ? [
              "usefulness",
              "clarity",
              "responsiveness",
              ...(room.payment?.amount ? ["valueForMoney"] : []),
            ]
          : ["preparedness", "followThrough"];
      const scores = Object.fromEntries(
        keys.map((key) => [key, Number(values[key] || values.rating)]),
      );
      need(
        Object.values(scores).every((rating) =>
          [1, 2, 3, 4, 5].includes(rating),
        ),
        "Rate every category from 1 to 5.",
      );
      cycle.reviews[account.id] = {
        scores,
        rating:
          Object.values(scores).reduce((sum, rating) => sum + rating, 0) /
          keys.length,
        note: text(values, "note"),
        at: stamp(),
      };
      setMentorMilestone(room, "progress");
      if (room.mentorship.endedAt && Object.keys(cycle.reviews).length === 2) {
        room.status = "reviewed";
        room.completedAt = stamp();
      }
      message = "Private cycle review saved.";
    } else if (command === "cycle-decision") {
      const cycle = room.cycle;
      need(
        cycle?.phase === "review" &&
          (cycle.reviews[account.id] || cycle.reviewWindowClosed) &&
          ["continue", "finish"].includes(values.decision),
        "Complete your cycle review and choose Continue or Finish.",
      );
      cycle.decisions[account.id] = values.decision;
      if (values.decision === "finish") {
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
        message = "The advisory cycle ended.";
      } else if (
        Object.values(cycle.decisions).filter(
          (decision) => decision === "continue",
        ).length === 2
      ) {
        need(!info.endedAt, "This advisory has ended.", 409);
        need(
          mentorMinutesFit(
            mentor.state,
            cyclePlan(now(), config()),
            config(),
            officeAllocation?.(mentor.state, now(), config()).months ||
              mentorCommitments(mentor.state, now(), config()),
          ),
          "The next cycle exceeds the mentor's monthly hours.",
          409,
        );
        (room.cycleHistory ||= []).push({
          ...cycle,
          milestones: room.milestones,
        });
        preserveSessions(room);
        room.milestones = milestoneSet(format);
        const number = cycle.number + 1;
        delete room.cycle;
        ensureCycle(room, now(), config()).number = number;
        message = `Advisory cycle ${number} started.`;
      } else message = "Cycle decision saved.";
    } else fail("This mentorship action is unavailable.");
    room.updatedAt = stamp();
    state.toast = message;
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
