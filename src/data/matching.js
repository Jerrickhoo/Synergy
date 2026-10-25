export const defaultMatching = {
  version: 1,
  founder: [0.5, 0, 0.2, 0.15, 0.15],
  mentor: [0.35, 0.25, 0.15, 0.1, 0.15],
};
export const factorNames = [
  "Need fit",
  "Expertise fit",
  "Industry fit",
  "Stage/size fit",
  "Goal fit",
];

// One observation per shared room, including closed and unfinished engagements.
// Only mutually released reviews contribute feedback; old rooms are unscored.
export function matchingReport(accounts) {
  const rooms = [
    ...new Map(
      Object.values(accounts).flatMap((a) =>
        Object.values(a.state.rooms).map((room) => [room.id, room]),
      ),
    ).values(),
  ];
  const scored = rooms.filter((r) => r.matchingSnapshot);
  const cohorts = new Map();
  for (const room of scored) {
    const snapshot = room.matchingSnapshot;
    const score =
      snapshot.scores.reduce((sum, s) => sum + s.score, 0) /
      snapshot.scores.length;
    const band = score < 40 ? "0–39" : score < 70 ? "40–69" : "70–100";
    const key = `${snapshot.algorithm || "legacy-v1"}:${snapshot.version}:${room.type}:${band}`;
    if (!cohorts.has(key))
      cohorts.set(key, {
        version: snapshot.version,
        algorithm: snapshot.algorithm || "legacy-v1",
        type: room.type,
        band,
        rooms: 0,
        completed: 0,
        closed: 0,
        active: 0,
        reviewed: 0,
        usefulnessResponses: 0,
        useful: 0,
        goalResponses: 0,
        goalsAchieved: 0,
      });
    const row = cohorts.get(key);
    row.rooms++;
    if (["launched", "reviewed"].includes(room.status)) row.completed++;
    else if (room.status === "cancelled") row.closed++;
    else row.active++;
    if (room.review.me && room.review.partner) {
      row.reviewed++;
      for (const prefix of ["", "partner"]) {
        const useful = room.review[prefix ? "partnerUseful" : "useful"];
        const goal = room.review[prefix ? "partnerGoalOutcome" : "goalOutcome"];
        if (["yes", "no"].includes(useful)) {
          row.usefulnessResponses++;
          if (useful === "yes") row.useful++;
        }
        if (["achieved", "partial", "not-achieved"].includes(goal)) {
          row.goalResponses++;
          if (goal === "achieved") row.goalsAchieved++;
        }
      }
    }
  }
  return {
    totalRooms: rooms.length,
    unscoredRooms: rooms.length - scored.length,
    cohorts: [...cohorts.values()].sort(
      (a, b) =>
        a.version - b.version ||
        a.type.localeCompare(b.type) ||
        a.band.localeCompare(b.band),
    ),
  };
}
