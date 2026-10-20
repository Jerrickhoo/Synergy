import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Icon from "../components/Icon.jsx";
import {
  activeRooms,
  profileCompleteness,
  roleRooms,
} from "../data/selectors.js";
import { upcomingSessions, scheduleLabel } from "../data/selectors.js";
import Introductions from "../components/Introductions.jsx";

export default function HomePage() {
  const { state, onAction } = useApp();
  const completeness = profileCompleteness(
    state.profiles[state.role],
    state.role,
  );
  const rooms = activeRooms(state);
  const completedCount = roleRooms(state).length - rooms.length;
  const activity = state.activity
    .filter((item) => item.role === state.role)
    .slice(0, 3);
  return (
    <div className="page simple-home page-enter">
      <PageHeader
        title={
          state.accountName
            ? `Welcome, ${state.accountName.split(" ")[0]}`
            : "Welcome to Synergy"
        }
        intro="A place to find collaborators and build together."
      />
      {completeness < 100 ? (
        <section className="card getting-started">
          <div className="empty-icon">
            <Icon name="profile" />
          </div>
          <span className="eyebrow">LET'S START HERE</span>
          <h2>Make your profile yours</h2>
          <p>
            Share what you're working on, what you can offer, and where you need
            help.
          </p>
          <button
            className="btn primary"
            onClick={() => onAction({ action: "edit-profile" })}
          >
            Set up your profile
          </button>
          <span className="setup-progress">
            {completeness}% complete · You can edit it anytime
          </span>
        </section>
      ) : (
        <section className="card getting-started">
          <div className="empty-icon">
            <Icon name="search" />
          </div>
          <h2>Your profile is ready</h2>
          <p>Head to Matches to find people to work with.</p>
          <button
            className="btn primary"
            onClick={() => onAction({ page: "discover" })}
          >
            Explore matches
          </button>
        </section>
      )}
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
            activity.map((item) => <p key={item.id}>{item.text}</p>)
          ) : (
            <p className="muted">
              You're all caught up. Your updates will appear here as you get
              started.
            </p>
          )}
        </section>
      </div>
      <Introductions compact />
      {rooms.length > 0 && (
        <section className="card panel section-gap">
          <h2>Continue working together</h2>
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
            <div className="collaboration-row" key={room.id}>
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
