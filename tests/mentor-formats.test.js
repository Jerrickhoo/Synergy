import test from "node:test";
import assert from "node:assert/strict";
import {
  canUpgrade,
  mentorFormat,
  mentorFormatIds,
  mentorFormatLabel,
  mentorFormats,
  normalizeMentorFormat,
  normalizeMentorFormats,
} from "../src/data/mentor-formats.js";
import { pageLabel } from "../src/data/filters.js";

test("the engagement ladder has the five spec formats in order", () => {
  assert.deepEqual(mentorFormatIds, [
    "quick-ask",
    "doc-review",
    "single-session",
    "office-hours",
    "ongoing-advisory",
  ]);
  for (const format of mentorFormats) {
    assert.ok(format.label && format.summary && format.effort);
    assert.ok(format.milestones.length >= 3);
    assert.ok(
      format.milestones.some((milestone) => milestone.confirm),
      `${format.id} needs at least one confirmed milestone`,
    );
    assert.equal(
      new Set(format.milestones.map((milestone) => milestone.id)).size,
      format.milestones.length,
    );
    for (const target of format.upgradeTo)
      assert.ok(mentorFormatIds.includes(target));
  }
});

test("legacy one-off and ongoing values map onto the ladder", () => {
  assert.equal(normalizeMentorFormat("one-off"), "single-session");
  assert.equal(normalizeMentorFormat("ongoing"), "ongoing-advisory");
  assert.equal(normalizeMentorFormat("quick-ask"), "quick-ask");
  assert.equal(normalizeMentorFormat("either"), null);
  assert.equal(normalizeMentorFormat(undefined), null);
  assert.equal(mentorFormatLabel("one-off"), "Single Session");
  assert.equal(mentorFormat("nope"), null);
});

test("stored format lists are cleaned, de-duplicated and kept in ladder order", () => {
  assert.deepEqual(
    normalizeMentorFormats([
      "ongoing",
      "quick-ask",
      "bogus",
      "ongoing-advisory",
    ]),
    ["quick-ask", "ongoing-advisory"],
  );
  assert.deepEqual(normalizeMentorFormats("quick-ask"), []);
});

test("upgrades only climb the ladder", () => {
  assert.ok(canUpgrade("single-session", "ongoing-advisory"));
  assert.ok(canUpgrade("one-off", "ongoing"));
  assert.ok(canUpgrade("quick-ask", "single-session"));
  assert.ok(!canUpgrade("ongoing-advisory", "single-session"));
  assert.ok(!canUpgrade("single-session", "quick-ask"));
});

test("mentors see request and mentee page labels; founders keep theirs", () => {
  assert.equal(pageLabel("waiting", "mentor"), "Requests");
  assert.equal(pageLabel("rooms", "mentor"), "Mentees");
  assert.equal(pageLabel("calendar", "mentor"), "Calendar");
  assert.equal(pageLabel("waiting", "founder"), "Introductions");
  assert.equal(pageLabel("rooms"), "Rooms");
});
