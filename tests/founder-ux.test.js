// Founder-experience audit fixes: tag-aware matching, swap fairness, fair
// closure, review windows, introduction expiry, disputes and demo partners.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace, scoreProfile } from "../server/workspace.js";
import { analyzeDescription } from "../src/data/profile-assistant.js";
import { canonicalTags, trustSummary } from "../src/data/collaboration.js";
import { roomNextAction } from "../src/data/selectors.js";
import { createModel } from "../src/data/model.js";

const profile = {
  bio: "Student budgeting app",
  offer: "Active dev team, Completed MVP",
  need: "People to try our product, early user feedback",
  industry: "FinTech",
  stage: "pre-seed",
  teamSize: "4",
};
const terms = {
  goal: "Validate onboarding",
  scope: "Fifty testers",
  timeline: "Two weeks",
  commitment: "Two hours weekly",
  compensation: "Early access",
};
const wait = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function fixture(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-founder-ux-"));
  t.after(() => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  const workspace = createWorkspace(join(dir, "workspace.json"), {
    adminEmails: ["moderator@example.com"],
    ...options,
  });
  t.after(() => workspace.close());
  const user = (name) =>
    workspace.login(
      {
        firstName: name,
        lastName: "Test",
        email: `${name.toLowerCase()}@example.com`,
        password: "private-password",
        role: "founder",
      },
      true,
    );
  const act = (u, command) =>
    workspace.act(u.token, {
      role: "founder",
      termsRevision:
        workspace.get(u.token).state.rooms[command.activeRoomId]?.terms
          .revision || 0,
      milestoneVersion:
        workspace.get(u.token).state.rooms[command.activeRoomId]?.milestones[
          command.id
        ]?.contentVersion || 0,
      ...command,
    });
  const a = user("Maria"),
    b = user("Jordan"),
    admin = user("Moderator");
  admin.email = "moderator@example.com";
  for (const u of [a, b]) act(u, { form: "profile-form", values: profile });
  const pair = () => {
    act(a, {
      action: "interest",
      id: `${b.state.accountId}:founder`,
      values: { note: "Your students are who we want." },
    });
    return act(b, {
      action: "accept-interest",
      id: `${a.state.accountId}:founder`,
    }).state.activeRoomId;
  };
  const agree = (id) => {
    act(a, { action: "lock-terms", activeRoomId: id, values: terms });
    act(b, { action: "accept-terms", activeRoomId: id });
  };
  const finish = (id) => {
    agree(id);
    const room = workspace.get(a.token).state.rooms[id];
    for (const [key, item] of Object.entries(room.milestones)) {
      if (item.evidence)
        act(a, {
          form: "evidence",
          activeRoomId: id,
          id: key,
          values: { attachment: "https://example.com/proof" },
        });
      for (const u of [a, b])
        act(u, { action: "confirm-milestone", activeRoomId: id, id: key });
    }
    act(a, { action: "launch-room", activeRoomId: id });
  };
  return { workspace, a, b, admin, act, pair, agree, finish };
}

test("the document's own example matches on need, not only on industry", () => {
  const maria = {
    ...profile,
    need: "People to try our product, early user feedback",
  };
  const grocer = {
    ...profile,
    offer: "600 active student users, beta testers, testing opportunities",
    need: "Early access to new tools, active dev team feedback",
    teamSize: "5",
  };
  const result = scoreProfile(maria, grocer, false);
  assert.ok(result.factorScores[0] >= 50, "Need Fit is no longer zero");
  assert.ok(result.score >= 55);
  assert.deepEqual(result.exchange.youGet, ["Beta Testers"]);
  assert.ok(result.exchange.theyGet.includes("Technical Development"));
  assert.deepEqual(canonicalTags("early adopters to try our product"), [
    "Beta Testers",
  ]);
});

test("an uneven audience swap is capped and a missing audience never wins", () => {
  const swap = (audienceSize) => ({
    ...profile,
    offer: "Newsletter audience, co-marketing",
    need: "Co-marketing, newsletter promotion",
    audienceSize,
  });
  const uneven = scoreProfile(swap("50000"), swap("500"), false);
  const equal = scoreProfile(swap("50000"), swap("45000"), false);
  const blank = scoreProfile(swap("50000"), swap(""), false);
  assert.ok(uneven.score <= 40);
  assert.match(uneven.audienceWarning, /Uneven swap: 50,000 vs 500/);
  assert.ok(equal.score > blank.score);
  assert.match(blank.audienceWarning, /missing/);
});

test("the profile assistant reads the §4 description and asks about ambiguity", () => {
  const maria = analyzeDescription(
    "We're a 4-person team building a budgeting app for students, about 8 months in, and we're looking for people to actually try it out and tell us what's broken.",
  );
  assert.deepEqual(maria.needs.sort(), ["Beta Testers", "Product Feedback"]);
  // Being a team that builds something is not an offer until it is stated.
  assert.deepEqual(maria.offers, []);
  assert.equal(maria.teamSize, "4");
  assert.equal(maria.stage, "pre-seed");
  assert.equal(maria.industry, "FinTech");
  const vague = analyzeDescription(
    "We need help getting our product in front of people.",
  );
  assert.equal(vague.questions.length, 1);
  assert.deepEqual(vague.questions[0].options, [
    "Beta Testers",
    "Co-Marketing",
    "Distribution",
  ]);
});

test("closing because a partner went silent counts against the partner only", (t) => {
  const { workspace: w, a, b, act, pair, agree } = fixture(t);
  const id = pair();
  agree(id);
  act(a, {
    form: "close-room",
    activeRoomId: id,
    values: { category: "unresponsive", reason: "" },
  });
  const mine = trustSummary(w.get(a.token).state.rooms, "founder");
  const theirs = trustSummary(w.get(b.token).state.rooms, "founder");
  assert.equal(mine.cancelled, 0);
  assert.equal(mine.followThrough, null);
  assert.equal(theirs.cancelled, 1);
  assert.equal(theirs.followThrough, 0);
  const second = pair();
  act(b, {
    form: "close-room",
    activeRoomId: second,
    values: { category: "mutual" },
  });
  assert.equal(
    trustSummary(w.get(b.token).state.rooms, "founder").cancelled,
    1,
  );
});

test("one missing review no longer blocks a deal: the window releases what exists", (t) => {
  const {
    workspace: w,
    a,
    b,
    act,
    pair,
    finish,
  } = fixture(t, {
    // Long enough that a loaded test run still submits inside the window.
    reviewWindowMs: 600,
  });
  const id = pair();
  finish(id);
  act(a, {
    form: "review-form",
    activeRoomId: id,
    values: { rating: 5, note: "Thorough testers" },
  });
  assert.equal(w.get(b.token).state.rooms[id].review.partnerNote, undefined);
  wait(700);
  const room = w.get(b.token).state.rooms[id];
  assert.equal(room.status, "reviewed");
  assert.equal(room.review.windowClosed, true);
  assert.equal(room.review.partnerNote, "Thorough testers");
  assert.throws(
    () =>
      act(b, { form: "review-form", activeRoomId: id, values: { rating: 4 } }),
    /window has closed/,
  );
  const history = w.get(b.token).state.trustHistoryByRole.founder[0];
  assert.equal(history.rating, 5);
  assert.equal(w.get(a.token).state.rooms[id].status, "reviewed");
  act(a, {
    form: "chat-form",
    activeRoomId: id,
    values: { message: "Thanks for the collaboration" },
  });
  assert.equal(w.get(b.token).state.rooms[id].review.windowClosed, true);
  assert.equal(
    w.get(b.token).state.rooms[id].review.partnerNote,
    "Thorough testers",
  );
});

test("unanswered introductions expire into history for both people", (t) => {
  const { workspace: w, a, b, act } = fixture(t, { introductionLimitMs: 100 });
  act(a, {
    action: "interest",
    id: `${b.state.accountId}:founder`,
    values: { note: "Hello" },
  });
  assert.equal(
    w.get(b.token).state.introductionMetaByRole.founder[
      `${a.state.accountId}:founder`
    ].note,
    "Hello",
  );
  wait(150);
  const sender = w.get(a.token).state;
  assert.equal(sender.waitingByRole.founder.size, 0);
  assert.equal(sender.introHistoryByRole.founder[0].status, "expired");
  assert.equal(w.get(b.token).state.incomingByRole.founder.size, 0);
});

test("disputes need a reason, can be escalated and settled by a moderator", (t) => {
  const { workspace: w, a, b, admin, act, pair, agree } = fixture(t);
  const id = pair();
  assert.equal(
    act(a, {
      action: "dispute",
      activeRoomId: id,
      id: "scope",
      values: { reason: "Too early" },
    }).state.rooms[id].milestones.scope.disputed,
    false,
    "no disputes before terms are agreed",
  );
  agree(id);
  const rejected = act(a, { action: "dispute", activeRoomId: id, id: "scope" });
  assert.ok(rejected.state.formErrors);
  act(a, {
    action: "dispute",
    activeRoomId: id,
    id: "scope",
    values: { reason: "Scope missing two flows", outcome: "Add them" },
  });
  assert.equal(
    w.get(b.token).state.rooms[id].milestones.scope.dispute.reason,
    "Scope missing two flows",
  );
  assert.throws(
    () => act(b, { action: "withdraw-dispute", activeRoomId: id, id: "scope" }),
    /Only the person who raised/,
  );
  act(b, { action: "escalate-dispute", activeRoomId: id, id: "scope" });
  const report = w
    .get(admin.token)
    .state.moderation.reports.find((item) => item.kind === "dispute");
  assert.match(report.details, /Scope missing two flows/);
  act(admin, {
    form: "moderation",
    values: {
      kind: "report",
      id: report.id,
      decision: "resolved",
      note: "Evidence shows the scope was agreed",
      remedy: "confirm-milestone",
    },
  });
  const scope = w.get(a.token).state.rooms[id].milestones.scope;
  assert.equal(scope.disputed, false);
  assert.equal(scope.me && scope.partner, true);
});

test("not-done-yet sends a milestone back with a note and next actions follow the turn", (t) => {
  const { workspace: w, a, b, act, pair, agree } = fixture(t);
  const id = pair();
  agree(id);
  // A terms-equivalent milestone is confirmed with the terms; use the first
  // open milestone that needs no evidence.
  const [open] = Object.entries(w.get(a.token).state.rooms[id].milestones).find(
    ([, item]) => !item.me && !item.evidence,
  );
  act(a, { action: "confirm-milestone", activeRoomId: id, id: open });
  const theirs = w.get(b.token).state.rooms[id];
  assert.match(roomNextAction(theirs, "Maria").text, /Your turn: confirm/);
  act(b, {
    form: "send-back",
    activeRoomId: id,
    id: open,
    values: { note: "Success criteria missing" },
  });
  const room = w.get(a.token).state.rooms[id];
  assert.equal(room.milestones[open].me, false);
  assert.match(room.messages.at(-1).text, /Not done yet/);
  assert.equal(roomNextAction(room, "Jordan").mine, true);
});

test("prototype partners answer a preview account through every stage", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "synergy-demo-partner-"));
  t.after(() => rmSync(dir, { recursive: true }));
  const w = createWorkspace(join(dir, "workspace.json"), {
    demoMode: true,
    reviewWindowMs: 60000,
  });
  t.after(() => w.close());
  const viewer = w.openDemo("founder");
  const act = (command) =>
    w.act(viewer.token, {
      role: "founder",
      termsRevision:
        w.get(viewer.token).state.rooms[command.activeRoomId]?.terms.revision ||
        0,
      milestoneVersion:
        w.get(viewer.token).state.rooms[command.activeRoomId]?.milestones[
          command.id
        ]?.contentVersion || 0,
      ...command,
    });
  const person = createModel(w.get(viewer.token).state)
    .browsePeople()
    .find((item) => item.kind === "Startup");
  act({ action: "interest", id: person.id, engagementType: "beta" });
  const id = act({ action: "simulate-acceptance", id: person.id }).state
    .activeRoomId;
  act({ action: "lock-terms", activeRoomId: id, values: terms });
  let room = w.get(viewer.token).state.rooms[id];
  assert.equal(room.terms.partnerLocked, true);
  assert.equal(room.status, "in-progress");
  for (const [key, item] of Object.entries(room.milestones)) {
    if (item.evidence)
      act({
        form: "evidence",
        activeRoomId: id,
        id: key,
        values: { attachment: "Proof" },
      });
    act({ action: "confirm-milestone", activeRoomId: id, id: key });
  }
  room = w.get(viewer.token).state.rooms[id];
  assert.ok(Object.values(room.milestones).every((m) => m.me && m.partner));
  act({ action: "launch-room", activeRoomId: id });
  act({ form: "review-form", activeRoomId: id, values: { rating: 5 } });
  room = w.get(viewer.token).state.rooms[id];
  assert.equal(room.status, "reviewed");
  assert.equal(room.review.partnerRating, 4);
  assert.match(
    w.get(viewer.token).state.activity[0].text,
    /^Prototype: .*simulated response/,
  );
});
