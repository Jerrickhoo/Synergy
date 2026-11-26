export const defaultMatchFilters = Object.freeze({
  search: "",
  type: "all",
  industry: "all",
  score: "0",
  engagement: "all",
  availableNow: false,
  freeOnly: false,
  maxPrice: "",
});
export function validMinimumFit(value) {
  return (
    value === "" ||
    (/^\d+$/.test(String(value)) && Number(value) >= 0 && Number(value) <= 100)
  );
}
// Empty means no price limit; otherwise a whole or decimal amount of 0 or more.
export function validMaxPrice(value) {
  const text = String(value ?? "").trim();
  return text === "" || /^(\d+(\.\d*)?|\.\d+)$/.test(text);
}
const hasMaxPrice = (filters) =>
  String(filters.maxPrice ?? "").trim() !== "" &&
  validMaxPrice(filters.maxPrice);
// Filters set in the Filters dialog; the Filters button shows this count.
export function activeFilterCount(filters) {
  return [
    filters.type !== "all",
    filters.industry !== "all",
    Number(filters.score) > 0,
    filters.engagement !== "all",
    Boolean(filters.availableNow),
    Boolean(filters.freeOnly),
    hasMaxPrice(filters),
  ].filter(Boolean).length;
}
export const hasActiveFilters = (filters) =>
  activeFilterCount(filters) > 0 ||
  Boolean(String(filters.search || "").trim());
// Which empty state Matches shows: an empty shortlist, no suggestions at all
// (with the closest profiles), or filters that hide every result.
export function emptyStateKind({ tab, filters, candidates, list }) {
  if (list.length) return null;
  if (tab === "saved" && !candidates.length) return "shortlist";
  if (tab === "suggested" && !hasActiveFilters(filters)) return "suggestions";
  return "filtered";
}
// Filters kept in browser storage, with anything unknown or invalid reset.
export function restoreMatchFilters(saved) {
  const next = { ...defaultMatchFilters };
  if (!saved || typeof saved !== "object") return next;
  for (const [key, fallback] of Object.entries(defaultMatchFilters))
    if (typeof saved[key] === typeof fallback) next[key] = saved[key];
  if (!validMinimumFit(next.score)) next.score = defaultMatchFilters.score;
  if (!validMaxPrice(next.maxPrice)) next.maxPrice = "";
  return next;
}
export function filterPeople(people, filters) {
  // Surrounding spaces are ignored; a search of only spaces is no filter.
  const search = String(filters.search || "")
    .trim()
    .toLowerCase();
  return people.filter((person) => {
    const haystack = [
      person.name,
      person.kind,
      person.sector,
      person.summary,
      person.founderName,
      person.goals,
      person.expertise,
      ...person.offer,
      ...person.need,
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!search || haystack.includes(search)) &&
      (filters.type === "all" || person.kind === filters.type) &&
      (filters.industry === "all" ||
        person.sector.toLowerCase().includes(filters.industry.toLowerCase())) &&
      (filters.engagement === "all" ||
        (person.engagementTypes || [person.engagement]).includes(
          filters.engagement,
        )) &&
      // "Available now" keeps only mentors who can take a request right now.
      (!filters.availableNow || person.available === true) &&
      (!filters.freeOnly ||
        person.formats?.some((format) => format.price === 0)) &&
      // An invalid maximum price is ignored rather than hiding everyone.
      (!hasMaxPrice(filters) ||
        person.formats?.some(
          (format) => format.price <= Number(filters.maxPrice) * 100,
        )) &&
      person.score >= Number(filters.score)
    );
  });
}
const mentorPageLabels = {
  discover: "Startups",
  waiting: "Requests",
  rooms: "Mentees",
  "room-detail": "Mentorship room",
};
// A mentorship room is always a "Mentorship room", whichever role opens it.
export const pageLabel = (page, role, roomType) =>
  (page === "room-detail" && roomType === "mentorship" && "Mentorship room") ||
  (role === "mentor" && mentorPageLabels[page]) ||
  {
    settings: "Account settings",
    home: "Home",
    discover: "Matches",
    waiting: "Requests",
    requests: "Requests",
    mentees: "Mentees",
    impact: "Impact",
    "impact-certificate": "Volunteer mentorship certificate",
    activity: "Activity",
    notifications: "Updates",
    moderation: "Moderation",
    rooms: "Rooms",
    calendar: "Calendar",
    "room-detail": "Deal Room",
    "match-detail": "Match details",
    review: "Review",
    profile: "Profile",
    trust: "Trust history",
    onboarding: "Onboarding",
    signup: "Create account",
  }[page] ||
  "Workspace";
