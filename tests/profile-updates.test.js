import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import {
  groupNotifications,
  relativeTime,
  notificationDestination,
} from "../src/data/notifications.js";
import { fitFactors, fitSummary } from "../src/data/profile-presentation.js";
import { createWorkspace } from "../server/workspace.js";
import { createModel } from "../src/data/model.js";
import { readWorkspaceSnapshot } from "../server/storage.js";
import { createFeatures } from "../server/features.js";
import { createInitialState } from "../src/data/model.js";

test("fit presentation distinguishes true zero, missing inputs and unavailable data", () => {
  const factors = [
    ["Need Fit", 0],
    ["Industry Fit", 2],
    ["Goal Fit", 4],
  ];
  const person = {
    score: 0,
    why: ["No overlap", "", "Missing inputs"],
    factorScores: [0, 0, 0],
  };
  const rows = fitFactors(person, factors);
  assert.equal(rows[0].status, "No overlap");
  assert.equal(rows[0].score, 0);
  assert.equal(rows[1].status, "Missing information");
  assert.equal(rows[1].score, null);
  assert.equal(rows[2].status, "Details unavailable");
  assert.equal(rows[2].score, null);
  assert.match(
    fitSummary(person, factors),
    /Neither profile clearly offers what the other needs/,
  );
  assert.match(fitSummary({}, factors), /not enough information/);
  assert.equal(
    fitFactors({ factorScores: [NaN, -1, 120] }, [
      ["A", 0],
      ["B", 1],
      ["C", 2],
    ]).every((row) => row.score === null),
    true,
  );
  assert.match(
    fitSummary({ score: 70, factorScores: [80] }, [["Need Fit", 0]]),
    /needs and their offers overlap/,
  );
});

test("updates group by local calendar day and handle missing times without invented dates", () => {
  const now = new Date(2026, 9, 29, 12).getTime();
  const iso = (day, hour) => new Date(2026, 9, day, hour).toISOString();
  const groups = groupNotifications(
    [
      { id: "earlier", timestamp: iso(27, 23) },
      { id: "missing" },
      { id: "yesterday", timestamp: iso(28, 23) },
      { id: "older-today", timestamp: iso(29, 8) },
      { id: "new-today", timestamp: iso(29, 11) },
    ],
    now,
  );
  assert.deepEqual(
    groups.map(([group]) => group),
    ["Today", "Yesterday", "Earlier", "Date unavailable"],
  );
  assert.deepEqual(
    groups[0][1].map((item) => item.id),
    ["new-today", "older-today"],
  );
  assert.equal(relativeTime(iso(29, 12), now), "Just now");
  assert.equal(relativeTime(iso(29, 11), now), "1 hour ago");
  assert.equal(relativeTime(undefined, now), "Time unavailable");
  assert.equal(
    groupNotifications([{ timestamp: null }], now)[0][0],
    "Date unavailable",
  );
  const boundary = new Date(2027, 0, 1, 0, 5).getTime();
  assert.equal(
    groupNotifications(
      [{ timestamp: new Date(2026, 11, 31, 23, 59).toISOString() }],
      boundary,
    )[0][0],
    "Yesterday",
  );
});

test("session reminder creation is stable and separate from the scheduled instant", (t) => {
  const now = Date.parse("2026-10-29T12:00:00Z");
  t.mock.method(Date, "now", () => now);
  const state = createInitialState();
  const room = createModel(state).createRoom({
    id: "session-room",
    role: "founder",
    partnerId: "mentor",
    type: "mentorship",
    status: "in-progress",
  });
  room.milestones.session.schedule = {
    date: "2026-10-30",
    time: "10:00",
    utcOffset: 0,
    timeZone: "UTC",
  };
  state.rooms[room.id] = room;
  const account = { id: "viewer" };
  const database = { accounts: {}, reports: [] };
  const features = createFeatures({
    getDb: () => database,
    options: {},
  });
  const first = features
    .decorate(account, state)
    .notifications.find((item) => item.sessionAt);
  assert.equal(first.sessionAt, "2026-10-30T10:00:00.000Z");
  assert.equal(first.timestamp, "2026-10-29T12:00:00.000Z");
  assert.equal(first.tab, "schedule");
  assert.equal(features.rememberNotifications(account, state), true);
  t.mock.method(Date, "now", () => now + 3600000);
  const repeated = features
    .decorate(account, state)
    .notifications.find((item) => item.id === first.id);
  assert.equal(repeated.timestamp, first.timestamp);
  assert.equal(repeated.sessionAt, first.sessionAt);
  assert.equal(features.rememberNotifications(account, state), false);
});

test("update destinations check visibility and role membership with useful fallbacks", () => {
  const state = {
    role: "founder",
    rooms: {
      one: { id: "one", role: "founder", partnerId: "p" },
      other: { id: "other", role: "mentor" },
    },
  };
  const people = [
    { id: "p", name: "Partner", sector: "EdTech" },
    { id: "q", name: "Other", sector: "SaaS" },
  ];
  assert.equal(
    notificationDestination({ roomId: "one", tab: "milestones" }, state, people)
      .command.tab,
    "milestones",
  );
  assert.equal(
    notificationDestination({ roomId: "one", kind: "review" }, state, people)
      .command.review,
    true,
  );
  assert.equal(
    notificationDestination({ roomId: "other" }, state, people).command.page,
    "rooms",
  );
  assert.equal(
    notificationDestination({ roomId: "missing" }, state, people).label,
    "View Deal Rooms",
  );
  // Round 3: a match update for someone you already have a room with opens it.
  assert.deepEqual(notificationDestination({ matchId: "p" }, state, people), {
    label: "Open Deal Room",
    context: "With Partner",
    command: { action: "open-room", id: "one" },
  });
  assert.equal(
    notificationDestination({ matchId: "q" }, state, people).label,
    "View match",
  );
  assert.equal(
    notificationDestination({ matchId: "hidden" }, state, people).command.page,
    "discover",
  );
  assert.equal(
    notificationDestination({ kind: "activity" }, state, people).command,
    undefined,
  );
});

test("generated match timestamps and read state survive polling, role changes and restart", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "synergy-update-times-"));
  const file = join(dir, "workspace.sqlite");
  t.after(() => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  const w = createWorkspace(file, { demoMode: true });
  const viewer = w.openDemo("founder");
  const first = viewer.state.notifications.find(
    (item) => item.kind === "match",
  );
  assert.ok(first);
  const firstTime = first.timestamp;
  const firstNow = Date.now();
  t.mock.method(Date, "now", () => firstNow + 3600000);
  let read = w.act(viewer.token, {
    role: "founder",
    action: "read-notifications",
    id: first.id,
  });
  assert.equal(
    read.state.notifications.find((item) => item.id === first.id).read,
    true,
  );
  assert.equal(
    read.state.notifications.find((item) => item.id === first.id).timestamp,
    firstTime,
  );
  w.get(viewer.token, "mentor");
  const restored = w.get(viewer.token, "founder");
  assert.equal(
    restored.state.notifications.find((item) => item.id === first.id).timestamp,
    firstTime,
  );
  assert.equal(
    w.poll(viewer.token, "founder", restored.revision, restored.refreshKey)
      .unchanged,
    true,
  );
  const profile = createModel(restored.state)
    .rolePeople()
    .find((person) => person.kind === "Mentor");
  assert.ok(profile.expertise);
  assert.ok(profile.startups);
  w.close();
  const restarted = createWorkspace(file, { demoMode: true });
  try {
    const other = restarted.openDemo("founder");
    assert.equal(
      other.state.notifications.find((item) => item.id === first.id).read,
      true,
      "weekly digests collect new-account match alerts without unread noise",
    );
    // Preview sessions intentionally expire at restart, so read the persisted
    // account through its stored ledger rather than inventing a login shortcut.
    const persisted =
      readWorkspaceSnapshot(file).accounts[viewer.state.accountId];
    assert.equal(
      persisted.notificationCreatedAt[`founder:${first.id}`],
      firstTime,
    );
    assert.ok(persisted.readNotifications.includes(first.id));
  } finally {
    restarted.close();
  }
});
