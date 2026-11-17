import TrustSummary from "./TrustSummary.jsx";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "./Avatar.jsx";
import VerificationGate from "./VerificationGate.jsx";
import { verificationRequired } from "../data/collaboration.js";
import Tags from "./Tags.jsx";
import Icon from "./Icon.jsx";
import { useState } from "react";
import Overlay from "./Overlay.jsx";
import {
  matchReason,
  stageLabel,
  trustLine,
} from "../data/profile-presentation.js";

export default function MatchCard({ person, large = false }) {
  const { state, model, onAction } = useApp();
  const saved = state.savedByRole[state.role].has(person.id);
  const interested = state.interestByRole[state.role].has(person.id);
  const [fitOpen, setFitOpen] = useState(false);
  // On the Saved tab, unsaving removes the card, so it animates out first.
  const [leaving, setLeaving] = useState(false);
  const leavesList = saved && state.matchTab === "saved" && large;
  const toggleSaved = async () => {
    await onAction({ action: "save", id: person.id });
    setLeaving(false);
  };
  const existingRoom = model.existingRoomFor(state.role, person.id);
  const incoming = state.incomingByRole[state.role].has(person.id);
  const mentoring = state.role === "mentor";
  const mentor = person.kind === "Mentor";
  const youGet = person.exchange?.youGet || [];
  const theyGet = person.exchange?.theyGet || [];
  // Fall back to the profile's own words when no shared tags were found.
  const gets = youGet.length
    ? youGet
    : (mentoring ? person.need : person.offer)?.slice(0, 2) || [];
  const gives = theyGet.length
    ? theyGet
    : mentor
      ? []
      : (mentoring ? person.offer : person.need)?.slice(0, 2) || [];
  const connection = existingRoom
    ? "You already have a Deal Room together"
    : incoming
      ? "Wants to connect with you · View match to reply"
      : interested
        ? "Introduction sent"
        : "";

  return (
    <article
      className={`match-card match-preview${large ? " large" : ""}${leaving ? " is-leaving" : ""}`}
      aria-labelledby={`match-name-${person.id}`}
      onAnimationEnd={(event) => {
        if (event.animationName === "match-leave") toggleSaved();
      }}
    >
      <div className="preview-heading">
        <Avatar
          image={person.image}
          name={person.name}
          identity={person.accountId || person.id}
          color={person.color}
        />
        <div className="preview-identity">
          <span className="preview-kind">
            {person.kind}
            {person.affiliation && (
              <span className="badge-verified">
                <Icon name="check" /> Verified
              </span>
            )}
          </span>
          <h3 id={`match-name-${person.id}`}>{person.name}</h3>
          {person.founderName && person.founderName !== person.name && (
            <span className="preview-founder">{person.founderName}</span>
          )}
        </div>
        <button
          className={`bookmark-btn ${saved ? "is-saved" : ""}`}
          type="button"
          data-action="save"
          data-id={person.id}
          aria-label={
            saved
              ? `Remove ${person.name} from saved matches`
              : `Save ${person.name}`
          }
          aria-pressed={saved}
          disabled={state.busy || leaving}
          title={saved ? "Remove from saved matches" : "Save for later"}
          onClick={(event) =>
            leavesList
              ? setLeaving(true)
              : onAction({ action: "save", id: person.id }, event)
          }
        >
          <Icon name="bookmark" />
        </button>
      </div>
      <p className="preview-sector">
        {[
          person.sector,
          !mentor && person.stage && stageLabel(person.stage),
          !mentor && person.teamSize && `Team of ${person.teamSize}`,
          mentor && person.availability,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {person.summary && <p className="preview-summary">{person.summary}</p>}
      <p
        className={`preview-reason${person.audienceWarning ? " warning" : ""}`}
      >
        {person.audienceWarning && <Icon name="alert" />}
        {matchReason(person)}
      </p>
      {(gets.length > 0 || gives.length > 0) && (
        <dl className="preview-exchange">
          {gets.length > 0 && (
            <div>
              <dt>{mentoring ? "Needs guidance with" : "You get"}</dt>
              <dd>
                <Tags values={gets} color="green" />
              </dd>
            </div>
          )}
          {gives.length > 0 && (
            <div>
              <dt>{mentoring ? "They offer" : "They get"}</dt>
              <dd>
                <Tags values={gives} />
              </dd>
            </div>
          )}
        </dl>
      )}
      {!mentor &&
        person.audienceSize &&
        person.engagementTypes?.includes("Co-Marketing Swap") && (
          <p className="preview-audience">
            Audience: {Number(person.audienceSize).toLocaleString()}
          </p>
        )}
      {mentoring && person.goals && (
        <p className="preview-goal">
          <strong>Startup goal:</strong> {person.goals}
        </p>
      )}
      {trustLine(person) && (
        <p className="preview-trust">{trustLine(person)}</p>
      )}
      <div className="preview-footer">
        <button
          className="preview-fit interactive-surface"
          aria-haspopup="dialog"
          aria-expanded={fitOpen}
          aria-controls={`match-why-${person.id}`}
          onClick={() => setFitOpen(true)}
        >
          <span className="fit-ring" style={{ "--fit": `${person.score}%` }}>
            <strong>
              {person.score}
              <small>%</small>
            </strong>
          </span>
          <span className="fit-caption">
            <span>
              Why this match? <Icon name="info" />
            </span>
          </span>
        </button>
        <button
          className="btn small"
          data-action="match-detail"
          data-id={person.id}
          onClick={(event) =>
            onAction({ action: "match-detail", id: person.id }, event)
          }
        >
          View match <Icon name="arrow" />
          <span className="visually-hidden">: {person.name}</span>
        </button>
      </div>
      {connection && (
        <p className="preview-connection">
          <Icon name={incoming ? "inbox" : "check"} />
          {connection}
        </p>
      )}
      {!existingRoom && verificationRequired(state) && (
        <>
          <button className="btn small" disabled>
            Verify to send introductions
          </button>
          <VerificationGate />
        </>
      )}
      {fitOpen && (
        <Overlay
          id={`match-why-${person.id}`}
          title="Why this match?"
          onClose={() => setFitOpen(false)}
        >
          <div className="fit-overview">
            <span className="fit-ring" style={{ "--fit": `${person.score}%` }}>
              <strong>
                {person.score}
                <small>%</small>
              </strong>
            </span>
            <div>
              <h3>{person.name}</h3>
              <p>{matchReason(person)}</p>
            </div>
          </div>
          <h3>How the factors compare</h3>
          <div className="why-box">
            {model.scoreFactors(person).map(([name, index]) => (
              <div className="why-metric" key={name}>
                <span>{name}</span>
                <strong>{person.why[index]}</strong>
                {person.factorScores?.[index] !== undefined && (
                  <span className="fit-factor-track" aria-hidden="true">
                    <span style={{ width: `${person.factorScores[index]}%` }} />
                  </span>
                )}
                {person.factorDetails?.[index] && (
                  <small>{person.factorDetails[index]}</small>
                )}
              </div>
            ))}
          </div>
          {person.need?.length > 0 && (
            <div className="preview-needs">
              <span className="match-chip-label">Looking for</span>
              <Tags values={person.need} />
            </div>
          )}
          <TrustSummary person={person} />
          <p className="preview-score-note">
            The match score is a guide based on both profiles, not a prediction
            of success.
          </p>
        </Overlay>
      )}
    </article>
  );
}
