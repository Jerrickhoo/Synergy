// Founder prototype review, round 2: agreed terms never show a false
// conflict, startup trades that are not beta testing default to a Skill Swap,
// and stored moderator templates still offer room types added later.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import { createStorage } from "../server/storage.js";
import { sameDraftValues } from "../src/state/useDraft.js";
import defaultTemplates from "../src/data/engagement-templates.json" with { type: "json" };

function workspaceFile(t) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-review-round2-"));
  t.after(() => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  return join(dir, "workspace.json");
}

const tablewise = {
  bio: "Reservation and waitlist app for independent cafes.",
  offer: "Product design feedback, Intros to cafe owners",
  need: "Pricing strategy, Fundraising",
  offerTags: "Product Design, Product Feedback",
  needTags: "Fundraising, Pricing Strategy",
  industry: "Hospitality software",
  stage: "pre-seed",
  teamSize: "2",
};

test("saved terms with extra empty template fields match the typed draft", () => {
  const typed = {
    goal: "Fairtab improves onboarding",
    scope: "Two reviews",
    timeline: "2 weeks",
    commitment: "2 calls",
    compensation: "Design feedback for a pricing playbook",
  };
  const saved = {
    compensation: typed.compensation,
    goal: typed.goal,
    scope: typed.scope,
    timeline: typed.timeline,
    commitment: typed.commitment,
    testerCount: "",
    testWindow: "",
    feedbackMethod: "",
  };
  assert.equal(sameDraftValues(typed, saved), true);
  assert.equal(
    sameDraftValues({ ...typed, timeline: "3 weeks" }, saved),
    false,
  );
  assert.equal(sameDraftValues({ ...typed, testerCount: "40" }, saved), false);
  assert.equal(sameDraftValues({ a: null }, {}), true);
  assert.equal(sameDraftValues({ tags: ["x"] }, { tags: ["x"] }), true);
  assert.equal(sameDraftValues({ tags: ["x"] }, { tags: ["y"] }), false);
});

test("a startup trade without testers defaults to a Skill Swap room", (t) => {
  const workspace = createWorkspace(workspaceFile(t), { demoMode: true });
  t.after(() => workspace.close());
  const user = workspace.openDemo("founder");
  const act = (input) =>
    workspace.act(user.token, { role: "founder", ...input }).state;
  const state = act({ form: "profile-form", values: tablewise });
  const fairtab = state.directory.founders.find((p) => p.name === "Fairtab");
  assert.equal(fairtab.engagement, "Skill Swap");
  assert.deepEqual(fairtab.engagementTypes, [
    "Beta Testing Exchange",
    "Co-Marketing Swap",
    "Skill Swap",
  ]);
  // A pair where either startup wants its product tested stays beta:
  // StudyLoop needs beta testing.
  const studyloop = state.directory.founders.find(
    (p) => p.name === "StudyLoop",
  );
  assert.equal(studyloop.engagement, "Beta Testing Exchange");
  const tester = act({
    form: "profile-form",
    values: { ...tablewise, needTags: "Beta Testers" },
  }).directory.founders.find((p) => p.name === "Fairtab");
  assert.equal(tester.engagement, "Beta Testing Exchange");

  act({ form: "profile-form", values: tablewise });
  act({ action: "interest", id: fairtab.id, engagementType: "swap" });
  const roomId = act({
    action: "simulate-acceptance",
    id: fairtab.id,
  }).activeRoomId;
  const room = workspace.get(user.token).state.rooms[roomId];
  assert.equal(room.type, "swap");
  assert.equal(room.engagementType, "Skill Swap");
  assert.deepEqual(
    Object.keys(room.milestones),
    defaultTemplates.swap.milestones.map((item) => item.id),
  );
});

test("stored moderator templates keep room types added later", (t) => {
  const file = workspaceFile(t);
  const storage = createStorage(file);
  const db = storage.load();
  // A workspace saved before Skill Swap existed, with an edited beta name.
  const { swap, ...older } = structuredClone(defaultTemplates);
  assert.ok(swap);
  older.beta.name = "Edited beta exchange";
  db.engagementTemplates = older;
  storage.commit(db, db.revision);
  storage.close();
  const workspace = createWorkspace(file, { demoMode: true });
  t.after(() => workspace.close());
  const { state } = workspace.openDemo("founder");
  assert.equal(state.engagementTemplates.beta.name, "Edited beta exchange");
  assert.equal(state.engagementTemplates.swap.name, "Skill Swap");
});
