import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import {
  activeRooms,
  attentionItems,
  profileCompleteness,
  roleRooms,
} from "../data/selectors.js";
import { upcomingSessions, scheduleLabel } from "../data/selectors.js";
import Introductions from "../components/Introductions.jsx";

export default function HomePage() {
  const { state, model, onAction } = useApp();
  const completeness = profileCompleteness(
    state.profiles[state.role],
    state.role,
  );
  const rooms = activeRooms(state);
  const attention = attentionItems(state);
  const actOn = (item) =>
    item.page
      ? onAction({ page: item.page })
      : onAction({
          action: "open-room",
          id: item.roomId,
          tab: item.tab,
          review: item.review,
        });
  const completedCount = roleRooms(state).filter((room) =>
    ["launched", "reviewed"].includes(room.status),
  ).length;
  const activity = state.activity
    .filter((item) => item.role === state.role)
    .slice(0, 3);
  const incoming = state.incomingByRole[state.role].size;
  const outgoing = model.waitingMatches().size;
  const savedCount = model
    .rolePeople()
    .filter((person) => state.savedByRole[state.role].has(person.id)).length;
  return (
    <div className="page simple-home page-enter">
      <PageHeader
        title={
          state.accountName
            ? `Welcome, ${state.accountName.split(" ")[0]}`
            : "Welcome to Synergy"
        }
        intro="Manage your introductions and current collaborations."
      />
      <section className="workspace-metrics" aria-label="Workspace overview">
        {[
          {
            label: "Active rooms",
            value: rooms.length,
            detail: completedCount
              ? `${completedCount} completed`
              : "Your shared workspaces",

            page: "rooms",
          },
          {
            label: "Introductions",
            value: incoming + outgoing,
            detail: incoming
              ? `${incoming} awaiting your response`
              : outgoing
                ? "Waiting for a response"
                : "Start a conversation",

            page: "waiting",
          },
          {
            label: "Saved matches",
            value: savedCount,
            detail: "People on your shortlist",

            page: "discover",
            matchTab: "saved",
          },
        ].map(({ label, value, detail, ...destination }) => (
          <button
            className="workspace-metric"
            key={label}
            onClick={() => onAction(destination)}
          >
            <span className="metric-heading">
              <span>{label}</span>
            </span>
            <strong>{value}</strong>
            <span className="metric-detail">{detail}</span>
          </button>
        ))}
      </section>
      <div className="home-focus-grid">
        <div className="home-next-action">
          {attention.length > 0 ? (
            <section className="card getting-started attention-card">
              <h2>{attention[0].text}</h2>
              <p>
                {attention.length} pending action
                {attention.length === 1 ? "" : "s"} across your collaborations.
              </p>
              <button
                className="btn primary"
                onClick={() => actOn(attention[0])}
              >
                Review next action
              </button>
              {attention.slice(1, 4).map((item, index) => (
                <div
                  className="collaboration-row"
                  key={`${item.roomId || item.page}:${index}`}
                >
                  <span>{item.text}</span>
                  <button className="link-btn" onClick={() => actOn(item)}>
                    Review
                  </button>
                </div>
              ))}
            </section>
          ) : completeness < 100 ? (
            <section className="card getting-started">
              <h2>Profile setup</h2>
              <p>Add your background, skills and collaboration needs.</p>
              <button
                className="btn primary"
                onClick={() => onAction({ action: "edit-profile" })}
              >
                Set up your profile
              </button>
              <div
                className="setup-progress-track"
                role="progressbar"
                aria-label="Profile completion"
                aria-valuenow={completeness}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${completeness}%` }} />
              </div>
              <span className="setup-progress">
                {completeness}% complete · You can edit it anytime
              </span>
            </section>
          ) : rooms.length ? (
            <section className="card getting-started">
              <h2>Continue your collaboration</h2>
              <p>{rooms[0].terms.draft.goal || rooms[0].engagementType}</p>
              <button
                className="btn primary"
                onClick={() =>
                  onAction({
                    action: "open-room",
                    id: rooms[0].id,
                    tab:
                      rooms[0].terms.locked && rooms[0].terms.partnerLocked
                        ? "milestones"
                        : "terms",
                  })
                }
              >
                {rooms[0].terms.locked && rooms[0].terms.partnerLocked
                  ? "Continue working"
                  : "Set up your agreement"}
              </button>
            </section>
          ) : (
            <section className="card getting-started">
              <h2>Find collaborators</h2>
              <p>Head to Matches to find people to work with.</p>
              <button
                className="btn primary"
                onClick={() => onAction({ page: "discover" })}
              >
                Explore matches
              </button>
            </section>
          )}
        </div>
      </div>
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
