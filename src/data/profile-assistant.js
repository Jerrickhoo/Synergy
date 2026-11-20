import { canonicalTags, defaultVocabulary } from "./collaboration.js";

// The sample startup a founder preview can explore with. The server seeds it,
// and the assistant treats fields still holding these values as replaceable.
export const sampleFounderProfile = Object.freeze({
  bio: "Building a budgeting app that helps students manage their money.",
  offer: "Beta testing, Student user insights",
  need: "Product strategy, Onboarding guidance",
  industry: "FinTech",
  stage: "pre-seed",
  teamSize: "4",
  image: "/demo/avatars/maria.svg",
});
export const sampleFounderName = "Maria Santos";

// A suggestion replaces a field that is empty or still holds the sample value.
export const replaceable = (key, current) => {
  const value = String(current ?? "").trim();
  return !value || value === sampleFounderProfile[key];
};

// A transparent, rule-based profile assistant. It reads a founder's own words
// and proposes structured details; every suggestion is reviewed and edited
// before anything is saved. No text leaves the browser.
const needCue =
  /\b(need|needs|looking for|seeking|want|wants|searching for|hoping to find|could use|help (with|getting)|lack|missing)\b/;
// Offers come only from explicit offer phrasing. Being a team, building
// something or having users is not an offer until the founder says so.
const offerCue =
  /\bwe (?:can (?:also )?(?:offer|share|help with)|(?:also )?offer)\b/;
const industries = [
  [
    "FinTech",
    /budget|finance|financial|fintech|payments?|banking|money|savings?/,
  ],
  ["EdTech", /students?|education|learning|study|campus|school|universit/],
  ["HealthTech", /health|medical|wellness|fitness|clinic|patients?/],
  ["Climate", /climate|carbon|energy|sustainab|recycl|surplus food/],
  ["Media", /newsletter|media|content|publishing|podcast/],
  ["SaaS", /\bsaas\b|b2b|software for\b/],
  ["Marketplace", /marketplace|delivery|grocer|e-?commerce|shop/],
];
// Phrases that could mean several different kinds of help (§2, §10).
const ambiguities = [
  {
    pattern:
      /in front of (people|users|customers)|get (more )?(users|customers|traction)|grow(th)?\b/,
    question:
      "When you say you want to reach more people, which kind of help do you mean?",
    options: ["Beta Testers", "Co-Marketing", "Distribution"],
  },
  {
    pattern: /\bfunding\b|\bmoney\b.*\b(raise|investor)|\binvest/,
    question:
      "Did you mean fundraising advice or introductions to investors? These are matched differently.",
    options: ["Fundraising", "Mentorship"],
  },
  {
    pattern: /\bfeedback\b/,
    question:
      "Do you want feedback from real users, or expert feedback from a mentor?",
    options: ["Product Feedback", "Mentorship"],
  },
];
const sentences = (text) =>
  String(text || "")
    .split(/(?<=[.!?;])\s+|\n+|,\s*(?=and |but |so )/i)
    .map((part) => part.trim())
    .filter(Boolean);

// Splits "pricing strategy and customer retention" into separate items.
const items = (phrase) =>
  phrase
    .split(/,\s*|\s+(?:and|or|plus)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
const tidy = (phrase) =>
  phrase
    .replace(/^[\s,:]+|[.\s]+$/g, "")
    .replace(/[\s,]+(and|but|so|or)$/i, "");

export function analyzeDescription(text, vocabulary = defaultVocabulary) {
  const source = String(text || "").trim();
  const lower = source.toLowerCase();
  const needs = new Set();
  const offers = new Set();
  const needPhrases = [];
  const goalPhrases = [];
  const offerPhrases = [];
  for (const sentence of sentences(source)) {
    const s = sentence.toLowerCase();
    // "We can help with X" is an offer, so mask it before looking for needs.
    const offerMatch = s.match(offerCue);
    const offerAt = offerMatch ? offerMatch.index : -1;
    const masked = offerMatch
      ? s.slice(0, offerAt) +
        " ".repeat(offerMatch[0].length) +
        s.slice(offerAt + offerMatch[0].length)
      : s;
    const needMatch = masked.match(needCue);
    const needAt = needMatch ? needMatch.index : -1;
    // Each part runs from its cue to the other cue (or the sentence end).
    const end = (from, other) => (other > from ? other : sentence.length);
    if (needAt >= 0) {
      let rest = sentence.slice(
        needAt + needMatch[0].length,
        end(needAt, offerAt),
      );
      // "need help with X" asks for X; keep "help" only in the goal wording.
      const help = rest.match(/^\s*help\s+(with|getting)?\b/i);
      if (/^help\b/i.test(needMatch[0]) || help) {
        rest = rest.slice(help?.[0].length || 0);
        const raw = tidy(rest);
        if (raw)
          goalPhrases.push(
            `Get help ${/getting/i.test(help?.[0] || needMatch[0]) ? "getting" : "with"} ${raw}`,
          );
      } else if (tidy(rest)) goalPhrases.push(tidy(rest));
      const raw = tidy(rest);
      if (raw) {
        canonicalTags(raw, vocabulary).forEach((tag) => needs.add(tag));
        needPhrases.push(raw);
      }
    }
    if (offerAt >= 0) {
      const raw = tidy(
        sentence.slice(offerAt + offerMatch[0].length, end(offerAt, needAt)),
      );
      if (raw) {
        canonicalTags(raw, vocabulary).forEach((tag) => offers.add(tag));
        offerPhrases.push(raw);
      }
    }
  }
  for (const tag of needs) offers.delete(tag);
  const needText = needPhrases.join(", ");
  const team =
    lower.match(/\b(\d{1,4})[- ]person\b/) ||
    lower.match(/team of (\d{1,4})/) ||
    lower.match(/\b(\d{1,4}) (people|founders|of us)\b/);
  const months = lower.match(/(\d{1,2}) months? (in|old|into)/);
  const audience = lower.match(
    /\b(\d[\d,]{1,9})\s+(active\s+)?(student\s+)?(users|subscribers|readers|members|customers)\b/,
  );
  const stage = /\bgrowth stage|series [abc]\b/.test(lower)
    ? "growth"
    : /\bseed round|raised (a )?seed|\bseed\b/.test(lower)
      ? "seed"
      : /\bidea\b|just an idea|not built yet/.test(lower)
        ? "idea"
        : months || /\bmvp\b|prototype|beta/.test(lower)
          ? "pre-seed"
          : "";
  const industry = industries.find(([, pattern]) => pattern.test(lower))?.[0];
  // Clarifying questions are about the help the founder asked for.
  const asked = needText.toLowerCase();
  const questions = ambiguities
    .filter((item) => item.pattern.test(asked))
    .filter((item) => !item.options.every((option) => needs.has(option)))
    .map((item) => ({ ...item, pattern: undefined }));
  // Wording that maps to no approved tag is offered for moderator review; it
  // stays in the need text either way.
  const unmatched = questions.length
    ? []
    : needPhrases
        .flatMap(items)
        .filter((item) => !canonicalTags(item, vocabulary).length)
        .slice(0, 3);
  const goal = goalPhrases[0] || "";
  return {
    needs: [...needs],
    offers: [...offers],
    needText,
    offerText: offerPhrases.join(", "),
    teamSize: team ? team[1] : "",
    stage,
    industry: industry || "",
    audienceSize: audience ? audience[1].replace(/,/g, "") : "",
    goals: !goal
      ? ""
      : /^get help/i.test(goal)
        ? goal
        : `Find ${goal.replace(/^(to|for)\s+/i, "")}`,
    questions,
    unmatched,
  };
}
