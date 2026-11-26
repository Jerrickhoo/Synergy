// The standard collaboration types: their names, how a pair is suggested
// one from its needs and offers, the tag groups on the profile pickers, a
// mentor's focus areas, and the rule that a need can't also be an offer.
import test from "node:test";
import assert from "node:assert/strict";
import {
  collaborationTypes,
  legacyTypeLabels,
  mentoringTypes,
  mentorshipFocus,
  startupTypes,
  suggestedType,
  tagGroups,
  typeIdForLabel,
  typeLabel,
} from "../src/data/collaboration-types.js";
import { validateProfile } from "../src/state/validation.js";
import { fitSentence } from "../src/data/profile-presentation.js";
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

test("a mentor's mentoring types come from their tags or the words they use, else General", () => {
  assert.deepEqual(
    mentoringTypes(["Product strategy", "Onboarding guidance"]),
    ["Product"],
  );
  assert.deepEqual(mentoringTypes(["Fundraising"], "Go-to-market and growth"), [
    "Marketing",
    "Financial",
  ]);
  assert.deepEqual(mentoringTypes(["Hiring"]), ["General"]);
});

test("a match's breakdown sums up why in one sentence", () => {
  const row = (index, score) => ({ index, score });
  assert.equal(
    fitSentence({ score: 78 }, [
      row(0, 100),
      row(1, 90),
      row(2, 10),
      row(3, 70),
    ]),
    "78% because they offer what you need, their expertise fits and you're at a similar stage and size, but your industries differ.",
  );
  assert.equal(
    fitSentence({ score: 20 }, [row(0, 10), row(2, null)]),
    "20% because few of your needs overlap and an industry is missing.",
  );
  // Needs carry the most weight, so a partial fit is still named.
  assert.equal(
    fitSentence({ score: 59 }, [row(0, 50), row(2, 63), row(5, 100)]),
    "59% because they offer some of what you need and they have room for you now.",
  );
  assert.equal(
    fitSentence({ score: 50 }, [row(2, 50), row(3, 40)]),
    "50% because your profiles partly line up on every factor.",
  );
  // A mentor reading a startup's match sees it from their side.
  assert.equal(
    fitSentence({ score: 70 }, [row(0, 80), row(1, 20)], {
      mentorViewer: true,
    }),
    "70% because you offer what they need, but your expertise is a looser fit for them.",
  );
  assert.equal(
    fitSentence({ score: 45 }, [row(0, 40)], { mentorViewer: true }),
    "45% because you offer some of what they need.",
  );
});
