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
        person.engagement === filters.engagement) &&
      person.score >= Number(filters.score)
    );
  });
}
export const pageLabel = (page) =>
  ({
    settings: "Account settings",
    home: "Home",
    discover: "Matches",
    waiting: "Introductions",
    notifications: "Updates",
    moderation: "Moderation",
    rooms: "Rooms",
    calendar: "Calendar",
    "room-detail": "Room",
    "match-detail": "Match details",
    review: "Review",
    profile: "Profile",
    trust: "Trust history",
    onboarding: "Onboarding",
    signup: "Create account",
  })[page] || "Workspace";
