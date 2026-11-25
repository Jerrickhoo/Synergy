import { useApp } from "../state/AppContext.jsx";
import { activeRooms, roleRooms } from "../data/selectors.js";
import Icon from "./Icon.jsx";

// `omit` leaves out tiles ("rooms", "introductions", "saved") whose story the
// page already tells elsewhere.
export default function HomeMetrics({ omit = [] }) {
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
  const kind = mentor ? "Mentorships" : "Collaborations";
  const metrics = [
    // Once nothing is active, finished work still shows on Home.
    !rooms.length && completed
      ? {
          id: "rooms",
          label: `Completed ${kind.toLowerCase()}`,
          icon: "check",
          value: completed,
          detail: "Agreements and reviews stay in Rooms",
          destination: { page: "rooms" },
        }
      : {
          id: "rooms",
          label: "Active rooms",
          icon: "rooms",
          value: rooms.length,
          detail: rooms.length
            ? `${kind} in progress${completed ? ` · ${completed} completed` : ""}`
            : "Connect with someone to open a room",
          destination: { page: "rooms" },
        },
    {
      id: "introductions",
      label: mentor ? "Requests to answer" : "Introductions to answer",
      icon: "people",
      value: incoming,
      detail: incoming
        ? "Reply within 14 days"
        : outgoing
          ? `${outgoing} sent and waiting for a reply`
          : mentor
            ? "Meet a startup you can support"
            : "Send one from Matches",
      destination: { page: mentor ? "requests" : "waiting" },
    },
    {
      id: "saved",
      label: "Saved matches",
      icon: "bookmark",
      value: saved,
      detail: saved
        ? "Return to your shortlist"
        : "Bookmark people to revisit later",
      destination: { page: "discover", matchTab: "saved" },
    },
  ];
  // A tile that would only say 0 is left out; the introductions tile stays
  // while sent introductions are waiting (readiness plan P8).
  const shown = metrics.filter(
    ({ id, value }) =>
      !omit.includes(id) &&
      (value > 0 || (id === "introductions" && outgoing > 0)),
  );
  if (!shown.length) return null;
  return (
    <section
      className="workspace-metrics"
      aria-label={mentor ? "Mentoring overview" : "Workspace overview"}
    >
      {shown.map(({ label, icon, value, detail, destination }) => (
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
