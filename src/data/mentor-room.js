import { mentorFormat, normalizeMentorFormat } from "./mentor-formats.js";
import { scheduleInstant, scheduleLabel } from "./selectors.js";
import { moneyLabel } from "./pricing.js";
import { formatDate, formatDateTime } from "./dates.js";

// (Nov 22, round 2) While a payment is due, paying is the founder's next
// step, before and after a failed attempt; the mentor waits for it.
export function paymentNextAction(room, now = Date.now()) {
  const payment = room?.payment;
  if (
    !payment ||
    payment.status !== "due" ||
    payment.upgrade ||
    !(Date.parse(payment.dueBy) > now)
  )
    return null;
  const due = formatDateTime(payment.dueBy);
  if (room.role !== "founder")
    return {
      mine: false,
      text: `Waiting for the founder's payment (due ${due})`,
      tab: "overview",
    };
  const format = mentorFormat(payment.format || roomFormat(room));
  const what = payment.cycleNumber
    ? `advisory cycle ${payment.cycleNumber}`
    : format?.id === "ongoing-advisory"
      ? "advisory cycle"
      : format?.sync === false
        ? format.label.toLowerCase()
        : "session";
  return {
    mine: true,
    text: `${payment.failedAt ? "Payment didn't go through. " : ""}Pay ${moneyLabel(payment.amount)} by ${due} to confirm your ${what}`,
    action: payment.failedAt ? "Retry payment" : "Pay now",
    pay: payment.providerRef,
    tab: "overview",
  };
}

// (Nov 22, round 3) The server refuses room commands until a due payment is
// held, so the room offers none of them meanwhile: paying is the founder's one
// primary action, and preparation and goal confirmation wait.
export const awaitingPayment = (room) =>
  room?.payment?.status === "due" && !room.payment.upgrade;

// (Nov 22, round 3) Confirming advisory check-ins names every date, so both
// people can spot a holiday or conflict and move that one check-in. There is
// no holiday calendar; the list is the safeguard.
export function checkInsConfirmedText(sessions, now = Date.now()) {
  const dates = sessions.map((session) => formatDate(session.date, { now }));
  return `Advisory check-ins confirmed. Check-ins: ${dates.join(", ")}. Reschedule any date from Schedule.`;
}

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

// Progress marks, read the same way as a Deal Room's: the last stage reached
// is current and the ones before it are done. Stage names are past tense
// ("Goal Confirmed"), so a stage still ahead is never highlighted. The one
// exception is "Awaiting payment", which names the wait itself. A finished or
// closed room marks every stage it reached as done and has no current step.
export function stageMarks(room) {
  const { stages, index } = mentorshipStage(room);
  const finished = ["reviewed", "cancelled"].includes(room.status);
  const at = stages[index + 1] === "Awaiting payment" ? index + 1 : index;
  return stages.map((label, position) => ({
    label,
    done: finished ? position <= index : position < at,
    current: !finished && position === at,
  }));
}

// `index` is the last stage reached; the next one (if any) is current.
// `label` names where the mentorship stands for lists.
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
    // Payment is a step still ahead: Accepted is the last one reached.
    stages.splice(2, 0, "Awaiting payment");
    return {
      stages,
      index: 1,
      label: room.status === "cancelled" ? "Closed" : "Awaiting payment",
    };
  }
  return {
    stages,
    index,
    label: room.status === "cancelled" ? "Closed" : stages[index],
  };
}

// (Nov 22, round 2) A mentorship room's card line names its stage and the
// next session, e.g. "Goal confirmed · session Thu, Nov 26", instead of the
// exchange "25% of milestones confirmed".
// The current stage in sentence case ("Goal confirmed"), wherever it is
// read as text rather than as a step of the room's stage list.
export function mentorshipStageText(room) {
  const { label } = mentorshipStage(room);
  return label.charAt(0) + label.slice(1).toLowerCase();
}

export function mentorshipCardSummary(room, now = Date.now()) {
  const { stages, index } = mentorshipStage(room);
  const stage = mentorshipStageText(room);
  const upcoming = mentorSessions(room)
    .filter(
      (session) =>
        !session.cancelledAt &&
        !session.outcome &&
        scheduleInstant(session).getTime() > now,
    )
    .sort((a, b) => scheduleInstant(a) - scheduleInstant(b))[0];
  const kind = roomFormat(room) === "ongoing-advisory" ? "check-in" : "session";
  return {
    text:
      upcoming && room.status !== "cancelled"
        ? `${stage} · ${kind} ${formatDate(scheduleInstant(upcoming), { weekday: true, now })}`
        : stage,
    progress: Math.round(((index + 1) / stages.length) * 100),
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

// The 1–5 questions each side answers in a private review, with short
// anchors for the ends of the scale. A mentor rates the founder's follow-
// through only once there is something to judge: a Single Session follow-up
// that is due or submitted, or the end of an advisory cycle.
const reviewQuestions = {
  usefulness: ["Usefulness", "Not useful", "Changed what I'll do next"],
  clarity: ["Clarity", "Hard to follow", "Very clear"],
  responsiveness: ["Responsiveness", "Slow or missed", "Quick and reliable"],
  valueForMoney: ["Value for money", "Not worth it", "Well worth it"],
  preparedness: [
    "Preparedness",
    "Came without context",
    "Shared context and materials ahead",
  ],
  followThrough: [
    "Follow-through",
    "Did none of the actions",
    "Did every action",
  ],
};
export const reviewQuestionLabel = (id) => reviewQuestions[id]?.[0] || id;
export function reviewCategories(
  room,
  now = Date.now(),
  { cycle = false } = {},
) {
  const role = room.role;
  let ids;
  if (role === "founder")
    ids = [
      "usefulness",
      "clarity",
      "responsiveness",
      ...(room.payment?.amount ? ["valueForMoney"] : []),
    ];
  else {
    const followup = followupEngagement(room)?.followup;
    const due =
      cycle ||
      Boolean(
        followup &&
        (followup.submittedAt || Date.parse(followup.availableAt || "") <= now),
      );
    ids = ["preparedness", ...(due ? ["followThrough"] : [])];
  }
  return ids.map((id) => {
    const [label, low, high] = reviewQuestions[id];
    return { id, label, low, high };
  });
}

// Why a mentorship room closed, in the reader's terms. Both sides of a lapsed
// checkout see a closed room; only the founder is told how to ask again.
export function closedRoomText(room) {
  if (room?.status !== "cancelled") return "";
  if (room.closeReason === "payment-lapsed")
    return room.role === "founder"
      ? "Checkout expired. This request is closed."
      : "The founder's checkout expired, so this mentorship closed. The time it reserved is free again.";
  return room.closeReason || "This mentorship is closed.";
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
      action: "Go to follow-up",
      tab: "overview",
      target: "room-followup",
    };
  if (room.status === "cancelled")
    return { done: true, text: closedRoomText(room), tab: "overview" };
  if (room.status === "reviewed")
    return {
      done: true,
      text: "Mentorship reviewed",
      tab: "overview",
      review: true,
    };
  const payment = paymentNextAction(room);
  if (payment) return payment;
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
      action: "Go to attendance",
      tab: "schedule",
      target: "room-schedule",
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
      action: room.role === "mentor" ? "Go to goal" : undefined,
      tab: "overview",
      target: "room-goal",
    };
  // Ongoing Advisory: the founder proposes a regular time, the mentor
  // confirms it, and that creates the cycle's check-ins.
  if (
    format.id === "ongoing-advisory" &&
    room.cycle?.phase === "active" &&
    !room.cycle.confirmedAt
  )
    // (Nov 22, round 2) Whoever proposed last waits; the other side confirms.
    return room.cycle.proposedTime
      ? (room.cycle.proposedTime.proposedBy || "founder") !== room.role
        ? {
            mine: true,
            text: "Confirm the proposed check-in time",
            action: "Go to check-in time",
            tab: "schedule",
            target: "room-schedule",
          }
        : {
            mine: false,
            text: `Waiting for the ${room.role === "founder" ? "mentor" : "founder"} to confirm the check-in time`,
            tab: "schedule",
          }
      : {
          mine: room.role === "founder",
          text:
            room.role === "founder"
              ? "Propose a regular check-in time"
              : "Waiting for the founder to propose a check-in time",
          action: room.role === "founder" ? "Propose time" : undefined,
          tab: "schedule",
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
  const noSession =
    format.sync &&
    !mentorSessions(room).some(
      (session) =>
        !session.cancelledAt &&
        (!session.outcome || session.outcome === "held"),
    );
  // Only the founder books another Office Hours slot after a cancellation.
  if (noSession && format.id === "office-hours" && room.role === "mentor")
    return {
      mine: false,
      text: "Waiting for the founder to book another slot",
      tab: "schedule",
    };
  if (noSession)
    return {
      // Either side can book the session (the server allows both).
      mine: true,
      text: "Arrange a session",
      action: "Go to schedule",
      tab: "schedule",
      target: "room-schedule",
    };
  // A founder with a session coming up still has prep to share.
  const upcoming = mentorSessions(room)
    .filter(
      (session) =>
        !session.cancelledAt &&
        !session.outcome &&
        scheduleInstant(session) > new Date(),
    )
    .sort((a, b) => scheduleInstant(a) - scheduleInstant(b))[0];
  if (
    room.role === "founder" &&
    format.sync &&
    upcoming &&
    !room.mentorship.prep?.sharedAt
  )
    return {
      mine: true,
      text: `Share your prep before ${scheduleLabel(upcoming)}`,
      action: "Go to prep",
      tab: "overview",
      target: "room-prep",
    };
  // A booked session is nobody's turn: name it, so neither side reads the
  // wait as the other person holding things up.
  if (format.sync && upcoming)
    return {
      mine: false,
      upNext: true,
      text: `Session booked for ${scheduleLabel(upcoming)}`,
      tab: "schedule",
    };
  return { mine: false, text: "Nothing needed from you", tab: "overview" };
}
