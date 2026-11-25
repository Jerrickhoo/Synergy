import { randomBytes, randomUUID } from "node:crypto";
import {
  formatHours,
  formatList,
  hoursLimitMonth,
  mentorCommitments,
  mentorMonthKey,
  validTimeZone,
} from "../src/data/mentor-rules.js";
import { mentorFormat } from "../src/data/mentor-formats.js";
import { formatMonth } from "../src/data/dates.js";
import {
  appointment,
  dayMs,
  hourMs,
  isMentorRoom,
  mentorSessions,
  roomFormat,
  sessionMilestone,
  setMentorMilestone,
} from "../src/data/mentor-room.js";
import { scheduleInstant } from "../src/data/selectors.js";

export const calendarActions = new Set([
  "open-office-slot",
  "set-office-preferred-time",
  "close-office-slot",
  "skip-office-date",
  "book-office-hours",
  "rebook-office-slot",
  "calendar-link",
  // Prototype only: handled in workspace.js.
  "simulate-office-booking",
  "simulate-office-rebooking",
]);

const durationOptions = [15, 30, 45, 60];
const dateKey = (instant, timeZone) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
const dateValue = (value) => {
  const time =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? Date.parse(value + "T00:00:00Z")
      : NaN;
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
    ? time
    : NaN;
};
const timeValue = (value) =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const overlap = (first, second) =>
  first.instant < second.instant + second.durationMinutes * 60000 &&
  second.instant < first.instant + first.durationMinutes * 60000;
const toOccurrence = (slot, date) => {
  const instance = {
    id: `${slot.id}@${date}`,
    slotId: slot.id,
    date,
    time: slot.time,
    timeZone: slot.timeZone,
    durationMinutes: slot.durationMinutes,
  };
  const instant = scheduleInstant(instance).getTime();
  return Number.isFinite(instant) ? { ...instance, instant } : null;
};

function occurrences(slots, start, end) {
  const output = [];
  for (const slot of slots) {
    if (!slot.recurring) {
      const instance = toOccurrence(slot, slot.date);
      if (
        instance &&
        !slot.closedDates.includes(slot.date) &&
        instance.instant >= start &&
        instance.instant <= end
      )
        output.push(instance);
      continue;
    }
    const initial = dateValue(dateKey(start, slot.timeZone));
    const final = dateValue(dateKey(end, slot.timeZone));
    let date = Math.max(initial, dateValue(slot.date));
    date += ((slot.weekday - new Date(date).getUTCDay() + 7) % 7) * dayMs;
    for (; date <= final; date += 7 * dayMs) {
      const local = new Date(date).toISOString().slice(0, 10);
      if (slot.closedDates.includes(local)) continue;
      const instance = toOccurrence(slot, local);
      if (instance && instance.instant >= start && instance.instant <= end)
        output.push(instance);
    }
  }
  return output.sort(
    (a, b) => a.instant - b.instant || a.id.localeCompare(b.id),
  );
}

const roomsFor = (state) =>
  Object.values(state.rooms).filter(
    (room) => isMentorRoom(room) && room.role === "mentor",
  );
const bookings = (state) =>
  roomsFor(state).flatMap((room) =>
    mentorSessions(room)
      .filter((session) => session.officeOccurrenceId && !session.cancelledAt)
      .map((session) => ({
        room,
        session,
        occurrenceId: session.officeOccurrenceId,
      })),
  );

const scheduled = (state) =>
  roomsFor(state).flatMap((room) =>
    mentorSessions(room)
      .filter((session) => !session.cancelledAt && !session.outcome)
      .map((session) => ({
        instant: scheduleInstant(session).getTime(),
        durationMinutes: session.durationMinutes,
      })),
  );

export function officeAvailability(state, now, config) {
  const taken = new Set(
    bookings(state).map(({ occurrenceId }) => occurrenceId),
  );
  const start = now + config.bookingMinLeadHours * hourMs;
  const end = now + config.bookingMaxAheadDays * dayMs;
  const busy = scheduled(state);
  return occurrences(state.profiles.mentor?.officeHours || [], start, end)
    .filter(
      (slot) =>
        !taken.has(slot.id) && !busy.some((session) => overlap(slot, session)),
    )
    .map(({ instant, ...slot }) => ({
      ...slot,
      startsAt: new Date(instant).toISOString(),
    }));
}

export function preferredAvailability(state, now, config) {
  const preference = state.profiles.mentor?.preferredHours;
  if (!preference) return [];
  const slot = {
    ...preference,
    id: "preferred",
    date: dateKey(now, preference.timeZone),
    recurring: true,
    closedDates: [],
  };
  const starts = now + config.bookingMinLeadHours * hourMs;
  const ends = now + config.bookingMaxAheadDays * dayMs;
  const busy = scheduled(state);
  return occurrences([slot], starts, ends)
    .filter((entry) => !busy.some((session) => overlap(entry, session)))
    .slice(0, 5)
    .map(({ instant, ...entry }) => ({
      ...entry,
      startsAt: new Date(instant).toISOString(),
    }));
}

function recurringMonthlyMinutes(slots, zone) {
  const weekdayMinutes = Array(7).fill(0);
  let otherZoneMinutes = 0;
  for (const slot of slots) {
    if (!slot.recurring) continue;
    if (slot.timeZone === zone)
      weekdayMinutes[slot.weekday] += slot.durationMinutes;
    else otherZoneMinutes += slot.durationMinutes;
  }
  // A month has four full weeks and at most three extra consecutive weekdays.
  // An older slot in another zone can shift at month boundaries, so reserve
  // its maximum of five occurrences independently of the local weekdays.
  const weekly = weekdayMinutes.reduce((sum, minutes) => sum + minutes, 0);
  const extra = Math.max(
    ...weekdayMinutes.map(
      (minutes, day) =>
        minutes + weekdayMinutes[(day + 1) % 7] + weekdayMinutes[(day + 2) % 7],
    ),
  );
  return weekly * 4 + extra + otherZoneMinutes * 5;
}

export function officeAllocation(
  state,
  now,
  config,
  slots = state.profiles.mentor?.officeHours || [],
  proposedSessions = [],
) {
  const committed = mentorCommitments(state, now, config);
  const zone = state.profiles.mentor?.timeZone || "Asia/Manila";
  const taken = new Set(
    bookings(state).map(({ occurrenceId }) => occurrenceId),
  );
  const months = { ...committed };
  const monthsToCheck = new Set(Object.keys(committed));
  for (const slot of [
    ...slots.filter((slot) => !slot.recurring),
    ...proposedSessions,
  ])
    monthsToCheck.add(mentorMonthKey(scheduleInstant(slot).getTime(), zone));
  // Include full local calendar months around far-future commitments without
  // expanding every intervening week. Padding covers UTC date boundaries.
  const windows = [[now, now + 366 * dayMs]];
  for (const month of [...monthsToCheck].sort()) {
    const start = Date.parse(`${month}-01T00:00:00Z`);
    const end = start + 33 * dayMs;
    if (end < now) continue;
    const last = windows.at(-1);
    if (start - dayMs <= last[1]) last[1] = Math.max(last[1], end);
    else windows.push([start - dayMs, end]);
  }
  const busy = scheduled(state);
  const projected = windows
    .flatMap(([start, end]) => occurrences(slots, start, end))
    .filter(
      (slot) =>
        !taken.has(slot.id) && !busy.some((session) => overlap(slot, session)),
    );
  if (
    projected.some(
      (slot, index) =>
        projected[index + 1] && overlap(slot, projected[index + 1]),
    )
  )
    return { conflict: true, months, unbooked: {} };
  const unbooked = {};
  for (const slot of projected) {
    const month = mentorMonthKey(slot.instant, zone);
    months[month] = (months[month] || 0) + slot.durationMinutes;
    (unbooked[month] ||= []).push(slot);
  }
  return { conflict: false, months, unbooked };
}

export function createOfficeHours({
  accounts,
  config,
  now,
  fail,
  mirror,
  connect,
  capacity,
  verify,
  founderLimit,
  conflict,
  eligible,
  checkSchedule,
  safetyCheck = () => [],
  recordSafety = () => {},
}) {
  const stamp = () => new Date(now()).toISOString();
  // `opening` is the mentor's slot list before a new slot, so the refusal can
  // say how much the new slot adds; without it the mentor is lowering hours.
  function assertAllocation(state, slots, limit, opening) {
    const { conflict, months, unbooked } = officeAllocation(
      state,
      now(),
      config(),
      slots,
    );
    if (conflict)
      fail("These office-hours times overlap. Choose different times.", 409);
    const exceeded = Object.entries(months).find(
      ([month, minutes]) => unbooked[month]?.length && minutes > limit * 60,
    );
    if (exceeded) {
      const [month, minutes] = exceeded;
      const name = formatMonth(month, now());
      const before = opening
        ? officeAllocation(state, now(), config(), opening).months[month] || 0
        : 0;
      const slotIds = [...new Set(unbooked[month].map((slot) => slot.slotId))];
      fail(
        opening
          ? `This slot would add ${formatHours(minutes - before)} in ${name}, but you have ${formatHours(Math.max(0, limit * 60 - before))} left. Choose a shorter slot or raise your hours in Settings.`
          : `Your sessions and open Office Hours need ${formatHours(minutes)} in ${name}. ${
              slotIds.length === 1
                ? "Close 1 open Office Hours slot"
                : `Close some of your ${slotIds.length} open Office Hours slots`
            } in ${name} (Calendar) to lower your hours to ${limit}.`,
        409,
        undefined,
        { reason: "hours-limit", month, slotIds },
      );
    }
    const recurringMinutes = recurringMonthlyMinutes(
      slots,
      state.profiles.mentor?.timeZone || "Asia/Manila",
    );
    if (recurringMinutes > limit * 60)
      fail(
        opening
          ? `Weekly slots can need up to ${formatHours(recurringMinutes)} in a month with an extra week, more than your ${limit}-hour limit. Choose a shorter slot or raise your hours in Settings.`
          : `Your weekly Office Hours can need up to ${formatHours(recurringMinutes)} in a month. Close a weekly slot in Calendar to lower your hours to ${limit}.`,
        409,
        undefined,
        {
          reason: "hours-limit",
          slotIds: slots.filter((slot) => slot.recurring).map(({ id }) => id),
        },
      );
  }

  // Offered formats that have room now but would run out of hours once the
  // new slots reserve their time, with the first month each one stops fitting.
  function closedBySlots(state, slots) {
    const previous = state.profiles.mentor.officeHours;
    const before = capacity(state);
    state.profiles.mentor.officeHours = slots;
    const after = capacity(state);
    const allocated = officeAllocation(state, now(), config()).months;
    state.profiles.mentor.officeHours = previous;
    return before.offeredFormats
      .filter(
        (id) =>
          !before.formatReasons[id] &&
          after.formatReasons[id] === "hours-limit",
      )
      .map((id) => ({
        id,
        label: mentorFormat(id).label,
        month:
          hoursLimitMonth(state, id, now(), config(), allocated) || after.month,
      }));
  }

  // `prototype.person` is set only when a fictional sample founder books a
  // preview mentor: sample founders never see preview accounts in their
  // directory, so the caller supplies the mentor and has already checked
  // that the founder is fictional. Every other booking rule still applies.
  function book(
    account,
    state,
    input,
    values,
    validateOnly = false,
    prototype = null,
  ) {
    if (state.role !== "founder")
      fail("Only founders can book office hours.", 403);
    verify(account, state, { action: "send-request" });
    const target =
      input.action === "rebook-office-slot"
        ? state.rooms[input.activeRoomId]?.partnerId
        : input.id;
    if (typeof target !== "string" || !target.endsWith(":mentor"))
      fail("Choose an available mentor.", 404);
    const mentorId = target.slice(0, -7);
    const mentor = Object.hasOwn(accounts(), mentorId)
      ? accounts()[mentorId]
      : null;
    if (
      !mentor ||
      !(prototype || eligible(mentor, account)) ||
      conflict(mentor, account)?.level === "block"
    )
      fail("This mentor is unavailable for booking.", 409);
    const profile = mentor.state.profiles.mentor;
    const person =
      prototype?.person ||
      state.directory.mentors.find((item) => item.id === target);
    const slot = (profile.officeHours || []).find(
      (item) => item.id === values.slotId,
    );
    const occurrenceId = `${values.slotId}@${values.date}`;
    if (
      bookings(mentor.state).some((item) => item.occurrenceId === occurrenceId)
    )
      fail("Just taken. Choose another Office Hours slot.", 409, undefined, {
        reason: "slot-taken",
        slots: officeAvailability(mentor.state, now(), config()),
      });
    const current = officeAvailability(mentor.state, now(), config()).find(
      (item) => item.id === occurrenceId,
    );
    if (!slot || !current)
      fail(
        "This Office Hours slot is unavailable. Choose another time.",
        409,
        undefined,
        { reason: "slot-unavailable" },
      );
    const usage = capacity(mentor.state);
    if (
      !person ||
      !usage.offeredFormats.includes("office-hours") ||
      [
        "paused",
        "guidelines",
        "approval-required",
        "suspended",
        "no-show-limit",
      ].includes(usage.reason)
    )
      fail(
        "This mentor is unable to take Office Hours bookings right now.",
        409,
      );
    if (usage.activeMentees >= usage.capacity.maxMentees)
      fail("The mentor has no session slots open right now.", 409, undefined, {
        reason: "mentee-limit",
      });
    if (Date.parse(state.mentorshipLimits?.founder || "") > now())
      fail(
        "Office Hours booking is paused while your attendance limit is active.",
        409,
        undefined,
        { reason: "no-show-limit" },
      );
    const pending = [...state.waitingByRole.founder].filter((id) =>
      id.endsWith(":mentor"),
    );
    if (
      input.action === "book-office-hours" &&
      (pending.includes(target) || pending.length >= founderLimit(state))
    )
      fail(
        "Resolve a pending mentorship request before booking.",
        409,
        undefined,
        { reason: "founder-limit" },
      );
    if (input.action === "rebook-office-slot") {
      const room = state.rooms[input.activeRoomId];
      if (
        !isMentorRoom(room) ||
        room.role !== "founder" ||
        room.partnerAccountId !== mentor.id ||
        roomFormat(room) !== "office-hours" ||
        !room.mentorship.slotReleased ||
        room.milestones.held?.me ||
        room.status !== "in-progress"
      )
        fail("This Office Hours booking cannot be replaced.", 409);
      const session = appointment({
        ...current,
        id: randomUUID(),
        officeSlotId: slot.id,
        officeOccurrenceId: occurrenceId,
      });
      checkSchedule(mentor, { ...account, state }, [session], {
        unbookedOfficeOccurrence: occurrenceId,
      });
      sessionMilestone(room).schedules.push(session);
      room.mentorship.slotReleased = false;
      room.updatedAt = stamp();
      mirror(
        account,
        state,
        room,
        "The founder booked another Office Hours slot.",
        { tab: "schedule", kind: "booking" },
      );
      state.toast = "New Office Hours slot booked.";
      return;
    }
    const content = {};
    for (const field of ["problem", "question"]) {
      const value =
        typeof values[field] === "string" ? values[field].trim() : "";
      if (value.length < 20 || value.length > 1000)
        fail(
          "Describe the problem and question in 20 to 1,000 characters each.",
          400,
          { [field]: "Enter 20 to 1,000 characters." },
        );
      content[field] = value;
    }
    const desiredOutcome =
      typeof values.desiredOutcome === "string"
        ? values.desiredOutcome.trim()
        : "";
    if (desiredOutcome.length > 1000)
      fail("Check the desired outcome.", 400, {
        desiredOutcome: "Enter up to 1,000 characters.",
      });
    if (desiredOutcome) content.desiredOutcome = desiredOutcome;
    const session = appointment({
      ...current,
      id: randomUUID(),
      officeSlotId: slot.id,
      officeOccurrenceId: occurrenceId,
    });
    checkSchedule(mentor, { ...account, state }, [session], {
      unbookedOfficeOccurrence: occurrenceId,
    });
    const flags = safetyCheck(
      Object.values(content).join("\n"),
      values.acknowledgeSafety,
    );
    if (validateOnly) return;
    const request = {
      id: randomUUID(),
      kind: "mentor-request",
      format: "office-hours",
      price: 0,
      consentAt: stamp(),
      ...content,
    };
    const room = connect(account, state, person, false, request);
    if (validTimeZone(input.timeZone))
      room.mentorship.founderTimeZone = input.timeZone;
    room.mentorship.booking = {
      ...content,
      consentAt: request.consentAt,
      safetyFlags: flags,
    };
    recordSafety(account, state.role, flags, `booking:${request.id}`, room.id);
    sessionMilestone(room).schedules = [session];
    setMentorMilestone(room, "booked");
    mirror(account, state, room, `${state.accountName} booked Office Hours.`, {
      tab: "schedule",
      kind: "booking",
    });
    state.roomTab = "schedule";
    state.toast = "Office Hours booked.";
  }

  function act(account, state, input) {
    const values = input.values || {};
    if (typeof values !== "object" || Array.isArray(values))
      fail("Invalid calendar values.");
    if (input.action === "calendar-link") {
      if (!account.calendarToken || values.reset === true)
        account.calendarToken = randomBytes(32).toString("hex");
      state.toast = values.reset
        ? "Calendar link reset."
        : "Private calendar link ready.";
      return;
    }
    if (["book-office-hours", "rebook-office-slot"].includes(input.action))
      return book(account, state, input, values);
    if (state.role !== "mentor") fail("Only mentors manage Office Hours.", 403);
    const profile = state.profiles.mentor;
    profile.officeHours ||= [];
    if (input.action === "set-office-preferred-time") {
      if (values.clear === true) {
        profile.preferredHours = null;
        state.toast = "Preferred time removed.";
        return;
      }
      const weekday = Number(values.weekday);
      const timeZone = profile.timeZone;
      if (
        values.weekday === "" ||
        !Number.isInteger(weekday) ||
        weekday < 0 ||
        weekday > 6 ||
        !timeValue(values.time) ||
        !validTimeZone(timeZone)
      )
        fail("Choose a weekday and valid time.");
      profile.preferredHours = {
        weekday,
        time: values.time,
        timeZone,
        durationMinutes: 60,
      };
      state.toast = "Preferred session time saved.";
      return;
    }
    if (input.action === "open-office-slot") {
      if (!capacity(state).offeredFormats.includes("office-hours"))
        fail("Offer Office Hours in Mentoring settings first.", 409);
      const timeZone = values.timeZone || profile.timeZone;
      const durationMinutes = Number(values.durationMinutes);
      const date = values.date;
      const weekday = new Date(dateValue(date)).getUTCDay();
      if (
        !validTimeZone(timeZone) ||
        !durationOptions.includes(durationMinutes) ||
        !Number.isFinite(weekday) ||
        !timeValue(values.time)
      )
        fail("Choose a valid date, time, duration and time zone.");
      const slot = {
        id: randomUUID(),
        date,
        weekday,
        time: values.time,
        durationMinutes,
        timeZone,
        recurring: values.recurring === true || values.recurring === "on",
        closedDates: [],
      };
      const first = scheduleInstant(slot).getTime();
      if (
        !Number.isFinite(first) ||
        first <= now() ||
        first > now() + config().bookingMaxAheadDays * dayMs
      )
        fail(
          `Choose a first date within the next ${config().bookingMaxAheadDays} days.`,
        );
      if (
        scheduled(state).some((session) =>
          occurrences(
            [slot],
            Math.max(now(), session.instant - durationMinutes * 60000),
            session.instant + session.durationMinutes * 60000,
          ).some((entry) => overlap(entry, session)),
        )
      )
        fail(
          "This Office Hours slot overlaps a booked session. Choose another time.",
          409,
        );
      const next = [...profile.officeHours, slot];
      assertAllocation(
        state,
        next,
        capacity(state).capacity.monthlyHours,
        profile.officeHours,
      );
      const closing = closedBySlots(state, next);
      if (
        closing.length &&
        values.confirmClosing !== true &&
        values.confirmClosing !== "true"
      ) {
        const months = new Map();
        for (const item of closing)
          months.set(item.month, [
            ...(months.get(item.month) || []),
            item.label,
          ]);
        const when = [...months]
          .map(
            ([month, labels]) =>
              `${formatList(labels)} to new founders in ${formatMonth(month, now())}`,
          )
          .join(", and ");
        // (Nov 22, round 2) A confirmation, not a failure: nothing opens,
        // and the answer carries the question instead of an error status.
        state.officeSlotCheck = {
          reason: "closes-formats",
          message: `This slot closes ${when}. Open it anyway, or choose a shorter slot.`,
          formats: closing,
        };
        return;
      }
      profile.officeHours = next;
      state.toast = closing.length
        ? `Office Hours slot opened. ${formatList(closing.map((item) => item.label))} ${closing.length === 1 ? "is" : "are"} closed to new founders until you have hours free.`
        : "Office Hours slot opened.";
    } else {
      const slot = profile.officeHours.find((item) => item.id === input.id);
      if (!slot) fail("This Office Hours slot is unavailable.", 404);
      const skip = input.action === "skip-office-date";
      if (skip) {
        const date = values.date;
        if (
          !slot.recurring ||
          !Number.isFinite(dateValue(date)) ||
          new Date(dateValue(date)).getUTCDay() !== slot.weekday ||
          date < slot.date ||
          scheduleInstant({ ...slot, date }).getTime() <= now()
        )
          fail("Choose one future occurrence of the weekly slot.");
        if (!slot.closedDates.includes(date)) slot.closedDates.push(date);
      } else
        profile.officeHours = profile.officeHours.filter(
          (item) => item.id !== slot.id,
        );
      // Only promise other times when the founder can actually book one.
      const usage = capacity(state);
      const otherTimes =
        !profile.paused &&
        ![
          "paused",
          "guidelines",
          "approval-required",
          "suspended",
          "no-show-limit",
        ].includes(usage.reason) &&
        officeAvailability(state, now(), config()).length > 0;
      let cancelled = 0;
      for (const { room, session } of bookings(state)) {
        if (
          session.officeSlotId !== slot.id ||
          (skip && session.date !== values.date) ||
          session.outcome ||
          scheduleInstant(session).getTime() <= now()
        )
          continue;
        session.cancelledAt = stamp();
        session.cancelledBy = "mentor";
        session.cancelReason = "The mentor closed this Office Hours slot.";
        session.lateCancel =
          scheduleInstant(session).getTime() - now() <
          config().lateNoticeHours * hourMs;
        room.mentorship.slotReleased = true;
        cancelled += 1;
        mirror(
          account,
          state,
          room,
          otherTimes
            ? "The mentor closed your Office Hours slot. Choose one of their next available times."
            : "The mentor closed your Office Hours slot and has no other open times right now. Find another mentor in Matches.",
          {
            kind: "slot-closed",
            tab: "schedule",
            matchId: `${account.id}:mentor`,
          },
        );
      }
      const booked = cancelled
        ? ` ${cancelled} booked ${cancelled === 1 ? "session was" : "sessions were"} cancelled and counted as a mentor cancellation.`
        : "";
      state.toast =
        (skip ? "Office Hours date skipped." : "Office Hours slot closed.") +
        booked;
    }
  }

  return {
    act,
    // Prototype only: see `prototype` on book.
    bookAsFictionalFounder(founder, founderState, input, values, person) {
      return book(founder, founderState, input, values, false, { person });
    },
    validateBooking(account, state, input) {
      return book(account, state, input, input.values || {}, true);
    },
    validateLowering(state, next) {
      const current =
        state.profiles.mentor.capacity?.monthlyHours ||
        config().defaultMonthlyHours;
      if (next.monthlyHours < current)
        assertAllocation(
          state,
          state.profiles.mentor.officeHours || [],
          next.monthlyHours,
        );
    },
  };
}

const eventTitle = (room, name) => {
  const officeHours = roomFormat(room) === "office-hours";
  const other = String(name || "").trim();
  if (!other)
    return officeHours ? "Mentorship Office Hours" : "Mentorship session";
  return `${officeHours ? "Office Hours" : "Mentorship"} with ${other}`;
};
const icsDate = (iso) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
// RFC 5545 TEXT: backslash, semicolon and comma are escaped; no line breaks.
const icsText = (value) =>
  String(value)
    .replace(/[\\;,]/g, (character) => "\\" + character)
    .replace(/[\r\n]+/g, " ");
// partnerName(room) gives the other participant's name from the viewer's side.
export function calendarIcs(state, now, selected, partnerName = () => "") {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Synergy//Mentoring Calendar//EN",
    "CALSCALE:GREGORIAN",
  ];
  const entries = Object.values(state.rooms)
    .filter(isMentorRoom)
    .flatMap((room) =>
      mentorSessions(room)
        .filter(
          (session) =>
            !session.cancelledAt &&
            (!selected || selected === `${room.id}-${session.id}`),
        )
        .flatMap((session) => {
          const start = scheduleInstant(session).getTime();
          if (!Number.isFinite(start)) return [];
          return [
            "BEGIN:VEVENT",
            `UID:${room.id}-${session.id}@synergy`,
            `DTSTAMP:${icsDate(room.updatedAt || now)}`,
            `DTSTART:${icsDate(start)}`,
            `DTEND:${icsDate(start + session.durationMinutes * 60000)}`,
            `SUMMARY:${icsText(eventTitle(room, partnerName(room)))}`,
            "END:VEVENT",
          ];
        }),
    );
  return [...header, ...entries, "END:VCALENDAR", ""].join("\r\n");
}
