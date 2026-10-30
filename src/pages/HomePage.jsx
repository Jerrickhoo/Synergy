import { useApp } from "../state/AppContext.jsx";
import HomeWelcome from "../components/HomeWelcome.jsx";
import HomeMetrics from "../components/HomeMetrics.jsx";
import { activeRooms, roleRooms } from "../data/selectors.js";
import { upcomingSessions, scheduleLabel } from "../data/selectors.js";
import Introductions from "../components/Introductions.jsx";
import MentorHome from "../components/MentorHome.jsx";

export default function HomePage() {
  const { state, onAction } = useApp();
  if (state.role === "mentor") return <MentorHome />;
  const rooms = activeRooms(state);
  const completedCount = roleRooms(state).filter((room) =>
    ["launched", "reviewed"].includes(room.status),
  ).length;
  const activity = state.activity
    .filter((item) => item.role === state.role)
    .slice(0, 3);
  return (
    <div className="page simple-home page-enter">
      <HomeWelcome />
      <HomeMetrics />
      <div className="simple-home-grid">
        <section className="card panel">
          <h2>Your collaborations</h2>
          <p className="muted">
            {rooms.length
              ? `${rooms.length} collaboration${rooms.length === 1 ? "" : "s"} in progress.`
              : completedCount
                ? `No collaborations in progress. ${completedCount} completed collaboration${completedCount === 1 ? "" : "s"}.`
                : "No collaborations yet. When you and someone connect, your shared room will appear here."}
          </p>
          <button
            className="link-btn"
            onClick={() => onAction({ page: "rooms" })}
          >
            View rooms →
          </button>
        </section>
        <section className="card panel">
          <h2>Recent activity</h2>
          {activity.length ? (
            activity.map((item) => (
              <p className="activity-entry" key={item.id}>
                {item.text}
              </p>
            ))
          ) : (
            <p className="muted">No recent activity.</p>
          )}
          <button
            className="link-btn"
            onClick={() => onAction({ page: "notifications" })}
          >
            View all updates →
          </button>
        </section>
      </div>
      <Introductions compact />
      {rooms.length > 0 && (
        <section className="card panel section-gap">
          <h2>Active collaborations</h2>
          {rooms.slice(0, 3).map((room) => (
            <div className="collaboration-row" key={room.id}>
              <span>
                {room.engagementType} · {room.progress}% complete
              </span>
              <button
                className="btn small"
                onClick={() => onAction({ action: "open-room", id: room.id })}
              >
                Open room
              </button>
            </div>
          ))}
        </section>
      )}
      {upcomingSessions(state).length > 0 && (
        <section className="card panel section-gap">
          <h2>Upcoming sessions</h2>
          {upcomingSessions(state).map(({ room, schedule }) => (
            <div
              className="collaboration-row"
              key={`${room.id}-${schedule.date}`}
            >
              <span>{scheduleLabel(schedule)}</span>
              <button
                className="btn small"
                onClick={() => onAction({ action: "open-room", id: room.id })}
              >
                View session
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
