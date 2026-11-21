import { useApp } from "../state/AppContext.jsx";
import HomeWelcome from "../components/HomeWelcome.jsx";
import HomeMetrics from "../components/HomeMetrics.jsx";
import {
  activeRooms,
  roomNextAction,
  milestoneDate,
} from "../data/selectors.js";
import { partnerName } from "../data/home.js";
import { upcomingSessions, scheduleLabel } from "../data/selectors.js";
import Introductions from "../components/Introductions.jsx";
import MentorHome from "../components/MentorHome.jsx";
import HomeTopMatches from "../components/HomeTopMatches.jsx";
import Icon from "../components/Icon.jsx";

export default function HomePage() {
  const { state, onAction } = useApp();
  if (state.role === "mentor") return <MentorHome />;
  const rooms = activeRooms(state);
  const activity = state.activity
    .filter((item) => item.role === state.role)
    .slice(0, 3);
  return (
    <div className="page simple-home page-enter">
      <HomeWelcome />
      {!rooms.length && <HomeTopMatches />}
      <HomeMetrics />
      <Introductions compact />
      {rooms.length > 0 && (
        <section className="card panel section-gap">
          <h2>Your collaborations</h2>
          <ul className="deal-rows">
            {rooms.slice(0, 5).map((room) => {
              const name = partnerName(state, room);
              const next = roomNextAction(room, name);
              return (
                <li className="deal-row" key={room.id}>
                  <div>
                    <strong>
                      {room.engagementType} with {name}
                    </strong>
                    {room.cycle && (
                      <span>
                        Cycle {room.cycle.number} · Next session:{" "}
                        {upcomingSessions(state).find(
                          (item) => item.room.id === room.id,
                        )
                          ? scheduleLabel(
                              upcomingSessions(state).find(
                                (item) => item.room.id === room.id,
                              ).schedule,
                            )
                          : "not scheduled"}
                      </span>
                    )}
                    <span
                      className={next.mine ? "deal-next mine" : "deal-next"}
                    >
                      {next.mine ? "Your turn: " : ""}
                      {next.text.replace(/^Your turn: /, "")}
                      {next.due ? ` · due ${milestoneDate(next.due)}` : ""}
                    </span>
                  </div>
                  <button
                    className={`btn small${next.mine ? " primary" : ""}`}
                    onClick={() =>
                      onAction({
                        action: "open-room",
                        id: room.id,
                        tab: next.tab,
                        review: next.review && next.mine,
                      })
                    }
                  >
                    {next.mine ? next.action || "Open" : "Open"}
                    <span className="visually-hidden">
                      :{" "}
                      {room.type === "mentorship"
                        ? `Mentorship with ${name}`
                        : `${room.engagementType} with ${name}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
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
              <span>
                {partnerName(state, room)} · {scheduleLabel(schedule)}
              </span>
              <button
                className="btn small"
                onClick={() =>
                  onAction({
                    action: "open-room",
                    id: room.id,
                    tab: "schedule",
                  })
                }
              >
                View session
              </button>
            </div>
          ))}
          <button
            className="link-btn"
            onClick={() => onAction({ page: "calendar" })}
          >
            View calendar
          </button>
        </section>
      )}
      {activity.length > 0 && (
        <section className="card panel section-gap">
          <h2>Recent activity</h2>
          {activity.map((item) => (
            <p className="activity-entry" key={item.id}>
              {item.text}
            </p>
          ))}
          <button
            className="link-btn"
            onClick={() => onAction({ page: "notifications" })}
          >
            View all updates <Icon name="arrow" />
          </button>
        </section>
      )}
    </div>
  );
}
