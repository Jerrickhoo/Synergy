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
    act(a, { action: "interest", id: `${b.state.accountId}:${b.role}` });
    const id = act(b, {
      action: "accept-interest",
      id: `${a.state.accountId}:founder`,
    }).state.activeRoomId;
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

test("ongoing mentorship runs weekly series, blind cycle reviews, consensus continuation and finish", (t) => {
  const { w, a, b, act, pair, finish } = fixture(t, { mentorship: true });
  const id = pair("ongoing");
  const details = () =>
    act(a, {
      form: "cycle-details",
      activeRoomId: id,
      values: {
        goals: "Validate next flow",
        summary: "Reviewed onboarding and assigned actions",
      },
    });
  details();
  finish(id);
  let room = w.get(a.token).state.rooms[id];
  assert.equal(room.status, "in-progress");
  assert.equal(room.cycle.phase, "review");
  assert.equal(room.milestones.session.schedules.length, 8);
  act(a, {
    form: "cycle-review",
    activeRoomId: id,
    values: { rating: "4", note: "Private cycle feedback" },
  });
  assert.equal(
    w.get(b.token, b.role).state.rooms[id].cycle.reviews[a.state.accountId],
    undefined,
  );
  assert.throws(
    () =>
      act(a, {
        action: "cycle-decision",
        activeRoomId: id,
        values: { decision: "continue" },
      }),
    /Both private/,
  );
  act(b, {
    form: "cycle-review",
    activeRoomId: id,
    values: { rating: "5", note: "Helpful cycle" },
  });
  for (const u of [a, b])
    act(u, {
      action: "cycle-decision",
      activeRoomId: id,
      values: { decision: "continue" },
    });
  room = w.get(a.token).state.rooms[id];
  assert.equal(room.cycle.number, 2);
  assert.equal(room.cycleHistory.length, 1);
  assert.equal(room.cycleHistory[0].milestones.session.schedules.length, 8);
  assert.equal(
    room.cycleHistory[0].milestones.guidance.attachment,
    "Shared proof",
  );
  assert.equal(
    room.cycleHistory[0].reviews[b.state.accountId].note,
    "Helpful cycle",
  );
  assert.equal(room.milestones.session.schedule, undefined);
  details();
  finish(id);
  for (const u of [a, b])
    act(u, { form: "cycle-review", activeRoomId: id, values: { rating: "4" } });
  act(a, {
    action: "cycle-decision",
    activeRoomId: id,
    values: { decision: "finish" },
  });
  assert.equal(w.get(a.token).state.rooms[id].status, "in-progress");
  act(b, {
    action: "cycle-decision",
    activeRoomId: id,
    values: { decision: "continue" },
  });
  assert.equal(w.get(a.token).state.rooms[id].status, "launched");
  for (const u of [a, b])
    act(u, { form: "review-form", activeRoomId: id, values: { rating: "5" } });
  assert.equal(w.get(a.token).state.rooms[id].status, "reviewed");
});

test("one-off mentorship completes automatically after an eight-session weekly series", (t) => {
  const { w, a, pair, finish } = fixture(t, { mentorship: true });
  const id = pair("one-off");
  finish(id);
  assert.equal(w.get(a.token).state.rooms[id].status, "launched");
  assert.equal(w.get(a.token).state.rooms[id].cycle, undefined);
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
  act(a, { action: "confirm-milestone", activeRoomId: id, id: "scope" });
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

test("a moderator's final confirmation opens an ongoing cycle review for both participants", (t) => {
  const { w, a, b, admin, act, pair, finish } = fixture(t, {
    mentorship: true,
  });
  const id = pair("ongoing");
  act(a, {
    form: "cycle-details",
    activeRoomId: id,
    values: {
      goals: "Validate onboarding",
      summary: "Session and next steps recorded",
    },
  });
  finish(id, true);
  act(b, {
    action: "dispute",
    activeRoomId: id,
    id: "reviewed",
    values: { reason: "Confirm the reflection" },
  });
  act(a, { action: "escalate-dispute", activeRoomId: id, id: "reviewed" });
  const report = w.get(admin.token).state.moderation.reports[0];
  act(admin, {
    form: "moderation",
    values: {
      kind: "report",
      id: report.id,
      decision: "resolved",
      note: "Reflection evidence confirmed",
      remedy: "confirm-milestone",
    },
  });
  for (const u of [a, b])
    assert.equal(w.get(u.token, u.role).state.rooms[id].cycle.phase, "review");
});

test("fictional preview partners review cycles and respond to Continue and Finish", (t) => {
  const { w, act } = fixture(t, { demoMode: true });
  const demo = w.openDemo("founder");
  demo.role = "founder";
  const person = demo.state.directory.mentors[0];
  act(demo, {
    action: "interest",
    id: person.id,
    engagementType: "mentorship",
  });
  const id = act(demo, { action: "simulate-acceptance", id: person.id }).state
    .activeRoomId;
  act(demo, {
    action: "lock-terms",
    activeRoomId: id,
    values: { ...terms, format: "ongoing" },
  });
  for (const decision of ["continue", "finish"]) {
    act(demo, {
      form: "cycle-details",
      activeRoomId: id,
      values: {
        goals: "Validate onboarding",
        summary: "Shared check-in summary",
      },
    });
    act(demo, {
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
      w.get(demo.token).state.rooms[id].milestones,
    )) {
      if (item.evidence)
        act(demo, {
          form: "evidence",
          activeRoomId: id,
          id: key,
          values: { attachment: "Prototype proof" },
        });
      act(demo, { action: "confirm-milestone", activeRoomId: id, id: key });
    }
    act(demo, {
      form: "cycle-review",
      activeRoomId: id,
      values: { rating: "4" },
    });
    assert.ok(
      w.get(demo.token).state.rooms[id].cycle.reviews[person.accountId],
    );
    assert.throws(
      () =>
        act(demo, {
          form: "evidence",
          activeRoomId: id,
          id: "guidance",
          values: { attachment: "Changed proof" },
        }),
      /locked after a private cycle review/,
    );
    const result = act(demo, {
      action: "cycle-decision",
      activeRoomId: id,
      values: { decision },
    }).state;
    assert.equal(
      result.rooms[id].status,
      decision === "finish" ? "launched" : "in-progress",
    );
    assert.equal(result.rooms[id].cycle.number, 2);
  }
  act(demo, { form: "review-form", activeRoomId: id, values: { rating: "5" } });
  assert.equal(w.get(demo.token).state.rooms[id].status, "reviewed");
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
