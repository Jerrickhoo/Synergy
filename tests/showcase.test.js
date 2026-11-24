import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";

const startup = {
  name: "Shiftly",
  bio: "Staff scheduling software for independent restaurants.",
  offer: "Intros to restaurant operators, Product feedback",
  need: "Pricing strategy, Customer retention, Beta testing",
  industry: "SaaS",
  stage: "seed",
  teamSize: "6",
};

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-showcase-"));
  const w = createWorkspace(join(dir, "workspace.json"), {
    demoMode: false,
    showcaseProfiles: true,
  });
  t.after(() => {
    w.close();
    rmSync(dir, { recursive: true });
  });
  const signup = (name) => {
    const user = w.login(
      {
        firstName: name,
        lastName: "Tester",
        email: `${name.toLowerCase()}@example.com`,
        password: "private-password",
        role: "founder",
      },
      true,
    );
    act(user, { form: "profile-form", values: { ...startup, name } });
    return user;
  };
  const act = (user, command) =>
    w.act(user.token, { role: "founder", ...command });
  const directory = (user) => w.get(user.token).state.directory;
  return { w, signup, act, directory };
}

test("a real founder can simulate a showcase startup accepting an introduction", (t) => {
  const { w, signup, act, directory } = fixture(t);
  const founder = signup("Justin");
  const brightlane = directory(founder).founders.find(
    (person) => person.name === "Brightlane",
  );
  assert.equal(brightlane.canSimulateAcceptance, false);
  act(founder, {
    action: "interest",
    id: brightlane.id,
    engagementType: "beta",
  });
  assert.equal(
    directory(founder).founders.find((person) => person.id === brightlane.id)
      .canSimulateAcceptance,
    true,
  );
  const state = act(founder, {
    action: "simulate-acceptance",
    id: brightlane.id,
  }).state;
  const room = state.rooms[state.activeRoomId];
  assert.equal(room.partnerAccountId, "showcase-brightlane");
  assert.equal(room.engagementType, "Beta Testing Exchange");
  // The showcase side holds the same room, as if Brightlane had accepted.
  const partner = w.login({
    email: "brightlane@showcase.test",
    password: "synergy-demo",
  });
  assert.ok(partner.state.rooms[state.activeRoomId]);
  // In the Deal Room, Brightlane answers on its own, as a demo sample does.
  assert.equal(
    directory(founder).founders.find((person) => person.id === brightlane.id)
      .prototypePartner,
    true,
  );
  const locked = act(founder, {
    action: "lock-terms",
    activeRoomId: state.activeRoomId,
    termsRevision: room.terms.revision || 0,
    values: {
      goal: "Validate the scheduling app with restaurant testers",
      scope: "Two testing rounds on the onboarding flow",
      timeline: "Two weeks",
      commitment: "Two hours per week",
      compensation: "Mutual testing",
    },
  }).state.rooms[state.activeRoomId];
  assert.equal(locked.terms.partnerLocked, true);
  assert.equal(locked.status, "in-progress");
});

test("a real founder can simulate a showcase mentor accepting a request", (t) => {
  const { signup, act, directory } = fixture(t);
  const founder = signup("Justin");
  const marcus = directory(founder).mentors.find(
    (person) => person.name === "Marcus Webb",
  );
  act(founder, {
    action: "send-request",
    id: marcus.id,
    values: mentorRequestValues,
  });
  const state = act(founder, {
    action: "simulate-acceptance",
    id: marcus.id,
  }).state;
  const room = state.rooms[state.activeRoomId];
  assert.equal(room.type, "mentorship");
  assert.equal(room.partnerAccountId, "showcase-marcus-webb");
  const goal = act(founder, {
    action: "simulate-goal-confirmation",
    activeRoomId: room.id,
  }).state.rooms[room.id].milestones.goal;
  assert.equal(goal.me && goal.partner, true);
});

test("simulated acceptance never stands in for a real person", (t) => {
  const { w, signup, act, directory } = fixture(t);
  const founder = signup("Justin");
  signup("Robin");
  const robin = directory(founder).founders.find(
    (person) => person.name === "Robin",
  );
  act(founder, { action: "interest", id: robin.id, engagementType: "swap" });
  assert.equal(
    directory(founder).founders.find((person) => person.id === robin.id)
      .canSimulateAcceptance,
    false,
  );
  assert.throws(
    () => act(founder, { action: "simulate-acceptance", id: robin.id }),
    /fictional prototype collaborator/,
  );
  assert.equal(
    directory(founder).founders.find((person) => person.id === robin.id)
      .prototypePartner,
    false,
  );
  // A showcase account cannot simulate anyone either.
  const fairtab = w.login({
    email: "fairtab@showcase.test",
    password: "synergy-demo",
  });
  const target = fairtab.state.directory.founders.find(
    (person) => person.name === "Brightlane",
  );
  act(fairtab, { action: "interest", id: target.id, engagementType: "swap" });
  assert.throws(
    () => act(fairtab, { action: "simulate-acceptance", id: target.id }),
    /preview accounts/,
  );
});
