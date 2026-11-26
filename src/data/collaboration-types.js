// The collaboration types, each tied to the need and offer tags it serves,
// so what a startup needs or can offer points straight at a type. Rooms keep
// the short ids (beta, marketing, swap, funding, mentorship); the labels are
// what people read.
export const collaborationTypes = [
  {
    id: "beta",
    label: "Evaluation and Feedback",
    summary: "Test each other's product and trade honest feedback.",
    tags: ["Beta Testers", "Product Feedback", "User Research"],
    words: /beta|tester|testing|feedback|user research|usability|interview/i,
  },
  {
    id: "marketing",
    label: "Audience Swap",
    summary: "Promote each other to your audiences.",
    tags: ["Co-Marketing", "Distribution"],
    words: /marketing|audience|promotion|growth|distribution|newsletter/i,
  },
  {
    id: "swap",
    label: "Technical Development",
    summary: "Build, design or review something for each other.",
    tags: ["Technical Development", "Product Design"],
    words: /technical|development|engineering|developer|design|build|code/i,
  },
  {
    id: "funding",
    label: "Funding",
    summary: "Share investor and grant leads, and review each other's pitch.",
    tags: ["Fundraising", "Pricing Strategy"],
    words: /fund|investor|grant|pitch|pricing|revenue|finance/i,
  },
  {
    id: "mentorship",
    label: "Mentorship",
    summary: "Guidance from an experienced mentor.",
    tags: ["Mentorship"],
    words: /mentor|advice|guidance|coaching/i,
  },
];
export const startupTypeIds = ["beta", "marketing", "swap", "funding"];
export const startupTypes = collaborationTypes.filter((type) =>
  startupTypeIds.includes(type.id),
);

// The names used before the types were standardised, for rooms and links
// made earlier.
export const legacyTypeLabels = {
  "Beta Testing Exchange": "Evaluation and Feedback",
  "Co-Marketing Swap": "Audience Swap",
  "Skill Swap": "Technical Development",
};
export const typeLabel = (id) =>
  collaborationTypes.find((type) => type.id === id)?.label ||
  legacyTypeLabels[id] ||
  id ||
  "";
export const typeIdForLabel = (label) =>
  collaborationTypes.find(
    (type) =>
      type.label === label ||
      type.id === label ||
      legacyTypeLabels[label] === type.label,
  )?.id || "";

// The type a pair of startups is suggested: the one whose tags or words
// connect what one side offers with what the other needs, in either
// direction. Any startup can test another's product, so a need for testing
// alone suggests Evaluation and Feedback; with nothing in common it is
// Technical Development.
export function suggestedType({ myOffer, myNeed, theirOffer, theirNeed }) {
  const fits = (offer, need, words) => words.test(offer) && words.test(need);
  let best = null;
  let bestScore = 0;
  for (const id of ["marketing", "funding", "beta", "swap"]) {
    const { words } = collaborationTypes.find((type) => type.id === id);
    let score =
      Number(fits(theirOffer, myNeed, words)) +
      Number(fits(myOffer, theirNeed, words));
    if (
      id === "beta" &&
      !score &&
      (words.test(myNeed) || words.test(theirNeed))
    )
      score = 0.5;
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best || "swap";
}

// Mentorship covers several kinds of guidance; a mentor's focus areas come
// from the tags they offer.
export const mentorshipCategories = [
  { id: "technical", label: "Technical", tags: ["Technical Development"] },
  {
    id: "product",
    label: "Product",
    tags: [
      "Product Design",
      "Product Feedback",
      "User Research",
      "Beta Testers",
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    tags: ["Co-Marketing", "Distribution"],
  },
  {
    id: "financial",
    label: "Financial",
    tags: ["Fundraising", "Pricing Strategy"],
  },
];
export function mentorshipFocus(offers = []) {
  const offered = new Set(
    [].concat(offers).map((item) => String(item).toLowerCase()),
  );
  return mentorshipCategories
    .filter((category) =>
      category.tags.some((tag) => offered.has(tag.toLowerCase())),
    )
    .map((category) => category.label);
}

// The standard tags grouped under the type each serves, for the need and
// offer pickers; tags outside every type are listed last.
export function tagGroups(vocabulary = []) {
  const placed = new Set();
  const groups = collaborationTypes
    .map((type) => {
      const tags = vocabulary.filter((tag) =>
        type.tags.some((item) => item.toLowerCase() === tag.toLowerCase()),
      );
      tags.forEach((tag) => placed.add(tag));
      return { id: type.id, label: type.label, tags };
    })
    .filter((group) => group.tags.length);
  const rest = vocabulary.filter((tag) => !placed.has(tag));
  return rest.length
    ? [...groups, { id: "other", label: "Other", tags: rest }]
    : groups;
}
