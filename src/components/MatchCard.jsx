import TrustSummary from "./TrustSummary.jsx";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "./Avatar.jsx";
import Tags from "./Tags.jsx";
import Icon from "./Icon.jsx";
import { useState } from "react";
import Overlay from "./Overlay.jsx";

export default function MatchCard({ person, large = false }) {
  const { state, model, onAction } = useApp();
  const saved = state.savedByRole[state.role].has(person.id);
  const interested = state.interestByRole[state.role].has(person.id);
  const [fitOpen, setFitOpen] = useState(false);
  const existingRoom = model.existingRoomFor(state.role, person.id);
  const incoming = state.incomingByRole[state.role].has(person.id);
  const offers = person.offer || [];

  return (
    <article
      className={`match-card match-preview${large ? " large" : ""}`}
      aria-labelledby={`match-name-${person.id}`}
    >
      <div className="preview-heading">
        <Avatar
          image={person.image}
          name={person.name}
          initials={person.initials}
          color={person.color}
        />
        <div className="preview-identity">
          <span className="preview-kind">{person.kind}</span>
          <h3 id={`match-name-${person.id}`}>{person.name}</h3>
        </div>
        <button
          className="bookmark-btn"
          type="button"
          data-action="save"
          data-id={person.id}
          aria-label={saved ? "Remove from saved matches" : "Save match"}
          aria-pressed={saved}
          title={saved ? "Remove from saved matches" : "Save for later"}
          onClick={(event) =>
            onAction({ action: "save", id: person.id }, event)
          }
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill={saved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.5L6 21z" />
          </svg>
        </button>
      </div>
      <p className="preview-sector">{person.sector}</p>
      <p className="preview-summary">{person.summary}</p>
      {offers.length > 0 && (
        <div className="preview-offers">
          <span className="match-chip-label">Can help with</span>
          <Tags values={offers.slice(0, 3)} color="green" />
          {offers.length > 3 && (
            <span className="preview-more">
              +{offers.length - 3} more on profile
            </span>
          )}
        </div>
      )}
      <div className="preview-footer">
        <button
          className="preview-fit"
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
            <b>Profile fit</b>
            <span>
              Why this match? <Icon name="info" />
            </span>
          </span>
        </button>
        <button
          className="btn primary small"
          data-action="match-detail"
          data-id={person.id}
          onClick={(event) =>
            onAction({ action: "match-detail", id: person.id }, event)
          }
        >
          View match <Icon name="arrow" />
        </button>
      </div>
      {(existingRoom || incoming || interested) && (
        <p className="preview-connection">
          <Icon name={incoming ? "inbox" : "check"} />
          {existingRoom
            ? "You already have a room together"
            : incoming
              ? "Introduction received · View match to respond"
              : "Introduction sent"}
        </p>
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
              <p>Profile fit based on your skills, needs, and goals.</p>
            </div>
          </div>
          <h3>Where your profiles align</h3>
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
            Fit is a guide based on your profiles, not a prediction of success.
          </p>
        </Overlay>
      )}
    </article>
  );
}
