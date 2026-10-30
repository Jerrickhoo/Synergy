import SelectField from "../components/SelectField.jsx";
import { Fragment, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Icon from "../components/Icon.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Introductions from "../components/Introductions.jsx";
export default function RoomsPage() {
  const { state, model, onAction } = useApp();
  const { allPeople, roomStatusLabel } = model;
  const [filter, setFilter] = useState("all");
  const rooms = Object.values(state.rooms).filter(
    (room) => room.role === state.role,
  );
  const group = (room) =>
    ["launched", "reviewed"].includes(room.status)
      ? "completed"
      : room.status === "cancelled"
        ? "closed"
        : "active";
  const visibleRooms = rooms
    .filter((room) => filter === "all" || group(room) === filter)
    .sort((a, b) => (group(a) !== "active") - (group(b) !== "active"));
  if (!rooms.length)
    return (
      <div className="page page-enter">
        <PageHeader
          title="Rooms"
          intro="Your conversations, plans, and progress in one place."
        />
        <section className="card clean-empty-state">
          <h2>No rooms yet</h2>
          <p>
            {state.role === "mentor"
              ? "Connect with a founder to agree goals, schedule sessions and record shared follow-up."
              : "A shared room starts when you and a collaborator both agree to connect."}
          </p>
          <button
            className="btn primary"
            onClick={() => onAction({ page: "discover" })}
          >
            Explore matches
          </button>
        </section>
        <Introductions compact />
      </div>
    );
  return (
    <div className="page page-enter">
      <PageHeader
        title="Rooms"
        intro="Keep agreements, milestones, and conversations in one shared space."
      />
      <Introductions compact />
      <div className="rooms-toolbar">
        <p className="muted" role="status">
          {visibleRooms.length} {visibleRooms.length === 1 ? "room" : "rooms"}
        </p>
        <div className="field">
          <label htmlFor="room-filter">Show rooms</label>
          <SelectField
            id="room-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All rooms</option>
            <option value="active">In progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </SelectField>
        </div>
      </div>
      {!visibleRooms.length && (
        <section className="card clean-empty-state">
          <h2>No {filter === "active" ? "active" : filter} rooms</h2>
          <p>Choose another view to see your other collaborations.</p>
          <button className="btn" onClick={() => setFilter("all")}>
            Show all rooms
          </button>
        </section>
      )}
      <div className="grid room-list">
        {visibleRooms.map((room) => {
          const partner = allPeople().find(
            (person) => person.id === room.partnerId,
          );
          return (
            <Fragment key={room.id}>
              <article className="card room-list-card">
                <div className="room-list-person">
                  <Avatar
                    image={partner?.image}
                    name={partner?.name}
                    identity={partner?.accountId || room.partnerId}
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
                      room.terms.confirmedByMe,
                      room.type,
                    )}
                  </span>
                </div>
                <p>
                  {room.terms.draft.goal ||
                    (room.status === "cancelled"
                      ? "Your agreement and conversation are available for reference."
                      : "Set a shared goal and agree on your first milestones.")}
                </p>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label={`Collaboration progress with ${partner?.name || room.partnerId}`}
                  aria-valuenow={room.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
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
                    {room.type === "mentorship"
                      ? "Open mentorship"
                      : "Open deal room"}
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
