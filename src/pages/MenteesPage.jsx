import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { isMentorRoom, roomFormat } from "../data/mentor-room.js";
import { mentorFormat } from "../data/mentor-formats.js";
import { roomNextAction } from "../data/selectors.js";

export function MenteeRow({ room, partner, primary = false }) {
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
          <p className="mentee-format">
            {mentorFormat(roomFormat(room)).label}
          </p>
          <p className={next.mine ? "deal-next mine" : "deal-next"}>
            {next.mine
              ? `Your turn: ${next.text.charAt(0).toLowerCase()}${next.text.slice(1)}`
              : next.text}
          </p>
        </div>
      </div>
      <button
        className={`btn small${primary || next.mine ? " primary" : ""}`}
        onClick={() =>
          onAction({ action: "open-room", id: room.id, tab: next.tab })
        }
      >
        Open room
      </button>
    </article>
  );
}

// No mentees yet: say what is waiting and take the mentor to it.
function MenteesEmpty({ requests }) {
  const { onAction } = useApp();
  return (
    <section className="card panel mentees-empty">
      <h2>
        {requests
          ? `${requests} ${requests === 1 ? "request is" : "requests are"} waiting for your reply`
          : "No mentees yet"}
      </h2>
      <p>
        {requests
          ? "Accept one and its mentorship room opens here."
          : "Founders find you in Matches. You can also reach out first from Startups."}
      </p>
      <button
        className="btn primary"
        onClick={() => onAction({ page: requests ? "requests" : "discover" })}
      >
        {requests ? "Review requests" : "Browse startups"}
      </button>
    </section>
  );
}

export default function MenteesPage() {
  const { state, model, onAction } = useApp();
  const mine = Object.values(state.rooms).filter(
    (room) => room.role === "mentor" && isMentorRoom(room),
  );
  const finished = mine.filter((room) =>
    ["cancelled", "reviewed"].includes(room.status),
  ).length;
  // Grouped by whose move it is, so the mentees waiting on the mentor lead;
  // each row still names its own step.
  const partnerOf = (room) =>
    model.allPeople().find((person) => person.id === room.partnerId);
  const active = mine.filter(
    (room) => !["cancelled", "reviewed"].includes(room.status),
  );
  const groups = new Map(
    [
      [
        "Waiting on you",
        active.filter(
          (room) => roomNextAction(room, partnerOf(room)?.name).mine,
        ),
      ],
      [
        "In progress",
        active.filter(
          (room) => !roomNextAction(room, partnerOf(room)?.name).mine,
        ),
      ],
    ].filter(([, rooms]) => rooms.length),
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
      {groups.size === 0 &&
        (finished ? (
          <p>
            No active mentees.{" "}
            {finished === 1
              ? "Your finished mentorship is"
              : `Your ${finished} finished mentorships are`}{" "}
            in Room history.
          </p>
        ) : (
          <MenteesEmpty requests={state.mentorRequests?.length || 0} />
        ))}
      {[...groups].map(([label, rooms]) => (
        <section className="card panel section-gap" key={label}>
          <h2>{label}</h2>
          {rooms.map((room) => (
            <MenteeRow key={room.id} room={room} partner={partnerOf(room)} />
          ))}
        </section>
      ))}
    </div>
  );
}
