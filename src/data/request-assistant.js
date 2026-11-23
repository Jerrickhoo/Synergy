import { mentorFormat } from "./mentor-formats.js";

export const requestReasons = {
  "outside-expertise": "Outside the mentor's expertise",
  "no-slots": "No slots available",
  "not-a-fit": "Not a fit",
  other: "Other",
  "mentor-paused": "The mentor paused new requests",
  "mentor-suspended": "The mentor is currently unavailable",
  blocked: "Contact between these accounts ended",
  "profile-hidden": "One of the profiles is no longer visible",
  "account-deleted": "The collaborator deleted their account",
};

export const requestFields = {
  problem: "What's the problem?",
  tried: "What have you already tried?",
  question: "What specific question do you want answered?",
};

export function requestLink(value) {
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function requestQuality({
  problem = "",
  tried = "",
  question = "",
  links = [],
}) {
  const reasons = [];
  let score = 0;
  for (const [value, label] of [
    [problem, "Describe the problem"],
    [tried, "Explain what you tried"],
    [question, "Write a specific question"],
  ]) {
    if (value.trim().length >= 20) score += 20;
    else reasons.push(label);
  }
  if (
    question.includes("?") &&
    /\d|\b(should|choose|between|which|measure|test|compare)\b/i.test(question)
  )
    score += 20;
  else reasons.push("Name the decision or metric you want advice on");
  if (/\d/.test(problem + tried)) score += 10;
  else reasons.push("Add a metric to explain the context");
  if (links.some(requestLink)) score += 10;
  else reasons.push("Add a supporting link if you have one");
  return { score, reasons };
}

export function requestSuggestions(draft, availableFormats) {
  const { question, problem, tried, links } = draft;
  const vague =
    question &&
    (question.length < 35 || /^(help|advice|feedback)\b/i.test(question));
  const topic = question
    .replace(/^(help|advice|feedback)( me)?( with| on)?\s*/i, "")
    .replace(/[?.!]+$/, "");
  const rewrite =
    vague && topic
      ? `What should we try next for ${topic}, given our current results?`
      : "";
  const corpus = [problem, tried, question, ...links].join(" ");
  const suggested = /\b(deck|pitch|document|review)\b/i.test(corpus)
    ? "doc-review"
    : /\b(ongoing|weekly|recurring)\b/i.test(corpus)
      ? "ongoing-advisory"
      : question.length > 140
        ? "single-session"
        : "quick-ask";
  return {
    ...requestQuality(draft),
    rewrite,
    format: availableFormats.includes(suggested)
      ? mentorFormat(suggested)
      : null,
  };
}

// The optional message a mentor sends with a decline.
export const declineMessageLimit = 280;
