import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "./Avatar.jsx";
import Overlay from "./Overlay.jsx";
import SelectField from "./SelectField.jsx";
import { startupTypes, typeLabel } from "../data/collaboration-types.js";
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
// "Nov 25, 2026", so a request from last year is never mistaken for this
// year's.
export const fullDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const statusText = {
  accepted: "Accepted · Deal Room opened",
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired after 14 days",
};

// Every request shows its date; one from before dates were kept says so.
function Timing({ meta, incoming }) {
  if (!meta?.sentAt)
    return (
      <p className="introduction-timing">
        {incoming ? "Received" : "Sent"} · date not recorded
      </p>
    );
  const left = Math.max(
    0,
    Math.ceil((Date.parse(meta.sentAt) + 14 * dayMs - Date.now()) / dayMs),
  );
  return (
    <p className="introduction-timing">
      {incoming ? "Received" : "Sent"}{" "}
      <time dateTime={meta.sentAt}>{fullDate(meta.sentAt)}</time> · expires in{" "}
      {left} day{left === 1 ? "" : "s"}
    </p>
  );
}

// The type a pending request proposes, by its current name.
function proposedType(state, person) {
  const id = state.introductionTypesByRole?.[state.role]?.[person.id];
  return id ? typeLabel(id) : typeLabel(person.engagement);
}

// A request you sent and are waiting on: who, which type, when. The full
// request (with editing and its earlier versions) opens from View request.
function OutgoingRow({ person }) {
  const { state, onAction } = useApp();
  const [open, setOpen] = useState(false);
  const meta = state.introductionMetaByRole?.[state.role]?.[person.id];
  return (
    <article className="introduction-row is-outgoing">
      <Avatar
        image={person.image}
        name={person.name}
        identity={person.accountId || person.id}
        verified={personVerified(person)}
        color={person.color}
      />
      <div className="introduction-copy">
        <h3>{person.name}</h3>
        <p>Waiting for their reply · {proposedType(state, person)}</p>
        <Timing meta={meta} />
        {meta?.editedAt && (
          <p className="introduction-timing">
            Edited{" "}
            <time dateTime={meta.editedAt}>{fullDate(meta.editedAt)}</time>
          </p>
        )}
      </div>
      <div className="introduction-actions">
        <button
          className="btn small primary"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          View request<span className="visually-hidden">: {person.name}</span>
        </button>
        <button
          className="btn small"
          disabled={state.busy}
          onClick={() => onAction({ action: "cancel-interest", id: person.id })}
        >
          Withdraw
          <span className="visually-hidden"> request to {person.name}</span>
        </button>
      </div>
      {open && (
        <SentRequestDialog
          person={person}
          meta={meta}
          onClose={() => setOpen(false)}
        />
      )}
    </article>
  );
}

// The request as sent, with Edit. Saving an edit keeps the earlier type and
// note in the version history below; nothing is lost.
function SentRequestDialog({ person, meta, onClose }) {
  const { state, onAction } = useApp();
  const [editing, setEditing] = useState(false);
  const typeId =
    state.introductionTypesByRole?.[state.role]?.[person.id] ||
    (state.role === "mentor" || person.kind === "Mentor" ? "mentorship" : "");
  const [type, setType] = useState(typeId);
  const [note, setNote] = useState(meta?.note || "");
  const mentorship = typeId === "mentorship";
  const versions = [...(meta?.versions || [])].reverse();
  const expires =
    meta?.sentAt && new Date(Date.parse(meta.sentAt) + 14 * dayMs);
  return (
    <Overlay
      id="sent-request"
      title={`Your request to ${person.name}`}
      onClose={onClose}
      footer={
        editing ? (
          <>
            <button className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={state.busy}
              onClick={async () => {
                const saved = await onAction({
                  action: "edit-interest",
                  id: person.id,
                  engagementType: mentorship ? undefined : type,
                  values: { note },
                });
                if (saved) setEditing(false);
              }}
            >
              {state.busy ? "Saving…" : "Save changes"}
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={onClose}>
              Close
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setType(typeId);
                setNote(meta?.note || "");
                setEditing(true);
              }}
            >
              Edit request
            </button>
          </>
        )
      }
    >
      <div className="sent-request">
        {editing ? (
          <div className="sent-request-edit">
            {!mentorship && (
              <div className="field">
                <label htmlFor="sent-request-type">Collaboration type</label>
                <SelectField
                  id="sent-request-type"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                >
                  {startupTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </SelectField>
              </div>
            )}
            <div className="field">
              <label htmlFor="sent-request-note">Note</label>
              <textarea
                id="sent-request-note"
                maxLength={280}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <span className="field-count">{note.length} / 280</span>
            </div>
            <p className="field-help">
              {person.name} sees the new version; the one you sent first stays
              in this request's history.
            </p>
          </div>
        ) : (
          <dl className="sent-request-facts">
            <div>
              <dt>Status</dt>
              <dd>Waiting for their reply</dd>
            </div>
            <div>
              <dt>Collaboration type</dt>
              <dd>{typeLabel(typeId) || "Not chosen"}</dd>
            </div>
            <div>
              <dt>Sent</dt>
              <dd>
                {meta?.sentAt ? fullDate(meta.sentAt) : "Date not recorded"}
              </dd>
            </div>
            {expires && (
              <div>
                <dt>Expires</dt>
                <dd>{fullDate(expires.toISOString())}</dd>
              </div>
            )}
            <div className="sent-request-note">
              <dt>Note</dt>
              <dd>{meta?.note ? `“${meta.note}”` : "No note"}</dd>
            </div>
          </dl>
        )}
        {versions.length > 0 && (
          <section
            className="sent-request-history"
            aria-labelledby="sent-request-history"
          >
            <h3 id="sent-request-history">Earlier versions</h3>
            <ol>
              {versions.map((version, index) => (
                <li key={`${version.savedAt}-${index}`}>
                  <span className="sent-request-version">
                    Version {versions.length - index}
                    {version.savedAt ? ` · ${fullDate(version.savedAt)}` : ""}
                  </span>
                  <span>{typeLabel(version.engagementType)}</span>
                  <span className="muted">
                    {version.note ? `“${version.note}”` : "No note"}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
        {!editing && <SimulateAcceptance person={person} />}
      </div>
    </Overlay>
  );
}

export function IntroductionRow({ person, incoming }) {
  const { state, onAction } = useApp();
  const meta = state.introductionMetaByRole?.[state.role]?.[person.id];
  const type = proposedType(state, person);
  const youGet = offeredToYou(person);
  if (!incoming) return <OutgoingRow person={person} />;
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
        <button
          className="btn small"
          onClick={() => onAction({ action: "match-detail", id: person.id })}
        >
          View profile<span className="visually-hidden">: {person.name}</span>
        </button>
        <button
          className="btn small primary"
          disabled={state.busy}
          onClick={() => onAction({ action: "accept-interest", id: person.id })}
        >
          Accept request
          <span className="visually-hidden"> from {person.name}</span>
        </button>
        <DeclineIntroduction person={person} className="link-btn" />
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
