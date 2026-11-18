import { useApp } from "../state/AppContext.jsx";
import Avatar from "./Avatar.jsx";
import VerificationGate from "./VerificationGate.jsx";
import { verificationRequired } from "../data/collaboration.js";
import SimulateAcceptance from "./SimulateAcceptance.jsx";
import DeclineIntroduction from "./DeclineIntroduction.jsx";
import { matchReason, stageLabel } from "../data/profile-presentation.js";

const dayMs = 86400000;
const dateText = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
const statusText = {
  accepted: "Accepted · Deal Room opened",
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired after 14 days",
};

function Timing({ meta, incoming }) {
  if (!meta?.sentAt) return null;
  const left = Math.max(
    0,
    Math.ceil((Date.parse(meta.sentAt) + 14 * dayMs - Date.now()) / dayMs),
  );
  return (
    <p className="introduction-timing">
      {incoming ? "Received" : "Sent"} {dateText(meta.sentAt)} · expires in{" "}
      {left} day{left === 1 ? "" : "s"}
    </p>
  );
}

function IntroductionRow({ person, incoming }) {
  const { state, onAction } = useApp();
  const meta = state.introductionMetaByRole?.[state.role]?.[person.id];
  const type = person.engagement;
  const youGet = person.exchange?.youGet || [];
  return (
    <article className="introduction-row">
      <Avatar
        image={person.image}
        name={person.name}
        identity={person.accountId || person.id}
        color={person.color}
      />
      <div className="introduction-copy">
        <h3>{person.name}</h3>
        <p>
          {incoming ? "Wants to work with you" : "Waiting for their reply"} ·{" "}
          {type} · {person.score}% match
        </p>
        <Timing meta={meta} incoming={incoming} />
        {incoming && meta?.note && (
          <blockquote className="intro-note">“{meta.note}”</blockquote>
        )}
        <div className="introduction-brief">
          <p>
            <strong>Why it fits:</strong> {matchReason(person)}
          </p>
          {incoming && state.role === "founder" && youGet.length > 0 && (
            <p>
              <strong>What you’d get:</strong> {youGet.join(", ")}
            </p>
          )}
          {person.kind === "Startup" ? (
            <>
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
              {person.goals && (
                <p>
                  <strong>Startup goal:</strong> {person.goals}
                </p>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
      <div className="introduction-actions">
        {!incoming && <SimulateAcceptance person={person} />}
        <button
          className="btn small"
          onClick={() => onAction({ action: "match-detail", id: person.id })}
        >
          View profile<span className="visually-hidden">: {person.name}</span>
        </button>
        {incoming ? (
          <>
            <button
              className="btn small primary"
              disabled={state.busy || verificationRequired(state)}
              onClick={() =>
                onAction({ action: "accept-interest", id: person.id })
              }
            >
              {verificationRequired(state)
                ? "Verify to accept introductions"
                : "Accept introduction"}
              <span className="visually-hidden"> from {person.name}</span>
            </button>
            <VerificationGate />
            <DeclineIntroduction person={person} className="link-btn" />
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
            <span className="visually-hidden">
              {" "}
              introduction to {person.name}
            </span>
          </button>
        )}
      </div>
    </article>
  );
}

export default function Introductions({ compact = false }) {
  const { state, model, onAction } = useApp();
  const incoming = state.incomingByRole[state.role];
  const outgoing = model.waitingMatches();
  const people = model
    .rolePeople()
    .filter(
      (person) =>
        (incoming.has(person.id) || outgoing.has(person.id)) &&
        (compact ||
          !state.introductionMetaByRole?.[state.role]?.[person.id]?.kind),
    );
  const received = people.filter((person) => incoming.has(person.id));
  const sent = people.filter((person) => !incoming.has(person.id));
  const history = (state.introHistoryByRole?.[state.role] || []).slice(0, 10);
  const mentor = state.role === "mentor";
  const [one, many] = mentor
    ? ["request", "requests"]
    : ["introduction", "introductions"];
  if (compact) {
    if (!people.length) return null;
    return (
      <section className="card panel introduction-summary">
        <h2>{mentor ? "Requests" : "Introductions"}</h2>
        <p>
          {received.length
            ? `${received.length} ${received.length === 1 ? `${one} needs` : `${many} need`} your reply.`
            : `${sent.length} sent and waiting for a reply.`}
        </p>
        <button
          className="btn"
          onClick={() => onAction({ page: mentor ? "requests" : "waiting" })}
        >
          View {many}
        </button>
      </section>
    );
  }
  return (
    <section className="card panel introductions">
      <h2>Your {many}</h2>
      {!people.length && (
        <p className="muted">
          {mentor
            ? "No pending requests. Browse startups to find one to support."
            : "No pending introductions for founder exchanges."}
        </p>
      )}
      {received.length > 0 && (
        <section aria-labelledby="intro-received">
          <h3 id="intro-received" className="introduction-group">
            Needs your reply ({received.length})
          </h3>
          {received.map((person) => (
            <IntroductionRow key={person.id} person={person} incoming />
          ))}
        </section>
      )}
      {sent.length > 0 && (
        <section aria-labelledby="intro-sent">
          <h3 id="intro-sent" className="introduction-group">
            Sent ({sent.length})
          </h3>
          {sent.map((person) => (
            <IntroductionRow key={person.id} person={person} />
          ))}
        </section>
      )}
      {history.length > 0 && (
        <section aria-labelledby="intro-closed">
          <h3 id="intro-closed" className="introduction-group">
            Closed
          </h3>
          <ul className="introduction-history">
            {history.map((item, index) => (
              <li key={`${item.id}-${index}`}>
                <span>
                  {item.direction === "sent" ? "To" : "From"} {item.name}
                </span>
                <span>
                  {statusText[item.status] || item.status}
                  {item.reason ? `: “${item.reason}”` : ""}
                </span>
                <span className="muted">{dateText(item.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
