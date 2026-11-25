import ReportCollaborator from "../components/ReportCollaborator.jsx";
import { priceLabel } from "../data/pricing.js";
import BlockCollaborator from "../components/BlockCollaborator.jsx";
import { FounderTrackRecord } from "../components/MentorImpact.jsx";
import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Introductions from "../components/Introductions.jsx";
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
function SentRequestDetails({ request }) {
  return (
    <details className="sent-request-details">
      <summary>View request</summary>
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
    </details>
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

export function SentMentorRequests() {
  const { state, onAction, model } = useApp();
  const records = state.mentorRequests || [];
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
    <section
      className="mentor-requests-list"
      aria-label="Sent mentorship requests"
    >
      <h2>Mentorship requests</h2>
      {details.length > 0 && <p>{details.join(" · ")}</p>}
      {records.map((request) => (
        <article
          className="card panel mentor-request-card"
          key={request.id}
          id={`request-${request.id}`}
          tabIndex={-1}
        >
          <h3>{request.name}</h3>
          <p className="muted">
            {formatLabel(request)} ·{" "}
            <span className="request-status">
              {requestStatusLabel(request.status)}
            </span>
            {request.status === "pending"
              ? ` · ${pendingTime(request.expiresAt)}`
              : ""}
          </p>
          {request.status === "pending" && (
            <>
              <p>
                {replyLine(
                  request,
                  model
                    .rolePeople()
                    .find((person) => person.id === request.partnerId),
                )}
              </p>
              <SentRequestDetails request={request} />
            </>
          )}
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
          {request.status === "pending" && (
            // Same controls as a sent introduction (readiness plan P9).
            <div className="mentor-request-controls">
              <button
                className="btn small"
                onClick={() =>
                  onAction({ action: "match-detail", id: request.partnerId })
                }
              >
                View profile
                <span className="visually-hidden">: {request.name}</span>
              </button>
              <button
                className="btn small"
                disabled={state.busy}
                onClick={(event) =>
                  onAction(
                    {
                      action: "withdraw-request",
                      id: request.partnerId,
                      requestId: request.id,
                    },
                    event,
                  )
                }
              >
                Withdraw
              </button>
            </div>
          )}
          {request.status === "pending" &&
            model.rolePeople().find((person) => person.id === request.partnerId)
              ?.canSimulateAcceptance && (
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
          {request.status === "accepted" && state.rooms[request.roomId] && (
            <button
              className="btn"
              onClick={() =>
                onAction({ action: "open-room", id: request.roomId })
              }
            >
              Open room
            </button>
          )}
          <MentorAlternatives
            alternatives={request.alternatives}
            referralId={request.status === "referred" ? request.id : null}
          />
        </article>
      ))}
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
  if (state.role !== "mentor") return <SentMentorRequests />;
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
          {hasIntroductions && <Introductions />}
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
