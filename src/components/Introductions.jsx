import { useApp } from "../state/AppContext.jsx";
import Avatar from "./Avatar.jsx";

export default function Introductions({ compact = false }) {
  const { state, model, onAction } = useApp();
  const incoming = state.incomingByRole[state.role];
  const outgoing = model.waitingMatches();
  const people = model
    .rolePeople()
    .filter((person) => incoming.has(person.id) || outgoing.has(person.id));
  if (compact) {
    if (!people.length) return null;
    return (
      <section className="card panel introduction-summary">
        <h2>Introductions ({people.length})</h2>
        <p>
          {incoming.size
            ? `${incoming.size} collaborator${incoming.size === 1 ? " wants" : "s want"} to connect with you.`
            : "Your introductions are waiting for a response."}
        </p>
        <button className="btn" onClick={() => onAction({ page: "waiting" })}>
          View introductions
        </button>
      </section>
    );
  }
  return (
    <section className="card panel introductions">
      <h2>Your introductions</h2>
      {!people.length && (
        <p className="muted">
          No pending introductions. Explore Matches to find your next
          collaborator.
        </p>
      )}
      {people.map((person) => (
        <article className="introduction-row" key={person.id}>
          <Avatar
            image={person.image}
            name={person.name}
            initials={person.initials}
            color={person.color}
          />
          <div className="introduction-copy">
            <h3>{person.name}</h3>
            <p>
              {incoming.has(person.id)
                ? "Wants to connect with you"
                : "Waiting for their response"}{" "}
              · {person.engagement}
            </p>
          </div>
          <div className="introduction-actions">
            <button
              className="btn small"
              onClick={() =>
                onAction({ action: "match-detail", id: person.id })
              }
            >
              View profile
            </button>
            {incoming.has(person.id) ? (
              <>
                <button
                  className="btn small primary"
                  disabled={state.busy}
                  onClick={() =>
                    onAction({ action: "accept-interest", id: person.id })
                  }
                >
                  Accept introduction
                </button>
                <button
                  className="link-btn"
                  disabled={state.busy}
                  onClick={() =>
                    onAction({ action: "decline-interest", id: person.id })
                  }
                >
                  Decline
                </button>
              </>
            ) : (
              <button
                className="link-btn"
                disabled={state.busy}
                onClick={() =>
                  onAction({ action: "cancel-interest", id: person.id })
                }
              >
                Withdraw
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
