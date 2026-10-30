import { useApp } from "../state/AppContext.jsx";
import Avatar from "./Avatar.jsx";
import SimulateAcceptance from "./SimulateAcceptance.jsx";
import { stageLabel } from "../data/profile-presentation.js";

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
          No pending introductions. Explore Matches to{" "}
          {state.role === "mentor"
            ? "find a startup to support."
            : "find your next collaborator."}
        </p>
      )}
      {people.map((person) => (
        <article className="introduction-row" key={person.id}>
          <Avatar
            image={person.image}
            name={person.name}
            identity={person.accountId || person.id}
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
            {person.kind === "Startup" ? (
              <div className="introduction-brief">
                <p>
                  {[
                    person.sector,
                    person.stage && stageLabel(person.stage),
                    person.teamSize && `Team of ${person.teamSize}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p>
                  <strong>
                    {state.role === "mentor"
                      ? "Needs guidance with"
                      : "Looking for"}
                    :
                  </strong>{" "}
                  {person.need?.join(", ") || "Discuss their needs together."}
                </p>
                <p>
                  <strong>Startup goal:</strong>{" "}
                  {person.goals || "Agree on a focused goal after connecting."}
                </p>
                <small>
                  From their current profile. View profile for full context.
                </small>
              </div>
            ) : (
              <div className="introduction-brief">
                <p>
                  <strong>Can guide you with:</strong>{" "}
                  {person.offer?.join(", ") ||
                    "Discuss their expertise together."}
                </p>
                {person.availability && (
                  <p>
                    <strong>Availability:</strong> {person.availability}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="introduction-actions">
            {!incoming.has(person.id) && <SimulateAcceptance person={person} />}
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
