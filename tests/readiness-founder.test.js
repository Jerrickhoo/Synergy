// Prototype evaluation readiness (Phase 2): founder-flow fixes.
import test from "node:test";
import assert from "node:assert/strict";
import { completeTermsMilestones } from "../src/data/terms.js";
import { canonicalTags } from "../src/data/collaboration.js";
import { createModel, createInitialState } from "../src/data/model.js";
import templates from "../src/data/engagement-templates.json" with { type: "json" };

const roomOf = (type) =>
  createModel(createInitialState()).createRoom({
    id: `room-${type}`,
    role: "founder",
    partnerId: "partner:founder",
    type,
  });

test("agreeing terms completes the milestone that means the same thing", () => {
  for (const type of ["swap", "beta"]) {
    const room = roomOf(type);
    completeTermsMilestones(room);
    assert.equal(room.milestones.scope.me, true, type);
    assert.equal(room.milestones.scope.partner, true, type);
    // Only that milestone: the work itself still has to be confirmed.
    const others = Object.entries(room.milestones).filter(
      ([id]) => id !== "scope",
    );
    assert.ok(
      others.every(([, item]) => !item.me && !item.partner),
      type,
    );
  }
  const marketing = roomOf("marketing");
  completeTermsMilestones(marketing);
  assert.ok(Object.values(marketing.milestones).every((item) => !item.me));
});

test("a disputed terms milestone is left for the collaborators", () => {
  const room = roomOf("swap");
  room.milestones.scope.disputed = true;
  completeTermsMilestones(room);
  assert.equal(room.milestones.scope.me, false);
});

test("every exchange template gives examples for the shared terms", () => {
  for (const type of ["beta", "marketing", "swap"]) {
    const examples = templates[type].termPlaceholders;
    for (const field of [
      "goal",
      "scope",
      "timeline",
      "commitment",
      "compensation",
    ])
      assert.match(examples?.[field] || "", /^For example: /, type + field);
  }
});

test("user acquisition wording suggests Distribution", () => {
  assert.ok(
    canonicalTags("We need help with user acquisition").includes(
      "Distribution",
    ),
  );
  assert.ok(canonicalTags("Acquiring new customers").includes("Distribution"));
  assert.ok(canonicalTags("We want early traction").includes("Distribution"));
  assert.ok(
    !canonicalTags("We need help with pricing").includes("Distribution"),
  );
});
