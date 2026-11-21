// Founder review round 4: price filters count as active filters, Maximum price
// is validated, calendar files name the other participant, and form titles.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import { createInitialState } from "../src/data/model.js";
import { transition } from "../src/state/transitions.js";
import { errorTitle } from "../src/state/feedback.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";
import {
  activeFilterCount,
  defaultMatchFilters,
  emptyStateKind,
  filterPeople,
  hasActiveFilters,
  restoreMatchFilters,
  validMaxPrice,
} from "../src/data/filters.js";

const person = (name, kind, formats) => ({
  id: name,
  name,
  kind,
  sector: "SaaS",
  summary: "",
  offer: [],
  need: [],
  engagement: kind === "Mentor" ? "Mentorship" : "Beta Testing Exchange",
  score: 80,
  ...(formats && { formats }),
});
// Suggestions where every mentor is paid, as in the founder's repro.
const suggestions = [
  person("Paid Mentor", "Mentor", [{ id: "single-session", price: 150000 }]),
  person("Pricier Mentor", "Mentor", [{ id: "office-hours", price: 500000 }]),
  person("Peer Startup", "Startup"),
];

test("1: Free only and a maximum price count as active filters", () => {
  assert.equal(activeFilterCount(defaultMatchFilters), 0);
  assert.equal(hasActiveFilters(defaultMatchFilters), false);
  for (const filters of [
    { ...defaultMatchFilters, freeOnly: true },
    { ...defaultMatchFilters, maxPrice: "0" },
    { ...defaultMatchFilters, maxPrice: "500" },
  ]) {
    assert.equal(activeFilterCount(filters), 1);
    assert.equal(hasActiveFilters(filters), true);
  }
  assert.equal(
    activeFilterCount({
      ...defaultMatchFilters,
      freeOnly: true,
      maxPrice: "0",
    }),
    2,
  );
  // An empty or invalid price sets no limit, so it is not counted.
  for (const maxPrice of ["", "  ", "-100", "abc"])
    assert.equal(activeFilterCount({ ...defaultMatchFilters, maxPrice }), 0);
});

test("1: price filters that hide every suggestion show the filtered empty state, and Clear filters restores the list", () => {
  for (const key of ["freeOnly", "maxPrice"]) {
    const state = createInitialState();
    transition(state, {
      action: "set-filter",
      key,
      value: key === "freeOnly" ? true : "0",
    });
    const list = filterPeople(suggestions, state.matchFilters);
    assert.deepEqual(list, [], key);
    // Not "No suggestions yet": these are real suggestions, hidden by a filter,
    // so the closest-profiles list stays away and Clear filters is offered.
    assert.equal(
      emptyStateKind({
        tab: "suggested",
        filters: state.matchFilters,
        candidates: suggestions,
        list,
      }),
      "filtered",
      key,
    );
    assert.equal(activeFilterCount(state.matchFilters), 1, key);
    transition(state, { action: "clear-filters" });
    assert.deepEqual(state.matchFilters, defaultMatchFilters, key);
    assert.equal(
      filterPeople(suggestions, state.matchFilters).length,
      suggestions.length,
      key,
    );
  }
  // With no filters and no suggestions, the "No suggestions yet" state stays.
  assert.equal(
    emptyStateKind({
      tab: "suggested",
      filters: defaultMatchFilters,
      candidates: [],
      list: [],
    }),
    "suggestions",
  );
});

test("1: a header search starts from cleared price filters", () => {
  const state = createInitialState();
  transition(state, { action: "set-filter", key: "freeOnly", value: true });
  transition(state, { action: "set-filter", key: "maxPrice", value: "5" });
  transition(state, { action: "header-search", query: " Ada " });
  assert.deepEqual(state.matchFilters, {
    ...defaultMatchFilters,
    search: "Ada",
  });
});

test("2: Maximum price accepts empty or a whole or decimal number of 0 or more", () => {
  for (const value of [
    "",
    " ",
    "0",
    "0.0",
    "100",
    "1500.50",
    "0.5",
    ".5",
    "7.",
  ])
    assert.equal(validMaxPrice(value), true, JSON.stringify(value));
  for (const value of [
    "-100",
    "-0.5",
    "abc",
    "1e3",
    "+5",
    "1,000",
    "5 5",
    "NaN",
  ])
    assert.equal(validMaxPrice(value), false, JSON.stringify(value));
});

test("2: filterPeople applies a valid maximum price and ignores an invalid one", () => {
  const names = (maxPrice) =>
    filterPeople(suggestions, { ...defaultMatchFilters, maxPrice }).map(
      (p) => p.name,
    );
  assert.deepEqual(names("1500"), ["Paid Mentor"]);
  assert.deepEqual(names("1499.99"), []);
  assert.deepEqual(names("5000"), ["Paid Mentor", "Pricier Mentor"]);
  // Defensive: an invalid value is no limit, never an empty list.
  for (const invalid of ["-100", "abc", "1e3"])
    assert.equal(names(invalid).length, suggestions.length, invalid);
});

test("4d: restored filters keep known valid values and reset the rest", () => {
  assert.deepEqual(restoreMatchFilters(null), defaultMatchFilters);
  assert.deepEqual(
    restoreMatchFilters({
      search: "pricing",
      freeOnly: true,
      maxPrice: "-100",
      score: "500",
      type: 7,
      extra: "ignored",
    }),
    { ...defaultMatchFilters, search: "pricing", freeOnly: true },
  );
});

test("4c: room note and task forms have specific error titles", () => {
  assert.equal(errorTitle("session-note"), "Couldn't add your note");
  assert.equal(errorTitle("task-create"), "Couldn't save the task");
  assert.equal(errorTitle("task-update"), "Couldn't save the task");
  assert.equal(
    errorTitle("calendar-link"),
    "Couldn't create the calendar file",
  );
  assert.equal(errorTitle("unknown-scope"), "Something needs your attention");
});

// A founder and mentor with a scheduled single session and booked Office Hours.
function calendarWorkspace(t) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-fourth-run-"));
  const clock = { value: Date.parse("2031-03-02T02:00:00Z") };
  const workspace = createWorkspace(join(dir, "workspace.json"), {
    now: () => clock.value,
    mentorApprovalRequired: false,
  });
  t.after(() => {
    workspace.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  const user = (firstName, lastName, role, values) => {
    const u = workspace.login(
      {
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}@example.com`,
        password: "private-password",
        role,
      },
      true,
    );
    u.role = role;
    workspace.act(u.token, { role, form: "profile-form", values });
    if (role === "mentor")
      workspace.act(u.token, {
        role,
        form: "accept-guidelines",
        values: { version: 2 },
      });
    return u;
  };
  const act = (u, command) =>
    workspace.act(u.token, { role: u.role, ...command }).state;
  return { workspace, user, act };
}

const icsEvents = (feed) =>
  feed
    .split("BEGIN:VEVENT")
    .slice(1)
    .map((block) =>
      Object.fromEntries(
        block
          .split("\r\n")
          .filter((line) => line.includes(":") && !line.startsWith("END"))
          .map((line) => [
            line.slice(0, line.indexOf(":")),
            line.slice(line.indexOf(":") + 1),
          ]),
      ),
    );

test("3: calendar files name the other participant from each side, with unchanged UID and times", (t) => {
  const { workspace, user, act } = calendarWorkspace(t);
  const mentor = user("Marcus", "Webb", "mentor", {
    bio: "Pricing mentor for SaaS teams.",
    offer: "Pricing strategy",
    need: "Focused questions",
    expertise: "Pricing strategy",
    startups: "Seed SaaS",
  });
  const founder = user("Jordan", "Lee", "founder", {
    bio: "Staff scheduling software for restaurants.",
    offer: "Product feedback",
    need: "Pricing strategy",
    industry: "SaaS",
    stage: "seed",
    teamSize: "6",
    startupName: "Shiftly",
  });
  act(mentor, {
    form: "mentor-capacity",
    values: {
      maxMentees: 3,
      monthlyHours: 10,
      maxOpenAsync: 3,
      responseDays: 3,
      "format-single-session": "on",
      "format-office-hours": "on",
      timeZone: "Asia/Manila",
    },
  });
  const mentorId = `${mentor.state.accountId}:mentor`;
  act(founder, {
    action: "send-request",
    id: mentorId,
    values: { ...mentorRequestValues, format: "single-session" },
  });
  const roomId = act(mentor, {
    action: "accept-request",
    id: `${founder.state.accountId}:founder`,
  }).activeRoomId;
  act(mentor, { action: "confirm-goal", activeRoomId: roomId });
  act(founder, {
    form: "schedule",
    activeRoomId: roomId,
    values: {
      date: "2031-03-04",
      time: "10:00",
      timeZone: "Asia/Manila",
      durationMinutes: 60,
    },
  });
  const feed = (u, selected) =>
    workspace.calendar(
      act(u, { action: "calendar-link" }).calendarToken,
      selected,
    );
  const [founderEvent] = icsEvents(feed(founder));
  const [mentorEvent] = icsEvents(feed(mentor));
  assert.equal(founderEvent.SUMMARY, "Mentorship with Marcus Webb");
  assert.equal(mentorEvent.SUMMARY, "Mentorship with Jordan Lee");
  // Asia/Manila 10:00 is 02:00 UTC; the hour-long session ends at 03:00.
  for (const event of [founderEvent, mentorEvent]) {
    assert.equal(event.DTSTART, "20310304T020000Z");
    assert.equal(event.DTEND, "20310304T030000Z");
    assert.match(event.UID, new RegExp(`^${roomId}-[^@]+@synergy$`));
  }
  assert.equal(founderEvent.UID, mentorEvent.UID);
  // The one-session file the room button downloads holds the same event.
  const sessionId = founderEvent.UID.slice(0, -"@synergy".length);
  assert.deepEqual(icsEvents(feed(founder, sessionId)), [founderEvent]);

  // Office Hours, booked by a second founder, are named as Office Hours.
  const second = user("Ana", "Cruz", "founder", {
    bio: "Inventory tools for cafes.",
    offer: "Product feedback",
    need: "Pricing strategy",
    industry: "SaaS",
    stage: "seed",
    teamSize: "4",
    startupName: "Stocklane",
  });
  act(mentor, {
    action: "open-office-slot",
    values: { date: "2031-03-06", time: "10:00", durationMinutes: 30 },
  });
  const [slot] = workspace
    .get(second.token, "founder")
    .state.directory.mentors.find((entry) => entry.id === mentorId).officeHours;
  act(second, {
    action: "book-office-hours",
    id: mentorId,
    values: {
      ...mentorRequestValues,
      slotId: slot.slotId,
      desiredOutcome: "Choose one pricing experiment.",
      date: "2031-03-06",
    },
  });
  const summaries = (u) => icsEvents(feed(u)).map((event) => event.SUMMARY);
  assert.deepEqual(summaries(second), ["Office Hours with Marcus Webb"]);
  assert.deepEqual(summaries(mentor).sort(), [
    "Mentorship with Jordan Lee",
    "Office Hours with Ana Cruz",
  ]);
});
