import { mentorRequestValues } from "./mentor-request-fixtures.js";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkspace, scoreProfile } from "../server/workspace.js";
import { encode, decode } from "../src/state/serialization.js";
import { moderationDueAt, trustSummary } from "../src/data/collaboration.js";
import { matchingReport } from "../src/data/matching.js";
import { dispatchOutbox, enqueueDelivery } from "../server/delivery.js";

const founder = {
  bio: "Building student tools",
  offer: "Technical development",
  need: "Beta testers",
  industry: "EdTech",
  stage: "idea",
  teamSize: "3",
};
const mentor = {
  bio: "Advising teams",
  offer: "Beta testers",
  need: "Focused questions",
  expertise: "Product feedback",
  availability: "Weekly",
  startups: "EdTech idea stage",
};
const terms = {
  goal: "Validate onboarding",
  scope: "Review the flow",
  timeline: "8 weeks",
  commitment: "Weekly call",
  compensation: "Voluntary",
};
function fixture(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-completion-"));
  const file = join(dir, "workspace.json");
  const clock = { value: Date.now() };
  const w = createWorkspace(file, {
    mentorApprovalRequired: false,
    adminEmails: ["moderator@example.com"],
    now: () => clock.value,
    ...options,
  });
  t.after(() => {
    w.close();
    rmSync(dir, { recursive: true });
  });
  const user = (name, role = "founder") => {
    const u = w.login(
      {
        firstName: name,
        lastName: "Test",
        email: `${name.toLowerCase()}@example.com`,
        password: "private-password",
        role,
      },
      true,
    );
    u.role = role;
    w.act(u.token, {
      role,
      form: "profile-form",
      values: role === "mentor" ? mentor : founder,
    });
    // New mentors accept the guidelines before taking requests (Phase 1).
    if (role === "mentor")
      w.act(u.token, {
        role,
        form: "accept-guidelines",
        values: { version: 2 },
      });
    return u;
  };
  const a = user("Founder"),
    b = user("Partner", options.mentorship ? "mentor" : "founder"),
    admin = user("Moderator");
  const act = (u, input) => {
    const room = w.get(u.token, u.role).state.rooms[input.activeRoomId];
    return w.act(u.token, {
      role: u.role,
      termsRevision: room?.terms.revision || 0,
      milestoneVersion: room?.milestones[input.id]?.contentVersion || 0,
      ...input,
    });
  };
  const verify = (u, decision = "verified") => {
    act(u, {
      form: "affiliation-request",
      values: {
        organization: "University referral",
        evidence: "Check cohort roster",
      },
    });
    return act(admin, {
      form: "moderation",
      values: {
        kind: "affiliation",
        id: u.state.accountId,
        decision,
        note:
          decision === "verified"
            ? "Roster confirmed"
            : "Please provide a current roster",
      },
    });
  };
  const pair = (format) => {
    if (b.role === "mentor")
      act(b, {
        form: "mentor-capacity",
        values: {
          maxMentees: 3,
          monthlyHours: 4,
          maxOpenAsync: 3,
          responseDays: 3,
          "format-single-session": "on",
          "format-ongoing-advisory": "on",
          timeZone: "Asia/Manila",
        },
      });
    act(a, {
      action: b.role === "mentor" ? "send-request" : "interest",
      id: `${b.state.accountId}:${b.role}`,
      values:
        b.role === "mentor"
          ? {
              ...mentorRequestValues,
              format:
                format === "ongoing" ? "ongoing-advisory" : "single-session",
            }
          : undefined,
    });
    const id = act(b, {
      action: b.role === "mentor" ? "accept-request" : "accept-interest",
      id: `${a.state.accountId}:founder`,
    }).state.activeRoomId;
    if (b.role === "mentor") {
      act(b, { action: "confirm-goal", activeRoomId: id });
      return id;
    }
    act(a, {
      action: "lock-terms",
      activeRoomId: id,
      values: { ...terms, ...(format ? { format } : {}) },
    });
    act(b, { action: "accept-terms", activeRoomId: id });
    return id;
  };
  const finish = (id, holdLast = false) => {
    if (options.mentorship)
      act(a, {
        form: "schedule",
        activeRoomId: id,
        values: {
          date: "2030-01-08",
          time: "10:00",
          timeZone: "Asia/Manila",
          count: "8",
          durationMinutes: "45",
        },
      });
    for (const [key, item] of Object.entries(
      w.get(a.token).state.rooms[id].milestones,
    )) {
      if (item.evidence)
        act(a, {
          form: "evidence",
          activeRoomId: id,
          id: key,
          values: { attachment: "Shared proof" },
        });
      act(a, { action: "confirm-milestone", activeRoomId: id, id: key });
      if (!(holdLast && key === "reviewed"))
        act(b, { action: "confirm-milestone", activeRoomId: id, id: key });
    }
  };
  return { w, file, clock, a, b, admin, act, verify, pair, finish };
}

test("verification gates sending and accepting; rejection explains why and moderator approval unlocks", (t) => {
  const { w, a, b, act, verify } = fixture(t, { requireVerification: true });
  const id = `${b.state.accountId}:founder`;
  assert.throws(
    () => act(a, { action: "interest", id }),
    /Verify your affiliation/,
  );
  act(a, { action: "save", id });
  assert.ok(w.get(a.token).state.savedByRole.founder.has(id));
  verify(a, "rejected");
  assert.equal(
    w.get(a.token).state.affiliation.note,
    "Please provide a current roster",
  );
  verify(a);
  act(a, { action: "interest", id });
  assert.throws(
    () =>
      act(b, { action: "accept-interest", id: `${a.state.accountId}:founder` }),
    /Verify your affiliation/,
  );
  verify(b);
  assert.ok(
    act(b, { action: "accept-interest", id: `${a.state.accountId}:founder` })
      .state.activeRoomId,
  );
});

test("verification remains opt-in and demo preview accounts are exempt", (t) => {
  const { pair } = fixture(t);
  assert.ok(pair());
  const { w } = fixture(t, { requireVerification: true, demoMode: true });
  const demo = w.openDemo("founder");
  const person = demo.state.directory.founders[0];
  assert.doesNotThrow(() =>
    w.act(demo.token, { role: "founder", action: "interest", id: person.id }),
  );
});

test("simulated verification approves only a pending request, and only when the flag is on", (t) => {
  const request = {
    form: "affiliation-request",
    values: { organization: "Demo cohort", evidence: "Demo roster" },
  };
  const off = fixture(t, { requireVerification: true });
  off.act(off.a, request);
  assert.throws(
    () => off.act(off.a, { action: "simulate-verification" }),
    /turned off/,
  );
  assert.equal(off.w.get(off.a.token).state.affiliation.status, "pending");
  assert.equal(
    off.w.get(off.a.token).state.integrations.simulateVerification,
    false,
  );

  const { w, a, b, act } = fixture(t, {
    requireVerification: true,
    simulateVerification: true,
  });
  assert.ok(w.get(a.token).state.integrations.simulateVerification);
  assert.throws(
    () => act(a, { action: "simulate-verification" }),
    /verification request first/,
  );
  act(a, request);
  act(a, { action: "simulate-verification" });
  const affiliation = w.get(a.token).state.affiliation;
  assert.equal(affiliation.status, "verified");
  assert.match(affiliation.note, /No moderator reviewed it/);
  assert.doesNotThrow(() =>
    act(a, { action: "interest", id: `${b.state.accountId}:founder` }),
  );
});

test("a moderator opening a verification request marks it seen, and an unreviewed one expires at its due date", (t) => {
  const { w, a, b, admin, act, clock } = fixture(t, {
    requireVerification: true,
  });
  act(a, {
    form: "affiliation-request",
    values: { organization: "University referral", evidence: "Roster link" },
  });
  const sent = w.get(a.token).state.affiliation;
  assert.equal(sent.status, "pending");
  assert.equal(sent.seenAt, undefined);
  assert.ok(Date.parse(sent.dueAt) > Date.parse(sent.requestedAt));
  // Only moderators can mark a request seen.
  assert.throws(
    () => act(b, { action: "affiliation-seen", id: a.state.accountId }),
    /Moderator access required/,
  );
  act(admin, { action: "affiliation-seen", id: a.state.accountId });
  const seen = w.get(a.token).state.affiliation.seenAt;
  assert.ok(seen);
  // The first opening counts; opening it again keeps that time.
  clock.value += 60000;
  act(admin, { action: "affiliation-seen", id: a.state.accountId });
  assert.equal(w.get(a.token).state.affiliation.seenAt, seen);

  // Past the due date with no decision, the request expires and says so.
  act(b, {
    form: "affiliation-request",
    values: { organization: "Founder community", evidence: "Organizer email" },
  });
  clock.value = Date.parse(w.get(b.token).state.affiliation.dueAt) + 1000;
  const expired = w.get(b.token).state;
  assert.equal(expired.affiliation.status, "expired");
  assert.equal(expired.verification, "expired");
  assert.ok(
    expired.notifications.some((item) =>
      /verification request expired/.test(item.text),
    ),
  );
  // It leaves the moderation queue, and a new request can be sent.
  assert.ok(
    !w
      .get(admin.token)
      .state.moderation.affiliations.some(
        (item) => item.accountId === b.state.accountId,
      ),
  );
  act(b, {
    form: "affiliation-request",
    values: { organization: "Founder community", evidence: "Organizer email" },
  });
  assert.equal(w.get(b.token).state.affiliation.status, "pending");
});

test("all five factors are symmetric for 400 seeded random founder and mentor pairs", () => {
  let seed = 419;
  const random = () =>
    (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const words = [
    "",
    "FinTech",
    "EdTech campus",
    "technical beta",
    "growth audience design",
    "early access feedback",
  ];
  const pick = () => words[Math.floor(random() * words.length)];
  const profile = () => ({
    bio: pick(),
    need: pick(),
    offer: pick(),
    industry: pick(),
    stage: pick(),
    teamSize: String(Math.floor(random() * 20)),
    audienceSize: String(Math.floor(random() * 50000)),
    goals: pick(),
    engagementPreference: ["", "ongoing", "one-off", "either"][
      Math.floor(random() * 4)
    ],
  });
  for (let i = 0; i < 400; i++) {
    const a = profile(),
      b = profile();
    if (i % 2)
      Object.assign(b, {
        expertise: pick(),
        startups: pick(),
        availability: pick(),
      });
    const forward = scoreProfile(a, b, Boolean(i % 2)),
      reverse = scoreProfile(b, a, Boolean(i % 2));
    assert.equal(forward.score, reverse.score, `pair ${i}`);
    assert.deepEqual(
      forward.factorScores,
      reverse.factorScores,
      `factors ${i}`,
    );
    assert.deepEqual(forward.directionalFit, {
      yourNeeds: reverse.directionalFit.theirNeeds,
      theirNeeds: reverse.directionalFit.yourNeeds,
    });
  }
});

test("last mutual confirmation launches atomically, notifies both, and undo enforces time and reviews", (t) => {
  const { w, a, b, act, pair, finish, clock } = fixture(t);
  const id = pair();
  finish(id);
  const get = (u) => w.get(u.token).state.rooms[id];
  assert.equal(get(a).status, "launched");
  assert.equal(get(a).launchedAt, get(b).launchedAt);
  for (const u of [a, b])
    assert.ok(
      w
        .get(u.token)
        .state.notifications.some(
          (n) => n.roomId === id && n.kind === "review",
        ),
    );
  const launchedAt = get(a).launchedAt;
  act(a, { action: "launch-room", activeRoomId: id });
  assert.equal(get(a).launchedAt, launchedAt);
  act(b, { action: "undo-launch", activeRoomId: id });
  assert.equal(get(a).status, "in-progress");
  assert.equal(get(a).launchedAt, undefined);
  for (const u of [a, b])
    act(u, { action: "confirm-milestone", activeRoomId: id, id: "issues" });
  clock.value += 86400000;
  assert.throws(
    () => act(a, { action: "undo-launch", activeRoomId: id }),
    /24 hours/,
  );
  clock.value -= 86400000;
  act(a, { form: "review-form", activeRoomId: id, values: { rating: "5" } });
  assert.throws(
    () => act(b, { action: "undo-launch", activeRoomId: id }),
    /before either review/,
  );
});

test("ongoing advisory reserves check-ins and uses blind cycle reviews for continuation and finish", (t) => {
  const { a, b, w, act, pair, clock } = fixture(t, { mentorship: true });
  const activeRoomId = pair("ongoing");
  const room = (u) => w.get(u.token, u.role).state.rooms[activeRoomId];
  assert.equal(room(b).cycle.checkIns, 4);
  const date = new Date(clock.value + 2 * 86400000).toISOString().slice(0, 10);
  act(a, {
    form: "propose-check-in-time",
    activeRoomId,
    values: { date, time: "10:00", timeZone: "Asia/Manila" },
  });
  act(b, { action: "confirm-check-in-time", activeRoomId });
  const sessions = room(a).milestones.checkins.schedules;
  assert.equal(sessions.length, 4);
  assert.equal(
    Date.parse(sessions[1].startsAt) - Date.parse(sessions[0].startsAt),
    14 * 86400000,
  );
  for (const [scheduleIndex, session] of sessions.entries()) {
    clock.value = Date.parse(session.startsAt) + 60000;
    for (const u of [a, b])
      act(u, {
        action: "report-attendance",
        activeRoomId,
        values: { scheduleIndex, status: "held" },
      });
  }
  assert.equal(room(a).cycle.phase, "review");
  act(a, {
    form: "cycle-review",
    activeRoomId,
    values: { rating: 4, note: "Private founder rating" },
  });
  assert.equal(room(b).cycle.reviews[a.state.accountId], undefined);
  act(b, { form: "cycle-review", activeRoomId, values: { rating: 5 } });
  assert.equal(room(b).cycle.reviews[a.state.accountId].rating, 4);
  for (const u of [a, b])
    act(u, {
      action: "cycle-decision",
      activeRoomId,
      values: { decision: "continue" },
    });
  assert.equal(room(a).cycle.number, 2);
  assert.equal(room(a).cycleHistory.length, 1);
  act(a, {
    action: "end-mentorship",
    activeRoomId,
    values: { reason: "The founder has a clear path forward." },
  });
  assert.equal(room(b).status, "launched");
  assert.equal(w.get(b.token, b.role).state.mentorUsage.activeMentees, 0);
});

test("single session attendance resolves after silence and a late follow-up lifts the limit", (t) => {
  const { a, b, w, act, pair, clock } = fixture(t, { mentorship: true });
  const activeRoomId = pair("one-off");
  const date = new Date(clock.value + 2 * 86400000).toISOString().slice(0, 10);
  act(a, {
    form: "schedule",
    activeRoomId,
    values: {
      date,
      time: "10:00",
      timeZone: "Asia/Manila",
      durationMinutes: 45,
    },
  });
  const session = w.get(a.token, a.role).state.rooms[activeRoomId].milestones
    .held.schedules[0];
  clock.value = Date.parse(session.startsAt) + 4 * 86400000;
  assert.equal(
    w.get(a.token, a.role).state.rooms[activeRoomId].milestones.held
      .schedules[0].outcome,
    "held",
  );
  assert.equal(w.get(b.token, b.role).state.mentorUsage.activeMentees, 0);
  clock.value += 22 * 86400000;
  assert.equal(w.get(a.token, a.role).state.mentorRequestLimit, 1);
  act(a, {
    action: "submit-followup",
    activeRoomId,
    values: { summary: "Our new flow improved completion." },
  });
  assert.equal(w.get(a.token, a.role).state.mentorRequestLimit, 3);
});

test("quiet-deal reminders use an injected clock and needs-reply alerts stay immediate", (t) => {
  const { w, a, b, act, pair, clock } = fixture(t);
  const id = pair();
  assert.equal(w.get(a.token).state.notificationPreferences.digest, "weekly");
  assert.ok(
    !w.get(a.token).state.notifications.some((n) => n.id.startsWith("quiet:")),
  );
  clock.value += 14 * 86400000 + 1000;
  assert.ok(
    w.get(a.token).state.notifications.some((n) => n.id.startsWith("quiet:")),
  );
  // A terms-equivalent milestone is confirmed with the terms; use the first
  // open milestone that needs no evidence.
  const [open] = Object.entries(w.get(a.token).state.rooms[id].milestones).find(
    ([, item]) => !item.me && !item.evidence,
  );
  act(a, { action: "confirm-milestone", activeRoomId: id, id: open });
  const reply = w
    .get(b.token)
    .state.notifications.find((n) => n.id.startsWith("confirm:"));
  assert.equal(reply.digested, false);
  assert.equal(reply.read, false);
});

test("moderation deadlines skip weekends, are mirrored and become overdue with a clock", (t) => {
  assert.equal(
    moderationDueAt("2026-11-06T12:00:00Z"),
    "2026-11-11T12:00:00.000Z",
  );
  const { w, a, b, admin, act, pair, clock } = fixture(t);
  const id = pair();
  act(b, {
    action: "dispute",
    activeRoomId: id,
    id: "scope",
    values: { reason: "Criteria missing" },
  });
  assert.throws(
    () => act(a, { action: "withdraw-dispute", activeRoomId: id, id: "scope" }),
    /Only the person/,
  );
  act(b, { action: "withdraw-dispute", activeRoomId: id, id: "scope" });
  assert.equal(w.get(a.token).state.rooms[id].milestones.scope.disputed, false);
  act(b, {
    action: "dispute",
    activeRoomId: id,
    id: "scope",
    values: { reason: "Still missing" },
  });
  act(a, { action: "escalate-dispute", activeRoomId: id, id: "scope" });
  const due = w.get(a.token).state.rooms[id].milestones.scope.dispute.dueAt;
  assert.equal(
    due,
    w.get(b.token).state.rooms[id].milestones.scope.dispute.dueAt,
  );
  clock.value = Date.parse(due) + 1;
  assert.equal(w.get(admin.token).state.moderation.reports[0].overdue, true);
});

test("five identical released ratings raise the uniform-rating safeguard", () => {
  const rooms = Object.fromEntries(
    Array.from({ length: 5 }, (_, i) => [
      String(i),
      {
        id: String(i),
        role: "founder",
        partnerAccountId: String(i),
        status: "reviewed",
        review: { me: true, partner: true, partnerRating: 5 },
      },
    ]),
  );
  assert.match(trustSummary(rooms, "founder").ratingPattern, /Uniform ratings/);
  assert.equal(trustSummary(rooms, "founder").distinctReviewers, 5);
});

test("blocking mid-deal closes both rooms and denies further contact", (t) => {
  const { w, a, b, act, pair } = fixture(t);
  const id = pair();
  w.accounts.block(a.token, b.state.accountId, true);
  assert.equal(w.get(b.token).state.rooms[id].status, "cancelled");
  assert.throws(
    () =>
      act(b, {
        form: "chat-form",
        activeRoomId: id,
        values: { message: "Contact" },
      }),
    /Further contact/,
  );
});

test("old launched rooms backfill timestamps, expire and preserve matching algorithm cohorts", (t) => {
  const { w, file, a, b, pair, finish } = fixture(t);
  const id = pair();
  finish(id);
  w.close();
  const db = decode(readFileSync(file, "utf8"));
  for (const u of [a, b]) {
    const room = db.accounts[u.state.accountId].state.rooms[id];
    delete room.launchedAt;
    room.updatedAt = "2026-01-01T00:00:00Z";
  }
  db.accounts[b.state.accountId].state.rooms.old = {
    ...structuredClone(db.accounts[b.state.accountId].state.rooms[id]),
    id: "old",
    matchingSnapshot: {
      ...db.accounts[b.state.accountId].state.rooms[id].matchingSnapshot,
      algorithm: "reciprocal-v2",
    },
  };
  assert.deepEqual(
    new Set(matchingReport(db.accounts).cohorts.map((c) => c.algorithm)),
    new Set(["reciprocal-v2", "reciprocal-v3"]),
  );
  writeFileSync(file, encode(db));
  const restarted = createWorkspace(file);
  try {
    const restored = restarted.login({
      email: "founder@example.com",
      password: "private-password",
    }).state.rooms[id];
    assert.equal(restored.status, "reviewed");
    assert.equal(restored.launchedAt, "2026-01-01T00:00:00Z");
  } finally {
    restarted.close();
  }
});

test("a moderator resolves conflicting attendance statements for both participants", (t) => {
  const { a, b, admin, w, act, pair, clock } = fixture(t, { mentorship: true });
  const activeRoomId = pair("one-off");
  const date = new Date(clock.value + 2 * 86400000).toISOString().slice(0, 10);
  act(a, {
    form: "schedule",
    activeRoomId,
    values: { date, time: "10:00", timeZone: "Asia/Manila" },
  });
  const session = w.get(a.token, a.role).state.rooms[activeRoomId].milestones
    .held.schedules[0];
  clock.value = Date.parse(session.startsAt) + 60000;
  act(a, {
    action: "report-attendance",
    activeRoomId,
    values: { scheduleIndex: 0, status: "held" },
  });
  act(b, {
    action: "report-attendance",
    activeRoomId,
    values: { scheduleIndex: 0, status: "partner-absent" },
  });
  assert.equal(
    w.get(admin.token, admin.role).state.moderation.sessionDisputes.length,
    1,
  );
  assert.throws(
    () =>
      act(a, { action: "resolve-session-dispute", activeRoomId, values: {} }),
    /Moderator access/,
  );
  act(admin, {
    action: "resolve-session-dispute",
    activeRoomId,
    values: { accountId: b.state.accountId, scheduleIndex: 0, outcome: "held" },
  });
  for (const partner of [a, b])
    assert.equal(
      w.get(partner.token, partner.role).state.rooms[activeRoomId].milestones
        .held.schedules[0].outcome,
      "held",
    );
});

test("fictional preview acceptance opens a v4 room with its request goal", (t) => {
  const { w, act } = fixture(t, { demoMode: true });
  const demo = w.openDemo("founder");
  demo.role = "founder";
  const mentor = demo.state.directory.mentors.find((person) =>
    person.availableFormats.includes("single-session"),
  );
  act(demo, {
    action: "send-request",
    id: mentor.id,
    values: mentorRequestValues,
  });
  const accepted = act(demo, {
    action: "simulate-acceptance",
    id: mentor.id,
  }).state;
  const room = accepted.rooms[accepted.activeRoomId];
  assert.equal(room.template.version, 4);
  assert.equal(room.terms.draft.goal, mentorRequestValues.question);
  assert.equal(room.review.me, false);
  assert.equal(room.review.partner, false);
});

test("outbox is durable and idempotent, stub never reports delivery, sender can be injected", async () => {
  const db = {};
  const item = {
    key: "review:one",
    accountId: "a",
    kind: "review",
    payload: { text: "Review now" },
  };
  assert.equal(enqueueDelivery(db, item, 0), true);
  assert.equal(enqueueDelivery(db, item, 0), false);
  await dispatchOutbox(db);
  assert.equal(db.outbox[0].status, "pending");
  assert.match(db.outbox[0].lastError, /not configured/);
  await dispatchOutbox(db, async () => ({ delivered: true }));
  assert.equal(db.outbox[0].status, "sent");
});
