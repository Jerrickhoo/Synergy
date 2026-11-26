// The standard collaboration types: their names, how a pair is suggested
// one from its needs and offers, the tag groups on the profile pickers, a
// mentor's focus areas, and the rule that a need can't also be an offer.
import test from "node:test";
import assert from "node:assert/strict";
import {
  collaborationTypes,
  legacyTypeLabels,
  mentorshipFocus,
  startupTypes,
  suggestedType,
  tagGroups,
  typeIdForLabel,
  typeLabel,
} from "../src/data/collaboration-types.js";
import { validateProfile } from "../src/state/validation.js";
import templates from "../src/data/engagement-templates.json" with { type: "json" };

test("the types are Evaluation and Feedback, Audience Swap, Technical Development, Funding and Mentorship", () => {
  assert.deepEqual(
    collaborationTypes.map((type) => type.label),
    [
      "Evaluation and Feedback",
      "Audience Swap",
      "Technical Development",
      "Funding",
      "Mentorship",
    ],
  );
  assert.deepEqual(
    startupTypes.map((type) => type.id),
    ["beta", "marketing", "swap", "funding"],
  );
  // Every type has a template, named the same way.
  for (const type of collaborationTypes)
    assert.equal(templates[type.id].name, type.label, type.id);
  // Old names and links still resolve.
  assert.equal(legacyTypeLabels["Skill Swap"], "Technical Development");
  assert.equal(typeIdForLabel("Co-Marketing Swap"), "marketing");
  assert.equal(typeIdForLabel("Funding"), "funding");
  assert.equal(typeLabel("beta"), "Evaluation and Feedback");
});

test("a pair is suggested the type that links one side's offer to the other's need", () => {
  const pair = (myOffer, myNeed, theirOffer, theirNeed) =>
    suggestedType({ myOffer, myNeed, theirOffer, theirNeed });
  assert.equal(
    pair("Co-Marketing", "Distribution", "Distribution", "Co-Marketing"),
    "marketing",
  );
  assert.equal(
    pair("Product Design", "Fundraising", "Fundraising", ""),
    "funding",
  );
  assert.equal(
    pair("Technical Development", "Product Design", "Product Design", ""),
    "swap",
  );
  // Anyone can test a product, so a need for testers alone is enough.
  assert.equal(pair("Pricing", "Beta Testers", "Legal", "Hiring"), "beta");
  // Nothing in common: Technical Development.
  assert.equal(pair("Legal", "Hiring", "Office space", "Catering"), "swap");
});

test("the need and offer pickers group the tags under the type each serves", () => {
  const groups = tagGroups([
    "Beta Testers",
    "Co-Marketing",
    "Fundraising",
    "Technical Development",
    "Accessibility Testing",
  ]);
  assert.deepEqual(
    groups.map((group) => [group.label, group.tags]),
    [
      ["Evaluation and Feedback", ["Beta Testers"]],
      ["Audience Swap", ["Co-Marketing"]],
      ["Technical Development", ["Technical Development"]],
      ["Funding", ["Fundraising"]],
      ["Other", ["Accessibility Testing"]],
    ],
  );
});

test("a mentor's focus areas come from the tags they offer", () => {
  assert.deepEqual(
    mentorshipFocus(["Technical Development", "Fundraising", "Distribution"]),
    ["Technical", "Marketing", "Financial"],
  );
  assert.deepEqual(mentorshipFocus([]), []);
});

test("a tag can't be both something a startup needs and something it offers", () => {
  const profile = {
    bio: "Budgeting app for students",
    offer: "Feedback",
    need: "Testers",
    industry: "EdTech",
    stage: "idea",
    teamSize: "3",
    offerTags: "Beta Testers, Product Feedback",
    needTags: "Beta Testers",
  };
  assert.match(
    validateProfile(profile, "founder").offer,
    /^Beta Testers can't be both something you need and something you offer/,
  );
  assert.equal(
    validateProfile({ ...profile, needTags: "Fundraising" }, "founder").offer,
    undefined,
  );
});
