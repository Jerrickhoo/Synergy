import { useApp } from "../state/AppContext.jsx";
import { activeRooms, roleRooms } from "../data/selectors.js";
import Icon from "./Icon.jsx";

export default function HomeMetrics() {
  const { state, model, onAction } = useApp();
  const mentor = state.role === "mentor";
  const rooms = activeRooms(state);
  const incoming = state.incomingByRole[state.role].size;
  const outgoing = model.waitingMatches().size;
  const saved = model
    .rolePeople()
    .filter((person) => model.savedMatches().has(person.id)).length;
  const completed = roleRooms(state).filter((room) =>
    ["launched", "reviewed"].includes(room.status),
  ).length;
  const metrics = [
    {
      label: "Active Deal Rooms",
      icon: "rooms",
      value: rooms.length,
      detail: rooms.length
        ? `${mentor ? "Mentorships" : "Collaborations"} in progress${completed ? ` · ${completed} completed` : ""}`
        : "Connect with someone to open a room",
      destination: { page: "rooms" },
    },
    {
      label: "Introductions to answer",
      icon: "people",
      value: incoming,
      detail: incoming
        ? "Reply within 14 days"
        : outgoing
          ? `${outgoing} sent and waiting for a reply`
          : mentor
            ? "Meet a startup you can support"
            : "Send one from Matches",
      destination: { page: "waiting" },
    },
    {
      label: "Saved matches",
      icon: "bookmark",
      value: saved,
      detail: saved
        ? "Return to your shortlist"
        : "Bookmark people to revisit later",
      destination: { page: "discover", matchTab: "saved" },
    },
  ];
  return (
    <section
      className="workspace-metrics"
      aria-label={mentor ? "Mentoring overview" : "Workspace overview"}
    >
      {metrics.map(({ label, icon, value, detail, destination }) => (
        <button
          className="workspace-metric interactive-surface"
          key={label}
          onClick={() => onAction(destination)}
        >
          <span className="metric-heading">
            <Icon name={icon} />
            {label}
            <Icon name="arrow" />
          </span>
          <strong>{value}</strong>
          <span className="metric-detail">{detail}</span>
        </button>
      ))}
    </section>
  );
}
