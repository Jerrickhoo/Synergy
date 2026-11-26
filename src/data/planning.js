import { isMentorRoom, mentorSessions } from "./mentor-room.js";
import { activeRooms, milestoneTask, scheduleInstant } from "./selectors.js";

export function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateFromKey(key) {
  return new Date(`${key}T12:00:00`);
}

export function zonedDateKey(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftCalendarDate(key, { days = 0, months = 0 } = {}) {
  const date = dateFromKey(key);
  if (months) {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + months);
    date.setDate(
      Math.min(
        day,
        new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
      ),
    );
  }
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function monthCells(month, fixedWeeks = false) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const weeks = fixedWeeks ? 6 : Math.ceil((offset + count) / 7);
  return Array.from({ length: weeks }, (_, row) =>
    Array.from({ length: 7 }, (_, column) => {
      const date = new Date(first);
      date.setDate(1 - offset + row * 7 + column);
      return {
        date,
        key: localDateKey(date),
        inMonth: date.getMonth() === first.getMonth(),
      };
    }),
  );
}

export function calendarKeyDate(key, pressed, shift = false) {
  const weekday = (dateFromKey(key).getDay() + 6) % 7;
  const days = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
    Home: -weekday,
    End: 6 - weekday,
  };
  if (pressed in days) return shiftCalendarDate(key, { days: days[pressed] });
  if (pressed === "PageUp" || pressed === "PageDown")
    return shiftCalendarDate(key, {
      months: (pressed === "PageUp" ? -1 : 1) * (shift ? 12 : 1),
    });
  return null;
}

export function monthEvents(events, month) {
  const start = localDateKey(
    new Date(month.getFullYear(), month.getMonth(), 1),
  );
  const end = localDateKey(
    new Date(month.getFullYear(), month.getMonth() + 1, 0),
  );
  const groups = new Map();
  for (const event of events.filter(
    (event) => event.date >= start && event.date <= end,
  )) {
    if (!groups.has(event.date)) groups.set(event.date, []);
    groups.get(event.date).push(event);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b));
}

export function weeklySchedules(first, count) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(`${first.date}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index * 7);
    return { ...first, date: date.toISOString().slice(0, 10) };
  });
}

// Open (unbooked) Office Hours times the server listed for the mentor. They
// belong to no room; booked times show as sessions in their room.
function officeOpenings(state) {
  return (state.role === "mentor" ? state.mentorOfficeOpenings || [] : [])
    .map((slot) => {
      const instant = new Date(slot.startsAt);
      return {
        id: `office:${slot.id}`,
        date: localDateKey(instant),
        instant,
        durationMinutes: slot.durationMinutes,
        title: "Open Office Hours",
        kind: "office-hours",
        room: null,
      };
    })
    .filter((event) => Number.isFinite(event.instant.getTime()));
}

export function calendarEvents(state) {
  return [...activeRooms(state), null]
    .flatMap((room) => {
      if (!room) return officeOpenings(state);
      const session = room.milestones.session;
      const events = (
        isMentorRoom(room)
          ? mentorSessions(room).filter((entry) => !entry.cancelledAt)
          : session?.schedules || (session?.schedule ? [session.schedule] : [])
      )
        .map((schedule, index) => {
          const instant = scheduleInstant(schedule);
          return {
            id: `${room.id}:session:${index}`,
            date: localDateKey(instant),
            instant,
            durationMinutes: schedule.durationMinutes,
            title: schedule.officeOccurrenceId
              ? "Office Hours (booked)"
              : "Mentorship session",
            kind: "session",
            room,
            tab: "schedule",
          };
        })
        .filter((event) => Number.isFinite(event.instant.getTime()));
      // Meetings scheduled in an exchange collaboration.
      for (const meeting of room.meetings || []) {
        if (meeting.cancelledAt) continue;
        const instant = scheduleInstant(meeting);
        if (!Number.isFinite(instant.getTime())) continue;
        events.push({
          id: `${room.id}:meeting:${meeting.id}`,
          date: localDateKey(instant),
          instant,
          durationMinutes: meeting.durationMinutes,
          title: "Meeting",
          kind: "session",
          room,
          tab: "schedule",
        });
      }
      for (const [id, milestone] of Object.entries(room.milestones)) {
        if (milestone.dueDate && !(milestone.me && milestone.partner))
          events.push({
            id: `${room.id}:milestone:${id}`,
            date: milestone.dueDate,
            // Still open, so it reads as the work to do.
            title: milestoneTask(milestone.title),
            kind: "milestone",
            milestoneId: id,
            room,
            tab: "milestones",
          });
      }
      for (const task of room.tasks || []) {
        if (task.dueDate && task.status !== "done")
          events.push({
            id: `${room.id}:task:${task.id}`,
            date: task.dueDate,
            title: task.title,
            kind: "task",
            room,
            tab: "tasks",
          });
      }
      return events;
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.instant?.getTime() || 0) - (b.instant?.getTime() || 0) ||
        a.title.localeCompare(b.title),
    );
}
