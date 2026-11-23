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

const declineReasons = ["outside-expertise", "no-slots", "not-a-fit", "other"];
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
  const [selected, setSelected] = useState([]);
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
      {mode === "decline" && (
        <form
          className="mentor-request-form"
          onSubmit={(event) =>
            act("decline-request", event, {
              reason,
              message: new FormData(event.currentTarget).get("message") || "",
            })
          }
        >
          <label htmlFor={`decline-${request.id}`}>Reason</label>
          <select
            id={`decline-${request.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            {declineReasons.map((id) => (
              <option key={id} value={id}>
                {requestReasons[id]}
              </option>
            ))}
          </select>
          <LimitedTextarea
            id={`decline-message-${request.id}`}
            name="message"
            label="Message to the founder (optional)"
            limit={declineMessageLimit}
          />
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
            <p>The founder decides whether to share their request with them.</p>
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
            <div className="mentor-request-controls">
              <button
                className="btn"
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
      <div className="mentor-requests-list">
        {records.map((request) => (
          <RequestCard key={request.id} request={request} />
        ))}
        {[...state.incomingByRole.mentor, ...state.waitingByRole.mentor].some(
          (id) => !state.introductionMetaByRole.mentor[id]?.kind,
        ) && <Introductions />}
      </div>
      <button
        className="btn section-gap"
        onClick={() => onAction({ page: "discover" })}
      >
        Browse startups
      </button>
    </div>
  );
}
