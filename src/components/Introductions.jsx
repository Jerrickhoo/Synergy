import { useApp } from "../state/AppContext.jsx";
import Avatar from "./Avatar.jsx";
import SimulateAcceptance from "./SimulateAcceptance.jsx";
import DeclineIntroduction from "./DeclineIntroduction.jsx";
import {
  matchReason,
  offeredToYou,
  stageLabel,
} from "../data/profile-presentation.js";
import { personVerified } from "../data/collaboration.js";

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
  const youGet = offeredToYou(person);
  return (
    <article className="introduction-row">
      <Avatar
        image={person.image}
        name={person.name}
        identity={person.accountId || person.id}
        verified={personVerified(person)}
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
              disabled={state.busy}
              onClick={() =>
                onAction({ action: "accept-interest", id: person.id })
              }
            >
              Accept request
              <span className="visually-hidden"> from {person.name}</span>
            </button>
            <DeclineIntroduction person={person} className="link-btn" />
          </>
        ) : (
          <button
            className="btn small"
            disabled={state.busy}
            onClick={() =>
              onAction({ action: "cancel-interest", id: person.id })
            }
          >
            Withdraw
            <span className="visually-hidden"> request to {person.name}</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Incoming and outgoing requests, as two sections with their own heading
// and count. `outgoingExtra` adds the founder's mentorship requests under
// Outgoing; `hideEmpty` leaves out an empty section (the mentor's page
// lists founders' requests above). `compact` is Home's one-line summary.
export default function Introductions({
  compact = false,
  outgoingExtra = null,
  outgoingExtraCount = 0,
  hideEmpty = false,
}) {
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
  if (compact) {
    if (!people.length) return null;
    return (
      <section className="card panel introduction-summary">
        <h2>Requests</h2>
        <p>
          {received.length
            ? `${received.length} ${received.length === 1 ? "request needs" : "requests need"} your reply.`
            : `${sent.length} sent and waiting for a reply.`}
        </p>
        <button
          className="btn"
          onClick={() => onAction({ page: mentor ? "requests" : "waiting" })}
        >
          View requests
        </button>
      </section>
    );
  }
  const sentCount = sent.length + outgoingExtraCount;
  return (
    <>
      {(!hideEmpty || received.length > 0) && (
        <section className="requests-group" aria-labelledby="requests-incoming">
          <div className="requests-group-head">
            <h2 id="requests-incoming">
              Incoming requests
              <span className="requests-count">{received.length}</span>
            </h2>
            <p>
              {mentor
                ? "Founders who want to work with you."
                : "People who want to work with you. Reply within 14 days or the request expires."}
            </p>
          </div>
          {received.length ? (
            <div className="card panel introductions">
              {received.map((person) => (
                <IntroductionRow key={person.id} person={person} incoming />
              ))}
            </div>
          ) : (
            <p className="card panel requests-empty">
              No one is waiting on your reply right now.
            </p>
          )}
        </section>
      )}
      {(!hideEmpty || sentCount > 0) && (
        <section className="requests-group" aria-labelledby="requests-outgoing">
          <div className="requests-group-head">
            <h2 id="requests-outgoing">
              Outgoing requests
              <span className="requests-count">{sentCount}</span>
            </h2>
            <p>Requests you sent, and where each one stands.</p>
          </div>
          {sent.length > 0 && (
            <div className="card panel introductions">
              {sent.map((person) => (
                <IntroductionRow key={person.id} person={person} />
              ))}
            </div>
          )}
          {outgoingExtra}
          {!sentCount && (
            <p className="card panel requests-empty">
              {mentor
                ? "Nothing sent right now. Browse startups to find one to support."
                : "Nothing sent right now. Find someone in Matches and send them a request."}
            </p>
          )}
        </section>
      )}
      {history.length > 0 && (
        <section className="requests-group" aria-labelledby="requests-closed">
          <div className="requests-group-head">
            <h2 id="requests-closed">Closed requests</h2>
            <p>Accepted, declined, withdrawn or expired.</p>
          </div>
          <div className="card panel introductions">
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
          </div>
        </section>
      )}
    </>
  );
}
