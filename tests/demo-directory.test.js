import test from "node:test";
import { availabilityFit, formatFit } from "../src/data/mentor-rules.js";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace, scoreProfile } from "../server/workspace.js";
import { createStorage, readWorkspaceSnapshot } from "../server/storage.js";
import {
  demoProfiles,
  legacyDemoProfiles,
  demoViewerScenarios,
  demoDirectoryVersion,
} from "../server/demo-directory.js";
import { createInitialState, createModel } from "../src/data/model.js";
import { validateProfile } from "../src/state/validation.js";
import { filterPeople } from "../src/data/filters.js";

function temporary(t, extension = "json") {
  const dir = mkdtempSync(join(tmpdir(), "synergy-directory-"));
  t.after(() => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  return join(dir, `workspace.${extension}`);
}

test("demo profiles validate and sample Impact and Office Hours stay in the demo", (t) => {
  // Version 11 adds three startups that trade commonly needed help, and
  // Version 12 one that trades go-to-market help for testers and research.
  assert.equal(demoProfiles.filter((p) => p.role === "founder").length, 19);
  assert.equal(demoProfiles.filter((p) => p.role === "mentor").length, 14);
  assert.equal(new Set(demoProfiles.map((p) => p.id)).size, 33);
  for (const p of demoProfiles) {
    assert.deepEqual(validateProfile(p.profile, p.role), {}, p.id);
    if (p.profile.image)
      assert.ok(existsSync(join("public", p.profile.image)), p.id);
  }
  for (const role of ["founder", "mentor"]) {
    assert.ok(demoProfiles.some((p) => p.role === role && p.profile.image));
    assert.ok(demoProfiles.some((p) => p.role === role && !p.profile.image));
  }
  const file = temporary(t);
  const workspace = createWorkspace(file, { demoMode: true });
  const viewer = workspace.openDemo("founder");
  const sample = viewer.state.directory.mentors.find(
    ({ id }) => id === "demo-sample-rafael-lim:mentor",
  );
  assert.ok(sample.officeHours.length > 0);
  assert.equal(sample.mentorImpact.sessions.value, 3);
  assert.equal(sample.pastExperience, "");
  const experiencedMentor = viewer.state.directory.mentors.find(
    ({ id }) => id === "demo-sample-david-park:mentor",
  );
  assert.ok(experiencedMentor.pastExperience);
  assert.ok(!Object.keys(viewer.state.rooms).length);
  workspace.close();
  const realFile = temporary(t);
  createWorkspace(realFile, { demoMode: false }).close();
  assert.deepEqual(readWorkspaceSnapshot(realFile).accounts, {});
  for (const account of Object.values(readWorkspaceSnapshot(file).accounts)) {
    assert.ok(
      Object.values(account.state.rooms).every(
        (room) => room.mentorship.sample && room.status === "reviewed",
      ),
    );
    assert.deepEqual(account.state.activity, []);
    assert.deepEqual(account.state.trustHistoryByRole, {
      founder: [],
      mentor: [],
    });
  }
});

test("reference viewers get many, few, no, and sparse mentor suggestions using real scores", (t) => {
  const workspace = createWorkspace(temporary(t), { demoMode: true });
  t.after(() => workspace.close());
  for (const [name, scenario] of Object.entries(demoViewerScenarios)) {
    assert.deepEqual(validateProfile(scenario.profile, scenario.role), {});
    const viewer = workspace.openDemo(scenario.role);
    const { state } = workspace.act(viewer.token, {
      role: scenario.role,
      form: "profile-form",
      values: scenario.profile,
    });
    const model = createModel(state);
    const suggestions = model.suggestedMatches();
    const count = suggestions.length;
    if (name === "many") {
      assert.ok(count >= 6);
      assert.ok(model.browsePeople().some((p) => p.score >= 70));
      assert.ok(
        model.browsePeople().some((p) => p.score >= 30 && p.score < 70),
      );
    } else if (name === "few") assert.ok(count >= 1 && count <= 2);
    else if (name === "none") assert.equal(count, 0);
    else assert.ok(count >= 1 && count <= 2);
    const expectedCount = scenario.role === "founder" ? 33 : 19;
    assert.equal(model.browsePeople().length, expectedCount);
    assert.ok(model.browsePeople().some((p) => p.score < 30));
    for (const p of model.browsePeople()) {
      const fixture = demoProfiles.find(
        (sample) => `demo-sample-${sample.id}` === p.accountId,
      );
      assert.equal(
        p.score,
        scoreProfile(
          scenario.profile,
          fixture.profile,
          scenario.role === "mentor" || p.role === "mentor",
          undefined,
          // Mentorship pairs include the mentor's live Availability and
          // Format Fit on both sides, so a pair reads the same percentage.
          p.role === "mentor"
            ? { availability: availabilityFit(p), format: formatFit(p) }
            : scenario.role === "mentor"
              ? {
                  availability: availabilityFit(state.mentorUsage),
                  format: formatFit(state.mentorUsage),
                }
              : null,
        ).score,
      );
      assert.equal(p.image, fixture.profile.image || "");
    }
    // Zero profile fit. A mentorship pair still carries the mentor's
    // Availability and Format Fit, as it does on the founder's side.
    if (["none", "sparseMentor"].includes(name))
      assert.ok(
        model
          .browsePeople()
          .some(
            (p) =>
              p.score === 0 ||
              p.factorScores?.slice(0, 5).every((value) => value === 0),
          ),
      );
    const filters = { ...state.matchFilters, score: "70" };
    assert.ok(
      filterPeople(model.browsePeople(), filters).every((p) => p.score >= 70),
    );
    assert.equal(
      filterPeople(model.browsePeople(), {
        ...filters,
        search: "no-such-profile",
      }).length,
      0,
    );
    const weak = model.browsePeople().find((p) => p.score < 30);
    const saved = workspace.act(viewer.token, {
      role: scenario.role,
      action: "save",
      id: weak.id,
    });
    assert.ok(saved.state.savedByRole[scenario.role].has(weak.id));
    assert.ok(
      workspace.get(viewer.token).state.savedByRole[scenario.role].has(weak.id),
    );
    if (suggestions.length) {
      state.rooms.existing = {
        role: scenario.role,
        partnerId: suggestions[0].id,
        status: "matched",
      };
      assert.ok(
        !model.suggestedMatches().some((p) => p.id === suggestions[0].id),
      );
      assert.ok(model.browsePeople().some((p) => p.id === suggestions[0].id));
    }
  }
});

for (const extension of ["json", "sqlite"]) {
  test(`fixture refresh preserves edited identities and existing references in ${extension}`, (t) => {
    const file = temporary(t, extension);
    const storage = createStorage(file);
    const db = storage.load();
    for (const sample of legacyDemoProfiles) {
      const state = createInitialState();
      state.role = sample.role;
      state.accountName = sample.name;
      Object.assign(state.profiles[sample.role], sample.profile);
      const id = `demo-sample-${sample.id}`;
      db.accounts[id] = { id, demo: true, demoSample: true, state };
    }
    const david = db.accounts["demo-sample-david-park"];
    david.state.rooms.existing = {
      id: "existing",
      partnerId: "preserved-reference",
    };
    david.state.savedByRole.mentor.add("preserved-saved");
    david.state.incomingByRole.mentor.add("preserved-introduction");
    const isabel = db.accounts["demo-sample-isabel-cruz"];
    isabel.state.profiles.mentor.bio = "A user-edited biography";
    const priya = db.accounts["demo-sample-priya-shah"];
    priya.state.accountName = "A user-edited name";
    const studyloop = db.accounts["demo-sample-studyloop"];
    // Also exercise refresh from a versioned baseline.
    studyloop.demoFixture = {
      version: 1,
      snapshot: {
        name: studyloop.state.accountName,
        profile: structuredClone(studyloop.state.profiles.founder),
      },
    };
    db.accounts.ordinary = { id: "ordinary", state: createInitialState() };
    storage.commit(db, db.revision);
    storage.close();
    const workspace = createWorkspace(file, { demoMode: true });
    workspace.close();
    const refreshed = readWorkspaceSnapshot(file);
    assert.equal(Object.keys(refreshed.accounts).length, 34);
    const updated = refreshed.accounts[david.id];
    assert.equal(updated.demoFixture.version, demoDirectoryVersion);
    assert.equal(
      updated.state.profiles.mentor.image,
      "/demo/avatars/david.svg",
    );
    assert.equal(
      refreshed.accounts[studyloop.id].demoFixture.version,
      demoDirectoryVersion,
    );
    assert.deepEqual(updated.state.rooms, david.state.rooms);
    assert.deepEqual(updated.state.savedByRole, david.state.savedByRole);
    assert.deepEqual(updated.state.incomingByRole, david.state.incomingByRole);
    const legacyPreferences = {
      match: true,
      activity: true,
      reminders: true,
      digest: "off",
    };
    assert.deepEqual(refreshed.accounts[isabel.id], {
      ...isabel,
      notificationPreferences: legacyPreferences,
    });
    assert.deepEqual(refreshed.accounts[priya.id], {
      ...priya,
      notificationPreferences: legacyPreferences,
    });
    assert.deepEqual(refreshed.accounts.ordinary, {
      ...db.accounts.ordinary,
      notificationPreferences: legacyPreferences,
    });
    createWorkspace(file, { demoMode: true }).close();
    assert.deepEqual(
      readWorkspaceSnapshot(file),
      refreshed,
      "second startup must be idempotent",
    );
    createWorkspace(file, { demoMode: false }).close();
    assert.deepEqual(
      readWorkspaceSnapshot(file),
      refreshed,
      "real-account mode must not seed or refresh samples",
    );
  });
}
