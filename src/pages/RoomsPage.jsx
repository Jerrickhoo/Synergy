import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Icon from "../components/Icon.jsx";
import PageHeader from "../components/PageHeader.jsx";
export default function RoomsPage() {
  const { state, model, onAction } = useApp();
  const { allPeople, roomStatusLabel } = model;
  const rooms = Object.values(state.rooms).filter(
    (room) => room.role === state.role,
  );
  if (!rooms.length)
    return (
      <div className="page page-enter">
        <PageHeader
          title="Rooms"
          intro="Your conversations, plans, and progress in one place."
        />
        <section className="card clean-empty-state">
          <div className="empty-icon">
            <Icon name="rooms" />
          </div>
          <h2>No rooms yet</h2>
          <p>
            A shared room starts when you and a collaborator both agree to
            connect.
          </p>
          <button
            className="btn"
            onClick={() => onAction({ page: "discover" })}
          >
            Explore matches
          </button>
        </section>
        {model.waitingMatches().size > 0 && (
          <button
            className="link-btn section-gap"
            onClick={() => onAction({ page: "waiting" })}
          >
            View pending introductions ({model.waitingMatches().size})
          </button>
        )}
      </div>
    );
  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="YOUR SHARED WORKSPACES"
        title="Rooms"
        intro="Keep agreements, milestones, and conversations in one shared space."
      />
      {model.waitingMatches().size > 0 && (
        <button
          className="link-btn"
          onClick={() => onAction({ page: "waiting" })}
        >
          View pending introductions ({model.waitingMatches().size})
        </button>
      )}
      <div className="grid room-list">
        {rooms.map((room, itemIndex) => {
          const partner = allPeople().find(
            (person) => person.id === room.partnerId,
          );
          return (
            <Fragment key={itemIndex}>
              <article className="card room-list-card">
                <div className="room-list-person">
                  <Avatar
                    initials={partner?.initials || "?"}
                    color={partner?.color || ""}
                  />
                  <div>
                    <h2>
                      {room.type === "mentorship"
                        ? "Mentorship Engagement"
                        : room.engagementType}
                    </h2>
                    <p className="panel-subtitle">
                      {"With "}
                      {partner?.name || room.partnerId}
                    </p>
                  </div>
                  <span
                    className={`status ${["launched", "reviewed"].includes(room.status) ? "green" : ""}`}
                  >
                    {roomStatusLabel(
                      room.status,
                      partner?.name || room.partnerId,
                    )}
                  </span>
                </div>
                <p>{room.terms.draft.goal}</p>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: room.progress + "%",
                    }}
                  />
                </div>
                <div className="completion-row">
                  <span>{room.progress}% complete</span>
                  <button
                    className="btn primary small"
                    data-action="open-room"
                    data-id={room.id}
                    onClick={(event) =>
                      onAction(
                        {
                          action: "open-room",
                          id: room.id,
                        },
                        event,
                      )
                    }
                  >
                    Open deal room
                  </button>
                </div>
              </article>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
