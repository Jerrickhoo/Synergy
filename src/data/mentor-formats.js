// The mentor engagement ladder (spec §10). This is the single source for the
// five formats: profile settings, request forms, matching (Format Fit) and the
// per-format room templates all read from here. Milestones marked `confirm`
// need evidence or mutual confirmation (the * in the spec).

export const mentorFormats = [
  {
    id: "quick-ask",
    label: "Quick Ask",
    summary:
      "One specific question, answered in text within the mentor's response time.",
    effort: "10–15 min",
    effortMinutes: 15,
    sync: false,
    milestones: [
      { id: "question", title: "Question sent", confirm: false },
      { id: "answer", title: "Answer delivered", confirm: true },
      { id: "helpful", title: "Founder marks helpful", confirm: false },
    ],
    upgradeTo: ["single-session", "ongoing-advisory"],
  },
  {
    id: "doc-review",
    label: "Doc/Pitch Review",
    summary:
      "The founder uploads a deck, plan or landing page and the mentor leaves written feedback.",
    effort: "30–60 min",
    effortMinutes: 60,
    sync: false,
    milestones: [
      { id: "uploaded", title: "Doc uploaded", confirm: false },
      { id: "review", title: "Review delivered", confirm: true },
      { id: "revisions", title: "Revisions logged", confirm: false },
    ],
    upgradeTo: ["single-session", "ongoing-advisory"],
  },
  {
    id: "single-session",
    label: "Single Session",
    summary: "One 30–60 minute video call on a confirmed goal.",
    effort: "About 1 hr",
    effortMinutes: 60,
    sync: true,
    milestones: [
      { id: "goal", title: "Goal confirmed", confirm: false },
      { id: "held", title: "Session held", confirm: true },
      { id: "actions", title: "Action items logged", confirm: false },
      { id: "followup", title: "Follow-up", confirm: true },
    ],
    upgradeTo: ["ongoing-advisory"],
  },
  {
    id: "office-hours",
    label: "Office Hours",
    summary: "The mentor opens recurring slots and founders book them.",
    effort: "Mentor's choice",
    effortMinutes: 30,
    sync: true,
    milestones: [
      { id: "booked", title: "Slot booked", confirm: false },
      { id: "held", title: "Session held", confirm: true },
      { id: "actions", title: "Action items logged", confirm: false },
    ],
    upgradeTo: ["single-session", "ongoing-advisory"],
  },
  {
    id: "ongoing-advisory",
    label: "Ongoing Advisory",
    summary:
      "Recurring check-ins over one to three months toward a bigger goal.",
    effort: "Highest",
    effortMinutes: 240,
    sync: true,
    milestones: [
      { id: "goals", title: "Goals defined", confirm: false },
      { id: "checkins", title: "Check-ins held", confirm: true },
      { id: "progress", title: "Progress reviewed", confirm: true },
      { id: "reviewed", title: "Engagement reviewed", confirm: false },
    ],
    upgradeTo: [],
  },
];

export const mentorFormatIds = mentorFormats.map((format) => format.id);

const byId = new Map(mentorFormats.map((format) => [format.id, format]));

// Rooms and profiles created before the ladder stored "one-off" or "ongoing".
const legacy = { "one-off": "single-session", ongoing: "ongoing-advisory" };

export function normalizeMentorFormat(value) {
  const id = legacy[value] || value;
  return byId.has(id) ? id : null;
}

export function mentorFormat(value) {
  return byId.get(normalizeMentorFormat(value)) || null;
}

export function mentorFormatLabel(value) {
  return mentorFormat(value)?.label || "";
}

// Keeps only known formats, maps legacy values, removes duplicates and keeps
// ladder order, so stored lists are stable however they were entered.
export function normalizeMentorFormats(values) {
  const wanted = new Set(
    (Array.isArray(values) ? values : [])
      .map(normalizeMentorFormat)
      .filter(Boolean),
  );
  return mentorFormatIds.filter((id) => wanted.has(id));
}

// The formats a mentor offers, each with its price. Accepts the object form
// ({ id, price }) or a plain list of ids, and a plain id gets price 0. Prices
// are always 0 in v1, whatever is stored or sent.
export function normalizeOfferedFormats(values) {
  const list = Array.isArray(values) ? values : [];
  const ids = normalizeMentorFormats(
    list.map((item) => (item && typeof item === "object" ? item.id : item)),
  );
  return ids.map((id) => ({ id, price: 0 }));
}

export function canUpgrade(from, to) {
  return Boolean(
    mentorFormat(from)?.upgradeTo.includes(normalizeMentorFormat(to)),
  );
}
