// Editing a sent request keeps its earlier versions; the terms timeline is
// a date range; request quality reads as a word; the Collaboration focus
// sentence says where two profiles meet.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import {
  commitmentChoices,
  timelineDates,
  timelineText,
} from "../src/data/terms.js";
import { validateTerms } from "../src/state/validation.js";
import { qualityLabel } from "../src/data/request-assistant.js";
import {
  fitSentence,
  overlapSentence,
  sameHelp,
} from "../src/data/profile-presentation.js";

const profile = {
  bio: "Student budgeting app",
  offer: "Product Feedback",
  need: "Beta Testers",
  industry: "FinTech",
  stage: "pre-seed",
  teamSize: "4",
};

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-request-edits-"));
  t.after(() => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  const workspace = createWorkspace(join(dir, "workspace.json"));
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
    workspace.act(u.token, { role: "founder", timeZone: "UTC", ...command });
  const a = user("Maria");
  const b = user("Jordan");
  act(a, {
    form: "profile-form",
    values: { ...profile, startupName: "Budgetly" },
  });
  act(b, {
    form: "profile-form",
    values: { ...profile, startupName: "Fairtab" },
  });
  return { workspace, a, b, act };
}

test("editing a sent request keeps the earlier wording on both sides", (t) => {
  const { workspace, a, b, act } = fixture(t);
  const target = `${b.state.accountId}:founder`;
  const sender = `${a.state.accountId}:founder`;
  act(a, {
    action: "interest",
    id: target,
    engagementType: "beta",
    values: { note: "First note" },
  });
  const edited = act(a, {
    action: "edit-interest",
    id: target,
    engagementType: "funding",
    values: { note: "Second note" },
  });
  const meta = edited.state.introductionMetaByRole.founder[target];
  assert.equal(meta.note, "Second note");
  assert.ok(meta.editedAt);
  assert.deepEqual(
    meta.versions.map((version) => [version.engagementType, version.note]),
    [["beta", "First note"]],
  );
  assert.equal(edited.state.introductionTypesByRole.founder[target], "funding");
  assert.equal(edited.state.toast, "Request updated.");

  // The recipient reads the new wording, with the same history, and is told.
  const theirs = workspace.get(b.token).state;
  const theirMeta = theirs.introductionMetaByRole.founder[sender];
  assert.equal(theirMeta.note, "Second note");
  assert.equal(theirMeta.versions.length, 1);
  assert.equal(theirs.introductionTypesByRole.founder[sender], "funding");
  assert.ok(
    theirs.activity.some((item) =>
      /Budgetly updated their request\./.test(item.text),
    ),
  );

  // Nothing changed is refused; each real edit adds a version.
  assert.throws(
    () =>
      act(a, {
        action: "edit-interest",
        id: target,
        engagementType: "funding",
        values: { note: "Second note" },
      }),
    /Change the collaboration type or the note/,
  );
  const again = act(a, {
    action: "edit-interest",
    id: target,
    values: { note: "Third note" },
  });
  assert.deepEqual(
    again.state.introductionMetaByRole.founder[target].versions.map(
      (version) => version.note,
    ),
    ["First note", "Second note"],
  );

  // Once accepted, the request is no longer editable.
  act(b, { action: "accept-interest", id: sender });
  assert.throws(
    () =>
      act(a, {
        action: "edit-interest",
        id: target,
        values: { note: "Too late" },
      }),
    /no longer pending/,
  );
});

test("the timeline is saved as a date range and read back as text", () => {
  assert.deepEqual(timelineDates("2026-12-01 to 2026-12-14"), {
    start: "2026-12-01",
    end: "2026-12-14",
    written: "",
  });
  // Mid-pick: a start without an end yet.
  assert.deepEqual(timelineDates("2026-12-01 to "), {
    start: "2026-12-01",
    end: "",
    written: "",
  });
  // Terms written before the date picker keep their wording.
  assert.deepEqual(timelineDates("Two weeks"), {
    start: "",
    end: "",
    written: "Two weeks",
  });
  assert.equal(timelineText("Two weeks"), "Two weeks");
  assert.match(
    timelineText("2026-12-01 to 2026-12-14"),
    /^\S.*2026 – \S.*2026$/,
  );
  assert.match(timelineText("2026-12-01 to "), /^From \S.*2026$/);
  assert.equal(timelineText(""), "");

  const terms = {
    goal: "Validate onboarding",
    scope: "Two testing rounds",
    commitment: commitmentChoices[1],
    compensation: "Shared feedback",
  };
  assert.deepEqual(
    validateTerms({ ...terms, timeline: "2026-12-01 to 2026-12-14" }),
    {},
  );
  // A one-day collaboration is allowed.
  assert.deepEqual(
    validateTerms({ ...terms, timeline: "2026-12-01 to 2026-12-01" }),
    {},
  );
  assert.equal(
    validateTerms({ ...terms, timeline: "2026-12-01 to " }).timeline,
    "Choose both a start and an end date.",
  );
  assert.equal(
    validateTerms({ ...terms, timeline: "2026-12-14 to 2026-12-01" }).timeline,
    "The timeline must end on or after its start date.",
  );
  assert.deepEqual(validateTerms({ ...terms, timeline: "Two weeks" }), {});
  assert.equal(
    validateTerms({ ...terms, timeline: "" }).timeline,
    "Timeline is required.",
  );
});

test("request quality reads as a word instead of a number", () => {
  assert.equal(qualityLabel(100), "Excellent");
  assert.equal(qualityLabel(90), "Excellent");
  assert.equal(qualityLabel(89), "Very good");
  assert.equal(qualityLabel(75), "Very good");
  assert.equal(qualityLabel(74), "Good");
  assert.equal(qualityLabel(60), "Good");
  assert.equal(qualityLabel(59), "Fair");
  assert.equal(qualityLabel(40), "Fair");
  assert.equal(qualityLabel(39), "Needs work");
  assert.equal(qualityLabel(0), "Needs work");
});

test("Collaboration focus says where two profiles meet", () => {
  // Same help by wording or by standard tag.
  assert.equal(sameHelp("Beta testers", ["Beta Testers"]), true);
  assert.equal(sameHelp("Pricing", ["Pricing strategy"]), true);
  assert.equal(sameHelp("Beta testers", ["User research"]), false);

  assert.equal(
    overlapSentence({
      youGet: ["Beta testers"],
      theyGet: ["Technical development"],
      name: "Fairtab",
    }),
    "Fairtab offers Beta testers, which you need, and you offer Technical development, which they need.",
  );
  assert.equal(
    overlapSentence({
      youGet: ["Product strategy", "Onboarding guidance"],
      name: "Hana Sato",
      mentor: true,
    }),
    "Hana Sato can help with Product strategy and Onboarding guidance, which you need.",
  );
  assert.equal(
    overlapSentence({ name: "Hana Sato", mentor: true }),
    "None of your needs match Hana Sato's expertise yet.",
  );
  assert.equal(
    overlapSentence({ name: "Fairtab" }),
    "Your needs and offers don't overlap yet, so this match rests on industry, stage and working style.",
  );
});

test("the working style factor explains itself in the match sentence", () => {
  const row = (index, score) => ({ index, score });
  assert.equal(
    fitSentence({ score: 80 }, [row(0, 100), row(4, 100)]),
    "80% because they offer what you need and you want the same kind of collaboration.",
  );
  assert.equal(
    fitSentence({ score: 55 }, [row(0, 70), row(4, 0)]),
    "55% because they offer what you need, but one of you wants a one-off exchange and the other something ongoing.",
  );
  assert.equal(
    fitSentence({ score: 60 }, [row(0, 70), row(4, null)]),
    "60% because they offer what you need, but a working style isn't chosen.",
  );
});
