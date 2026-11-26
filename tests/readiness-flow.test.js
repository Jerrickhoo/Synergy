// Founder flow review of 24 Nov 2026: a founder who sets up their own startup
// can reach a Deal Room from Suggested, and a fictional partner's instant
// agreement is what the room says after terms are sent.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import { createModel } from "../src/data/model.js";
import { analyzeDescription } from "../src/data/profile-assistant.js";

function demo(t) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-readiness-flow-"));
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

// A founder's own words, applied the way "Apply suggestions" fills the form.
function ownStartup(workspace, text) {
  const found = analyzeDescription(text);
  const user = workspace.openDemo("founder", {
    email: `own-${Math.random()}@example.com`,
    password: "pw",
  });
  const act = (input) =>
    workspace.act(user.token, { role: "founder", ...input }).state;
  act({ action: "first-run-choice", values: { start: "blank" } });
  const state = act({
    form: "profile-form",
    values: {
      name: "Ana Reyes",
      startupName: "Own startup",
      bio: text,
      need: found.needText,
      needTags: found.needs.join(", "),
      offer: found.offerText,
      offerTags: found.offers.join(", "),
      industry: found.industry || "Consumer",
      stage: found.stage || "pre-seed",
      teamSize: found.teamSize || "3",
      goals: found.goal || "Find a collaborator",
    },
  });
  return { act, state };
}

test("founders who offer testers or research see a startup to trade with", (t) => {
  const workspace = demo(t);
  for (const text of [
    "We're a pre-seed team of 3 building a meal-planning app for university students in Manila. We need help with user acquisition and pricing strategy. We can offer beta testers from our campus community and student user research.",
    "We're building a peer tutoring marketplace for high school students. Team of 2. We need help with marketing and fundraising. We can offer beta testers and user research with students.",
    "Pre-seed team of 4 running a campus thrift resale app. We need help with distribution and co-marketing. We can offer product feedback and student user research.",
  ]) {
    const { state } = ownStartup(workspace, text);
    const startups = createModel(state)
      .suggestedMatches()
      .filter((person) => person.kind !== "Mentor");
    assert.ok(startups.length > 0, `No startup suggested for: ${text}`);
    const brightlane = startups.find((person) => person.name === "Brightlane");
    assert.ok(brightlane, text);
    // A startup exchange (beta testing, or co-marketing when both sides
    // mention marketing), never mentorship.
    assert.ok(
      ["Evaluation and Feedback", "Audience Swap"].includes(
        brightlane.engagement,
      ),
      brightlane.engagement,
    );
  }
});

test("after terms are sent, the room says the fictional partner agreed", (t) => {
  const workspace = demo(t);
  const { act, state } = ownStartup(
    workspace,
    "We're a pre-seed team of 3 building a meal-planning app for university students in Manila. We need help with user acquisition and pricing strategy. We can offer beta testers from our campus community and student user research.",
  );
  const brightlane = createModel(state)
    .suggestedMatches()
    .find((person) => person.name === "Brightlane");
  act({ action: "interest", id: brightlane.id, engagementType: "beta" });
  const roomId = act({
    action: "simulate-acceptance",
    id: brightlane.id,
  }).activeRoomId;
  const locked = act({
    action: "lock-terms",
    activeRoomId: roomId,
    termsRevision: 0,
    values: {
      goal: "Test both apps with 20 students",
      scope: "We test Brightlane's app; Brightlane reviews our pricing.",
      timeline: "Two weeks",
      commitment: "Two hours a week each",
      compensation: "Student testers for go-to-market advice",
    },
  });
  const room = locked.rooms[roomId];
  assert.equal(room.terms.partnerLocked, true);
  assert.equal(room.status, "in-progress");
  assert.equal(
    locked.confirmation,
    "Brightlane agreed to the terms. Start on the milestones together.",
  );
  assert.doesNotMatch(locked.confirmation, /can now review/);
});
