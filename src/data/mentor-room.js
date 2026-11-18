import { mentorFormat, normalizeMentorFormat } from "./mentor-formats.js";
import { scheduleInstant } from "./selectors.js";

export const hourMs = 3600000;
export const dayMs = 24 * hourMs;
export const attendanceReports = ["held", "partner-absent", "i-missed"];
export const resolvedOutcomes = [
  "held",
  "no-show-mentor",
  "no-show-founder",
  "no-show-both",
];
export const isMentorRoom = (room) =>
  room?.type === "mentorship" && Boolean(room.mentorship);
export const roomFormat = (room) =>
  normalizeMentorFormat(room.terms.draft.format) || "single-session";
export const sessionMilestone = (room) =>
  room.milestones[
    roomFormat(room) === "ongoing-advisory" ? "checkins" : "held"
  ];
export const mentorSessions = (room) => sessionMilestone(room)?.schedules || [];
export function followupEngagement(room) {
  if (room.mentorship?.followup) return room.mentorship;
  return room.mentorship?.history?.findLast((entry) => entry.followup);
}

export function followupTasks(room, followup) {
  return (room.tasks || []).filter(
    (task) =>
      task.kind === "action" &&
      (!followup.actionItemIds || followup.actionItemIds.includes(task.id)),
  );
}

export const noteSessions = (room) => [
  ...(room.mentorship.sessionHistory || []),
  ...mentorSessions(room),
];

export function attendanceOpen(session, role, now = Date.now(), hours = 72) {
  const other = role === "mentor" ? "founder" : "mentor";
  const admitted =
    session.attendance?.[other] === "i-missed" &&
    session.outcome === `no-show-${other}` &&
    now < Date.parse(session.attendance.at?.[other]) + hours * hourMs;
  return (
    !session.cancelledAt &&
    (!session.outcome || admitted) &&
    !session.attendance?.[role] &&
    scheduleInstant(session).getTime() <= now
  );
}

export const goalMilestone = (room) =>
  roomFormat(room) === "ongoing-advisory" ? "goals" : "goal";
export const deliveredMilestone = (room) =>
  roomFormat(room) === "quick-ask" ? "answer" : "review";

export function setMentorMilestone(room, id, complete = true) {
  const milestone = room.milestones[id];
  if (milestone) milestone.me = milestone.partner = complete;
}

export function appointment(values) {
  return {
    ...values,
    startsAt: scheduleInstant(values).toISOString(),
    attendance: {
      mentor: null,
      founder: null,
      at: { mentor: null, founder: null },
    },
    outcome: null,
    reschedules: { mentor: 0, founder: 0 },
    cancelledAt: null,
    cancelledBy: null,
    lateCancel: false,
  };
}

export function resolveAttendance(
  schedule,
  now = Date.now(),
  autoConfirmHours = 72,
) {
  if (schedule.outcome || schedule.cancelledAt) return schedule.outcome || null;
  const starts = scheduleInstant(schedule).getTime();
  if (!Number.isFinite(starts) || now < starts) return null;
  const window = autoConfirmHours * hourMs;
  const { attendance = {}, durationMinutes = 60 } = schedule;
  const { mentor, founder } = attendance;
  const report = (role, status) =>
    status === "partner-absent"
      ? role === "mentor"
        ? "founder"
        : "mentor"
      : status === "i-missed"
        ? role
        : status;
  if (mentor && founder) {
    if (mentor === "i-missed" && founder === "i-missed") return "no-show-both";
    const a = report("mentor", mentor);
    const b = report("founder", founder);
    return a === b ? (a === "held" ? a : `no-show-${a}`) : "disputed";
  }
  if (mentor === "i-missed" || founder === "i-missed")
    return mentor ? "no-show-mentor" : "no-show-founder";
  if (mentor === "partner-absent" || founder === "partner-absent") {
    const reportedAt = Date.parse(
      attendance.at?.[mentor ? "mentor" : "founder"],
    );
    return now >= reportedAt + window
      ? mentor
        ? "no-show-founder"
        : "no-show-mentor"
      : null;
  }
  return now >= starts + durationMinutes * 60000 + window ? "held" : null;
}

export function mentorTemplate(format) {
  const definition = mentorFormat(format);
  return {
    id: "mentorship",
    version: 4,
    name: definition.label,
    format,
    fields: [],
  };
}

export function milestoneSet(format) {
  return Object.fromEntries(
    mentorFormat(format).milestones.map(({ id, title, confirm }) => [
      id,
      {
        title,
        description: "",
        evidence: confirm && ["answer", "review"].includes(id),
        me: false,
        partner: false,
        contentVersion: 0,
      },
    ]),
  );
}

export function initMentorship(room, format, goal, now = Date.now()) {
  room.mentorship = {
    acceptedAt: new Date(now).toISOString(),
    history: [],
    sessionHistory: [],
  };
  room.terms = {
    draft: { ...room.terms.draft, goal, format, price: 0, compensation: "" },
    locked: true,
    partnerLocked: true,
    confirmedByMe: true,
  };
  room.template = mentorTemplate(format);
  room.milestones = milestoneSet(format);
  room.status = "in-progress";
  setMentorMilestone(room, "question");
  return room;
}

export function migrateMentorship(room, now = Date.now()) {
  if (room.type !== "mentorship" || isMentorRoom(room)) return false;
  const old = room.milestones;
  const originalTerms = room.terms;
  const status = room.status;
  const format = roomFormat(room);
  initMentorship(
    room,
    format,
    originalTerms.draft.goal || "",
    Date.parse(room.createdAt) || now,
  );
  room.mentorship.migrated = true;
  room.mentorship.history.push({ format, templateVersion: 3, milestones: old });
  if (["launched", "reviewed", "cancelled"].includes(status))
    room.status = status;
  const oldEntries = Object.values(old || {});
  for (const [index, item] of Object.values(room.milestones).entries()) {
    const prior = oldEntries[index];
    if (!prior) continue;
    const { me, partner, evidenceItems, attachment } = prior;
    Object.assign(item, { me, partner, evidenceItems, attachment });
  }
  const schedules =
    old.session?.schedules ||
    (old.session?.schedule ? [old.session.schedule] : []);
  if (sessionMilestone(room) && schedules.length) {
    sessionMilestone(room).schedules = schedules
      .filter((entry) =>
        Number.isFinite(
          scheduleInstant({
            ...entry,
            timeZone: entry.timeZone || "Asia/Manila",
          }).getTime(),
        ),
      )
      .map((entry) => {
        const schedule = appointment({
          ...entry,
          id: entry.id || `legacy-${entry.date}-${entry.time}`,
          durationMinutes: Number(entry.durationMinutes) || 60,
          timeZone: entry.timeZone || "Asia/Manila",
        });
        if (
          old.session?.me &&
          old.session?.partner &&
          old.guidance?.me &&
          old.guidance?.partner
        )
          schedule.outcome = "held";
        return schedule;
      });
  }
  return true;
}

export function mentorshipStage(room) {
  const format = roomFormat(room);
  const complete = (id) =>
    room.milestones[id]?.me && room.milestones[id]?.partner;
  const held = mentorSessions(room).filter(
    (session) => session.outcome === "held",
  ).length;
  const checkIns = room.cycle?.checkIns || mentorSessions(room).length;
  const checkInLabel = checkIns
    ? `Check-ins (${held} of ${checkIns})`
    : "Check-ins";
  const stages = {
    "quick-ask": ["Requested", "Accepted", "Delivered", "Reviewed"],
    "doc-review": ["Requested", "Accepted", "Delivered", "Reviewed"],
    "single-session": [
      "Requested",
      "Accepted",
      "Goal Confirmed",
      "Session Held",
      "Follow-up",
      "Reviewed",
    ],
    "office-hours": ["Booked", "Session Held", "Reviewed"],
    "ongoing-advisory": [
      "Requested",
      "Accepted",
      "Goals Defined",
      checkInLabel,
      "Progress Reviewed",
      "Reviewed",
    ],
  }[format];
  let index = 1;
  if (format === "office-hours") index = complete("held") ? 1 : 0;
  else if (format === "single-session")
    index = complete("followup")
      ? 4
      : complete("held")
        ? 3
        : complete("goal")
          ? 2
          : 1;
  else if (format === "ongoing-advisory")
    index = complete("progress")
      ? 4
      : room.cycle?.confirmedAt
        ? 3
        : complete("goals")
          ? 2
          : 1;
  else if (complete(deliveredMilestone(room))) index = 2;
  if (room.status === "reviewed") index = stages.length - 1;
  if (room.payment?.status === "due" && !room.payment.upgrade) {
    stages.splice(2, 0, "Awaiting payment");
    index = 2;
  }
  return {
    stages,
    index,
    label: room.status === "cancelled" ? "Closed" : stages[index],
  };
}

// These are the administrative steps required from a mentor per format.
export function requiredMentorActions(format) {
  return {
    "quick-ask": ["rate"],
    "doc-review": ["rate"],
    "single-session": ["confirm-goal", "report-attendance", "rate"],
    "office-hours": ["report-attendance", "rate"],
    "ongoing-advisory": [
      "confirm-goal",
      "confirm-check-in-time",
      "report-attendance",
      "rate",
    ],
  }[format];
}

export function mentorshipNextAction(room) {
  const followup = followupEngagement(room)?.followup;
  if (
    followup?.availableAt &&
    !followup.submittedAt &&
    Date.parse(followup.availableAt) <= Date.now() &&
    room.role === "founder"
  )
    return {
      mine: true,
      text: "Share your follow-up",
      action: "Add follow-up",
      tab: "overview",
    };
  if (room.status === "cancelled")
    return { done: true, text: "This mentorship is closed.", tab: "overview" };
  if (room.status === "reviewed")
    return {
      done: true,
      text: "Mentorship reviewed",
      tab: "overview",
      review: true,
    };
  if (
    room.mentorship.reviewOpenedAt &&
    !room.review.me &&
    !room.review.windowClosed
  )
    return {
      mine: true,
      text: "Write your private review",
      action: "Write review",
      tab: "overview",
      review: true,
    };
  if (room.cycle?.phase === "review")
    return {
      mine: true,
      text: `Review mentorship cycle ${room.cycle.number}`,
      tab: "overview",
    };
  if (
    mentorSessions(room).some(
      (session) =>
        !session.cancelledAt &&
        !session.outcome &&
        scheduleInstant(session) <= new Date() &&
        !session.attendance?.[room.role],
    )
  )
    return {
      mine: true,
      text: "Report session attendance",
      action: "Report attendance",
      tab: "schedule",
    };
  const format = mentorFormat(roomFormat(room));
  const needsGoal =
    room.milestones[goalMilestone(room)] &&
    !room.milestones[goalMilestone(room)].me;
  if (needsGoal)
    return {
      mine: room.role === "mentor",
      text:
        room.role === "mentor"
          ? "Confirm the goal"
          : "Waiting for the mentor to confirm the goal",
      tab: "overview",
    };
  if (!format.sync && !room.mentorship.deliveredAt) {
    const response = format.id === "quick-ask" ? "answer" : "review";
    return {
      mine: room.role === "mentor",
      text:
        room.role === "mentor"
          ? `Deliver your ${response}`
          : `Waiting for the mentor's ${response}`,
      tab: "overview",
    };
  }
  if (
    format.sync &&
    !mentorSessions(room).some(
      (session) =>
        !session.cancelledAt &&
        (!session.outcome || session.outcome === "held"),
    )
  )
    return {
      mine: room.role === "founder",
      text: "Arrange a session",
      tab: "schedule",
    };
  return { mine: false, text: "Nothing needed from you", tab: "overview" };
}
