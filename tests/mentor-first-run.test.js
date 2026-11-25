// Fixes from the first-time mentor review: honest hours, alerts for the
// person who is waiting, an accurate self-picture and the reported bugs.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import { createModel } from "../src/data/model.js";
import { closestProfiles } from "../src/data/home.js";
import { officeAllocation } from "../server/office-hours.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";
import { applicationSteps } from "./mentor-onboarding-fixtures.js";
import {
  availabilityLine,
  capacityErrors,
  capacityUsageText,
  cooldownActive,
  cooldownText,
  closedFormatsLine,
  formatHours,
  formatUnavailableText,
  mentorConfig,
  mentorMonthKey,
  requestStatusLabel,
  unavailableText,
} from "../src/data/mentor-rules.js";
import { httpUrl, linkParts } from "../src/data/links.js";
import { monthCells } from "../src/data/planning.js";
import { errorTitle } from "../src/state/feedback.js";
import { publicMentorshipTrust } from "../src/data/mentor-impact.js";
import {
  reviewCategories,
  awaitingPayment,
  checkInsConfirmedText,
  closedRoomText,
  mentorshipCardSummary,
  mentorshipStageText,
  mentorshipNextAction,
  paymentNextAction,
} from "../src/data/mentor-room.js";
import {
  missingProfileKeys,
  missingProfileText,
  profileKeys,
} from "../src/data/selectors.js";
import { approvalCopy, finalRejection } from "../src/data/mentor-onboarding.js";
import {
  dayKeyIn,
  formatDate,
  formatMonth,
  formatTimeRange,
  nextDayKey,
} from "../src/data/dates.js";
import { moneyLabel, priceRangeText } from "../src/data/pricing.js";
import { mentorEmailKinds } from "../src/data/mentor-email.js";
import { digestContent } from "../src/data/notifications.js";

const day = 86400000;
const founderValues = {
  startupName: "Ledgerly",
  bio: "Building budgeting tools for student founders.",
  offer: "User feedback",
  need: "Product strategy",
  industry: "FinTech",
  stage: "idea",
  teamSize: "3",
};
const mentorValues = {
  bio: "Product mentor for student teams.",
  offer: "Product strategy",
  expertise: "Product strategy",
  startups: "FinTech student tools",
};
const allFormats = Object.fromEntries(
  [
    "single-session",
    "quick-ask",
    "doc-review",
    "ongoing-advisory",
    "office-hours",
  ].map((id) => [`format-${id}`, "on"]),
);

function setup(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-mentor-first-run-"));
  const clock = { value: Date.parse("2031-03-03T02:00:00Z") };
  const w = createWorkspace(join(dir, "workspace.sqlite"), {
    now: () => clock.value,
    mentorApprovalRequired: false,
    adminEmails: ["admin@example.com"],
    ...options,
  });
  t.after(() => {
    w.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  const act = (u, command) =>
    w.act(u.token, { role: u.role, ...command }).state;
  const view = (u) => w.get(u.token, u.role).state;
  const user = (name, role, values, { guidelines = true } = {}) => {
    const u = {
      ...w.login(
        {
          firstName: name,
          lastName: "Test",
          email: `${name.toLowerCase()}@example.com`,
          password: "private-password",
          role,
        },
        true,
      ),
      role,
    };
    if (values) act(u, { form: "profile-form", values });
    if (role === "mentor" && guidelines)
      act(u, { form: "accept-guidelines", values: { version: 2 } });
    return u;
  };
  const capacity = (mentor, values = {}) =>
    act(mentor, {
      form: "mentor-capacity",
      values: {
        maxMentees: 3,
        monthlyHours: 6,
        maxOpenAsync: 3,
        responseDays: 3,
        timeZone: "Asia/Manila",
        ...allFormats,
        ...values,
      },
    });
  const request = (founder, mentor, format = "single-session") =>
    act(founder, {
      action: "send-request",
      id: `${mentor.state.accountId}:mentor`,
      values: { ...mentorRequestValues, format },
    });
  const accept = (mentor, founder) =>
    act(mentor, {
      action: "accept-request",
      id: `${founder.state.accountId}:founder`,
    }).activeRoomId;
  return { w, clock, act, view, user, capacity, request, accept };
}
const idOf = (u) => `${u.state.accountId}:${u.role}`;

test("P1.1 the hours a mentor sees are the hours the server enforces", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  s.capacity(mentor);
  const date = new Date(s.clock.value + 2 * day).toISOString().slice(0, 10);
  s.act(mentor, {
    action: "open-office-slot",
    values: {
      date,
      time: "18:00",
      durationMinutes: 60,
      recurring: true,
      confirmClosing: true,
    },
  });
  const state = s.view(mentor);
  const usage = state.mentorUsage;
  const month = mentorMonthKey(s.clock.value, "Asia/Manila");
  const enforced = officeAllocation(
    s.w.get(mentor.token, "mentor").state,
    s.clock.value,
    state.mentorConfig,
  ).months[month];
  assert.ok(usage.minutesReserved > 0, "open slots reserve hours");
  assert.equal(usage.minutesUsed, enforced);
  assert.equal(
    usage.minutesUsed,
    usage.minutesCommitted + usage.minutesReserved,
  );
  assert.equal(
    usage.hoursLeft,
    Math.round(((6 * 60 - enforced) / 60) * 10) / 10,
  );
  // Lowering below what the slots reserve is refused in the same numbers,
  // naming the month for people.
  assert.throws(
    () => s.capacity(mentor, { monthlyHours: 1 }),
    (error) =>
      error.status === 409 &&
      error.message.includes(`${enforced / 60} h in March`) &&
      // (Nov 22, round 2) Written for people, with the slot count.
      error.message.includes(
        "Close 1 open Office Hours slot in March (Calendar) to lower your hours to 1.",
      ) &&
      !/\d{4}-\d{2}/.test(error.message),
  );
});

test("P1.2 and P1.4 founders and the mentor read the same open slots and closed formats", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor, { maxMentees: 2, maxOpenAsync: 2, monthlyHours: 1 });
  const own = s.view(mentor).mentorUsage;
  const listed = s
    .view(founder)
    .directory.mentors.find((person) => person.id === idOf(mentor));
  // Mentee slots and async slots are named, never added together.
  assert.equal(listed.availability, availabilityLine(own));
  assert.match(
    listed.availability,
    /2 session slots · 2 quick-ask or review slots open/,
  );
  assert.doesNotMatch(listed.availability, /4 slots/);
  // One hour can't hold a new advisory cycle; Office Hours has no slot.
  const closed = closedFormatsLine(own);
  assert.match(closed, /^Closed to founders right now: /);
  // (Nov 22, round 2) The line names the month the hours run out.
  assert.match(
    closed,
    /Ongoing Advisory \(not enough hours in March( 2031)? for a new 8-week cycle\)/,
  );
  assert.match(closed, /Office Hours \(no open slots\)/);
  assert.deepEqual(
    [...listed.availableFormats].sort(),
    [...own.availableFormats].sort(),
  );
});

test("P1.3 opening a slot that closes a format asks first and names the month", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  s.capacity(mentor, { monthlyHours: 4 });
  assert.ok(
    s.view(mentor).mentorUsage.availableFormats.includes("ongoing-advisory"),
  );
  const date = new Date(s.clock.value + 2 * day).toISOString().slice(0, 10);
  const open = (extra = {}) =>
    s.act(mentor, {
      action: "open-office-slot",
      values: {
        date,
        time: "18:00",
        durationMinutes: 30,
        recurring: true,
        ...extra,
      },
    });
  // (Nov 22, round 2) A confirmation, not an error: the answer succeeds,
  // carries the question and opens nothing until confirmed.
  const asked = open();
  const check = asked.officeSlotCheck;
  assert.equal(check.reason, "closes-formats");
  assert.match(
    check.message,
    /This slot closes Ongoing Advisory to new founders in (March|April|May)( 2031)?\./,
  );
  assert.doesNotMatch(check.message, /\d{4}-\d{2}/);
  assert.equal(asked.toast, "");
  assert.equal(asked.profiles.mentor.officeHours.length, 0);
  assert.equal(s.view(mentor).profiles.mentor.officeHours.length, 0);
  const opened = open({ confirmClosing: true });
  assert.equal(opened.profiles.mentor.officeHours.length, 1);
  assert.equal(opened.officeSlotCheck, undefined);
  assert.match(opened.toast, /Ongoing Advisory is closed to new founders/);
});

test("P1.6 and P4.27 settings and application errors name the field and range", (t) => {
  const s = setup(t, { mentorApprovalRequired: true });
  const { errors } = capacityErrors({
    maxMentees: "0",
    monthlyHours: "4",
    maxOpenAsync: "3",
    responseDays: "3",
    timeZone: "Asia/Manila",
  });
  assert.deepEqual(errors, { maxMentees: "Mentees at once: choose 1 to 10." });
  const mentor = s.user("Pat", "mentor", undefined, { guidelines: false });
  const save = (values) =>
    s.act(mentor, {
      action: "mentor-onboarding-save",
      values: { ...values, step: s.view(mentor).mentorApplication.step },
    });
  save(applicationSteps[0]);
  save(applicationSteps[1]);
  assert.throws(
    () => save({ ...applicationSteps[2], maxMentees: 11 }),
    (error) =>
      error.message === "Mentees at once: choose 1 to 10." &&
      error.fields.maxMentees === "Mentees at once: choose 1 to 10." &&
      !/maxMentees/.test(error.message),
  );
  assert.throws(
    () => save({ ...applicationSteps[2], timeZone: "Mars/Olympus" }),
    (error) =>
      error.fields.timeZone === "Time zone: choose a time zone from the list.",
  );
  assert.throws(
    () => save({ ...applicationSteps[2], maxMentees: 0, monthlyHours: 99 }),
    (error) => error.message === "Check Mentees at once, Hours per month.",
  );
});

test("P1.6 lowering a limit below current use explains it in the roadmap's words", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const a = s.user("Alex", "founder", founderValues);
  const b = s.user("Sam", "founder", {
    ...founderValues,
    startupName: "Kitabook",
  });
  s.capacity(mentor, { monthlyHours: 10 });
  for (const founder of [a, b]) {
    s.request(founder, mentor);
    s.accept(mentor, founder);
  }
  s.capacity(mentor, { maxMentees: 1, monthlyHours: 10 });
  const usage = s.view(mentor).mentorUsage;
  assert.equal(
    capacityUsageText(usage),
    "You have 2 active mentees and a limit of 1. New requests for sessions resume when you're under the limit.",
  );
  assert.doesNotMatch(capacityUsageText(usage), /2 of 1/);
});

test("P2.7 a declined or expired founder gets an unread action, never a digest", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const other = s.user("Jordan", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  s.capacity(other, { responseDays: 1 });
  // Weekly digest is the founder default; it pre-reads ordinary activity.
  s.request(founder, mentor);
  s.act(mentor, {
    action: "decline-request",
    id: idOf(founder),
    values: { reason: "not-a-fit", message: "Not my area, sorry." },
  });
  s.request(founder, other);
  s.clock.value += 2 * day;
  const notices = s.view(founder).notifications;
  for (const kind of ["declined", "expired"]) {
    const notice = notices.find((item) => item.kind === kind);
    assert.ok(notice, `${kind} notice exists`);
    assert.equal(notice.category, "action");
    assert.equal(notice.digested, false);
    assert.equal(notice.read, false);
  }
  // The digest summary never counts them; they stay under "Needs you".
  const state = s.view(founder);
  const { activity } = digestContent(state.notifications, {
    people: [],
    rooms: state.rooms,
    role: "founder",
    now: s.clock.value,
    span: 7 * day,
  });
  assert.equal(
    activity.some((item) => ["declined", "expired"].includes(item.kind)),
    false,
  );
});

test("P2.7 and P2.8 a proposed check-in time is an unread action for the mentor", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor, { monthlyHours: 40 });
  s.request(founder, mentor, "ongoing-advisory");
  const activeRoomId = s.accept(mentor, founder);
  s.act(mentor, { action: "confirm-goal", activeRoomId });
  const date = new Date(s.clock.value + 2 * day).toISOString().slice(0, 10);
  s.act(founder, {
    form: "propose-check-in-time",
    activeRoomId,
    values: { date, time: "10:00", timeZone: "Asia/Manila" },
  });
  const state = s.view(mentor);
  const notice = state.notifications.find(
    (item) => item.kind === "check-in-time",
  );
  assert.ok(notice);
  assert.equal(notice.category, "action");
  assert.equal(notice.read, false);
  assert.equal(notice.digested, false);
  assert.match(notice.text, /Confirm it/);
  // Home's prompt reads the same pending proposal.
  const room = state.rooms[activeRoomId];
  assert.ok(room.cycle.proposedTime && !room.cycle.confirmedAt);
});

test("P2.9 a mentor in a decline cooldown is left out of alerts, suggestions and alternatives", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const other = s.user("Jordan", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  s.capacity(other);
  const before = s.view(founder);
  assert.ok(
    before.notifications.some((item) => item.matchId === idOf(mentor)),
    "a strong match alert exists before the decline",
  );
  s.request(founder, mentor);
  s.act(mentor, {
    action: "decline-request",
    id: idOf(founder),
    values: { reason: "not-a-fit" },
  });
  const state = s.view(founder);
  const listed = state.directory.mentors.find(
    (person) => person.id === idOf(mentor),
  );
  assert.ok(Date.parse(listed.cooldownUntil) > s.clock.value);
  // Generated match alerts (the digest's source) leave the mentor out.
  assert.equal(
    state.notifications.some(
      (item) => item.kind === "match" && item.matchId === idOf(mentor),
    ),
    false,
  );
  assert.equal(
    createModel(state)
      .suggestedMatches()
      .some((person) => person.id === idOf(mentor)),
    false,
  );
  // Alternatives offered elsewhere skip the cooled-down mentor.
  s.request(founder, other);
  s.act(other, {
    action: "decline-request",
    id: idOf(founder),
    values: { reason: "no-slots" },
  });
  const declined = s
    .view(founder)
    .mentorRequests.find((entry) => entry.partnerId === idOf(other));
  assert.equal(
    declined.alternatives.some((item) => item.id === idOf(mentor)),
    false,
  );
  // After the cooldown the mentor is suggested again.
  s.clock.value += 31 * day;
  assert.equal(
    s
      .view(founder)
      .directory.mentors.find((person) => person.id === idOf(mentor))
      .cooldownUntil,
    undefined,
  );
});

test("P2.10 checkout expiry closes the founder's room as well as the mentor's", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  s.act(mentor, { action: "start-payout-setup" });
  s.act(mentor, {
    action: "set-format-price",
    values: { format: "single-session", price: 150000 },
  });
  s.request(founder, mentor);
  const id = s.accept(mentor, founder);
  s.act(founder, { action: "pay", activeRoomId: id });
  const result = s.act(founder, {
    action: "simulate-payment",
    activeRoomId: id,
    values: { result: "expiry" },
  });
  assert.equal(result.toast, "Checkout expired. This request is closed.");
  for (const u of [founder, mentor]) {
    const room = s.view(u).rooms[id];
    assert.equal(room.status, "cancelled");
    assert.equal(room.closeReason, "payment-lapsed");
  }
  assert.equal(
    closedRoomText(s.view(founder).rooms[id]),
    "Checkout expired. This request is closed.",
  );
});

test("P2.11 a failed payment keeps the request open and says how to retry", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  s.act(mentor, { action: "start-payout-setup" });
  s.act(mentor, {
    action: "set-format-price",
    values: { format: "single-session", price: 150000 },
  });
  s.request(founder, mentor);
  const id = s.accept(mentor, founder);
  s.act(founder, { action: "pay", activeRoomId: id });
  const result = s.act(founder, {
    action: "simulate-payment",
    activeRoomId: id,
    values: { result: "failure" },
  });
  assert.match(
    result.toast,
    /Nothing was charged\. Select Retry payment to try again\./,
  );
  assert.equal(s.view(founder).rooms[id].payment.status, "due");
  assert.ok(s.view(founder).rooms[id].payment.failedAt);
});

test("P3.12 and P3.16 an approved mentor is listed and verified, and mentor keys never ask for a founder field", (t) => {
  const s = setup(t, { mentorApprovalRequired: true });
  assert.equal(profileKeys("mentor").includes("need"), false);
  const admin = s.user("Admin", "founder", founderValues);
  const founder = s.user("Alex", "founder", {
    ...founderValues,
    startupName: "Kitabook",
  });
  const mentor = s.user("Pat", "mentor", undefined, { guidelines: false });
  for (const values of applicationSteps)
    s.act(mentor, {
      action: "mentor-onboarding-save",
      values: { ...values, step: s.view(mentor).mentorApplication.step },
    });
  // The moderator sees what was applied for beside the evidence.
  const entry = s
    .view(admin)
    .moderation.mentorApprovals.find(
      (item) => item.accountId === mentor.state.accountId,
    );
  assert.deepEqual([...entry.profile.formats].sort(), [
    "office-hours",
    "quick-ask",
    "single-session",
  ]);
  assert.equal(
    entry.profile.pastExperience,
    "Startup product and design advisor.",
  );
  assert.equal(entry.profile.noConflicts, true);
  assert.equal(entry.profile.capacity.maxMentees, 3);
  s.act(admin, { action: "approve-mentor", id: mentor.state.accountId });
  const own = s.view(mentor);
  assert.equal(own.mentorListing.listed, true);
  assert.equal(own.mentorVerification.label, "Endorsing organization checked");
  // The summary is past experience only, never copied into the bio, which
  // holds the separate introduction.
  assert.equal(
    own.profiles.mentor.pastExperience,
    "Startup product and design advisor.",
  );
  assert.equal(
    own.profiles.mentor.bio,
    "I help student founders test their product with real users.",
  );
  const listed = s
    .view(founder)
    .directory.mentors.find((person) => person.id === idOf(mentor));
  assert.equal(listed.affiliation.status, "verified");
});

test("simulated mentor approval approves only your own pending application, and only when the flag is on", (t) => {
  const submit = (s, mentor) => {
    for (const values of applicationSteps)
      s.act(mentor, {
        action: "mentor-onboarding-save",
        values: { ...values, step: s.view(mentor).mentorApplication.step },
      });
  };
  const off = setup(t, { mentorApprovalRequired: true });
  const kept = off.user("Pat", "mentor", undefined, { guidelines: false });
  submit(off, kept);
  assert.throws(
    () => off.act(kept, { action: "simulate-mentor-approval" }),
    /turned off/,
  );
  assert.equal(off.view(kept).mentorApplication.status, "pending");

  const s = setup(t, {
    mentorApprovalRequired: true,
    simulateVerification: true,
  });
  const mentor = s.user("Sam", "mentor", undefined, { guidelines: false });
  assert.throws(
    () => s.act(mentor, { action: "simulate-mentor-approval" }),
    /Submit your mentor application first/,
  );
  submit(s, mentor);
  const state = s.act(mentor, { action: "simulate-mentor-approval" });
  assert.equal(state.toast, "Mentor approved (simulated).");
  const own = s.view(mentor);
  assert.equal(own.mentorApplication, null);
  assert.equal(own.mentorListing.listed, true);
  assert.equal(own.mentorVerification.label, "Endorsing organization checked");
  assert.ok(own.profiles.mentor.mentorApprovedAt);
  assert.equal(own.profiles.mentor.mentorApprovedBy, "simulated");
  assert.ok(own.notifications.some((item) => item.kind === "mentor-approved"));
  // Already approved, so there is nothing left to simulate.
  assert.throws(
    () => s.act(mentor, { action: "simulate-mentor-approval" }),
    /Submit your mentor application first/,
  );
});

test("an introduction from an incomplete profile names the missing fields", (t) => {
  assert.equal(
    missingProfileText(["startups"]),
    "the startups you want to help",
  );
  assert.equal(
    missingProfileText(["bio", "industry", "teamSize"]),
    "an introduction, your industry and your team size",
  );
  assert.deepEqual(
    missingProfileKeys({ ...mentorValues, startups: " " }, "mentor"),
    ["startups"],
  );
  // Industries is optional in the application and is the only thing that
  // fills "Startups I want to help", so an approved mentor can still lack it.
  const s = setup(t, { mentorApprovalRequired: true });
  const admin = s.user("Admin", "founder", founderValues);
  const founder = s.user("Alex", "founder", {
    ...founderValues,
    startupName: "Kitabook",
  });
  const mentor = s.user("Pat", "mentor", undefined, { guidelines: false });
  for (const values of applicationSteps.slice(0, -1))
    s.act(mentor, {
      action: "mentor-onboarding-save",
      values: { ...values, step: s.view(mentor).mentorApplication.step },
    });
  s.act(mentor, {
    action: "mentor-onboarding-save",
    values: { industries: "", stages: "", step: 7 },
  });
  s.act(admin, { action: "approve-mentor", id: mentor.state.accountId });
  assert.deepEqual(
    missingProfileKeys(s.view(mentor).profiles.mentor, "mentor"),
    ["startups"],
  );
  assert.throws(
    () => s.act(mentor, { action: "interest", id: idOf(founder) }),
    /^Error: Add the startups you want to help to your profile before sending or accepting an introduction\.$/,
  );
});

test("a second rejection closes the application and says what is still possible", (t) => {
  const s = setup(t, { mentorApprovalRequired: true });
  const admin = s.user("Admin", "founder", founderValues);
  const mentor = s.user("Pat", "mentor", undefined, { guidelines: false });
  const submit = () => {
    for (const values of applicationSteps)
      s.act(mentor, {
        action: "mentor-onboarding-save",
        values: { ...values, step: s.view(mentor).mentorApplication.step },
      });
  };
  const reject = () =>
    s.act(admin, {
      action: "reject-mentor",
      id: mentor.state.accountId,
      values: { reason: "The endorsement could not be checked." },
    });
  submit();
  reject();
  let application = s.view(mentor).mentorApplication;
  assert.equal(finalRejection(application), false);
  assert.equal(
    approvalCopy(application, 2),
    "The endorsement could not be checked.",
  );
  // The first rejection can be edited and sent again.
  s.act(mentor, { action: "mentor-onboarding-save" });
  submit();
  reject();
  application = s.view(mentor).mentorApplication;
  assert.equal(finalRejection(application), true);
  assert.equal(
    approvalCopy(application, 2),
    "The endorsement could not be checked. This was your second application, so it can't be resubmitted. You can still use Synergy as a startup founder: switch profiles in Settings.",
  );
  assert.throws(
    () => s.act(mentor, { action: "mentor-onboarding-save" }),
    /cannot be edited/,
  );
});

test("P3.14 and P4.26 the application stores a separate introduction and refuses over-long text", (t) => {
  const s = setup(t, { mentorApprovalRequired: true });
  const mentor = s.user("Pat", "mentor", undefined, { guidelines: false });
  const save = (values) =>
    s.act(mentor, {
      action: "mentor-onboarding-save",
      values: { ...values, step: s.view(mentor).mentorApplication.step },
    });
  for (const values of applicationSteps.slice(0, 6)) save(values);
  assert.throws(
    () => save({ experience: "x".repeat(1501), bio: "Product mentor." }),
    (error) =>
      error.fields.experience ===
      "Experience summary: shorten it to 1,500 characters (now 1,501).",
  );
  // The introduction is required: without it the approved mentor couldn't
  // send an introduction, so the application refuses to move on.
  for (const bio of [undefined, "", "   "])
    assert.throws(
      () => save({ experience: "Ten years in product.", bio }),
      (error) =>
        error.fields.bio ===
        "Short introduction: add two or three sentences on who you help.",
    );
  assert.equal(s.view(mentor).mentorApplication.step, 6);
  save({
    experience: "Ten years in product.",
    bio: "I help student founders choose their next experiment.",
  });
  const profile = s.view(mentor).profiles.mentor;
  assert.equal(profile.pastExperience, "Ten years in product.");
  assert.equal(
    profile.bio,
    "I help student founders choose their next experiment.",
  );
});

test("P4.26 a decline message over the limit is refused, never cut off", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  s.request(founder, mentor);
  assert.throws(
    () =>
      s.act(mentor, {
        action: "decline-request",
        id: idOf(founder),
        values: { reason: "other", message: "a".repeat(281) },
      }),
    (error) => /shorten it to 280 characters \(now 281\)/.test(error.message),
  );
  assert.equal(s.view(mentor).incomingByRole.mentor.size, 1);
});

test("P4.20 and P4.22 payout and price actions show their own messages and specific errors", (t) => {
  const s = setup(t, { mentorApprovalRequired: true });
  const mentor = s.user("Pat", "mentor", undefined, { guidelines: false });
  for (const values of applicationSteps)
    s.act(mentor, {
      action: "mentor-onboarding-save",
      values: { ...values, step: s.view(mentor).mentorApplication.step },
    });
  // The application's toast never replays after a payment action.
  let state = s.act(mentor, { action: "start-payout-setup" });
  assert.equal(state.toast, "Payout setup complete.");
  state = s.act(mentor, {
    action: "set-format-price",
    values: { format: "single-session", price: 0 },
  });
  assert.equal(state.toast, "Single Session price saved.");
  assert.throws(
    () =>
      s.act(mentor, {
        action: "set-format-price",
        values: { format: "single-session", price: 100 },
      }),
    (error) =>
      error.message ===
        `Choose Free (0) or a price from ${priceRangeText()}.` &&
      error.message.includes("₱300–₱10,000"),
  );
  const unready = s.user("Jordan", "mentor", mentorValues, {
    guidelines: false,
  });
  assert.throws(
    () =>
      s.act(unready, {
        action: "set-format-price",
        values: { format: "single-session", price: 150000 },
      }),
    /Accept the current mentor guidelines/,
  );
  s.act(unready, { form: "accept-guidelines", values: { version: 2 } });
  assert.throws(
    () =>
      s.act(unready, {
        action: "set-format-price",
        values: { format: "single-session", price: 150000 },
      }),
    /^Error: Complete payout setup before charging for a format\.$/,
  );
  assert.equal(moneyLabel(0), "₱0.00");
});

test("P4.23 counts show from the first session; only rates and ratings wait for more data", () => {
  const stat = (value, count) => ({ value, count });
  const shown = publicMentorshipTrust(
    {
      role: "mentor",
      sessions: stat(1, 1),
      founders: stat(1, 1),
      minutes: 60,
      averageRating: stat(5, 1),
      topSkills: stat(["Product"], 1),
      followThrough: stat(1, 1),
      responseRate: stat(1, 1),
      responseHours: stat(2, 1),
      noShowRate: stat(0, 1),
      badges: [],
      testimonials: [],
      highlights: [],
    },
    mentorConfig,
  );
  assert.deepEqual(shown.sessions, stat(1, 1));
  assert.deepEqual(shown.founders, stat(1, 1));
  assert.equal(shown.minutes, 60);
  assert.equal(shown.averageRating.value, null);
  assert.equal(shown.responseRate.value, null);
});

test("P4.24c closing a booked slot with no other open times does not promise any", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor, {
    monthlyHours: 40,
    ...{ "format-ongoing-advisory": "" },
  });
  const date = new Date(s.clock.value + 3 * day).toISOString().slice(0, 10);
  s.act(mentor, {
    action: "open-office-slot",
    values: { date, time: "10:00", durationMinutes: 60, confirmClosing: true },
  });
  const [slot] = s
    .view(founder)
    .directory.mentors.find((person) => person.id === idOf(mentor)).officeHours;
  const booked = s.act(founder, {
    action: "book-office-hours",
    id: idOf(mentor),
    values: { ...mentorRequestValues, slotId: slot.slotId, date },
  });
  const closed = s.act(mentor, {
    action: "close-office-slot",
    id: slot.slotId,
  });
  assert.match(closed.toast, /counted as a mentor cancellation/);
  const notice = s
    .view(founder)
    .notifications.find((item) => item.kind === "slot-closed");
  assert.match(notice.text, /has no other open times right now/);
  assert.doesNotMatch(notice.text, /next available/);
  assert.equal(
    s.view(founder).rooms[booked.activeRoomId].milestones.held.schedules[0]
      .cancelledBy,
    "mentor",
  );
});

test("P5.30 the room carries the whole request", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  s.request(founder, mentor);
  const id = s.accept(mentor, founder);
  for (const u of [mentor, founder]) {
    const info = s.view(u).rooms[id].mentorship;
    assert.equal(info.problem, mentorRequestValues.problem);
    assert.equal(info.tried, mentorRequestValues.tried);
    assert.equal(info.question, mentorRequestValues.question);
  }
});

test("P5.31 a mentor rates follow-through only once the follow-up is due", () => {
  const room = (followup) => ({
    role: "mentor",
    type: "mentorship",
    template: { version: 4 },
    terms: { draft: { format: "single-session" } },
    milestones: {},
    mentorship: { followup },
  });
  const now = Date.parse("2031-03-10T00:00:00Z");
  const ids = (r, options) =>
    reviewCategories(r, now, options).map(({ id }) => id);
  assert.deepEqual(ids(room(null)), ["preparedness"]);
  assert.deepEqual(ids(room(null), { cycle: true }), [
    "preparedness",
    "followThrough",
  ]);
  for (const category of reviewCategories(room(null), now))
    assert.ok(category.low && category.high, "each scale has anchors");
  assert.deepEqual(
    reviewCategories({ ...room(null), role: "founder" }, now).map(
      ({ id }) => id,
    ),
    ["usefulness", "clarity", "responsiveness"],
  );
});

test("P5.32 and P5.33 dates read for people and core emails come first", () => {
  assert.equal(formatMonth("2031-12", Date.parse("2031-03-01")), "December");
  assert.equal(
    formatMonth("2032-01", Date.parse("2031-03-01")),
    "January 2032",
  );
  assert.equal(formatTimeRange("18:00", 60), "6:00–7:00 PM");
  assert.equal(formatTimeRange("11:30", 60), "11:30 AM–12:30 PM");
  const kinds = Object.keys(mentorEmailKinds);
  const firstPayment = kinds.findIndex((kind) =>
    /payment|payout|refund/.test(kind),
  );
  assert.ok(
    kinds
      .slice(firstPayment)
      .every((kind) => /payment|payout|refund/.test(kind)),
  );
  assert.equal(kinds[0], "request");
});

test("P5.34 a preview mentor is not marked as having accepted the guidelines", (t) => {
  const s = setup(t, { demoMode: true });
  const preview = s.w.openDemo("mentor");
  const state = s.w.get(preview.token, "mentor").state;
  assert.equal(state.profiles.mentor.guidelinesAcceptedAt, null);
  assert.equal(state.mentorUsage.guidelines.status, "grace");
  assert.equal(state.mentorUsage.available, true);
});

test("investigation: a mentorship pair reads the same score from both sides", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  const fromFounder = s
    .view(founder)
    .directory.mentors.find((person) => person.id === idOf(mentor)).score;
  const fromMentor = s
    .view(mentor)
    .directory.mentorStartups.find(
      (person) => person.id === idOf(founder),
    ).score;
  assert.equal(fromMentor, fromFounder);
  // Mentor-facing cards never carry founder-swap copy.
  const card = s
    .view(mentor)
    .directory.mentorStartups.find((person) => person.id === idOf(founder));
  assert.equal(card.audienceWarning, "");
});

// Round 2 of the first-time mentor review (Nov 22, round 2).

test("R2 P1 founders read the same closed-format cause and month as the mentor", (t) => {
  const s = setup(t);
  const mentor = s.user("Maya", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor, { monthlyHours: 6 });
  const date = new Date(s.clock.value + 2 * day).toISOString().slice(0, 10);
  s.act(mentor, {
    action: "open-office-slot",
    values: {
      date,
      time: "18:00",
      durationMinutes: 60,
      recurring: true,
      confirmClosing: true,
    },
  });
  const own = s.view(mentor).mentorUsage;
  const listed = s
    .view(founder)
    .directory.mentors.find((person) => person.id === idOf(mentor));
  assert.equal(listed.formatReasons["ongoing-advisory"], "hours-limit");
  const month = listed.formatReasonMonths["ongoing-advisory"];
  assert.equal(month, own.reasonMonths["ongoing-advisory"]);
  const name = formatMonth(month);
  const founderText = unavailableText("hours-limit", listed.name, {
    format: "ongoing-advisory",
    month,
  });
  assert.equal(
    founderText,
    `Ongoing Advisory isn't open right now: Maya's ${name} hours are already booked.`,
  );
  assert.ok(
    closedFormatsLine(own).includes(
      `Ongoing Advisory (not enough hours in ${name} for a new 8-week cycle)`,
    ),
  );
  // The format list near the bottom of Match details names the same month.
  assert.equal(
    formatUnavailableText("hours-limit", { name: listed.name, month }),
    `Maya's ${name} hours are already booked`,
  );
  // The server refusal reads the same sentence.
  assert.throws(
    () => s.request(founder, mentor, "ongoing-advisory"),
    (error) => error.message.includes(founderText),
  );
});

test("R2 P1 session and quick-ask limits are named as slots founders recognize", () => {
  assert.equal(
    unavailableText("mentee-limit", "Maya Reyes"),
    "Maya Reyes has no session slots open right now.",
  );
  assert.equal(
    unavailableText("mentee-limit", "Maya Reyes", { format: "single-session" }),
    "Single Session isn't open right now: Maya Reyes has no session slots open.",
  );
  assert.equal(
    unavailableText("async-limit", "Maya Reyes", { format: "quick-ask" }),
    "Quick Ask isn't open right now: Maya Reyes has no quick-ask or review slots open.",
  );
  assert.equal(formatUnavailableText("mentee-limit"), "no session slots open");
  assert.equal(
    unavailableText("hours-limit", "Maya Reyes"),
    "Maya Reyes isn't taking new requests right now: Maya's hours for this month are already booked.",
  );
  for (const reason of [
    "mentee-limit",
    "async-limit",
    "hours-limit",
    "paused",
    "inbox-full",
  ]) {
    assert.doesNotMatch(unavailableText(reason, "Maya Reyes"), /mentee/i);
    assert.doesNotMatch(formatUnavailableText(reason), /mentee/i);
  }
});

test("R2 P2 mentorship rooms say action item and only the founder finishes one", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  s.request(founder, mentor);
  const activeRoomId = s.accept(mentor, founder);
  const create = (u, values) =>
    s.act(u, {
      form: "task-create",
      activeRoomId,
      values: { priority: "normal", status: "todo", ...values },
    });
  assert.throws(
    () => create(mentor, { title: "Ship it", status: "done" }),
    (error) =>
      error.status === 403 &&
      error.message === "Only the founder can mark an action item done.",
  );
  assert.throws(
    () => create(mentor, { title: "" }),
    (error) => /action item/.test(error.message) && !/task/.test(error.message),
  );
  const added = create(mentor, { title: "Interview five students" });
  assert.equal(added.toast, "Action item added.");
  const [item] = s.view(founder).rooms[activeRoomId].tasks;
  const done = s.act(founder, {
    form: "task-update",
    activeRoomId,
    id: item.id,
    values: { ...item, status: "done" },
  });
  assert.equal(done.rooms[activeRoomId].tasks[0].status, "done");
  assert.equal(
    errorTitle("task-create", { type: "mentorship" }),
    "Couldn't save the action item",
  );
  assert.equal(
    errorTitle("task-create", { type: "exchange" }),
    "Couldn't save the task",
  );
});

test("R2 P3.6 the founder's check-in toast addresses the founder", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor, { monthlyHours: 40 });
  s.request(founder, mentor, "ongoing-advisory");
  const activeRoomId = s.accept(mentor, founder);
  s.act(mentor, { action: "confirm-goal", activeRoomId });
  const date = new Date(s.clock.value + 2 * day).toISOString().slice(0, 10);
  const proposed = s.act(founder, {
    form: "propose-check-in-time",
    activeRoomId,
    values: { date, time: "10:00", timeZone: "Asia/Manila" },
  });
  assert.equal(
    proposed.toast,
    "Check-in time sent to Pat Test. You'll see it here once they confirm.",
  );
  assert.equal(
    proposed.notifications.some((item) => item.kind === "check-in-time"),
    false,
  );
  const notice = s
    .view(mentor)
    .notifications.find((item) => item.kind === "check-in-time");
  assert.match(
    notice.text,
    /^Founder proposed a regular advisory check-in time/,
  );
  assert.equal(notice.read, false);
  assert.equal(notice.category, "action");
});

test("R2 P3.7 paying is the founder's next step before and after a failure", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  s.act(mentor, { action: "start-payout-setup" });
  s.act(mentor, {
    action: "set-format-price",
    values: { format: "single-session", price: 50000 },
  });
  s.request(founder, mentor);
  const id = s.accept(mentor, founder);
  const before = mentorshipNextAction(s.view(founder).rooms[id]);
  assert.equal(before.mine, true);
  assert.match(before.text, /^Pay ₱500\.00 by .+ to confirm your session$/);
  assert.equal(before.action, "Pay now");
  assert.ok(before.pay);
  const waiting = mentorshipNextAction(s.view(mentor).rooms[id]);
  assert.equal(waiting.mine, false);
  assert.match(waiting.text, /^Waiting for the founder's payment \(due .+\)$/);
  s.act(founder, { action: "pay", activeRoomId: id });
  s.act(founder, {
    action: "simulate-payment",
    activeRoomId: id,
    values: { result: "failure" },
  });
  const after = mentorshipNextAction(s.view(founder).rooms[id]);
  assert.match(
    after.text,
    /^Payment didn't go through\. Pay ₱500\.00 by .+ to confirm your session$/,
  );
  assert.equal(after.action, "Retry payment");
  assert.match(
    mentorshipNextAction(s.view(mentor).rooms[id]).text,
    /^Waiting for the founder's payment/,
  );
});

test("R2 P3.8 a mentorship room card shows its stage and next session", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  s.request(founder, mentor);
  const activeRoomId = s.accept(mentor, founder);
  s.act(mentor, { action: "confirm-goal", activeRoomId });
  const date = new Date(s.clock.value + 3 * day).toISOString().slice(0, 10);
  s.act(founder, {
    form: "schedule",
    activeRoomId,
    values: {
      date,
      time: "10:00",
      timeZone: "Asia/Manila",
      durationMinutes: 60,
    },
  });
  const room = s.view(founder).rooms[activeRoomId];
  const summary = mentorshipCardSummary(room, s.clock.value);
  assert.match(summary.text, /^Goal confirmed · session \w{3}, \w{3} \d{1,2}/);
  assert.doesNotMatch(summary.text, /milestones/);
  assert.ok(summary.progress > 0 && summary.progress <= 100);
});

test("R2 P4 shared helpers: hours, links, statuses, dates and the month grid", () => {
  // 9: one formatter for Impact and the certificate.
  assert.equal(formatHours(15), "0.25 h");
  assert.equal(formatHours(90), "1.5 h");
  // 15: only valid http(s) addresses become links.
  assert.equal(httpUrl("javascript:alert(1)"), "");
  assert.equal(
    httpUrl("https://deck.example/view"),
    "https://deck.example/view",
  );
  assert.equal(httpUrl("ftp://files.example"), "");
  assert.deepEqual(
    linkParts("See https://a.example/x, then data:text/html,hi"),
    [
      { type: "text", text: "See" },
      { type: "text", text: " " },
      {
        type: "link",
        text: "https://a.example/x",
        href: "https://a.example/x",
      },
      { type: "text", text: "," },
      { type: "text", text: " " },
      { type: "text", text: "then" },
      { type: "text", text: " " },
      { type: "text", text: "data:text/html,hi" },
    ],
  );
  // 16: one sentence-case status map.
  assert.equal(requestStatusLabel("referred"), "Mentor suggested others");
  assert.equal(requestStatusLabel("pending"), "Waiting for a reply");
  // 18: tomorrow in the mentor's zone.
  assert.equal(
    dayKeyIn(Date.parse("2026-11-22T17:00:00Z"), "Asia/Manila"),
    "2026-11-23",
  );
  assert.equal(nextDayKey("2026-11-30"), "2026-12-01");
  assert.equal(nextDayKey("2026-12-31"), "2027-01-01");
  // Investigation: Nov 2, 2026 sits inside November's grid in Asia/Manila.
  const zone = process.env.TZ;
  process.env.TZ = "Asia/Manila";
  try {
    const cells = monthCells(new Date(2026, 10, 1, 12)).flat();
    const nov2 = cells.find((cell) => cell.key === "2026-11-02");
    assert.equal(nov2.inMonth, true);
    assert.equal(cells.filter((cell) => cell.inMonth).length, 30);
    assert.equal(cells[0].key, "2026-10-26");
  } finally {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
});

test("R2 P5.20 the mentor suggests another check-in time and the founder confirms it", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor, { monthlyHours: 40 });
  s.request(founder, mentor, "ongoing-advisory");
  const activeRoomId = s.accept(mentor, founder);
  s.act(mentor, { action: "confirm-goal", activeRoomId });
  const propose = (u, offset, time) =>
    s.act(u, {
      form: "propose-check-in-time",
      activeRoomId,
      values: {
        date: new Date(s.clock.value + offset * day).toISOString().slice(0, 10),
        time,
        timeZone: "Asia/Manila",
      },
    });
  // A mentor can only suggest another time once the founder proposed one.
  assert.throws(() => propose(mentor, 2, "09:00"), { status: 409 });
  propose(founder, 2, "10:00");
  const suggested = propose(mentor, 3, "15:00");
  assert.equal(
    suggested.toast,
    "Check-in time sent to Alex Test. You'll see it here once they confirm.",
  );
  const mentorRoom = suggested.rooms[activeRoomId];
  assert.equal(mentorRoom.cycle.proposedTime.proposedBy, "mentor");
  assert.equal(mentorRoom.cycle.proposedTime.time, "15:00");
  assert.equal(mentorshipNextAction(mentorRoom).mine, false);
  // The mentor can't confirm their own suggestion; the founder gets an
  // unread "Needs you" item and confirms it.
  assert.throws(
    () => s.act(mentor, { action: "confirm-check-in-time", activeRoomId }),
    { status: 403 },
  );
  const founderState = s.view(founder);
  const notice = founderState.notifications.find(
    (item) => item.kind === "check-in-time",
  );
  assert.match(
    notice.text,
    /^Your mentor suggested another advisory check-in time/,
  );
  assert.equal(notice.read, false);
  assert.equal(notice.category, "action");
  assert.equal(
    mentorshipNextAction(founderState.rooms[activeRoomId]).text,
    "Confirm the proposed check-in time",
  );
  const confirmed = s.act(founder, {
    action: "confirm-check-in-time",
    activeRoomId,
  });
  const room = confirmed.rooms[activeRoomId];
  assert.ok(room.cycle.confirmedAt);
  assert.equal(room.milestones.checkins.schedules.length, room.cycle.checkIns);
  assert.ok(
    room.milestones.checkins.schedules.every(
      (session) => session.time === "15:00",
    ),
  );
});

test("R2 P5.21 a mentor applicant can propose a missing expertise tag", (t) => {
  const s = setup(t, { mentorApprovalRequired: true });
  const mentor = s.user("Pat", "mentor", undefined, { guidelines: false });
  const proposed = s.act(mentor, {
    form: "tag-proposal",
    values: { label: "Customer retention" },
  });
  assert.equal(proposed.toast, "Tag proposed for moderator approval.");
  assert.deepEqual(
    proposed.myTagProposals.map(({ label, status }) => [label, status]),
    [["Customer retention", "pending"]],
  );
  assert.ok(proposed.mentorApplication, "still applying");
});

test("R2 manual run: an unpaid room never blocks the mentor's Calendar actions", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  s.act(mentor, { action: "start-payout-setup" });
  s.act(mentor, {
    action: "set-format-price",
    values: { format: "single-session", price: 50000 },
  });
  s.request(founder, mentor);
  const unpaid = s.accept(mentor, founder);
  const date = new Date(s.clock.value + 2 * day).toISOString().slice(0, 10);
  // The client sends the tab's last room with every command.
  const opened = s.act(mentor, {
    action: "open-office-slot",
    activeRoomId: unpaid,
    values: { date, time: "18:00", durationMinutes: 30, confirmClosing: true },
  });
  assert.equal(opened.profiles.mentor.officeHours.length, 1);
  // Room commands in the unpaid room still wait for the payment.
  assert.throws(
    () => s.act(mentor, { action: "confirm-goal", activeRoomId: unpaid }),
    /Complete payment before starting this mentorship\./,
  );
});

test("R3.1 a mentor who declined the founder is left out of the closest profiles and the refusal reads like Introductions", (t) => {
  const s = setup(t);
  const mentor = s.user("Maya", "mentor", mentorValues);
  const other = s.user("Tomas", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  s.capacity(other);
  assert.ok(
    closestProfiles(s.view(founder)).some(
      (person) => person.id === idOf(mentor),
    ),
    "the mentor is among the closest profiles before the decline",
  );
  s.request(founder, mentor);
  s.act(mentor, {
    action: "decline-request",
    id: idOf(founder),
    values: { reason: "not-a-fit" },
  });
  // The founder connects with another mentor, so Suggested is empty and
  // Matches falls back to the closest profiles.
  s.request(founder, other);
  s.accept(other, founder);
  const state = s.view(founder);
  assert.deepEqual(createModel(state).suggestedMatches(), []);
  assert.equal(
    closestProfiles(state).some((person) => person.id === idOf(mentor)),
    false,
  );
  // Browse all keeps the mentor as a directory entry, flagged with the date.
  const listed = createModel(state)
    .browsePeople()
    .find((person) => person.id === idOf(mentor));
  assert.ok(cooldownActive(listed.cooldownUntil));
  // The server's refusal names the day the same way as Introductions.
  assert.throws(
    () => s.request(founder, mentor),
    (error) =>
      error.status === 409 &&
      error.message ===
        `${cooldownText(listed.cooldownUntil, { now: s.clock.value, timeZone: "Asia/Manila" })}. Try another mentor in the meantime.` &&
      /^You can ask again after [A-Z][a-z]{2} \d{1,2}\./.test(error.message) &&
      !/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(error.message),
  );
});

test("R3.1 the cooldown line uses the shared date format", () => {
  const now = Date.parse("2026-11-22T04:00:00Z");
  assert.equal(
    cooldownText("2026-12-22T04:00:00Z", { now, timeZone: "Asia/Manila" }),
    "You can ask again after Dec 22",
  );
  assert.equal(
    cooldownText("2027-01-05T04:00:00Z", { now, timeZone: "Asia/Manila" }),
    "You can ask again after Jan 5, 2027",
  );
  assert.equal(cooldownActive("2026-12-22T04:00:00Z", now), true);
  assert.equal(cooldownActive("2026-11-01T04:00:00Z", now), false);
  assert.equal(cooldownActive(null, now), false);
});

test("R3.2 while a payment is due, the room offers no command the server would refuse", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  s.act(mentor, { action: "start-payout-setup" });
  s.act(mentor, {
    action: "set-format-price",
    values: { format: "single-session", price: 50000 },
  });
  s.request(founder, mentor);
  const id = s.accept(mentor, founder);
  for (const u of [founder, mentor])
    assert.equal(awaitingPayment(s.view(u).rooms[id]), true);
  // Share preparation and Confirm goal wait for the payment, so the room
  // hides them and Pay now is the founder's only primary action.
  assert.throws(
    () =>
      s.act(founder, {
        form: "prep-checklist",
        activeRoomId: id,
        values: { deck: "https://deck.example/view" },
      }),
    /Complete payment before starting this mentorship\./,
  );
  assert.throws(
    () => s.act(mentor, { action: "confirm-goal", activeRoomId: id }),
    /Complete payment before starting this mentorship\./,
  );
  assert.equal(
    paymentNextAction(s.view(founder).rooms[id], s.clock.value).action,
    "Pay now",
  );
  s.act(founder, { action: "pay", activeRoomId: id });
  s.act(founder, {
    action: "simulate-payment",
    activeRoomId: id,
    values: { result: "success" },
  });
  for (const u of [founder, mentor])
    assert.equal(awaitingPayment(s.view(u).rooms[id]), false);
  const shared = s.act(founder, {
    form: "prep-checklist",
    activeRoomId: id,
    values: { deck: "https://deck.example/view" },
  });
  assert.ok(shared.rooms[id].mentorship.prep.sharedAt);
});

test("R3.3 a mentorship room card names its stage once, in sentence case", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor);
  s.request(founder, mentor);
  const activeRoomId = s.accept(mentor, founder);
  s.act(mentor, { action: "confirm-goal", activeRoomId });
  for (const u of [founder, mentor]) {
    const room = s.view(u).rooms[activeRoomId];
    assert.equal(mentorshipStageText(room), "Goal confirmed");
    assert.equal(
      mentorshipCardSummary(room, s.clock.value).text,
      "Goal confirmed",
    );
  }
});

test("R3.4 confirming advisory check-ins lists every date for both people", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.capacity(mentor, { monthlyHours: 40 });
  s.request(founder, mentor, "ongoing-advisory");
  const activeRoomId = s.accept(mentor, founder);
  s.act(mentor, { action: "confirm-goal", activeRoomId });
  s.act(founder, {
    form: "propose-check-in-time",
    activeRoomId,
    values: {
      date: new Date(s.clock.value + 2 * day).toISOString().slice(0, 10),
      time: "10:00",
      timeZone: "Asia/Manila",
    },
  });
  const confirmed = s.act(mentor, {
    action: "confirm-check-in-time",
    activeRoomId,
  });
  const sessions = confirmed.rooms[activeRoomId].milestones.checkins.schedules;
  const dates = sessions.map((session) =>
    formatDate(session.date, { now: s.clock.value }),
  );
  assert.equal(dates.length, confirmed.rooms[activeRoomId].cycle.checkIns);
  const text = `Advisory check-ins confirmed. Check-ins: ${dates.join(", ")}. Reschedule any date from Schedule.`;
  // The mentor who confirmed reads it as a toast; the founder gets the same
  // list in the room's notification.
  assert.equal(confirmed.toast, text);
  assert.ok(s.view(founder).notifications.some((item) => item.text === text));
  assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\//);
  // The helper reads calendar-day keys without shifting a day.
  assert.equal(
    checkInsConfirmedText(
      ["2026-11-27", "2026-12-11", "2026-12-25", "2027-01-08"].map((date) => ({
        date,
      })),
      Date.parse("2026-11-22T04:00:00Z"),
    ),
    "Advisory check-ins confirmed. Check-ins: Nov 27, Dec 11, Dec 25, Jan 8, 2027. Reschedule any date from Schedule.",
  );
});
