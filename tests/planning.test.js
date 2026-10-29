import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarEvents,
  localDateKey,
  monthCells,
  shiftCalendarDate,
  calendarKeyDate,
  weeklySchedules,
  monthEvents,
  zonedDateKey,
} from "../src/data/planning.js";
import { validateSchedule } from "../src/state/validation.js";
import { execFileSync } from "node:child_process";
import { scheduleInstant } from "../src/data/selectors.js";
import { applyRoute, parseRoute, routeHash } from "../src/state/routes.js";
import { createInitialState } from "../src/data/model.js";

test("calendar combines active role sessions, incomplete tasks and unconfirmed milestones", () => {
  const schedule = {
    date: "2035-04-01",
    time: "23:30",
    timeZone: "America/Los_Angeles",
  };
  const room = {
    id: "shared",
    role: "founder",
    status: "in-progress",
    milestones: {
      session: { schedules: [schedule] },
      scope: {
        title: "Agree scope",
        dueDate: "2035-03-31",
        me: true,
        partner: false,
      },
      finished: {
        title: "Finished milestone",
        dueDate: "2035-04-01",
        me: true,
        partner: true,
      },
    },
    tasks: [
      {
        id: "task-a",
        title: "Draft brief",
        status: "doing",
        dueDate: "2035-04-01",
      },
      {
        id: "task-b",
        title: "Finished task",
        status: "done",
        dueDate: "2035-04-01",
      },
      { id: "task-c", title: "No deadline", status: "todo" },
    ],
  };
  const events = calendarEvents({
    role: "founder",
    rooms: {
      shared: room,
      closed: { ...room, id: "closed", status: "cancelled" },
      launched: { ...room, id: "launched", status: "launched" },
      otherRole: { ...room, id: "otherRole", role: "mentor" },
    },
  });
  assert.equal(events.length, 3);
  assert.equal(events[0].title, "Agree scope");
  assert.equal(events.find((event) => event.kind === "task").tab, "tasks");
  const event = events.find((item) => item.kind === "session");
  assert.equal(event.date, localDateKey(scheduleInstant(schedule)));
  assert.equal(event.instant.toISOString(), "2035-04-02T06:30:00.000Z");
  assert.equal(event.tab, "schedule");
  assert.deepEqual(calendarEvents({ role: "founder", rooms: {} }), []);
});

test("calendar supports direct links and authenticated route restoration", () => {
  assert.deepEqual(parseRoute("#/calendar"), { page: "calendar" });
  const state = createInitialState();
  state.authenticated = true;
  applyRoute(state, parseRoute("#/calendar"));
  assert.equal(state.page, "calendar");
  assert.equal(routeHash(state), "#/calendar");
});

test("month grids have complete aligned weeks for four, five and six occupied rows", () => {
  for (const [year, month, rows] of [
    [2021, 1, 4],
    [2026, 3, 5],
    [2021, 4, 6],
  ]) {
    const grid = monthCells(new Date(year, month, 1));
    assert.equal(grid.length, rows);
    assert.ok(grid.every((week) => week.length === 7));
    assert.ok(
      grid.every(
        (week) => week[0].date.getDay() === 1 && week[6].date.getDay() === 0,
      ),
    );
    assert.equal(
      grid.flat().filter((day) => day.inMonth).length,
      new Date(year, month + 1, 0).getDate(),
    );
    assert.equal(new Set(grid.flat().map((day) => day.key)).size, rows * 7);
    assert.equal(
      monthCells(new Date(year, month, 1), true).length,
      6,
      "picker stays six rows high",
    );
  }
});

test("calendar keyboard movement crosses month, year and leap boundaries without skipping dates", () => {
  assert.equal(calendarKeyDate("2026-12-31", "ArrowRight"), "2027-01-01");
  assert.equal(calendarKeyDate("2027-01-01", "ArrowLeft"), "2026-12-31");
  assert.equal(calendarKeyDate("2026-10-29", "Home"), "2026-10-26");
  assert.equal(calendarKeyDate("2026-10-29", "End"), "2026-11-01");
  assert.equal(calendarKeyDate("2028-01-31", "PageDown"), "2028-02-29");
  assert.equal(calendarKeyDate("2028-02-29", "PageDown", true), "2029-02-28");
  assert.equal(calendarKeyDate("2026-10-29", "ArrowUp"), "2026-10-22");
  assert.equal(calendarKeyDate("2026-10-29", "Enter"), null);
  assert.equal(shiftCalendarDate("2026-12-31", { days: 1 }), "2027-01-01");
});

test("weekly sessions preserve local clock times and duration across daylight-saving changes", () => {
  const spring = weeklySchedules(
    {
      date: "2027-03-07",
      time: "10:00",
      timeZone: "America/New_York",
      durationMinutes: 45,
    },
    2,
  );
  assert.deepEqual(
    spring.map((schedule) => scheduleInstant(schedule).toISOString()),
    ["2027-03-07T15:00:00.000Z", "2027-03-14T14:00:00.000Z"],
  );
  assert.ok(spring.every((schedule) => schedule.durationMinutes === 45));
  const fall = weeklySchedules(
    { date: "2027-10-31", time: "10:00", timeZone: "America/New_York" },
    2,
  );
  assert.deepEqual(
    fall.map((schedule) => scheduleInstant(schedule).toISOString()),
    ["2027-10-31T14:00:00.000Z", "2027-11-07T15:00:00.000Z"],
  );
  assert.equal(
    scheduleInstant({
      date: "2027-01-01",
      time: "00:15",
      timeZone: "Asia/Kolkata",
    }).toISOString(),
    "2026-12-31T18:45:00.000Z",
  );
});

test("schedule validation rejects clock gaps, gaps later in a series and unsupported durations", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const gap = {
    date: "2027-03-14",
    time: "02:30",
    timeZone: "America/New_York",
  };
  assert.ok(Number.isNaN(scheduleInstant(gap).getTime()));
  assert.ok(validateSchedule(gap, now).time);
  assert.ok(
    validateSchedule({ ...gap, date: "2027-03-07", count: "2" }, now).time,
  );
  const valid = { ...gap, time: "10:00", count: "3", durationMinutes: "45" };
  assert.deepEqual(validateSchedule(valid, now), {});
  assert.ok(
    validateSchedule({ ...valid, durationMinutes: 0 }, now).durationMinutes,
  );
  assert.ok(
    validateSchedule({ ...valid, durationMinutes: "500" }, now).durationMinutes,
  );
  assert.ok(validateSchedule({ ...valid, count: "13" }, now).count);
  assert.ok(validateSchedule({ ...valid, count: 0 }, now).count);
  assert.deepEqual(
    validateSchedule({ ...valid, durationMinutes: undefined }, now),
    {},
    "legacy duration is optional",
  );
});

test("session display dates change with viewer timezone while deadline dates stay fixed", () => {
  assert.equal(
    zonedDateKey(new Date("2027-01-01T02:00:00Z"), "America/Los_Angeles"),
    "2026-12-31",
  );
  const source = `import {calendarEvents} from './src/data/planning.js';
    const events=calendarEvents({role:'founder',rooms:{r:{id:'r',role:'founder',status:'in-progress',milestones:{session:{schedule:{date:'2035-04-01',time:'23:30',timeZone:'America/Los_Angeles',durationMinutes:30}},scope:{title:'Scope',dueDate:'2035-04-01'}},tasks:[{id:'t',title:'Task',dueDate:'2035-04-01',status:'todo'}]}}});
    process.stdout.write(JSON.stringify(Object.fromEntries(events.map(e=>[e.kind,e.date]))));`;
  const results = {};
  for (const zone of ["Asia/Manila", "America/Los_Angeles"])
    results[zone] = JSON.parse(
      execFileSync(process.execPath, ["--input-type=module", "-e", source], {
        env: { ...process.env, TZ: zone },
        encoding: "utf8",
      }),
    );
  assert.equal(results["Asia/Manila"].session, "2035-04-02");
  assert.equal(results["America/Los_Angeles"].session, "2035-04-01");
  for (const result of Object.values(results)) {
    assert.equal(result.milestone, "2035-04-01");
    assert.equal(result.task, "2035-04-01");
  }
  assert.deepEqual(
    monthEvents(
      [{ date: "2027-01-01" }, { date: "2026-12-31" }, { date: "2026-12-31" }],
      new Date(2026, 11, 1),
    ).map(([day, items]) => [day, items.length]),
    [["2026-12-31", 2]],
  );
});
