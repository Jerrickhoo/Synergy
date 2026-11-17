import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace, scoreProfile } from "../server/workspace.js";
import { decode } from "../src/state/serialization.js";
import { backupWorkspace, verifyBackup } from "../server/backup.js";
import { scheduleInstant, upcomingSessions } from "../src/data/selectors.js";
import { defaultMatching } from "../src/data/matching.js";

test("milestone revisions require the partner's approval, reject stale decisions and preserve evidence", (t) => {
  const { workspace: w, a, b, c, act, pair, agree, file } = fixture(t);
  const id = pair();
  agree(id);
  act(a, {
    form: "evidence",
    activeRoomId: id,
    id: "testing",
    values: { attachment: "Existing test results" },
  });
  for (const u of [a, b])
    act(u, { action: "confirm-milestone", activeRoomId: id, id: "testing" });
  const command = {
    form: "milestone-proposal",
    activeRoomId: id,
    id: "testing",
    values: {
      title: "Extended testing",
      description: "Test with twenty more students",
      revision: 0,
    },
  };
  assert.throws(() => act(c, command), /unavailable/);
  assert.throws(() => act(a, { ...command, role: "mentor" }), /unavailable/);
  act(a, command);
  let item = w.get(b.token).state.rooms[id].milestones.testing;
  assert.equal(item.title, "Testing round");
  assert.equal(item.me, true);
  const decision = {
    form: "milestone-decision",
    activeRoomId: id,
    id: "testing",
    values: { decision: "accept", proposalId: item.proposal.id },
  };
  assert.throws(() => act(a, decision), /other collaborator/);
  assert.throws(() => act(a, command), /current proposal/);
  assert.throws(
    () =>
      act(b, {
        ...decision,
        values: { ...decision.values, proposalId: "stale" },
      }),
    /proposal changed/,
  );
  assert.throws(
    () =>
      act(b, { action: "confirm-milestone", activeRoomId: id, id: "testing" }),
    /proposed milestone/,
  );
  assert.ok(w.get(a.token).state.rooms[id].milestones.testing.proposal);
  act(b, decision);
  for (const u of [a, b]) {
    item = w.get(u.token).state.rooms[id].milestones.testing;
    assert.equal(item.title, "Extended testing");
    assert.equal(item.attachment, "Existing test results");
    assert.equal(item.me, false);
    assert.equal(item.partner, false);
    assert.equal(item.revision, 1);
    assert.equal(item.revisions[0].decision, "accept");
    assert.equal(item.proposal, undefined);
  }
  assert.throws(() => act(a, command), /milestone changed/);
  assert.throws(() => act(b, decision), /proposal changed/);
  act(a, {
    ...command,
    values: { ...command.values, title: "Another title", revision: 1 },
  });
  item = w.get(b.token).state.rooms[id].milestones.testing;
  act(b, {
    ...decision,
    values: { decision: "reject", proposalId: item.proposal.id },
  });
  assert.equal(
    w.get(a.token).state.rooms[id].milestones.testing.title,
    "Extended testing",
  );
  const reloaded = createWorkspace(file).login({
    email: "alex@example.com",
    password: "private-password",
  });
  assert.equal(reloaded.state.rooms[id].milestones.testing.revisions.length, 2);
});

test("workspace templates are versioned, moderator-only and copied into future rooms", (t) => {
  const { workspace: w, a, admin, act, pair, file } = fixture(t);
  const oldRoom = pair();
  const template = w.get(admin.token).state.engagementTemplates.beta;
  const values = {
    type: "beta",
    version: template.version,
    name: "Student beta exchange",
  };
  for (const item of template.milestones)
    Object.assign(values, {
      [`title-${item.id}`]:
        item.id === "scope" ? "Agree test scope" : item.title,
      [`description-${item.id}`]: item.description,
      [`evidence-${item.id}`]: item.evidence ? "on" : "",
    });
  assert.throws(
    () => act(a, { form: "engagement-template", values }),
    /moderator/i,
  );
  act(admin, { form: "engagement-template", values });
  assert.throws(
    () => act(admin, { form: "engagement-template", values }),
    /template changed/,
  );
  assert.equal(
    w.get(a.token).state.rooms[oldRoom].milestones.scope.title,
    "Scope defined",
  );
  act(a, {
    form: "close-room",
    activeRoomId: oldRoom,
    values: { reason: "New scope" },
  });
  const newRoom = pair();
  assert.equal(
    w.get(a.token).state.rooms[newRoom].milestones.scope.title,
    "Agree test scope",
  );
  assert.equal(w.get(a.token).state.rooms[newRoom].template.version, 3);
  assert.equal(w.get(a.token).state.rooms[oldRoom].template.version, 2);
  const loaded = createWorkspace(file).login({
    email: "alex@example.com",
    password: "private-password",
  });
  assert.equal(
    loaded.state.engagementTemplates.beta.name,
    "Student beta exchange",
  );
});

test("pending scope changes block automatic launch and terminal rooms reject further revisions", (t) => {
  const { workspace: w, a, b, act, pair, agree } = fixture(t);
  const id = pair();
  agree(id);
  for (const [key, item] of Object.entries(
    w.get(a.token).state.rooms[id].milestones,
  )) {
    if (item.evidence)
      act(a, {
        form: "evidence",
        activeRoomId: id,
        id: key,
        values: { attachment: "Completed work" },
      });
    for (const u of [a, b])
      if (!(key === "issues" && u === b))
        act(u, { action: "confirm-milestone", activeRoomId: id, id: key });
  }
  const command = {
    form: "milestone-proposal",
    activeRoomId: id,
    id: "scope",
    values: {
      revision: 0,
      title: "Additional scope",
      description: "A further testing round",
    },
  };
  act(a, command);
  const result = act(a, { action: "launch-room", activeRoomId: id });
  assert.equal(result.state.rooms[id].status, "in-progress");
  const proposalId = result.state.rooms[id].milestones.scope.proposal.id;
  act(b, {
    form: "milestone-decision",
    activeRoomId: id,
    id: "scope",
    values: { proposalId, decision: "reject" },
  });
  act(b, { action: "confirm-milestone", activeRoomId: id, id: "issues" });
  assert.equal(w.get(a.token).state.rooms[id].status, "launched");
  assert.throws(() => act(a, command), /cannot be changed/);
});

test("matching captures fixed versioned scores and counts rooms once with blind outcome feedback", (t) => {
  const { workspace: w, a, b, admin, act, pair, complete } = fixture(t);
  const id = pair();
  const snapshot = w.get(a.token).state.rooms[id].matchingSnapshot;
  const values = { version: 1 };
  for (const kind of ["founder", "mentor"])
    defaultMatching[kind].forEach((weight, index) => {
      values[`${kind}-${index}`] = weight * 100;
    });
  values["founder-0"] = 60;
  values["founder-2"] = 10;
  assert.throws(
    () => act(a, { form: "matching-config", values }),
    /moderator/i,
  );
  act(admin, { form: "matching-config", values });
  assert.equal(w.get(a.token).state.matchingConfig.version, 2);
  assert.deepEqual(w.get(a.token).state.rooms[id].matchingSnapshot, snapshot);
  assert.throws(
    () => act(admin, { form: "matching-config", values }),
    /weights changed/,
  );
  assert.throws(
    () =>
      act(admin, {
        form: "matching-config",
        values: { ...values, version: 2, "founder-0": 90 },
      }),
    /total 100/,
  );
  complete(id, 4, { useful: "no", goalOutcome: "partial" });
  let report = w.get(admin.token).state.moderation.matchingReport;
  assert.equal(report.totalRooms, 1);
  assert.equal(report.cohorts[0].completed, 1);
  assert.equal(report.cohorts[0].reviewed, 0);
  assert.equal(w.get(b.token).state.rooms[id].review.partnerUseful, undefined);
  act(b, {
    form: "review-form",
    activeRoomId: id,
    values: { rating: 5, useful: "yes", goalOutcome: "achieved" },
  });
  report = w.get(admin.token).state.moderation.matchingReport;
  assert.equal(report.cohorts[0].rooms, 1);
  assert.equal(report.cohorts[0].reviewed, 1);
  assert.equal(report.cohorts[0].useful, 1);
  assert.equal(report.cohorts[0].usefulnessResponses, 2);
  assert.equal(report.cohorts[0].goalsAchieved, 1);
  assert.equal(w.get(a.token).state.moderation, undefined);
  const second = pair();
  assert.equal(w.get(a.token).state.rooms[second].matchingSnapshot.version, 2);
  assert.equal(
    w.get(admin.token).state.moderation.matchingReport.totalRooms,
    2,
  );
});

test("mentor past experience is optional, saved, public and preserved across restart", (t) => {
  const { workspace: w, a, user, act, file } = fixture(t);
  const mentor = user("Mentor", "mentor");
  act(mentor, {
    form: "profile-form",
    values: {
      bio: "Product mentor",
      offer: "Research advice",
      need: "Founder goals",
      expertise: "Research",
      availability: "Weekly",
      startups: "EdTech",
      pastExperience:
        "Led research at a student startup.\nAdvised three teams.",
    },
  });
  assert.match(
    w.get(a.token).state.directory.mentors[0].pastExperience,
    /Led research/,
  );
  const loaded = createWorkspace(file).login({
    email: "mentor@example.com",
    password: "private-password",
  });
  assert.match(
    loaded.state.profiles.mentor.pastExperience,
    /Advised three teams/,
  );
});

const profile = {
  bio: "We build student tools.",
  offer: "Technical development",
  need: "Beta testers, feedback",
  industry: "EdTech",
  stage: "idea",
  teamSize: "3",
};

test("room task boards share changes, persist, and reject stale or unauthorized edits", (t) => {
  const { workspace: w, a, b, c, act, pair, file } = fixture(t);
  const roomId = pair();
  const values = {
    title: "Prepare the beta brief",
    description: "Write goals and recruitment criteria",
    status: "todo",
    priority: "high",
    assignee: b.state.accountId,
    dueDate: "2035-04-01",
    milestoneId: "scope",
  };
  const create = { form: "task-create", activeRoomId: roomId, values };
  assert.throws(() => act(c, create), /unavailable/);
  assert.throws(() => act(a, { ...create, role: "mentor" }), /unavailable/);
  for (const change of [
    { title: " " },
    { priority: "urgent" },
    { status: "unknown" },
    { dueDate: "2035-02-30" },
    { assignee: c.state.accountId },
    { milestoneId: "__proto__" },
  ])
    assert.throws(() =>
      act(a, { ...create, values: { ...values, ...change } }),
    );
  act(a, create);
  const task = w.get(b.token).state.rooms[roomId].tasks[0];
  assert.equal(task.title, values.title);
  assert.equal(task.assignee, b.state.accountId);
  assert.equal(task.version, 1);
  const update = {
    form: "task-update",
    activeRoomId: roomId,
    id: task.id,
    values: { ...task, status: "doing" },
  };
  assert.throws(() => act(c, update), /unavailable/);
  act(b, update);
  assert.equal(w.get(a.token).state.rooms[roomId].tasks[0].status, "doing");
  assert.throws(() => act(a, update), /task changed/);
  assert.throws(
    () => act(a, { ...update, form: "task-delete" }),
    /task changed/,
  );
  const fresh = w.get(a.token).state.rooms[roomId].tasks[0];
  act(a, {
    ...update,
    values: { ...fresh, title: "Brief ready", status: "done" },
  });
  const restarted = createWorkspace(file).login({
    email: "jamie@example.com",
    password: "private-password",
  });
  assert.equal(restarted.state.rooms[roomId].tasks[0].title, "Brief ready");
  assert.equal(restarted.state.rooms[roomId].tasks[0].status, "done");
  assert.equal(w.get(a.token).state.rooms[roomId].milestones.scope.me, false);
  act(b, {
    form: "task-delete",
    activeRoomId: roomId,
    id: task.id,
    values: { version: 3 },
  });
  assert.deepEqual(w.get(a.token).state.rooms[roomId].tasks, []);
  assert.throws(() => act(a, update), /task is unavailable/);
  act(a, create);
  act(a, {
    form: "close-room",
    activeRoomId: roomId,
    values: { reason: "Finished for now" },
  });
  assert.throws(() => act(b, create), /cannot be changed/);
});
const terms = {
  goal: "Validate onboarding",
  scope: "Twenty testers",
  timeline: "Two weeks",
  commitment: "Two hours weekly",
  compensation: "Product feedback",
};
function fixture(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-features-"));
  t.after(() => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  const file = join(dir, "data", "workspace.json");
  const workspace = createWorkspace(file, {
    adminEmails: ["moderator@example.com"],
    ...options,
  });
  const user = (name, role = "founder") =>
    workspace.login(
      {
        firstName: name,
        lastName: "Test",
        email: `${name.toLowerCase()}@example.com`,
        password: "private-password",
        role,
      },
      true,
    );
  const a = user("Alex"),
    b = user("Jamie"),
    c = user("Observer"),
    admin = user("Moderator");
  const act = (u, command) =>
    workspace.act(u.token, {
      role: u.state.role,
      termsRevision:
        workspace.get(u.token).state.rooms[command.activeRoomId]?.terms
          .revision || 0,
      milestoneVersion:
        workspace.get(u.token).state.rooms[command.activeRoomId]?.milestones[
          command.id
        ]?.contentVersion || 0,
      ...command,
    });
  for (const u of [a, b, c]) act(u, { form: "profile-form", values: profile });
  const pair = () => {
    act(a, { action: "interest", id: `${b.state.accountId}:founder` });
    return act(b, {
      action: "accept-interest",
      id: `${a.state.accountId}:founder`,
    }).state.activeRoomId;
  };
  const agree = (id) => {
    act(a, { action: "lock-terms", activeRoomId: id, values: terms });
    act(b, { action: "accept-terms", activeRoomId: id });
  };
  const complete = (id, rating = 4, feedback = {}) => {
    agree(id);
    const room = workspace.get(a.token).state.rooms[id];
    for (const [key, item] of Object.entries(room.milestones)) {
      if (item.evidence)
        act(a, {
          form: "evidence",
          activeRoomId: id,
          id: key,
          values: { attachment: "Deliverable summary" },
        });
      for (const u of [a, b])
        act(u, { action: "confirm-milestone", activeRoomId: id, id: key });
    }
    act(a, { action: "launch-room", activeRoomId: id });
    act(a, {
      form: "review-form",
      activeRoomId: id,
      values: { rating, note: "Private feedback", ...feedback },
    });
  };
  return {
    dir,
    file,
    workspace,
    user,
    a,
    b,
    c,
    admin,
    act,
    pair,
    agree,
    complete,
  };
}

test("terms can reopen safely, revoke confirmations, close with a reason, and preserve history", (t) => {
  const { workspace: w, a, b, c, act, pair, agree, file } = fixture(t);
  const id = pair();
  agree(id);
  act(a, { action: "confirm-milestone", activeRoomId: id, id: "scope" });
  assert.throws(
    () => act(c, { action: "reopen-terms", activeRoomId: id }),
    /unavailable/,
  );
  assert.throws(
    () => act(a, { role: "mentor", action: "reopen-terms", activeRoomId: id }),
    /unavailable/,
  );
  act(b, { action: "reopen-terms", activeRoomId: id });
  // A change request keeps the agreement and confirmations until accepted.
  assert.equal(w.get(a.token).state.rooms[id].terms.locked, true);
  assert.equal(w.get(a.token).state.rooms[id].milestones.scope.me, true);
  assert.throws(
    () => act(b, { action: "accept-reopen", activeRoomId: id }),
    /collaborator must agree/,
  );
  act(a, { action: "accept-reopen", activeRoomId: id });
  for (const u of [a, b]) {
    const r = w.get(u.token).state.rooms[id];
    assert.equal(r.terms.locked, false);
    assert.equal(r.terms.partnerLocked, false);
    assert.equal(r.terms.confirmedByMe, false);
    assert.equal(r.milestones.scope.me, false);
    assert.equal(r.status, "matched");
  }
  assert.throws(
    () => act(a, { action: "accept-terms", activeRoomId: id }),
    /no terms/,
  );
  agree(id);
  act(a, {
    form: "close-room",
    activeRoomId: id,
    values: { reason: "Priorities changed" },
  });
  assert.equal(w.get(b.token).state.rooms[id].status, "cancelled");
  assert.throws(
    () => act(b, { action: "reopen-terms", activeRoomId: id }),
    /cannot be changed/,
  );
  assert.throws(
    () => act(a, { action: "launch-room", activeRoomId: id }),
    /cannot be changed/,
  );
  const fresh = pair();
  assert.notEqual(fresh, id);
  assert.ok(w.get(a.token).state.rooms[id]);
  const restarted = createWorkspace(file);
  const recovered = restarted.login({
    email: "alex@example.com",
    password: "private-password",
  });
  assert.equal(recovered.state.rooms[id].closeReason, "Priorities changed");
});

test("public reputation respects blind reviews and repeat collaborations preserve history without inflating reviewer counts", (t) => {
  const { workspace: w, a, b, c, act, pair, complete } = fixture(t);
  const id = pair();
  complete(id);
  let visible = w
    .get(c.token)
    .state.directory.founders.find((p) => p.accountId === b.state.accountId);
  assert.equal(visible.trust.completed, 1);
  assert.equal(visible.trust.averageRating, null);
  assert.equal(visible.trust.history[0].rating, null);
  assert.equal(JSON.stringify(visible).includes("Private feedback"), false);
  act(b, { form: "review-form", activeRoomId: id, values: { rating: 5 } });
  const next = pair();
  complete(next, 3);
  act(b, { form: "review-form", activeRoomId: next, values: { rating: 5 } });
  visible = w
    .get(c.token)
    .state.directory.founders.find((p) => p.accountId === b.state.accountId);
  assert.equal(visible.trust.completed, 2);
  assert.equal(visible.trust.distinctReviewers, 1);
  assert.equal(visible.trust.averageRating, 3);
  assert.ok(w.get(a.token).state.rooms[id]);
});

test("matching uses size, audience and engagement goals and describes missing or zero signals honestly", () => {
  const mine = {
    ...profile,
    goals: "Validate onboarding",
    engagementPreference: "one-off",
    audienceSize: "100",
  };
  const base = scoreProfile(mine, mine, false);
  assert.ok(
    scoreProfile(mine, { ...mine, teamSize: "300" }, false).score < base.score,
  );
  assert.ok(
    scoreProfile(mine, { ...mine, engagementPreference: "ongoing" }, false)
      .score < base.score,
  );
  const marketing = {
    ...mine,
    offer: "Audience marketing",
    need: "Audience marketing",
  };
  assert.ok(
    scoreProfile(marketing, { ...marketing, audienceSize: "10000" }, false)
      .score < scoreProfile(marketing, marketing, false).score,
  );
  assert.match(
    scoreProfile(profile, { ...profile, teamSize: "" }, false).factorDetails[3],
    /both size values/,
  );
  assert.match(
    scoreProfile({ need: "science" }, { offer: "music" }, false)
      .factorDetails[0],
    /0%/,
  );
});

test("moderators verify affiliations, approve vocabulary, resolve disputes and enforce account access", (t) => {
  const { workspace: w, a, b, c, admin, act, pair, agree } = fixture(t);
  const id = pair();
  agree(id);
  act(a, {
    action: "dispute",
    activeRoomId: id,
    id: "scope",
    values: { reason: "Scope is incomplete" },
  });
  act(a, {
    form: "report-form",
    activeRoomId: id,
    values: { reason: "Cannot agree on completion" },
  });
  const values = {
    kind: "report",
    id: "unknown",
    decision: "resolved",
    note: "Reviewed evidence",
    remedy: "resolve-disputes",
  };
  assert.throws(
    () => act(a, { form: "moderation", values }),
    /Moderator access/,
  );
  assert.throws(
    () =>
      act(admin, {
        form: "moderation",
        values: {
          kind: "account",
          id: "__proto__",
          decision: "suspend",
          note: "Invalid target",
        },
      }),
    /cannot be moderated/,
  );
  assert.equal(Object.prototype.suspended, undefined);
  assert.equal(w.get(c.token).state.moderation, undefined);
  const report = w.get(admin.token).state.moderation.reports[0];
  assert.ok(report.context.milestones.some((m) => m.disputed));
  act(admin, {
    form: "moderation",
    values: {
      ...values,
      id: report.id,
      decision: "assigned",
      assignee: "moderator@example.com",
    },
  });
  act(admin, { form: "moderation", values: { ...values, id: report.id } });
  for (const u of [a, b]) {
    const r = w.get(u.token).state.rooms[id];
    assert.equal(r.milestones.scope.disputed, false);
    assert.equal(r.milestones.scope.me, false);
  }
  act(a, {
    form: "affiliation-request",
    values: {
      organization: "University Startup Program",
      evidence: "Roster confirmation",
    },
  });
  act(admin, {
    form: "moderation",
    values: {
      kind: "affiliation",
      id: a.state.accountId,
      decision: "verified",
      note: "Checked program roster",
    },
  });
  assert.equal(
    w
      .get(c.token)
      .state.directory.founders.find((p) => p.accountId === a.state.accountId)
      .affiliation.status,
    "verified",
  );
  act(a, { form: "tag-proposal", values: { label: "Accessibility Testing" } });
  const proposal = w.get(admin.token).state.moderation.tags[0];
  act(admin, {
    form: "moderation",
    values: {
      kind: "tag",
      id: proposal.id,
      decision: "approved",
      note: "Distinct reusable need",
    },
  });
  assert.ok(w.get(b.token).state.vocabulary.includes("Accessibility Testing"));
  assert.throws(
    () =>
      act(a, {
        form: "profile-form",
        values: { ...profile, offerTags: "Unapproved tag" },
      }),
    /approved tags/,
  );
  act(a, {
    form: "profile-form",
    values: { ...profile, offerTags: "Accessibility Testing" },
  });
  act(admin, {
    form: "moderation",
    values: {
      kind: "account",
      id: b.state.accountId,
      decision: "suspend",
      note: "Confirmed abuse",
    },
  });
  assert.throws(() => w.get(b.token), /sign in|unavailable/);
  assert.throws(
    () => w.login({ email: "jamie@example.com", password: "private-password" }),
    /unavailable/,
  );
  assert.equal(
    w
      .get(c.token)
      .state.directory.founders.some((p) => p.accountId === b.state.accountId),
    false,
  );
  assert.equal(w.get(admin.token).state.moderation.audit.length, 5);
});

test("due dates and unread notifications survive restart and respect roles", (t) => {
  const { workspace: w, a, b, act, pair, agree, file } = fixture(t);
  const id = pair();
  agree(id);
  act(a, {
    form: "milestone-date",
    activeRoomId: id,
    id: "scope",
    values: { dueDate: "2025-01-01" },
  });
  assert.throws(
    () =>
      act(a, {
        form: "milestone-date",
        activeRoomId: id,
        id: "scope",
        values: { dueDate: "2026-99-99" },
      }),
    /valid milestone/,
  );
  assert.equal(
    w.get(b.token).state.rooms[id].milestones.scope.dueDate,
    "2025-01-01",
  );
  const notification = w
    .get(b.token)
    .state.notifications.find((n) => n.kind === "reminder");
  assert.ok(notification);
  assert.equal(notification.read, false);
  assert.equal(notification.dueAt, "2025-01-01T23:59:59Z");
  assert.equal(notification.tab, "milestones");
  assert.notEqual(notification.timestamp, notification.dueAt);
  const later = Date.now() + 120000;
  t.mock.method(Date, "now", () => later);
  const repeated = w.get(b.token);
  assert.equal(
    repeated.state.notifications.find((n) => n.id === notification.id)
      .timestamp,
    notification.timestamp,
  );
  assert.equal(
    w.get(b.token).revision,
    repeated.revision,
    "repeated reads do not rewrite notification metadata",
  );
  act(b, { action: "read-notifications", id: notification.id });
  assert.equal(
    w.get(b.token).state.notifications.find((n) => n.id === notification.id)
      .read,
    true,
  );
  const restarted = createWorkspace(file, {});
  const recovered = restarted.login({
    email: "jamie@example.com",
    password: "private-password",
  });
  assert.equal(
    recovered.state.notifications.find((n) => n.id === notification.id).read,
    true,
  );
  assert.equal(
    recovered.state.notifications.find((n) => n.id === notification.id)
      .timestamp,
    notification.timestamp,
  );
  assert.equal(
    restarted
      .get(recovered.token, "mentor")
      .state.notifications.some((n) => n.id === notification.id),
    false,
  );
});

test("mentorship can be rescheduled as a weekly series and clears confirmations for both partners", (t) => {
  const { workspace: w, a, b, act, file } = fixture(t);
  act(b, {
    role: "mentor",
    form: "profile-form",
    values: {
      bio: "Mentor for student teams",
      offer: "Product guidance",
      need: "Student founders",
      expertise: "Product strategy",
      availability: "Weekly",
      startups: "EdTech",
    },
  });
  act(a, { action: "interest", id: `${b.state.accountId}:mentor` });
  const id = act(b, {
    role: "mentor",
    action: "accept-interest",
    id: `${a.state.accountId}:founder`,
  }).state.activeRoomId;
  act(a, { action: "lock-terms", activeRoomId: id, values: terms });
  act(b, { role: "mentor", action: "accept-terms", activeRoomId: id });
  const values = {
    date: "2035-04-01",
    time: "10:00",
    count: "3",
    durationMinutes: "45",
  };
  act(a, {
    form: "schedule",
    activeRoomId: id,
    values,
    timeZone: "Asia/Manila",
  });
  for (const [u, role] of [
    [a, "founder"],
    [b, "mentor"],
  ])
    act(u, {
      role,
      action: "confirm-milestone",
      activeRoomId: id,
      id: "session",
    });
  act(a, {
    form: "schedule",
    activeRoomId: id,
    values: { ...values, date: "2035-04-02" },
    timeZone: "Asia/Manila",
  });
  const room = w.get(b.token, "mentor").state.rooms[id];
  assert.equal(room.milestones.session.me, false);
  assert.equal(room.milestones.session.partner, false);
  assert.equal(room.milestones.session.schedules.length, 3);
  assert.ok(
    room.milestones.session.schedules.every(
      (schedule) => schedule.durationMinutes === 45,
    ),
  );
  assert.equal(room.milestones.session.schedules[2].date, "2035-04-16");
  assert.equal(upcomingSessions(w.get(a.token).state).length, 3);
  assert.equal(
    scheduleInstant(room.milestones.session.schedule).toISOString(),
    "2035-04-02T02:00:00.000Z",
  );
  assert.ok(
    decode(readFileSync(file, "utf8")).accounts[b.state.accountId].state.rooms[
      id
    ],
  );
});

test("backups capture the database and immutable uploads and detect corruption", (t) => {
  const { file, dir } = fixture(t);
  const snapshot = decode(readFileSync(file, "utf8"));
  const id = "11111111-1111-4111-8111-111111111111";
  snapshot.files[id] = { id, size: 8 };
  mkdirSync(join(dir, "data", "uploads"));
  writeFileSync(join(dir, "data", "uploads", id), "evidence");
  // Use the application's Set-aware serializer for the test snapshot.
  const bytes = readFileSync(file, "utf8");
  const json = JSON.parse(bytes);
  json.files = snapshot.files;
  writeFileSync(file, JSON.stringify(json));
  const target = backupWorkspace(file, join(dir, "backups"));
  assert.equal(verifyBackup(target).revision, snapshot.revision);
  const restored = createWorkspace(join(target, "synergy.json"));
  assert.ok(
    restored.login({ email: "alex@example.com", password: "private-password" })
      .token,
  );
  // Signing in doesn't write when verification is disabled, so the backup stays valid.
  writeFileSync(join(target, "uploads", id), "modified");
  assert.throws(() => verifyBackup(target), /verification failed/);
});
