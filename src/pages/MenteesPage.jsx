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
import { personVerified } from "../data/collaboration.js";
import {
  mentorStepLabel,
  mentorStepRank,
  waitingText,
} from "../data/mentor-home.js";

const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);

// The button names the mentor's step (Confirm check-in, Deliver review…)
// and opens the room on the tab that holds it; while the mentor waits, the
// line says who is expected to act.
export function MenteeRow({ room, partner, next, primary = false }) {
  const { onAction } = useApp();
  const mine = mentorStepRank(next) < 8;
  return (
    <article className="collaboration-row">
      <div className="mentee-identity">
        <Avatar
          image={partner?.image}
          name={partner?.name}
          identity={partner?.accountId || room.partnerId}
          verified={personVerified(partner)}
        />
        <div>
          <h3>{partner?.name || "Startup"}</h3>
          <p>{mentorFormat(roomFormat(room)).label}</p>
          <p className={mine ? "mentee-turn" : undefined}>
            {mine
              ? `Your turn: ${lower(next.text)}`
              : waitingText(next, partner?.name)}
          </p>
        </div>
      </div>
      <button
        className={`btn small${primary ? " primary" : ""}`}
        onClick={() =>
          onAction({
            action: "open-room",
            id: room.id,
            tab: next.tab,
            review: mine && next.review,
          })
        }
      >
        {mentorStepLabel(next)}
        <span className="visually-hidden">
          {" "}
          with {partner?.name || "this startup"}
        </span>
      </button>
    </article>
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
  const partnerOf = (room) =>
    model.allPeople().find((person) => person.id === room.partnerId);
  // Stage groups keep their order; inside each, mentorships that need the
  // mentor come first, most urgent step first.
  const rows = mine
    .filter((room) => !["cancelled", "reviewed"].includes(room.status))
    .map((room) => {
      const partner = partnerOf(room);
      return { room, partner, next: roomNextAction(room, partner?.name) };
    });
  const groups = Map.groupBy(rows, ({ room }) => mentorshipStageText(room));
  for (const group of groups.values())
    group.sort((a, b) => mentorStepRank(a.next) - mentorStepRank(b.next));
  const needYou = rows.filter(({ next }) => mentorStepRank(next) < 8);
  // One primary button on the page: the most urgent step.
  const first = [...needYou].sort(
    (a, b) => mentorStepRank(a.next) - mentorStepRank(b.next),
  )[0]?.room.id;
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
        intro={
          groups.size === 0
            ? undefined
            : needYou.length
              ? `${needYou.length} ${needYou.length === 1 ? "mentorship needs" : "mentorships need"} your action`
              : "Nothing needs you right now"
        }
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
          <p>Accept a mentorship request to see your mentees here.</p>
        ))}
      {[...groups].map(([label, items]) => (
        <section className="card panel section-gap" key={label}>
          <h2>{label}</h2>
          {items.map(({ room, partner, next }) => (
            <MenteeRow
              key={room.id}
              room={room}
              partner={partner}
              next={next}
              primary={room.id === first}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
