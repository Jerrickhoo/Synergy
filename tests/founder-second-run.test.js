// Founder review round 2: useful suggestions, sample coverage, profile helper
// output, progress marks, prep nudge, session times and role switching.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import { demoProfiles } from "../server/demo-directory.js";
import { createModel } from "../src/data/model.js";
import {
  canonicalTags,
  coveredNeeds,
  defaultVocabulary,
  needItems,
} from "../src/data/collaboration.js";
import { uncoveredNeeds } from "../src/data/home.js";
import {
  analyzeDescription,
  withoutSampleImage,
} from "../src/data/profile-assistant.js";
import {
  mentorSessions,
  mentorshipNextAction,
  mentorshipStage,
  stageMarks,
} from "../src/data/mentor-room.js";
import { scheduleLabel } from "../src/data/selectors.js";
import { mentorFormat } from "../src/data/mentor-formats.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";

function demo(t) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-second-run-"));
  const workspace = createWorkspace(join(dir, "workspace.json"), {
    demoMode: true,
  });
  t.after(() => {
    workspace.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  return workspace;
}
const shiftlyText =
  "Shiftly is staff scheduling software for independent restaurants. We are a seed-stage team of 6 with 40 paying restaurants, but churn spikes after month two. We need help with pricing strategy and customer retention. We can offer intros to restaurant operators and product feedback.";
const barLabsText =
  "BarLabs builds compliance software for craft breweries opening taprooms. Pre-seed, team of 3. We need help with liquor licensing law. We can offer brewery operator feedback.";
const shiftlyProfile = {
  name: "Jordan Lee",
  startupName: "Shiftly",
  bio: shiftlyText,
  need: "Pricing strategy, Customer retention",
  needTags: "Pricing Strategy",
  offer: "Intros to restaurant operators, Product feedback",
  offerTags: "Product Feedback",
  goals: "Get help with pricing strategy and customer retention",
  industry: "SaaS",
  stage: "seed",
  teamSize: "6",
};
function shiftlyState(workspace) {
  const user = workspace.openDemo("founder", {
    email: `shiftly-${Math.random()}@example.com`,
    password: "pw",
  });
  workspace.act(user.token, {
    role: "founder",
    action: "first-run-choice",
    values: { start: "blank" },
  });
  const state = workspace.act(user.token, {
    role: "founder",
    form: "profile-form",
    values: shiftlyProfile,
  }).state;
  return { user, state };
}
const names = (people) => people.map((person) => person.name);

test("A1: a suggestion must cover a stated need, and the list is deterministic", (t) => {
  const workspace = demo(t);
  const { state } = shiftlyState(workspace);
  const model = createModel(state);
  const suggested = model.suggestedMatches();
  const kai = model.rolePeople().find((person) => person.name === "Kai Chen");
  // Kai Chen scores above 30% on the other factors but offers neither need.
  assert.ok(kai.score >= 30, `Kai Chen scored ${kai.score}`);
  assert.deepEqual(coveredNeeds(kai, state.profiles.founder), []);
  assert.equal(names(suggested).includes("Kai Chen"), false);
  for (const person of suggested) {
    assert.ok(person.score >= 30);
    assert.ok(coveredNeeds(person, state.profiles.founder).length > 0);
  }
  assert.ok(names(suggested).includes("Marcus Webb"));
  assert.ok(names(suggested).includes("Hana Sato"));
  // The same profile gives the same list in another workspace and on repeat.
  const again = createModel(shiftlyState(demo(t)).state).suggestedMatches();
  assert.deepEqual(names(again), names(suggested));
  assert.deepEqual(
    names(createModel(state).suggestedMatches()),
    names(suggested),
  );
  assert.deepEqual(uncoveredNeeds(state), []);
});

test("A1: without any need overlap, nobody is suggested and every need is uncovered", (t) => {
  const workspace = demo(t);
  const { user } = shiftlyState(workspace);
  const state = workspace.act(user.token, {
    role: "founder",
    form: "profile-form",
    values: {
      ...shiftlyProfile,
      need: "Liquor licensing law",
      needTags: "",
    },
  }).state;
  const model = createModel(state);
  assert.ok(model.rolePeople().length > 0);
  assert.deepEqual(model.suggestedMatches(), []);
  assert.deepEqual(uncoveredNeeds(state), ["Liquor licensing law"]);
  assert.deepEqual(needItems({ need: "A and B, C", needTags: "Fundraising" }), [
    "Fundraising",
    "A",
    "B",
    "C",
  ]);
});

test("A2: every standard tag is offered by at least two sample profiles", () => {
  const offered = (sample) =>
    canonicalTags(
      [
        sample.profile.offer,
        sample.profile.offerTags,
        sample.profile.expertise,
        sample.profile.topics,
      ]
        .filter(Boolean)
        .join(", "),
    );
  for (const tag of defaultVocabulary)
    assert.ok(
      demoProfiles.filter((sample) => offered(sample).includes(tag)).length >=
        2,
      tag,
    );
  const marcus = demoProfiles.find((sample) => sample.id === "marcus-webb");
  assert.match(marcus.profile.expertise, /Pricing strategy/);
  assert.match(marcus.profile.startups, /SaaS/);
  const hana = demoProfiles.find((sample) => sample.id === "hana-sato");
  assert.match(hana.profile.expertise, /Customer retention/);
});

test("A4: the helper lists needs and offers as items and suggests the startup name", () => {
  const shiftly = analyzeDescription(shiftlyText);
  assert.equal(shiftly.needText, "Pricing strategy, Customer retention");
  assert.equal(
    shiftly.offerText,
    "Intros to restaurant operators, Product feedback",
  );
  assert.equal(shiftly.startupName, "Shiftly");
  const barLabs = analyzeDescription(barLabsText);
  assert.equal(barLabs.startupName, "BarLabs");
  assert.equal(barLabs.needText, "Liquor licensing law");
  assert.equal(barLabs.offerText, "Brewery operator feedback");
  for (const text of [
    "We are building a budgeting app.",
    "Our team builds tools.",
    "It helps students.",
  ])
    assert.equal(analyzeDescription(text).startupName, "", text);
});

test("A5: pre-seed is not read as seed", () => {
  for (const [text, stage] of [
    ["Pre-seed, team of 3.", "pre-seed"],
    ["We are pre seed and hiring.", "pre-seed"],
    ["We are preseed.", "pre-seed"],
    ["We closed a seed round.", "seed"],
    ["We raised a seed last spring.", "seed"],
    ["A seed-stage team.", "seed"],
  ])
    assert.equal(analyzeDescription(text).stage, stage, text);
  assert.equal(analyzeDescription(barLabsText).stage, "pre-seed");
});

test("D4: the sample photo is dropped only when the sample name is gone", () => {
  const maria = "/demo/avatars/maria.svg";
  assert.equal(withoutSampleImage("Maria Santos", maria), maria);
  assert.equal(withoutSampleImage("Rosa Diaz", maria), "");
  assert.equal(
    withoutSampleImage("Rosa Diaz", "/api/avatars/x"),
    "/api/avatars/x",
  );
});

// A mentorship room through acceptance, the simulated goal and a session.
function mentorshipRoom(t) {
  const workspace = demo(t);
  const user = workspace.openDemo("founder");
  const mentor = user.state.directory.mentors.find((person) =>
    person.availableFormats?.includes("single-session"),
  );
  workspace.act(user.token, {
    role: "founder",
    action: "send-request",
    id: mentor.id,
    values: { ...mentorRequestValues, format: "single-session" },
  });
  const roomId = workspace.act(user.token, {
    role: "founder",
    action: "simulate-acceptance",
    id: mentor.id,
  }).state.activeRoomId;
  const act = (command) =>
    workspace.act(user.token, {
      role: "founder",
      activeRoomId: roomId,
      ...command,
    }).state.rooms[roomId];
  return { workspace, user, roomId, act };
}

// Readiness review (24 Nov): the highlighted stage is the one reached, as in
// a Deal Room. Highlighting the next one lit "Goal Confirmed" while the
// room was still waiting for the mentor to confirm the goal.
test("B1: the stage reached is current and earlier stages are checked", (t) => {
  const { act } = mentorshipRoom(t);
  const accepted = act({ action: "simulate-goal-confirmation" });
  assert.equal(mentorshipStage(accepted).index, 2);
  const marks = stageMarks(accepted);
  assert.deepEqual(
    marks.filter((mark) => mark.done).map((mark) => mark.label),
    ["Requested", "Accepted"],
  );
  assert.deepEqual(
    marks.filter((mark) => mark.current).map((mark) => mark.label),
    ["Goal Confirmed"],
  );
  // Before the goal is confirmed, no stage ahead is highlighted.
  const waiting = stageMarks({
    ...accepted,
    milestones: {
      ...accepted.milestones,
      goal: { ...accepted.milestones.goal, me: false, partner: false },
    },
  });
  assert.deepEqual(
    waiting.filter((mark) => mark.current).map((mark) => mark.label),
    ["Accepted"],
  );
  const finished = stageMarks({ ...accepted, status: "reviewed" });
  assert.ok(finished.every((mark) => mark.done && !mark.current));
  const closed = stageMarks({ ...accepted, status: "cancelled" });
  assert.equal(
    closed.some((mark) => mark.current),
    false,
  );
  // A payment still due is the current step, never a checked one.
  const due = stageMarks({ ...accepted, payment: { status: "due" } });
  assert.deepEqual(
    due.filter((mark) => mark.current).map((mark) => mark.label),
    ["Awaiting payment"],
  );
});

test("B2: a founder with an upcoming session is asked to share prep until it is shared", (t) => {
  const { act } = mentorshipRoom(t);
  act({ action: "simulate-goal-confirmation" });
  const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const scheduled = act({
    form: "schedule",
    values: { date, time: "10:00", timeZone: "UTC", durationMinutes: "60" },
  });
  const nudge = mentorshipNextAction(scheduled);
  assert.equal(nudge.mine, true);
  assert.equal(nudge.tab, "overview");
  assert.equal(
    nudge.text,
    `Share your prep before ${scheduleLabel(mentorSessions(scheduled)[0])}`,
  );
  const shared = act({
    form: "prep-checklist",
    values: { deck: "https://example.com/deck" },
  });
  // Once prep is shared, the room names the booked session as what is next,
  // rather than reading as the mentor's turn.
  const booked = `Session booked for ${scheduleLabel(mentorSessions(shared)[0])}`;
  assert.deepEqual(mentorshipNextAction(shared), {
    mine: false,
    upNext: true,
    text: booked,
    tab: "schedule",
  });
  // The mentor's copy never shows the founder's prep task.
  assert.equal(
    mentorshipNextAction({ ...scheduled, role: "mentor" }).text,
    booked,
  );
});

test("B4: one session format in the viewer's zone, naming another zone", () => {
  const session = {
    date: "2026-11-25",
    time: "10:00",
    timeZone: "Asia/Manila",
  };
  const local = scheduleLabel(session, { zone: "Asia/Manila" });
  assert.match(local, /^Wed, Nov 25 · 10:00\sAM$/);
  const elsewhere = scheduleLabel(session, { zone: "UTC" });
  assert.match(elsewhere, /^Wed, Nov 25 · 2:00\sAM UTC$/);
  assert.equal(
    scheduleLabel("2026-11-25T02:00:00.000Z", { zone: "UTC" }).replace(
      /\s/g,
      " ",
    ),
    "Wed, Nov 25 · 2:00 AM",
  );
  assert.match(
    scheduleLabel(session, { zone: "Asia/Manila", timeOnly: true }),
    /^10:00\sAM$/,
  );
  assert.equal(scheduleLabel(null), "Not scheduled");
  assert.equal(scheduleLabel({ date: "nope", time: "x" }), "Not scheduled");
  assert.equal(
    mentorFormat("ongoing-advisory").effort,
    "4 check-ins over 8 weeks",
  );
});

test("C1: signing in to a preview account in its other role asks first", async (t) => {
  const workspace = demo(t);
  const credentials = { email: "both@example.com", password: "pw" };
  const founder = workspace.openDemo("founder", credentials);
  for (const open of [
    () => workspace.openDemo("mentor", credentials),
    () => workspace.openDemoAsync("mentor", credentials),
  ])
    await assert.rejects(
      async () => open(),
      (error) =>
        error.status === 409 &&
        error.data?.reason === "role-switch" &&
        error.data?.currentRole === "founder" &&
        error.message ===
          "You were last using Synergy as a founder. Switch to mentor? Other open tabs will switch too.",
    );
  // Nothing changed for the founder tab.
  assert.equal(workspace.get(founder.token).state.role, "founder");
  // A wrong password is refused before the role is revealed.
  assert.throws(
    () => workspace.openDemo("mentor", { ...credentials, password: "no" }),
    (error) => error.status === 401 && !error.data,
  );
  // The same role needs no confirmation; a confirmed switch applies.
  assert.equal(
    workspace.openDemo("founder", credentials).state.accountId,
    founder.state.accountId,
  );
  const mentor = await workspace.openDemoAsync("mentor", {
    ...credentials,
    confirmRoleSwitch: true,
  });
  assert.equal(mentor.state.accountId, founder.state.accountId);
  assert.equal(mentor.state.role, "mentor");
});
