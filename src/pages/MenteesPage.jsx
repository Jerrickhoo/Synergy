import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import {
  isMentorRoom,
  mentorshipStageText,
  roomFormat,
} from "../data/mentor-room.js";
import { mentorFormat } from "../data/mentor-formats.js";
import { roomNextAction } from "../data/selectors.js";

export function MenteeRow({ room, partner }) {
  const { onAction } = useApp();
  const next = roomNextAction(room, partner?.name);
  return (
    <article className="collaboration-row">
      <div className="mentee-identity">
        <Avatar
          image={partner?.image}
          name={partner?.name}
          identity={partner?.accountId || room.partnerId}
        />
        <div>
          <h3>{partner?.name || "Startup"}</h3>
          <p>{mentorFormat(roomFormat(room)).label}</p>
          <p>{next.mine ? next.text : "Nothing needed from you"}</p>
        </div>
      </div>
      <button
        className="btn small"
        onClick={() =>
          onAction({ action: "open-room", id: room.id, tab: next.tab })
        }
      >
        Open room
      </button>
    </article>
  );
}

export default function MenteesPage() {
  const { state, model, onAction } = useApp();
  const groups = Map.groupBy(
    Object.values(state.rooms).filter(
      (room) =>
        room.role === "mentor" &&
        isMentorRoom(room) &&
        !["cancelled", "reviewed"].includes(room.status),
    ),
    (room) => mentorshipStageText(room),
  );
  if (state.role !== "mentor")
    return (
      <PageHeader
        title="Mentees"
        intro="Switch to your mentor profile to view mentees."
      />
    );
  return (
    <div className="page page-enter">
      <PageHeader
        title="Mentees"
        actions={
          <button className="btn" onClick={() => onAction({ page: "rooms" })}>
            Room history
          </button>
        }
      />
      {groups.size === 0 && (
        <p>Accept a mentorship request to see your mentees here.</p>
      )}
      {[...groups].map(([label, rooms]) => (
        <section className="card panel section-gap" key={label}>
          <h2>{label}</h2>
          {rooms.map((room) => (
            <MenteeRow
              key={room.id}
              room={room}
              partner={model
                .allPeople()
                .find((person) => person.id === room.partnerId)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
