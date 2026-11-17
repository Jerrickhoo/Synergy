import { canonicalTags, defaultVocabulary } from "./collaboration.js";

// A transparent, rule-based profile assistant. It reads a founder's own words
// and proposes structured details; every suggestion is reviewed and edited
// before anything is saved. No text leaves the browser.
const needCue =
  /\b(need|needs|looking for|seeking|want|wants|searching for|hoping to find|could use|help (with|getting)|lack|missing)\b/;
const offerCue =
  /\b(we have|we've got|our|offer|offering|can provide|can share|we can|built|completed|with \d+|have an?)\b/;
const industries = [
  [
    "FinTech",
    /budget|finance|financial|fintech|payments?|banking|money|savings?/,
  ],
  ["EdTech", /students?|education|learning|study|campus|school|universit/],
  ["HealthTech", /health|medical|wellness|fitness|clinic|patients?/],
  ["Climate", /climate|carbon|energy|sustainab|recycl|surplus food/],
  ["Media", /newsletter|media|content|publishing|podcast/],
  ["SaaS", /\bsaas\b|b2b|software for (teams|businesses)/],
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

export function analyzeDescription(text, vocabulary = defaultVocabulary) {
  const source = String(text || "").trim();
  const lower = source.toLowerCase();
  const needs = new Set();
  const offers = new Set();
  const needPhrases = [];
  const offerPhrases = [];
  for (const sentence of sentences(source)) {
    const s = sentence.toLowerCase();
    // Split mixed sentences at the cue so "we have X and need Y" is read twice.
    const at = s.search(needCue);
    const offerPart = at > 0 ? s.slice(0, at) : at === 0 ? "" : s;
    const needPart = at >= 0 ? s.slice(at) : "";
    if (needPart) {
      canonicalTags(needPart, vocabulary).forEach((tag) => needs.add(tag));
      needPhrases.push(
        sentence
          .slice(at)
          .replace(new RegExp(needCue.source, "i"), "")
          .replace(/^[\s,:]+|[.\s]+$/g, ""),
      );
    }
    if (offerPart && offerCue.test(offerPart)) {
      canonicalTags(offerPart, vocabulary).forEach((tag) => offers.add(tag));
      offerPhrases.push(
        sentence.slice(0, at > 0 ? at : undefined).replace(/[.\s]+$/g, ""),
      );
    }
  }
  // Teams that describe themselves as building something offer development.
  if (
    /\b(\d+)[- ]person team|team of \d+|we('re| are) building|we built/.test(
      lower,
    )
  )
    offers.add("Technical Development");
  if (
    /\b\d[\d,]* (active )?(student )?(users|subscribers|members|customers)\b/.test(
      lower,
    )
  )
    offers.add(
      /subscribers|newsletter/.test(lower) ? "Co-Marketing" : "Beta Testers",
    );
  for (const tag of needs) offers.delete(tag);
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
  const questions = ambiguities
    .filter((item) => item.pattern.test(lower))
    .filter((item) => !item.options.every((option) => needs.has(option)))
    .map((item) => ({ ...item, pattern: undefined }));
  // Wording that maps to no approved tag is offered for moderator review.
  const unmatched = questions.length
    ? []
    : needPhrases
        .filter((phrase) => phrase && !canonicalTags(phrase, vocabulary).length)
        .slice(0, 3);
  return {
    needs: [...needs],
    offers: [...offers],
    needText: needPhrases.filter(Boolean).join(", "),
    offerText: offerPhrases.filter(Boolean).join(", "),
    teamSize: team ? team[1] : "",
    stage,
    industry: industry || "",
    audienceSize: audience ? audience[1].replace(/,/g, "") : "",
    goals: needPhrases[0]
      ? `Find ${needPhrases[0].replace(/^(to|for)\s+/i, "")}`
      : "",
    questions,
    unmatched,
  };
}
