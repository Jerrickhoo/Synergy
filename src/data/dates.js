// The one place user-facing dates and times are formatted, so the same
// moment never reads "2026-12-05" on one screen and "Dec 5" on another.
// Calendar-day keys (YYYY-MM-DD) are read at noon UTC so they never shift a
// day in the viewer's zone. Instants accept a Date, an ISO string or a number.

const locale = "en";
const dayKey = /^\d{4}-\d{2}-\d{2}$/;
const monthKey = /^\d{4}-\d{2}$/;

function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "string" && dayKey.test(value))
    return new Date(`${value}T12:00:00Z`);
  return new Date(value);
}
const valid = (date) => Number.isFinite(date.getTime());
const yearOf = (date, timeZone) =>
  new Intl.DateTimeFormat(locale, { year: "numeric", timeZone }).format(date);

// "Dec 5", "Sat, Dec 5", or "Dec 5, 2027" outside the current year.
export function formatDate(
  value,
  { weekday = false, year, now = Date.now(), timeZone } = {},
) {
  if (value == null || value === "") return "";
  const date = toDate(value);
  if (!valid(date)) return "";
  const zone =
    timeZone ||
    (typeof value === "string" && dayKey.test(value) ? "UTC" : undefined);
  const showYear =
    year ?? yearOf(date, zone) !== yearOf(new Date(now), zone || undefined);
  return date.toLocaleDateString(locale, {
    ...(weekday && { weekday: "short" }),
    month: "short",
    day: "numeric",
    ...(showYear && { year: "numeric" }),
    ...(zone && { timeZone: zone }),
  });
}

// "6:00 PM" from an instant, or from a wall-clock "18:00".
export function formatTime(value, { timeZone } = {}) {
  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value))
    return new Date(`2000-01-01T${value}:00Z`).toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
  const date = toDate(value);
  if (!valid(date)) return "";
  return date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone && { timeZone }),
  });
}

// "Dec 5 · 6:00 PM" (with the weekday when asked).
export function formatDateTime(value, options = {}) {
  const date = formatDate(value, options);
  const time = formatTime(value, options);
  return date && time ? `${date} · ${time}` : "";
}

// "6:00–7:00 PM" for a wall-clock start and a duration.
export function formatTimeRange(time, minutes) {
  if (!/^\d{2}:\d{2}$/.test(String(time))) return "";
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + Number(minutes || 0);
  const end = `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  const start = formatTime(time);
  const finish = formatTime(end);
  const startPeriod = start.slice(-2);
  return startPeriod === finish.slice(-2)
    ? `${start.slice(0, -3)}–${finish}`
    : `${start}–${finish}`;
}

// "December", or "December 2027" outside the current year, from "2026-12".
export function formatMonth(key, now = Date.now()) {
  if (!monthKey.test(String(key))) return String(key || "");
  const date = new Date(`${key}-15T12:00:00Z`);
  const showYear = yearOf(date, "UTC") !== yearOf(new Date(now), "UTC");
  return date.toLocaleDateString(locale, {
    month: "long",
    ...(showYear && { year: "numeric" }),
    timeZone: "UTC",
  });
}

// The weekday name of a calendar-day key, e.g. "Tuesday".
export function formatWeekday(key) {
  const date = toDate(key);
  return valid(date)
    ? date.toLocaleDateString(locale, { weekday: "long", timeZone: "UTC" })
    : "";
}

// "2026-11-22": the calendar day of an instant in a time zone (the viewer's
// zone when none is given or the zone is unknown).
export function dayKeyIn(value = Date.now(), timeZone) {
  const date = toDate(value);
  if (!valid(date)) return "";
  const options = { year: "numeric", month: "2-digit", day: "2-digit" };
  try {
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone }).format(
      date,
    );
  } catch {
    return new Intl.DateTimeFormat("en-CA", options).format(date);
  }
}

// The calendar day after a day key: "2026-11-30" -> "2026-12-01".
export function nextDayKey(key) {
  if (!dayKey.test(String(key))) return "";
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// A time zone people can read, for example "Philippine Standard Time
// (GMT+8)", instead of the IANA identifier ("Asia/Manila").
export function timeZoneLabel(zone, at = new Date()) {
  if (!zone) return "";
  const part = (timeZoneName) => {
    try {
      return new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName })
        .formatToParts(at)
        .find((item) => item.type === "timeZoneName")?.value;
    } catch {
      return "";
    }
  };
  const name = part("long");
  const offset = part("shortOffset");
  if (!name) return zone;
  return offset && offset !== name ? `${name} (${offset})` : name;
}
