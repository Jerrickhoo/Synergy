export function validMinimumFit(value) {
  return (
    value === "" ||
    (/^\d+$/.test(String(value)) && Number(value) >= 0 && Number(value) <= 100)
  );
}
export function filterPeople(people, filters) {
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
      haystack.includes(filters.search.toLowerCase()) &&
      (filters.type === "all" || person.kind === filters.type) &&
      (filters.industry === "all" ||
        person.sector.toLowerCase().includes(filters.industry.toLowerCase())) &&
      (filters.engagement === "all" ||
        (person.engagementTypes || [person.engagement]).includes(
          filters.engagement,
        )) &&
      // "Available now" keeps only mentors who can take a request right now.
      (!filters.availableNow || person.available === true) &&
      person.score >= Number(filters.score)
    );
  });
}
const mentorPageLabels = {
  waiting: "Requests",
  rooms: "Mentees",
  "room-detail": "Mentorship Room",
};
export const pageLabel = (page, role) =>
  (role === "mentor" && mentorPageLabels[page]) ||
  {
    settings: "Account settings",
    home: "Home",
    discover: "Matches",
    waiting: "Introductions",
    notifications: "Updates",
    moderation: "Moderation",
    rooms: "Deal Rooms",
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
