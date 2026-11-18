import test from "node:test";
import assert from "node:assert/strict";
import { initMentorship } from "../src/data/mentor-room.js";
import {
  badgesFor,
  mentorshipTrust,
  publicMentorshipTrust,
} from "../src/data/mentor-impact.js";

const now = Date.parse("2031-01-20T12:00:00Z");
function room(id, format, role = "mentor") {
  const model = initMentorship(
    {
      id,
      role,
      type: "mentorship",
      partnerAccountId: `partner-${id}`,
      terms: { draft: {} },
      review: { me: true, partner: true },
    },
    format,
    "Improve pricing",
    now,
  );
  model.mentorship.topics = ["Pricing Strategy"];
  return model;
}

test("impact aggregates held and async work, released ratings, response median and follow-through", () => {
  const a = room("a", "single-session");
  a.milestones.held.schedules = [
    { id: "one", durationMinutes: 45, outcome: "held" },
    { id: "two", durationMinutes: 45, outcome: "no-show-mentor" },
    { id: "three", durationMinutes: 45, outcome: "disputed" },
    {
      id: "four",
      durationMinutes: 45,
      lateCancel: true,
      cancelledBy: "mentor",
      cancelledAt: "2031-01-19T12:00:00Z",
    },
  ];
  a.review = {
    me: true,
    partner: true,
    partnerRating: 5,
    partnerTestimonial: "Private quote",
    partnerTestimonialPublic: false,
    testimonialAccepted: true,
  };
  a.mentorship.followup = {
    submittedAt: "2031-01-18T12:00:00Z",
    summary: "Revenue increased",
    shareable: true,
    outcomes: { a: "done", b: "in-progress" },
  };
  const b = room("b", "quick-ask");
  b.mentorship.deliveredAt = "2031-01-19T12:00:00Z";
  b.review = {
    me: true,
    partner: true,
    partnerRating: 4,
    partnerTestimonial: "Approved quote",
    partnerTestimonialPublic: true,
    testimonialAccepted: true,
  };
  const c = room("c", "doc-review");
  c.mentorship.deliveredAt = b.mentorship.deliveredAt;
  c.review = {
    me: false,
    partner: true,
    partnerRating: 1,
    partnerTestimonial: "Unreleased quote",
    partnerTestimonialPublic: true,
    testimonialAccepted: true,
  };
  const requests = [
    ["accepted", 2],
    ["declined", 6],
    ["referred", 4],
    ["expired", 12],
    ["returned", 1],
    ["withdrawn", 1],
  ].map(([status, hours]) => ({
    status,
    sentAt: "2031-01-10T00:00:00Z",
    at: `2031-01-10T${String(hours).padStart(2, "0")}:00:00Z`,
  }));
  const trust = mentorshipTrust({ a, b, c }, "mentor", {
    requests,
    approved: true,
    now,
  });
  assert.deepEqual(trust.sessions, { value: 3, count: 3 });
  assert.deepEqual(trust.founders, { value: 3, count: 3 });
  assert.equal(trust.minutes, 120);
  assert.equal(trust.averageRating.value, 4.5);
  assert.deepEqual(trust.topSkills.value, ["Pricing Strategy"]);
  assert.equal(trust.followThrough.value, 0.5);
  assert.equal(trust.responseRate.value, 0.75);
  assert.equal(trust.responseHours.value, 4);
  assert.equal(trust.noShowRate.value, 0.5);
  assert.equal(trust.lateCancellations.value, 1);
  assert.deepEqual(trust.highlights, ["Revenue increased"]);
  assert.deepEqual(badgesFor(trust), ["Verified Mentor"]);
  const published = publicMentorshipTrust(trust);
  assert.equal(published.averageRating.value, null);
  assert.equal(published.responseRate.value, 0.75);
  assert.equal(published.noShowRate, undefined);
  assert.deepEqual(published.testimonials, ["Approved quote"]);
});

test("founder badge follows preparedness and follow-up without exposing private ratings", () => {
  const rooms = Object.fromEntries(
    [1, 2].map((index) => {
      const engagement = room(String(index), "single-session", "founder");
      engagement.milestones.held.schedules = [
        { outcome: "held", durationMinutes: 60 },
      ];
      engagement.review = {
        me: true,
        partner: true,
        partnerRating: 4.5,
        partnerScores: { preparedness: 5 },
      };
      engagement.mentorship.followup = {
        submittedAt: "2031-01-19T12:00:00Z",
        outcomes: {},
      };
      return [index, engagement];
    }),
  );
  const trust = mentorshipTrust(rooms, "founder", { now });
  assert.deepEqual(trust.badges, ["Prepared Founder"]);
  rooms[1].milestones.held.schedules.push({
    outcome: "held",
    durationMinutes: 60,
  });
  const singleEngagement = mentorshipTrust({ one: rooms[1] }, "founder", {
    now,
  });
  assert.equal(singleEngagement.sessions.value, 2);
  assert.deepEqual(singleEngagement.badges, []);
  const published = publicMentorshipTrust(trust);
  assert.equal(published.prepared, true);
  assert.equal(published.preparedness.value, null);
});

test("multiple unusually fast released reviews are flagged for moderation", () => {
  const rooms = Object.fromEntries(
    [1, 2].map((id) => {
      const engagement = room(String(id), "single-session");
      engagement.mentorship.reviewOpenedAt = "2031-01-17T12:00:00.000Z";
      engagement.review = {
        me: true,
        partner: true,
        partnerRating: 4,
        partnerSubmittedAt: "2031-01-17T12:00:05.000Z",
      };
      return [id, engagement];
    }),
  );
  assert.match(
    mentorshipTrust(rooms, "mentor", { now }).ratingPattern,
    /within seconds/,
  );
  rooms[1].review.me = false;
  assert.equal(mentorshipTrust(rooms, "mentor", { now }).ratingPattern, "");
});
