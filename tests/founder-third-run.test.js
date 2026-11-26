// Founder review round 3: match cards agree with match details, the digest
// leaves out current collaborators, and copy fixes.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace, scoreProfile } from "../server/workspace.js";
import { createModel } from "../src/data/model.js";
import {
  fitSummary,
  matchReason,
  offeredToYou,
} from "../src/data/profile-presentation.js";
import {
  digestContent,
  notificationDestination,
} from "../src/data/notifications.js";

const factors = [
  ["Need fit", 0],
  ["Industry fit", 2],
];
const shiftlyText =
  "Shiftly is staff scheduling software for independent restaurants. We are a seed-stage team of 6 with 40 paying restaurants, but churn spikes after month two. We need help with pricing strategy and customer retention. We can offer intros to restaurant operators and product feedback.";
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

function shiftlyWorkspace(t) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-third-run-"));
  const workspace = createWorkspace(join(dir, "workspace.json"), {
    demoMode: true,
  });
  t.after(() => {
    workspace.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
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
  return { workspace, user, state };
}

test("1a: matchReason names plain-text need overlap when no standard tag is shared", () => {
  const person = {
    exchange: { youGet: [], theyGet: [], matchedNeeds: ["Customer retention"] },
    why: ["Good", "", "Strong"],
    factorScores: [50, 0, 70],
  };
  assert.equal(matchReason(person), "Offers what you need: Customer retention");
  assert.deepEqual(offeredToYou(person), ["Customer retention"]);
  // Match details lead with the same help.
  assert.match(
    fitSummary(person, factors),
    /^They offer what you need: Customer retention\./,
  );
});

test("1a: matchReason uses the founder's own wording before shared standard tags", () => {
  const person = {
    exchange: {
      youGet: ["Pricing Strategy"],
      theyGet: [],
      matchedNeeds: ["Pricing strategy"],
    },
    why: ["Strong"],
    factorScores: [100],
  };
  assert.equal(matchReason(person), "Offers what you need: Pricing strategy");
  assert.equal(
    matchReason({
      ...person,
      exchange: { ...person.exchange, theyGet: ["Product Feedback"] },
    }),
    "Two-way fit: Pricing strategy for Product Feedback",
  );
  // Tags matched without a phrase are kept; tags a phrase already names are not.
  assert.deepEqual(
    offeredToYou({
      ...person,
      exchange: {
        ...person.exchange,
        youGet: ["Pricing Strategy", "Beta Testers"],
      },
    }),
    ["Pricing strategy", "Beta Testers"],
  );
  // With no phrase matched, the shared tags still explain the fit.
  assert.deepEqual(
    offeredToYou({
      ...person,
      exchange: { ...person.exchange, matchedNeeds: [] },
    }),
    ["Pricing Strategy"],
  );
});

test("sample founder: David Park's reason names her needs, not Mentorship", () => {
  const david = scoreProfile(
    {
      need: "Product strategy, Onboarding guidance",
      offer: "Beta testing, Student user insights",
      industry: "FinTech",
      stage: "pre-seed",
    },
    {
      offer: "Product strategy, Onboarding guidance, Growth",
      expertise: "Product strategy, Onboarding guidance",
      startups: "FinTech, Idea and pre-seed teams",
      availability: "Weekly sessions",
    },
    true,
  );
  assert.deepEqual(david.exchange.youGet, ["Mentorship"]);
  assert.deepEqual(offeredToYou(david), [
    "Product strategy",
    "Onboarding guidance",
  ]);
  assert.equal(
    matchReason(david),
    "Offers what you need: Product strategy, Onboarding guidance",
  );
  assert.match(
    fitSummary(david, factors),
    /^They offer what you need: Product strategy and Onboarding guidance\./,
  );
});

test("1a: with no need overlap the card keeps the comparison fallback", () => {
  const person = {
    // Stale phrases never count when Need fit is 0.
    exchange: { youGet: [], theyGet: [], matchedNeeds: ["Customer retention"] },
    why: ["No overlap", "", "Limited"],
    factorScores: [0, 0, 20],
  };
  assert.deepEqual(offeredToYou(person), []);
  assert.equal(
    matchReason(person),
    "Limited overlap so far; compare what each side needs",
  );
  assert.match(fitSummary(person, factors), /^Neither profile clearly offers/);
  // A partial word overlap names no phrase but agrees with match details.
  const partial = {
    exchange: { youGet: [], theyGet: [], matchedNeeds: [] },
    why: ["Good"],
    factorScores: [40],
  };
  assert.equal(matchReason(partial), "Needs and offers partly overlap");
  assert.match(fitSummary(partial, factors), /needs and their offers overlap/);
});

test("1a: Need fit reports only need items whose every word is offered", () => {
  const mentor = (expertise) => ({
    expertise,
    offer: expertise,
    startups: "SaaS, seed",
    availability: "Weekly sessions",
  });
  const hana = scoreProfile(
    shiftlyProfile,
    mentor("Customer retention, Churn analysis, Product feedback"),
    true,
  );
  assert.deepEqual(hana.exchange.youGet, []);
  assert.deepEqual(hana.exchange.matchedNeeds, ["Customer retention"]);
  // "Product strategy" shares one word with "Pricing strategy" and covers neither.
  const kai = scoreProfile(
    shiftlyProfile,
    mentor("Accessibility, User research, Product strategy"),
    true,
  );
  assert.ok(kai.factorScores[0] > 0);
  assert.deepEqual(kai.exchange.matchedNeeds, []);
  // A mentor scoring a founder sees no "you get" phrases.
  assert.deepEqual(
    scoreProfile(mentor("Customer retention"), shiftlyProfile, true).exchange
      .matchedNeeds,
    [],
  );
});

test("1a: Hana Sato's card and match details name the same help for Shiftly", (t) => {
  const { state } = shiftlyWorkspace(t);
  const people = createModel(state).rolePeople();
  const hana = people.find((person) => person.name === "Hana Sato");
  assert.equal(hana.score, 59);
  assert.equal(matchReason(hana), "Offers what you need: Customer retention");
  assert.match(
    fitSummary(hana, factors),
    /They offer what you need: Customer retention\./,
  );
  for (const name of ["Priya Shah", "Kai Chen", "David Park"]) {
    const person = people.find((item) => item.name === name);
    assert.doesNotMatch(matchReason(person), /Offers what you need/, name);
  }
});

const day = 86400000;
const now = Date.parse("2026-11-21T12:00:00.000Z");
const at = (ago) => new Date(now - ago).toISOString();
const people = [
  { id: "marcus", name: "Marcus Webb", score: 78 },
  { id: "diego", name: "Diego Alvarez", score: 78 },
  { id: "hana", name: "Hana Sato", score: 51 },
  { id: "old", name: "Old Partner", score: 80 },
];
const items = [
  { id: "1", kind: "match", matchId: "marcus", timestamp: at(day) },
  { id: "2", kind: "match", matchId: "diego", timestamp: at(day) },
  { id: "3", kind: "match", matchId: "hana", timestamp: at(2 * day) },
  { id: "4", kind: "match", matchId: "old", timestamp: at(day) },
  { id: "5", kind: "activity", roomId: "r1", timestamp: at(day) },
];
const rooms = {
  r1: {
    id: "r1",
    role: "founder",
    partnerId: "marcus",
    type: "mentorship",
    status: "in-progress",
  },
  // A closed room doesn't hide anyone.
  r2: {
    id: "r2",
    role: "founder",
    partnerId: "old",
    type: "mentorship",
    status: "cancelled",
  },
  // A room under the other role doesn't either.
  r3: {
    id: "r3",
    role: "mentor",
    partnerId: "diego",
    type: "mentorship",
    status: "in-progress",
  },
};

test("2: the digest leaves out people you already have an open room with", () => {
  const digest = digestContent(items, {
    people,
    rooms,
    role: "founder",
    now,
    span: 7 * day,
  });
  assert.deepEqual(
    digest.matches.map((person) => person.name),
    ["Old Partner", "Diego Alvarez", "Hana Sato"],
  );
  // Hana's update came from a match alert, not a 70%+ fit.
  assert.deepEqual(digest.summary, [
    "2 strong matches (70%+ fit)",
    "1 match alert",
    "1 collaboration update",
  ]);
  const one = digestContent(items.slice(1, 2), {
    people,
    rooms,
    role: "founder",
    now,
    span: 7 * day,
  });
  assert.deepEqual(one.summary, ["1 strong match (70%+ fit)"]);
  const none = digestContent(items.slice(0, 1), {
    people,
    rooms,
    role: "founder",
    now,
    span: 7 * day,
  });
  assert.deepEqual(none.matches, []);
  assert.deepEqual(none.summary, []);
});

test("2: an older match update for a current collaborator opens the room", () => {
  const state = { role: "founder", rooms };
  assert.deepEqual(notificationDestination(items[0], state, people), {
    label: "Open room",
    context: "With Marcus Webb",
    command: { action: "open-room", id: "r1" },
  });
  // Closed rooms and other-role rooms keep View match.
  for (const item of [items[1], items[3]])
    assert.equal(
      notificationDestination(item, state, people).label,
      "View match",
    );
});
