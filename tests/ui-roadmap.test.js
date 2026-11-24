import { mentorRequestValues } from "./mentor-request-fixtures.js";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createServer } from "node:http";
import sharp from "sharp";
import { createWorkspace, scoreProfile } from "../server/workspace.js";
import { createApi } from "../server/api.js";
import { configuration } from "../server/config.js";
import { inspectAvatar } from "../server/files.js";
import { decode } from "../src/state/serialization.js";
import {
  normalizeProfile,
  profileEntries,
} from "../src/data/profile-content.js";
import { profileCompleteness } from "../src/data/selectors.js";
import { filterPeople, validMinimumFit } from "../src/data/filters.js";
import { createInitialState, createModel } from "../src/data/model.js";
import { homeNextStep } from "../src/data/home.js";

const profile = {
  bio: "Student product\n\nWorking on onboarding.",
  offer: "Beta testing, Product feedback",
  need: "Product strategy",
  industry: "EdTech",
  stage: "idea",
  teamSize: "3",
};
function fixture(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-roadmap-"));
  const file = join(dir, "workspace.json");
  const workspace = createWorkspace(file, options);
  t.after(() => {
    workspace.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  return { workspace, file, dir };
}
function signup(workspace, name, role = "founder") {
  const user = workspace.login(
    {
      firstName: name,
      lastName: "Tester",
      email: `${name}@example.com`,
      password: "private-password",
      role,
    },
    true,
  );
  // New mentors accept the guidelines before taking requests (Phase 1).
  if (role === "mentor")
    workspace.act(user.token, {
      role,
      form: "accept-guidelines",
      values: { version: 2 },
    });
  return user;
}
const act = (workspace, user, command) =>
  workspace.act(user.token, { role: user.state.role, ...command });

test("Home selects real actions before sessions, active work, profile completion and discovery for both roles", () => {
  const now = new Date("2030-01-01T00:00:00Z");
  for (const role of ["founder", "mentor"]) {
    const state = createInitialState();
    state.role = role;
    assert.equal(homeNextStep(state, now).command.action, "edit-profile");
    state.profiles[role] =
      role === "founder"
        ? { ...profile }
        : {
            bio: "Mentor",
            offer: "Strategy",
            need: "Questions",
            expertise: "Product",
            availability: "Weekly",
            startups: "Early teams",
          };
    assert.equal(homeNextStep(state, now).command.page, "discover");
    const room = createModel(state).createRoom({
      id: "next-room",
      role,
      partnerId: "person",
      type: "mentorship",
    });
    state.rooms[room.id] = room;
    Object.assign(room.terms, {
      locked: true,
      partnerLocked: true,
      confirmedByMe: true,
    });
    room.milestones.session.schedule = {
      date: "2030-01-10",
      time: "10:00",
      timeZone: "UTC",
    };
    assert.equal(homeNextStep(state, now).command.tab, "schedule");
    state.incomingByRole[role].add("incoming-person");
    assert.equal(homeNextStep(state, now).command.page, "waiting");
    state.incomingByRole[role].clear();
    room.milestones.guidance.partner = true;
    assert.equal(homeNextStep(state, now).command.tab, "milestones");
    room.milestones.guidance.partner = false;
    room.milestones.session.schedule = {
      date: "2029-12-10",
      time: "10:00",
      timeZone: "UTC",
    };
    assert.equal(homeNextStep(state, now).command.id, room.id);
    room.status = "cancelled";
    state.profiles[role].bio = " ";
    assert.equal(homeNextStep(state, now).command.action, "edit-profile");
  }
});

test("Home asks for verification only after the profile, and never sends founders to a missing moderator", () => {
  const now = new Date("2030-01-01T00:00:00Z");
  const state = createInitialState();
  state.role = "founder";
  state.verification = "none";
  state.integrations = { requireVerification: true, moderation: true };
  assert.equal(homeNextStep(state, now).command.action, "edit-profile");
  state.profiles.founder = { ...profile };
  assert.equal(homeNextStep(state, now).command.action, "open-verification");
  state.verification = "pending";
  assert.match(homeNextStep(state, now).detail, /checking your evidence/);
  state.verification = "none";
  state.integrations.moderation = false;
  const locked = homeNextStep(state, now);
  assert.equal(locked.command.page, "discover");
  assert.equal(locked.title, "Introductions are not open yet");
  state.integrations.moderation = true;
  state.incomingByRole.founder.add("incoming-person");
  assert.equal(homeNextStep(state, now).command.page, "waiting");
  state.incomingByRole.founder.clear();
  state.verification = "verified";
  assert.equal(homeNextStep(state, now).command.page, "discover");
});

test("profile normalization discards blank entries, retains internal spaces and paragraphs, and gives blanks no fit", () => {
  const result = normalizeProfile({
    ...profile,
    bio: " \n Bio  with spaces\n\nSecond paragraph. \t ",
    offer: " , \t; First  skill, ; Second skill ; ",
    need: ["  ", "Product strategy", "\n"],
  });
  assert.equal(result.bio, "Bio  with spaces\n\nSecond paragraph.");
  assert.equal(result.offer, "First  skill, Second skill");
  assert.equal(result.need, "Product strategy");
  assert.deepEqual(profileEntries("\n\t, ;  \nSkill,\t"), ["Skill"]);
  assert.equal(
    normalizeProfile({ offer: "Paragraph one\n\nParagraph two" }).offer,
    "Paragraph one\n\nParagraph two",
  );
  const blank = { ...profile, bio: "\t \n", offer: " , ; \t\n", need: "\n" };
  assert.equal(profileCompleteness(blank, "founder"), 50);
  assert.equal(scoreProfile(blank, blank, false).factorScores[0], 0);
});

test("minimum fit accepts every whole percentage including equal thresholds and rejects invalid drafts", () => {
  const people = [0, 1, 49, 99, 100].map((score) => ({
    score,
    name: String(score),
    kind: "Startup",
    sector: "",
    summary: "",
    offer: [],
    need: [],
  }));
  const filters = {
    type: "all",
    industry: "all",
    engagement: "all",
    search: "",
  };
  for (let value = 0; value <= 100; value++) {
    assert.equal(validMinimumFit(String(value)), true);
    assert.deepEqual(
      filterPeople(people, { ...filters, score: String(value) }).map(
        (p) => p.score,
      ),
      people.filter((p) => p.score >= value).map((p) => p.score),
    );
  }
  assert.equal(validMinimumFit(""), true);
  for (const value of ["-1", "101", "1.5", "NaN", "e", "1e2", " "])
    assert.equal(validMinimumFit(value), false);
});

test("avatar validation decodes JPEG, PNG and WebP and rejects spoofed, corrupt, empty and oversized input", async () => {
  for (const [format, mime] of [
    ["jpeg", "jpeg"],
    ["png", "png"],
    ["webp", "webp"],
  ]) {
    const bytes = await sharp({
      create: { width: 32, height: 24, channels: 3, background: "#245e49" },
    })
      .toFormat(format)
      .toBuffer();
    const result = await inspectAvatar(
      `data:image/${mime};base64,${bytes.toString("base64")}`,
    );
    const metadata = await sharp(result).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 32);
    await assert.rejects(
      inspectAvatar(
        `data:image/${mime};base64,${bytes.subarray(0, 14).toString("base64")}`,
      ),
    );
  }
  const bytes = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    inspectAvatar(`data:image/jpeg;base64,${bytes.toString("base64")}`),
  );
  for (const value of [
    "",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/png;base64,Y29ycnVwdA==",
    `data:image/png;base64,${Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64")}`,
  ])
    await assert.rejects(inspectAvatar(value));
});

test("profile photo API publishes only on a valid save, enforces ownership and visibility, persists and removes", async (t) => {
  const { file, dir } = fixture(t);
  const api = createApi({
    file,
    config: configuration({
      SYNERGY_DATA_FILE: file,
      SYNERGY_DEMO_MODE: "false",
    }),
  });
  const server = createServer((req, res) =>
    api(req, res, () => {
      res.statusCode = 404;
      res.end();
    }),
  );
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  t.after(async () => {
    await new Promise((done) => server.close(done));
    api.close();
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body, token) => {
    const response = await fetch(`${origin}/api/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: decode(await response.text()) };
  };
  const a = (
    await post("signup", {
      firstName: "Photo",
      lastName: "Owner",
      email: "photo@example.com",
      password: "private-password",
      role: "founder",
    })
  ).body;
  const b = (
    await post("signup", {
      firstName: "Photo",
      lastName: "Viewer",
      email: "viewer@example.com",
      password: "private-password",
      role: "founder",
    })
  ).body;
  const png = await sharp({
    create: { width: 80, height: 60, channels: 3, background: "#245e49" },
  })
    .png()
    .toBuffer();
  const image = `data:image/png;base64,${png.toString("base64")}`;
  const saved = await post(
    "profile",
    { role: "founder", form: "profile-form", values: { ...profile, image } },
    a.token,
  );
  assert.equal(saved.status, 200);
  const path = saved.body.state.profiles.founder.image;
  assert.match(path, /^\/api\/avatars\/[0-9a-f-]+$/);
  const getPhoto = (token) =>
    fetch(`${origin}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  assert.equal((await getPhoto()).status, 401);
  assert.equal((await getPhoto(a.token)).status, 200);
  assert.equal((await getPhoto(b.token)).status, 200);
  const stolen = await post(
    "action",
    {
      role: "founder",
      form: "profile-form",
      values: { ...profile, image: path },
    },
    b.token,
  );
  assert.equal(stolen.status, 403);
  const realSimulation = await post(
    "action",
    {
      role: "founder",
      action: "simulate-acceptance",
      id: `${b.state.accountId}:founder`,
      demo: true,
      canSimulateAcceptance: true,
    },
    a.token,
  );
  assert.equal(realSimulation.status, 403);
  assert.equal(
    (
      await post(
        "profile",
        {
          role: "founder",
          form: "profile-form",
          values: { ...profile, image: 3 },
        },
        a.token,
      )
    ).status,
    400,
  );
  const bad = await post(
    "profile",
    {
      role: "founder",
      form: "profile-form",
      values: { ...profile, image: "data:image/png;base64,Y29ycnVwdA==" },
    },
    a.token,
  );
  assert.equal(bad.status, 400);
  const invalid = await post(
    "profile",
    {
      role: "founder",
      form: "profile-form",
      values: { ...profile, bio: " ", image },
    },
    a.token,
  );
  assert.ok(invalid.body.state.formErrors);
  assert.equal(invalid.body.state.profiles.founder.image, path);
  assert.equal(
    Object.values(decode(readFileSync(file, "utf8")).files).filter(
      (f) => f.purpose === "avatar",
    ).length,
    1,
  );
  await post("account/visibility", { visible: false }, a.token);
  assert.equal((await getPhoto(b.token)).status, 404);
  assert.equal((await getPhoto(a.token)).status, 200);
  const stored = decode(readFileSync(file, "utf8"));
  assert.equal(
    stored.accounts[a.state.accountId].state.profiles.founder.image,
    path,
  );
  assert.ok(readFileSync(join(dir, "uploads", path.split("/").at(-1))).length);
  const removed = await post(
    "profile",
    {
      role: "founder",
      form: "profile-form",
      values: { ...profile, image: "" },
    },
    a.token,
  );
  assert.equal(removed.body.state.profiles.founder.image, "");
  assert.equal((await getPhoto(a.token)).status, 404);
});

for (const role of ["founder", "mentor"])
  test(`prototype ${role} acceptance is owned, narrow, idempotent and persistent`, (t) => {
    const { workspace, file } = fixture(t, { demoMode: true });
    const user = workspace.openDemo(role);
    const otherRole = role === "founder" ? "mentors" : "founders";
    const person = user.state.directory[otherRole][0];
    const command = { action: "simulate-acceptance", id: person.id };
    assert.throws(() => act(workspace, user, command));
    act(workspace, user, {
      action: "interest",
      values: {
        ...mentorRequestValues,
        format: person.availableFormats?.[0] || mentorRequestValues.format,
      },
      id: person.id,
      engagementType: "mentorship",
    });
    const pending = workspace.get(user.token, role).state;
    assert.equal(
      pending.directory[otherRole].find((p) => p.id === person.id)
        .canSimulateAcceptance,
      true,
    );
    const accepted = act(workspace, user, command).state;
    const room = Object.values(accepted.rooms)[0];
    assert.equal(Object.keys(accepted.rooms).length, 1);
    assert.equal(room.type, "mentorship");
    assert.equal(room.template.version, 4);
    assert.equal(room.review.me, false);
    assert.equal(room.review.partner, false);
    assert.equal(accepted.waitingByRole[role].size, 0);
    assert.equal(accepted.interestByRole[role].size, 0);
    for (let retry = 0; retry < 3; retry++)
      assert.equal(act(workspace, user, command).state.activeRoomId, room.id);
    assert.equal(Object.keys(workspace.get(user.token).state.rooms).length, 1);
    const stored = decode(readFileSync(file, "utf8"));
    assert.equal(
      Object.keys(stored.accounts[user.state.accountId].state.rooms).length,
      1,
    );
    assert.equal(
      Object.keys(stored.accounts[person.accountId].state.rooms).filter(
        (id) => id === room.id,
      ).length,
      1,
    );
    for (const action of [
      "demo-partner-confirm",
      "partner-confirm",
      "demo-partner-review",
    ])
      assert.throws(() =>
        act(workspace, user, { action, activeRoomId: room.id, id: "session" }),
      );
  });

test("simulation rejects real actors, real targets, other previews, withdrawn, hidden and blocked introductions", (t) => {
  const { workspace } = fixture(t, { demoMode: true });
  const real = signup(workspace, "real");
  act(workspace, real, { form: "profile-form", values: profile });
  const user = workspace.openDemo("founder");
  const person = user.state.directory.mentors[0];
  assert.throws(
    () =>
      act(workspace, real, {
        action: "simulate-acceptance",
        id: person.id,
        demo: true,
        canSimulateAcceptance: true,
      }),
    // A real account may simulate only showcase profiles, never demo samples.
    /fictional prototype collaborator/,
  );
  assert.throws(
    () =>
      act(workspace, user, {
        action: "simulate-acceptance",
        id: `${real.state.accountId}:founder`,
      }),
    /fictional/,
  );
  const otherPreview = workspace.openDemo("mentor");
  assert.throws(
    () =>
      act(workspace, user, {
        action: "simulate-acceptance",
        id: `${otherPreview.state.accountId}:mentor`,
      }),
    /fictional/,
  );
  act(workspace, user, {
    action: "interest",
    values: { ...mentorRequestValues, format: person.availableFormats[0] },
    id: person.id,
    engagementType: "mentorship",
  });
  act(workspace, user, { action: "cancel-interest", id: person.id });
  assert.throws(
    () =>
      act(workspace, user, { action: "simulate-acceptance", id: person.id }),
    /no longer eligible/,
  );
  act(workspace, user, {
    action: "interest",
    values: { ...mentorRequestValues, format: person.availableFormats[0] },
    id: person.id,
    engagementType: "mentorship",
  });
  workspace.accounts.visibility(user.token, false);
  assert.throws(
    () =>
      act(workspace, user, { action: "simulate-acceptance", id: person.id }),
    /visible/,
  );
  workspace.accounts.visibility(user.token, true);
  act(workspace, user, {
    action: "interest",
    values: { ...mentorRequestValues, format: person.availableFormats[0] },
    id: person.id,
    engagementType: "mentorship",
  });
  workspace.accounts.block(user.token, person.accountId, true);
  assert.throws(() =>
    act(workspace, user, { action: "simulate-acceptance", id: person.id }),
  );
  assert.equal(Object.keys(workspace.get(user.token).state.rooms).length, 0);
});

test("profile reports record authenticated participants, optional details and moderation decisions without blocking", (t) => {
  const { workspace } = fixture(t, { adminEmails: ["moderator@example.com"] });
  const a = signup(workspace, "reporter");
  const b = signup(workspace, "reported");
  const moderator = signup(workspace, "moderator");
  for (const user of [a, b])
    act(workspace, user, { form: "profile-form", values: profile });
  const profileId = `${b.state.accountId}:founder`;
  for (const values of [
    { reason: "  " },
    { reason: "Spam", details: "x".repeat(3001) },
    { reason: "Spam", profileId: `${a.state.accountId}:founder` },
  ])
    assert.throws(() =>
      act(workspace, a, {
        form: "report-form",
        values: { profileId, ...values },
      }),
    );
  assert.equal(
    workspace.get(moderator.token).state.moderation.reports.length,
    0,
  );
  act(workspace, a, {
    form: "report-form",
    values: {
      profileId,
      reason: " Spam or scam ",
      details: " An unsolicited request. ",
      reporterAccountId: "forged",
      reportedAccountId: "forged",
    },
  });
  const report = workspace.get(moderator.token).state.moderation.reports[0];
  assert.equal(report.reporterAccountId, a.state.accountId);
  assert.equal(report.reporterProfileId, `${a.state.accountId}:founder`);
  assert.equal(report.reportedAccountId, b.state.accountId);
  assert.equal(report.reportedProfileId, profileId);
  assert.equal(report.details, "An unsolicited request.");
  assert.equal(report.roomId, null);
  assert.equal(workspace.accounts.settings(a.token).blocked.length, 0);
  act(workspace, moderator, {
    form: "moderation",
    values: {
      kind: "report",
      id: report.id,
      decision: "resolved",
      remedy: "none",
      note: "Reviewed profile concern.",
    },
  });
  assert.equal(
    workspace.get(moderator.token).state.moderation.reports[0].status,
    "resolved",
  );
});
