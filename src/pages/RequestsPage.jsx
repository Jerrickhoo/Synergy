import ReportCollaborator from "../components/ReportCollaborator.jsx";
import { priceLabel } from "../data/pricing.js";
import BlockCollaborator from "../components/BlockCollaborator.jsx";
import { FounderTrackRecord } from "../components/MentorImpact.jsx";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Introductions, {
  IntroductionRow,
  fullDate,
} from "../components/Introductions.jsx";
import Icon from "../components/Icon.jsx";
import Avatar from "../components/Avatar.jsx";
import Overlay from "../components/Overlay.jsx";
import {
  introductionRecords,
  introductionStatusLabel,
  statusMeaning,
} from "../data/activity.js";
import { MentorAlternatives } from "../components/MentorRequestForm.jsx";
import { mentorFormat } from "../data/mentor-formats.js";
import {
  declineMessageLimit,
  requestFields,
  requestReasons,
} from "../data/request-assistant.js";
import LimitedTextarea from "../components/LimitedTextarea.jsx";
import { matchStrength, stageLabel } from "../data/profile-presentation.js";
import LinkedText from "../components/LinkedText.jsx";
import PrototypeShortcut from "../components/PrototypeShortcut.jsx";
import {
  cooldownActive,
  cooldownText,
  requestStatusLabel,
} from "../data/mentor-rules.js";
import SelectField from "../components/SelectField.jsx";

const declineReasons = ["outside-expertise", "no-slots", "not-a-fit", "other"];

// What accepting commits the mentor to, stated before they decide.
const commitments = {
  "quick-ask":
    "Accepting means answering their question in writing within your reply time, then leaving a private review.",
  "doc-review":
    "Accepting means reviewing what they upload and leaving written feedback, then a private review.",
  "single-session":
    "Accepting means confirming the goal, booking a call of about 1 hour, reporting attendance and leaving a private review.",
  "office-hours":
    "Accepting means meeting in the booked slot, reporting attendance and leaving a private review.",
  "ongoing-advisory":
    "Accepting means agreeing goals and holding 4 check-ins over 8 weeks, reporting attendance for each.",
};
const formatLabel = (request) =>
  mentorFormat(request.format)?.label || "Mentorship";
const pendingTime = (expiry) => {
  const hours = Math.max(
    1,
    Math.ceil((Date.parse(expiry) - Date.now()) / 3600000),
  );
  const days = Math.ceil(hours / 24);
  return hours <= 24
    ? `Expires in ${hours} ${hours === 1 ? "hour" : "hours"}`
    : `Expires in ${days} days`;
};

// What the founder sent, so a pending request can be reread while waiting.
function RequestAnswers({ request }) {
  return (
    <dl className="mentor-request-answers">
      {Object.entries(requestFields)
        .filter(([key]) => request[key])
        .map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd className="preserve-lines">{request[key]}</dd>
          </div>
        ))}
      {request.desiredOutcome && (
        <div>
          <dt>Desired outcome</dt>
          <dd className="preserve-lines">{request.desiredOutcome}</dd>
        </div>
      )}
      <div>
        <dt>Format</dt>
        <dd>
          {formatLabel(request)}
          {request.price ? ` · ${priceLabel(request.price)}` : ""}
        </dd>
      </div>
      {request.links?.length > 0 && (
        <div>
          <dt>Links</dt>
          <dd>
            <ul className="sent-request-links">
              {request.links.map((link) => (
                <li key={link}>
                  <LinkedText text={link} />
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
    </dl>
  );
}

// "David usually replies within 3 days. You'll see the reply in Updates."
function replyLine(request, mentor) {
  const first = String(request.name || "The mentor").split(" ")[0];
  const days = mentor?.responseDays;
  return days
    ? `${first} usually replies within ${days} ${days === 1 ? "day" : "days"}. You’ll see the reply in Updates.`
    : `You’ll see ${first}’s reply in Updates.`;
}

export function RequestCard({ request }) {
  const { state, model, onAction } = useApp();
  const founder = model
    .rolePeople()
    .find((person) => person.id === request.partnerId);
  const [mode, setMode] = useState("");
  const [reason, setReason] = useState(declineReasons[0]);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState([]);
  const cooldown = state.mentorConfig?.cooldownDays?.[reason] || 0;
  const commitment =
    commitments[request.format] ||
    (format?.effort
      ? `Accepting opens a mentorship room. This format takes ${format.effort.toLowerCase()}.`
      : "");
  const choices = state.referralChoices?.[request.id] || [];
  const error =
    state.mentorshipActionError?.id === request.partnerId &&
    state.mentorshipActionError;
  const format = mentorFormat(request.format);
  const act = (action, event, values) =>
    onAction(
      {
        action,
        id: request.partnerId,
        requestId: request.id,
        values,
      },
      event,
    );
  return (
    <article
      className="card panel mentor-request-card"
      id={`request-${request.id}`}
      tabIndex={-1}
    >
      <h2>{request.name}</h2>
      {founder && (
        <p className="request-founder">
          {[
            founder.founderName && founder.founderName !== founder.name
              ? founder.founderName
              : "",
            stageLabel(founder.stage),
            founder.sector,
          ]
            .filter(Boolean)
            .join(" · ")}{" "}
          <button
            className="link-btn"
            onClick={(event) =>
              onAction({ action: "match-detail", id: founder.id }, event)
            }
          >
            View profile
            <span className="visually-hidden"> of {request.name}</span>
          </button>
        </p>
      )}
      <p className="muted request-meta">
        {request.category ? `${request.category} mentoring · ` : ""}
        {formatLabel(request)} · {format?.effort}
        {request.price ? ` · ${priceLabel(request.price)}` : ""} ·{" "}
        {pendingTime(request.expiresAt)}
      </p>
      <p className="request-meta">
        {request.score}% match · {matchStrength(request.score)}
      </p>
      <FounderTrackRecord trackRecord={request.trackRecord} />
      {request.conflictWarning && (
        <p className="warning-note">{request.conflictWarning}</p>
      )}
      {request.kind === "legacy-note" ? (
        <div>
          <p>Sent before structured requests</p>
          {request.note && <blockquote>{request.note}</blockquote>}
        </div>
      ) : (
        <dl className="mentor-request-answers">
          {Object.entries(requestFields).map(([id, label]) => (
            <div key={id}>
              <dt>{label}</dt>
              <dd>{request[id]}</dd>
            </div>
          ))}
          {request.desiredOutcome && (
            <div>
              <dt>Desired outcome</dt>
              <dd>{request.desiredOutcome}</dd>
            </div>
          )}
          {request.links.length > 0 && (
            <div>
              <dt>Links</dt>
              <dd>
                <ul>
                  {request.links.map((link, index) => (
                    <li key={`${link}-${index}`}>
                      <a href={link} target="_blank" rel="noreferrer">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      )}
      {error && (
        <div className="warning-note" role="status">
          <p>{error.message}</p>
          {error.reason === "request-closed" ||
          error.reason === "request-changed" ||
          error.reason === "unavailable" ? (
            <button
              className="btn small"
              onClick={() => window.location.reload()}
            >
              Refresh requests
            </button>
          ) : error.reason ? (
            <p>
              You can update your{" "}
              <button
                className="link-btn"
                onClick={() => onAction({ page: "settings" })}
              >
                mentoring settings
              </button>
              , decline, or suggest another mentor using Refer.
            </p>
          ) : null}
        </div>
      )}
      <div className="mentor-request-controls">
        <button
          className="btn primary"
          disabled={state.busy}
          onClick={(event) => act("accept-request", event)}
        >
          Accept
        </button>
        <button
          className="btn"
          disabled={state.busy}
          aria-expanded={mode === "decline"}
          onClick={() => setMode(mode === "decline" ? "" : "decline")}
        >
          Decline
        </button>
        <button
          className="btn"
          disabled={state.busy}
          aria-expanded={mode === "refer"}
          onClick={() => setMode(mode === "refer" ? "" : "refer")}
        >
          Refer
        </button>
      </div>
      {commitment && !mode && (
        <p className="request-commitment">{commitment}</p>
      )}
      {mode === "decline" && (
        <form
          className="mentor-request-form"
          onInput={(event) => {
            if (event.target.name === "message") setMessage(event.target.value);
          }}
          onSubmit={(event) =>
            act("decline-request", event, {
              reason,
              message: new FormData(event.currentTarget).get("message") || "",
            })
          }
        >
          <label htmlFor={`decline-${request.id}`}>Reason</label>
          <SelectField
            id={`decline-${request.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            {declineReasons.map((id) => (
              <option key={id} value={id}>
                {requestReasons[id]}
              </option>
            ))}
          </SelectField>
          <LimitedTextarea
            id={`decline-message-${request.id}`}
            name="message"
            label="Message to the founder (optional)"
            limit={declineMessageLimit}
          />
          <div className="founder-preview" aria-live="polite">
            <h3>What {request.name} will see</h3>
            <p>Declined · {requestReasons[reason]}</p>
            {message.trim() && <blockquote>{message.trim()}</blockquote>}
            <p>
              They're shown other mentors to ask
              {cooldown
                ? `, and can't request you again for ${cooldown} days.`
                : ", and can request you again later."}
            </p>
          </div>
          <button className="btn" disabled={state.busy}>
            Send decline
          </button>
        </form>
      )}
      {mode === "refer" && (
        <form
          className="mentor-request-form"
          onSubmit={(event) =>
            act("refer-request", event, { mentorIds: selected })
          }
        >
          <fieldset>
            <legend>
              Suggest up to {state.mentorConfig?.maxReferrals || 3} mentors
            </legend>
            {choices.length ? (
              choices.map((mentor) => (
                <label key={mentor.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(mentor.id)}
                    disabled={
                      !selected.includes(mentor.id) &&
                      selected.length >= (state.mentorConfig?.maxReferrals || 3)
                    }
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, mentor.id]
                          : selected.filter((id) => id !== mentor.id),
                      )
                    }
                  />
                  {mentor.name} · {mentor.score}% match
                </label>
              ))
            ) : (
              <p>No suggested mentors are currently available.</p>
            )}
          </fieldset>
          {choices.length > 0 && (
            <div className="founder-preview" aria-live="polite">
              <h3>What {request.name} will see</h3>
              {selected.length > 0 && (
                <p>
                  You suggested{" "}
                  {choices
                    .filter((mentor) => selected.includes(mentor.id))
                    .map((mentor) => mentor.name)
                    .join(", ")}
                  , each with an Ask button.
                </p>
              )}
              <p>
                Their request closes with you. It reaches a suggested mentor
                only if they choose to ask.
              </p>
            </div>
          )}
          <button className="btn" disabled={state.busy || !selected.length}>
            Send referral
          </button>
        </form>
      )}
      {/* Safety actions sit below the reply, never beside Accept. */}
      {founder && (
        <div className="mentor-request-controls request-safety">
          <ReportCollaborator person={founder} compact />
          <BlockCollaborator person={founder} />
        </div>
      )}
    </article>
  );
}

// One mentorship request you sent, laid out like a sent startup request:
// who, where it stands and when, with the full request in a dialog.
function SentMentorRequestCard({ request }) {
  const { state, onAction, model } = useApp();
  const [open, setOpen] = useState(false);
  const mentor = model
    .rolePeople()
    .find((person) => person.id === request.partnerId);
  const pending = request.status === "pending";
  const withdraw = (event) =>
    onAction(
      {
        action: "withdraw-request",
        id: request.partnerId,
        requestId: request.id,
      },
      event,
    );
  return (
    <article
      className="card panel mentor-request-card"
      id={`request-${request.id}`}
      tabIndex={-1}
    >
      <div className="mentor-request-row">
        <Avatar
          image={mentor?.image}
          name={request.name}
          identity={mentor?.accountId || request.partnerId}
          color={mentor?.color}
        />
        <div className="mentor-request-copy">
          <h4 className="mentor-request-name">{request.name}</h4>
          <p className="mentor-request-status">
            <span className="request-status">
              {requestStatusLabel(request.status)}
            </span>
            {" · "}
            {formatLabel(request)}
            {pending ? ` · ${pendingTime(request.expiresAt)}` : ""}
          </p>
          {request.sentAt && (
            <p className="introduction-timing">
              Sent{" "}
              <time dateTime={request.sentAt}>{fullDate(request.sentAt)}</time>
            </p>
          )}
          {pending && (
            <p className="mentor-request-reply">{replyLine(request, mentor)}</p>
          )}
        </div>
        <div className="introduction-actions">
          {request.kind !== "legacy-note" && (
            <button
              className={`btn small${pending ? " primary" : ""}`}
              aria-haspopup="dialog"
              onClick={() => setOpen(true)}
            >
              View request
              <span className="visually-hidden">: {request.name}</span>
            </button>
          )}
          {pending && (
            <button
              className="btn small"
              disabled={state.busy}
              onClick={withdraw}
            >
              Withdraw
            </button>
          )}
          {request.status === "accepted" && state.rooms[request.roomId] && (
            <button
              className="btn small primary"
              onClick={() =>
                onAction({ action: "open-room", id: request.roomId })
              }
            >
              Open room
            </button>
          )}
        </div>
      </div>
      {request.reason && (
        <p>{requestReasons[request.reason] || request.reason}</p>
      )}
      {request.status === "expired" && (
        <p>The mentor's response window ended.</p>
      )}
      {request.message && <blockquote>{request.message}</blockquote>}
      {cooldownActive(request.cooldownUntil) && (
        <p>{cooldownText(request.cooldownUntil)}.</p>
      )}
      <MentorAlternatives
        alternatives={request.alternatives}
        referralId={request.status === "referred" ? request.id : null}
      />
      {open && (
        <Overlay
          id="sent-mentorship-request"
          title={`Your request to ${request.name}`}
          onClose={() => setOpen(false)}
          busy={state.busy}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>
                Close
              </button>
              <button
                className="btn"
                onClick={() =>
                  onAction({ action: "match-detail", id: request.partnerId })
                }
              >
                View profile
              </button>
            </>
          }
        >
          <dl className="sent-request-facts">
            <div>
              <dt>Status</dt>
              <dd>{requestStatusLabel(request.status)}</dd>
            </div>
            {request.sentAt && (
              <div>
                <dt>Sent</dt>
                <dd>{fullDate(request.sentAt)}</dd>
              </div>
            )}
          </dl>
          <RequestAnswers request={request} />
          {pending && mentor?.canSimulateAcceptance && (
            <PrototypeShortcut
              note={`${request.name} is fictional. Simulate them accepting to open your mentorship room.`}
            >
              <button
                className="btn"
                disabled={state.busy}
                onClick={(event) =>
                  onAction(
                    { action: "simulate-acceptance", id: request.partnerId },
                    event,
                  )
                }
              >
                Simulate acceptance
              </button>
            </PrototypeShortcut>
          )}
        </Overlay>
      )}
    </article>
  );
}

// The founder's mentorship requests. `records` narrows the list (the
// Requests page passes the ones its tab and filters show).
export function SentMentorRequests({ records: shown }) {
  const { state, onAction, model } = useApp();
  const records = shown || state.mentorRequests || [];
  useRequestFocus(state.activeMentorRequest);
  if (!records.length) return null;
  const pending = records.filter(
    (request) => request.status === "pending",
  ).length;
  const referred = records.filter(
    (request) => request.status === "referred" && request.alternatives.length,
  ).length;
  const details = [
    pending && `${pending} waiting for a reply`,
    referred && `${referred} with mentor suggestions`,
  ].filter(Boolean);
  return (
    // Sits under Outgoing requests on the Requests page.
    <section
      className="mentor-requests-list"
      aria-labelledby="sent-mentorship-requests"
    >
      <h3 id="sent-mentorship-requests" className="requests-subhead">
        Mentorship requests
        {details.length > 0 && (
          <span className="requests-subhead-detail">{details.join(" · ")}</span>
        )}
      </h3>
      {records.map((request) => (
        <SentMentorRequestCard key={request.id} request={request} />
      ))}
    </section>
  );
}

const requestTabs = [
  ["incoming", "Incoming"],
  ["outgoing", "Outgoing"],
  ["history", "History"],
];
const dateWindows = [
  ["any", "All time"],
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
];
const typeChoices = [
  ["all", "Everyone"],
  ["startup", "Startup founders"],
  ["mentor", "Mentors"],
];
const dayMs = 86400000;
// The collaborator's side, from their profile id ("…:mentor").
const collaboratorType = (row) =>
  String(row.personId || "").endsWith(":mentor") ? "mentor" : "startup";
// A founder's referred mentorship request still has a step to take (ask a
// suggested mentor), so it stays under Outgoing.
const requestTab = (row) =>
  row.status === "needs-reply"
    ? "incoming"
    : row.status === "waiting" ||
        (row.status === "referred" && row.direction === "sent")
      ? "outgoing"
      : "history";

// One past request: who, which way, when it was sent and closed, and how
// it ended.
function HistoryRow({ row }) {
  return (
    <li
      className="requests-history-row"
      id={row.requestId ? `request-${row.requestId}` : undefined}
      tabIndex={row.requestId ? -1 : undefined}
    >
      <div className="requests-history-who">
        <strong>{row.name}</strong>
        <span>
          {collaboratorType(row) === "mentor" ? "Mentor" : "Startup founder"} ·{" "}
          {row.direction === "sent" ? "You sent it" : "Sent to you"}
          {row.kind === "Mentorship request" ? " · Mentorship request" : ""}
        </span>
      </div>
      <div className="requests-history-dates">
        <span>
          Requested{" "}
          {row.requestedAt ? (
            <time dateTime={row.requestedAt}>{fullDate(row.requestedAt)}</time>
          ) : (
            "· date not recorded"
          )}
        </span>
        {row.closedAt && (
          <span>
            Closed <time dateTime={row.closedAt}>{fullDate(row.closedAt)}</time>
          </span>
        )}
      </div>
      <span
        className={`activity-status status-${row.status}`}
        title={statusMeaning(row.status)}
      >
        {introductionStatusLabel(row.status)}
      </span>
      {row.reason && <p className="requests-history-reason">“{row.reason}”</p>}
    </li>
  );
}

// A founder's Requests: Incoming, Outgoing and History tabs over one list,
// narrowed by name, date sent and whether the other side is a startup
// founder or a mentor.
export function RequestsBoard() {
  const { state, model, onTabKeyDown } = useApp();
  const records = introductionRecords(state);
  const people = model.rolePeople();
  const personOf = (id) => people.find((person) => person.id === id);
  const [query, setQuery] = useState("");
  const [when, setWhen] = useState("any");
  const [who, setWho] = useState("all");
  // Open on the tab holding a linked request, else where replies are due.
  const linkedTab = () => {
    const linked = records.find(
      (row) => row.requestId && row.requestId === state.activeMentorRequest,
    );
    if (linked) return requestTab(linked);
    if (records.some((row) => requestTab(row) === "incoming"))
      return "incoming";
    if (records.some((row) => requestTab(row) === "outgoing"))
      return "outgoing";
    return "incoming";
  };
  const [tab, setTab] = useState(linkedTab);
  // A link to a request (from Updates) opens its tab and focuses it once
  // it is on screen; the records changing never moves the tab.
  const focusPending = useRef(null);
  useEffect(() => {
    if (!state.activeMentorRequest) return;
    focusPending.current = state.activeMentorRequest;
    setTab(linkedTab());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeMentorRequest]);
  useEffect(() => {
    const element =
      focusPending.current &&
      document.getElementById(`request-${focusPending.current}`);
    if (!element) return;
    element.focus();
    focusPending.current = null;
  });
  const search = query.trim().toLowerCase();
  const filtering = Boolean(search) || when !== "any" || who !== "all";
  const shown = records.filter((row) => {
    if (search && !row.name.toLowerCase().includes(search)) return false;
    if (who !== "all" && collaboratorType(row) !== who) return false;
    if (when !== "any") {
      const at = Date.parse(row.requestedAt || row.closedAt || "");
      if (!at || Date.now() - at > Number(when) * dayMs) return false;
    }
    return true;
  });
  const groups = Object.fromEntries(
    requestTabs.map(([id]) => [
      id,
      shown.filter((row) => requestTab(row) === id),
    ]),
  );
  const rows = groups[tab];
  const exchangeRows = rows.filter(
    (row) => row.kind !== "Mentorship request" && personOf(row.personId),
  );
  const mentorshipRecords = (state.mentorRequests || []).filter((request) =>
    rows.some((row) => row.requestId === request.id),
  );
  const clear = () => {
    setQuery("");
    setWhen("any");
    setWho("all");
  };
  const empty = {
    incoming: "No one is waiting on your reply right now.",
    outgoing:
      "Nothing sent right now. Find someone in Matches and send them a request.",
    history: "Accepted, declined, withdrawn and expired requests appear here.",
  }[tab];
  return (
    <section className="requests-board" aria-label="Your requests">
      <div className="tabs" role="tablist" aria-label="Requests">
        {requestTabs.map(([id, label]) => (
          <button
            key={id}
            className={`tab${tab === id ? " active" : ""}`}
            role="tab"
            id={`requests-tab-${id}`}
            aria-controls="requests-panel"
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onKeyDown={onTabKeyDown}
            onClick={() => setTab(id)}
          >
            {label}
            <span className="requests-count">{groups[id].length}</span>
          </button>
        ))}
      </div>
      <div className="requests-filters">
        <div className="filter-search field">
          <label className="visually-hidden" htmlFor="requests-search">
            Search requests
          </label>
          <Icon name="search" />
          <input
            className="search-input"
            id="requests-search"
            type="search"
            value={query}
            placeholder="Search by name"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <SelectField
          id="requests-date"
          aria-label="Date sent"
          className="requests-select"
          value={when}
          onChange={(event) => setWhen(event.target.value)}
        >
          {dateWindows.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="requests-type"
          aria-label="Collaborator type"
          className="requests-select"
          value={who}
          onChange={(event) => setWho(event.target.value)}
        >
          {typeChoices.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </SelectField>
        {filtering && (
          <button type="button" className="link-btn" onClick={clear}>
            Clear filters
          </button>
        )}
      </div>
      <div
        id="requests-panel"
        role="tabpanel"
        aria-labelledby={`requests-tab-${tab}`}
        className="requests-panel"
      >
        {!rows.length ? (
          <div className="card panel requests-empty">
            <p>{filtering ? "No requests match these filters." : empty}</p>
            {filtering && (
              <button type="button" className="btn small" onClick={clear}>
                Clear filters
              </button>
            )}
          </div>
        ) : tab === "history" ? (
          <ul className="card panel requests-history">
            {rows.map((row) => (
              <HistoryRow key={row.id} row={row} />
            ))}
          </ul>
        ) : (
          <>
            {exchangeRows.length > 0 && (
              <div className="card panel introductions">
                {exchangeRows.map((row) => (
                  <IntroductionRow
                    key={row.id}
                    person={personOf(row.personId)}
                    incoming={tab === "incoming"}
                  />
                ))}
              </div>
            )}
            {mentorshipRecords.length > 0 && (
              <SentMentorRequests records={mentorshipRecords} />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function useRequestFocus(id) {
  useEffect(() => {
    if (id) document.getElementById(`request-${id}`)?.focus();
  }, [id]);
}

export default function RequestsPage() {
  const { state, onAction } = useApp();
  const records = state.mentorRequests || [];
  useRequestFocus(state.activeMentorRequest);
  // Founders reach their Requests through WaitingPage.
  const hasIntroductions = [
    ...state.incomingByRole.mentor,
    ...state.waitingByRole.mentor,
  ].some((id) => !state.introductionMetaByRole.mentor[id]?.kind);
  const hasList = records.length > 0 || hasIntroductions;
  return (
    <div className="page page-enter">
      <PageHeader
        title="Requests"
        intro={
          records.length
            ? `${records.length} waiting for your reply`
            : "No new mentorship requests"
        }
      />
      {hasList && (
        <div className="mentor-requests-list">
          {records.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
          {hasIntroductions && <Introductions hideEmpty />}
        </div>
      )}
      {/* Prototype only: sample founders keep a preview inbox from running dry. */}
      {!records.length && state.prototypeMentor && (
        <PrototypeShortcut note="Bring in a new request from a fictional sample founder.">
          <button
            className="btn small"
            disabled={state.busy}
            onClick={(event) =>
              onAction({ action: "simulate-sample-request" }, event)
            }
          >
            {state.busy ? "Adding…" : "Get another sample request"}
          </button>
        </PrototypeShortcut>
      )}
      <button
        className={hasList ? "btn section-gap" : "btn"}
        onClick={() => onAction({ page: "discover" })}
      >
        Browse startups
      </button>
    </div>
  );
}
