import { useApp } from "../state/AppContext.jsx";
import HomeWelcome from "./HomeWelcome.jsx";
import HomeMetrics from "./HomeMetrics.jsx";
import Avatar from "./Avatar.jsx";
import Icon from "./Icon.jsx";
import Introductions from "./Introductions.jsx";
import {
  activeRooms,
  upcomingSessions,
  scheduleInstant,
} from "../data/selectors.js";
import { mentorshipActions } from "../data/mentorship.js";
import { ownUnavailableText } from "../data/mentor-rules.js";

export default function MentorHome() {
  const { state, model, onAction } = useApp();
  const rooms = activeRooms(state).filter((room) => room.type === "mentorship");
  const sessions = upcomingSessions(state);
  const actions = mentorshipActions(state);
  // Banners appear only when something needs doing (roadmap Phase 5 adds the
  // approval banner once Phase 6 ships).
  const usage = state.mentorUsage;
  const banners = [];
  if (usage?.guidelines.status !== "accepted" && usage) {
    const until = usage.guidelines.graceUntil
      ? new Date(usage.guidelines.graceUntil).toLocaleDateString("en", {
          day: "numeric",
          month: "short",
        })
      : "";
    banners.push({
      key: "guidelines",
      text:
        usage.guidelines.status === "grace"
          ? `Accept the mentor guidelines by ${until} to keep receiving requests.`
          : ownUnavailableText("guidelines"),
      action: "Read and accept",
    });
  }
  if (usage?.paused)
    banners.push({
      key: "paused",
      text: `Pause Mode is on${usage.pausedUntil ? " until " + new Date(usage.pausedUntil + "T12:00:00Z").toLocaleDateString("en", { day: "numeric", month: "short" }) : ""}. Founders can't send you requests, and your current mentees are not affected.`,
      action: "Change in Settings",
    });
  const partner = (room) =>
    model.allPeople().find((p) => p.id === room.partnerId);
  const open = (room, tab = "milestones") =>
    onAction({ action: "open-room", id: room.id, tab });
  const act = (item) =>
    item.page
      ? onAction({ page: item.page })
      : onAction({
          action: "open-room",
          id: item.roomId,
          tab: item.tab,
          review: item.review,
        });
  return (
    <div className="page simple-home mentor-home page-enter">
      <HomeWelcome />
      {banners.map((banner) => (
        <div className="mentoring-banner" role="status" key={banner.key}>
          <p>{banner.text}</p>
          <button
            className="btn small"
            onClick={() => onAction({ page: "settings" })}
          >
            {banner.action}
          </button>
        </div>
      ))}
      <HomeMetrics />
      <Introductions compact />
      <div className="simple-home-grid section-gap">
        <section className="card panel" aria-labelledby="mentor-sessions">
          <h2 id="mentor-sessions">Upcoming sessions</h2>
          {sessions.length ? (
            sessions.slice(0, 4).map(({ room, schedule }) => (
              <div
                className="collaboration-row"
                key={`${room.id}:${schedule.date}:${schedule.time}`}
              >
                <div>
                  <strong>{partner(room)?.name || "Startup"}</strong>
                  <p>
                    <time dateTime={scheduleInstant(schedule).toISOString()}>
                      {scheduleInstant(schedule).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                    {schedule.durationMinutes
                      ? ` · ${schedule.durationMinutes} min`
                      : ""}
                  </p>
                </div>
                <button
                  className="btn small"
                  onClick={() => open(room, "schedule")}
                >
                  View session
                </button>
              </div>
            ))
          ) : (
            <p className="muted">
              No upcoming sessions. Agree on availability in Chat, then share a
              schedule in your mentorship room.
            </p>
          )}
          <button
            className="link-btn"
            onClick={() => onAction({ page: "calendar" })}
          >
            Open calendar <Icon name="arrow" />
          </button>
        </section>
        <section className="card panel" aria-labelledby="mentor-followup">
          <h2 id="mentor-followup">Preparation and follow-up</h2>
          {actions.filter((item) => item.roomId).length ? (
            actions
              .filter((item) => item.roomId)
              .slice(0, 5)
              .map((item, index) => (
                <div
                  className="collaboration-row"
                  key={`${item.roomId}:${index}`}
                >
                  <div>
                    <strong>{item.text}</strong>
                    <p>
                      {partner(state.rooms[item.roomId])?.name}
                      {item.dueDate ? ` · Due ${item.dueDate}` : ""}
                    </p>
                  </div>
                  <button className="link-btn" onClick={() => act(item)}>
                    Review
                  </button>
                </div>
              ))
          ) : (
            <p className="muted">
              You are up to date. Add shared preparation or follow-up tasks
              inside a mentorship room and assign an owner.
            </p>
          )}
        </section>
      </div>
      <section
        className="card panel section-gap"
        aria-labelledby="mentor-mentees"
      >
        <h2 id="mentor-mentees">Active mentees</h2>
        {rooms.length ? (
          rooms.map((room) => (
            <div className="collaboration-row" key={room.id}>
              <div className="mentee-identity">
                <Avatar
                  image={partner(room)?.image}
                  name={partner(room)?.name}
                  identity={partner(room)?.accountId || room.partnerId}
                />
                <div>
                  <h3>{partner(room)?.name || "Startup"}</h3>
                  <p>
                    {room.terms.draft.goal ||
                      "Agree on a mentoring goal together."}
                  </p>
                  <span className="muted">
                    {room.progress}% of milestones confirmed by both
                  </span>
                  {room.cycle && (
                    <p>
                      Cycle {room.cycle.number} · Next session:{" "}
                      {sessions.find((item) => item.room.id === room.id)
                        ? scheduleInstant(
                            sessions.find((item) => item.room.id === room.id)
                              .schedule,
                          ).toLocaleString()
                        : "not scheduled"}
                    </p>
                  )}
                </div>
              </div>
              <button
                className="btn small"
                onClick={() =>
                  open(room, room.terms.partnerLocked ? "milestones" : "terms")
                }
              >
                Open mentorship
              </button>
            </div>
          ))
        ) : (
          <p className="muted">
            No active mentees yet. Accept an introduction or explore startups
            looking for guidance.
          </p>
        )}
      </section>
    </div>
  );
}
