import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Icon from "../components/Icon.jsx";
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
          eyebrow="YOUR SHARED WORKSPACES"
          title="Deal rooms"
          intro="Agreements and progress live here once you and a partner match."
        />
        <section className="empty-state">
          <Icon name="handshake" />
          <p>
            Your deal rooms will appear here when an introduction becomes a
            mutual match.
          </p>
          <button
            className="btn primary"
            data-page="discover"
            onClick={(event) =>
              onAction(
                {
                  page: "discover",
                },
                event,
              )
            }
          >
            Explore matches
          </button>
        </section>
      </div>
    );
  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="YOUR SHARED WORKSPACES"
        title="Deal rooms"
        intro="Keep agreements, milestones, and conversations in one shared space."
      />
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
                  <span className="status">
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
