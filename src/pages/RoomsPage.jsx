import SelectField from "../components/SelectField.jsx";
import { Fragment, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Icon from "../components/Icon.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Introductions from "../components/Introductions.jsx";
import { milestoneDate, roomNextAction } from "../data/selectors.js";
export default function RoomsPage() {
  const { state, model, onAction } = useApp();
  const { allPeople, roomStatusLabel } = model;
  const mentor = state.role === "mentor";
  const noun = mentor ? "mentorships" : "Deal Rooms";
  const header = mentor ? (
    <PageHeader
      title="Mentees"
      intro="Each mentorship holds one founder's goal, your sessions and the follow-up actions you agreed."
    />
  ) : (
    <PageHeader
      title="Deal Rooms"
      intro="Each Deal Room holds one agreement, its milestones and the conversation, with whose turn it is."
    />
  );
  const [filter, setFilter] = useState("all");
  const rooms = Object.values(state.rooms).filter(
    (room) => room.role === state.role,
  );
  const group = (room) =>
    room.status === "launched"
      ? "awaiting"
      : room.status === "reviewed"
        ? "archived"
        : room.status === "cancelled"
          ? "closed"
          : "active";
  const visibleRooms = rooms
    .filter((room) => filter === "all" || group(room) === filter)
    .sort((a, b) => (group(a) !== "active") - (group(b) !== "active"));
  if (!rooms.length)
    return (
      <div className="page page-enter">
        {header}
        <section className="card clean-empty-state">
          <h2>{mentor ? "No mentees yet" : "No Deal Rooms yet"}</h2>
          <p>
            {state.role === "mentor"
              ? "A mentorship opens when you accept a founder's request. You'll agree the goal, hold sessions and track follow-up here."
              : "A Deal Room opens when someone accepts your introduction, or you accept theirs."}
          </p>
          <button
            className="btn primary"
            onClick={() => onAction({ page: mentor ? "waiting" : "discover" })}
          >
            {mentor ? "Review requests" : "Explore matches"}
          </button>
        </section>
        <Introductions compact />
      </div>
    );
  return (
    <div className="page page-enter">
      {header}
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
            <option value="all">All {noun}</option>
            <option value="active">Active</option>
            <option value="awaiting">Awaiting reviews</option>
            <option value="archived">Archived</option>
            <option value="closed">Closed</option>
          </SelectField>
        </div>
      </div>
      {!visibleRooms.length && (
        <section className="card clean-empty-state">
          <h2>
            No{" "}
            {
              {
                active: "active",
                awaiting: `${noun} awaiting reviews`,
                archived: "archived",
                closed: "closed",
              }[filter]
            }{" "}
            {filter === "awaiting" ? "" : noun}
          </h2>
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
          const next = roomNextAction(room, partner?.name);
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
                {!next.done && (
                  <p className={`room-next${next.mine ? " mine" : ""}`}>
                    <strong>{next.mine ? "Your turn" : "Their turn"}:</strong>{" "}
                    {next.text.replace(/^Your turn: /, "")}
                    {next.due ? ` · due ${milestoneDate(next.due)}` : ""}
                  </p>
                )}
                <div className="completion-row">
                  <span>{room.progress}% of milestones confirmed</span>
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
                      : "Open Deal Room"}
                    <span className="visually-hidden">
                      {" "}
                      with {partner?.name || "collaborator"}
                    </span>
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
