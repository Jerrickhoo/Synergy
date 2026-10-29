import BlockCollaborator from "../components/BlockCollaborator.jsx";
import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Tags from "../components/Tags.jsx";
import PageHeader from "../components/PageHeader.jsx";
import TrustSummary from "../components/TrustSummary.jsx";
import Icon from "../components/Icon.jsx";
import {
  fitFactors,
  fitSummary,
  stageLabel,
  preferenceLabel,
} from "../data/profile-presentation.js";

export default function MatchDetailPage() {
  const { state } = useApp();
  return <MatchDetail key={`${state.role}:${state.activeMatch}`} />;
}
function MatchDetail() {
  const { state, model, onAction } = useApp();
  const [engagementType, setEngagementType] = useState("");
  const person = model
    .rolePeople()
    .find((item) => item.id === state.activeMatch);
  if (!person)
    return (
      <div className="page page-enter">
        <PageHeader
          title="Match unavailable"
          intro="This profile may have changed its visibility or is no longer available. Explore Matches to find someone else."
        />
        <button className="btn" onClick={() => onAction({ page: "discover" })}>
          Back to matches
        </button>
      </div>
    );
  const existingRoom = model.existingRoomFor(state.role, person.id);
  const incoming = state.incomingByRole[state.role].has(person.id);
  const interested = model.interestedMatches().has(person.id);
  const mentor = person.kind === "Mentor";
  const factors = model.scoreFactors(person);
  const rows = fitFactors(person, factors);
  const isScore =
    typeof person.score === "number" && Number.isFinite(person.score);
  return (
    <div className="page match-detail-page page-enter">
      <button
        className="link-btn back-link"
        onClick={() => onAction({ page: "discover" })}
      >
        ← Back to matches
      </button>
      <p className="page-kicker">Match details</p>
      <div className="match-detail-layout">
        <section className="card identity-panel match-identity-panel">
          <div className="identity-heading">
            <Avatar
              image={person.image}
              name={person.name}
              initials={person.initials}
              color={person.color}
              size={64}
            />
            <PageHeader
              title={person.name}
              intro={[person.kind, person.sector].filter(Boolean).join(" · ")}
            />
          </div>
          <p className="identity-summary preserve-lines">
            {person.summary || "An introduction has not been added yet."}
          </p>
          <div className="identity-metadata">
            {!mentor && person.stage && <span>{stageLabel(person.stage)}</span>}
            {!mentor && person.teamSize && (
              <span>Team of {person.teamSize}</span>
            )}
            {mentor && person.availability && (
              <span>
                <Icon name="clock" />
                {person.availability}
              </span>
            )}
            <span className="identity-fit">
              {isScore ? `${person.score}% profile fit` : "Fit unavailable"}
            </span>
          </div>
        </section>
        <aside
          className="card panel match-action-panel"
          aria-label="Collaboration actions"
        >
          <span className="action-eyebrow">
            <Icon
              name={existingRoom ? "rooms" : incoming ? "inbox" : "handshake"}
            />
            {existingRoom
              ? "Connected"
              : incoming
                ? "Introduction received"
                : interested
                  ? "Waiting for a response"
                  : "Your next step"}
          </span>
          <h2>
            {existingRoom
              ? "Continue your collaboration"
              : incoming
                ? "Meet your collaborator"
                : interested
                  ? "Introduction sent"
                  : "Start a conversation"}
          </h2>
          <p>
            {existingRoom
              ? "Your shared room has the agreed scope and next steps."
              : incoming
                ? "Review the proposed collaboration before accepting. You’ll agree on the scope together."
                : interested
                  ? "They can accept or decline your introduction. You can withdraw it while you wait."
                  : "Send an introduction to discuss a collaboration and agree on a focused goal."}
          </p>
          {!existingRoom && !incoming && !interested && (
            <div className="field">
              <label htmlFor="introduction-type">Collaboration type</label>
              <select
                id="introduction-type"
                value={engagementType || model.roomTypeForPerson(person)}
                onChange={(event) => setEngagementType(event.target.value)}
              >
                {state.role === "mentor" || mentor ? (
                  <option value="mentorship">Mentorship</option>
                ) : (
                  <>
                    <option value="beta">Beta Testing Exchange</option>
                    <option value="marketing">Co-Marketing Swap</option>
                  </>
                )}
              </select>
              <p className="field-help">
                Your collaborator reviews this type before accepting.
              </p>
            </div>
          )}
          {(incoming || interested) && !existingRoom && (
            <p className="proposed-type">
              Proposed collaboration: <strong>{person.engagement}</strong>
            </p>
          )}
          <button
            className="btn primary full"
            data-action="interest"
            data-id={person.id}
            disabled={state.busy || (interested && !existingRoom && !incoming)}
            onClick={() =>
              onAction({
                action: existingRoom
                  ? "open-room"
                  : incoming
                    ? "accept-interest"
                    : "interest",
                id: existingRoom?.id || person.id,
                engagementType:
                  engagementType || model.roomTypeForPerson(person),
              })
            }
          >
            {existingRoom
              ? "Open room"
              : incoming
                ? "Accept introduction"
                : interested
                  ? "Interest sent"
                  : "Express interest"}
            <Icon name="arrow" />
          </button>
          {incoming && !existingRoom && (
            <button
              className="btn full"
              disabled={state.busy}
              onClick={() =>
                onAction({ action: "decline-interest", id: person.id })
              }
            >
              Decline introduction
            </button>
          )}
          {interested && !incoming && !existingRoom && (
            <button
              className="btn full"
              disabled={state.busy}
              onClick={() =>
                onAction({ action: "cancel-interest", id: person.id })
              }
            >
              Withdraw introduction
            </button>
          )}
          <button
            className="btn full"
            aria-pressed={model.savedMatches().has(person.id)}
            disabled={state.busy}
            data-action="save"
            data-id={person.id}
            onClick={() => onAction({ action: "save", id: person.id })}
          >
            {model.savedMatches().has(person.id)
              ? "Saved for later"
              : "Save for later"}
          </button>
          <details className="match-safety">
            <summary>Safety and privacy</summary>
            <BlockCollaborator person={person} />
          </details>
        </aside>
        <div className="match-reading-column">
          <section className="card panel profile-section">
            <p className="section-eyebrow">
              {mentor ? "Mentorship" : "Collaboration focus"}
            </p>
            <h2>
              {mentor ? "Expertise and support" : "What this startup needs"}
            </h2>
            {mentor && person.expertise && (
              <p className="expertise-lead">{person.expertise}</p>
            )}
            <div className="profile-section-pair">
              <div>
                <h3>{mentor ? "Can help with" : "Looking for help with"}</h3>
                {(mentor ? person.offer : person.need)?.length ? (
                  <Tags
                    values={mentor ? person.offer : person.need}
                    color="green"
                  />
                ) : (
                  <p className="muted">Not added yet.</p>
                )}
              </div>
              <div>
                <h3>
                  {mentor
                    ? "What they need from founders"
                    : "Can offer in return"}
                </h3>
                {(mentor ? person.need : person.offer)?.length ? (
                  <Tags values={mentor ? person.need : person.offer} />
                ) : (
                  <p className="muted">Not added yet.</p>
                )}
              </div>
            </div>
            {person.goals && (
              <div className="profile-section-block">
                <h3>Collaboration goals</h3>
                <p className="preserve-lines">{person.goals}</p>
              </div>
            )}
            {mentor && person.startups && (
              <div className="profile-section-block">
                <h3>Startups they want to help</h3>
                <p>{person.startups}</p>
              </div>
            )}
            <p className="profile-preference">
              {preferenceLabel(person.engagementPreference)}
              {!mentor && person.audienceSize
                ? ` · Audience: ${person.audienceSize}`
                : ""}
            </p>
          </section>
          <section className="card panel profile-section">
            <p className="section-eyebrow">Background</p>
            <h2>Experience and collaboration history</h2>
            {person.pastExperience && (
              <div className="profile-section-block">
                <h3>Past experience</h3>
                <p className="preserve-lines">{person.pastExperience}</p>
              </div>
            )}
            <TrustSummary person={person} detailed />
          </section>
          <section className="card panel profile-section fit-section">
            <p className="section-eyebrow">Profile alignment</p>
            <h2>Why this match</h2>
            <p>{fitSummary(person, factors)}</p>
            <p className="muted">
              Fit is a guide based on your profiles, not a prediction of
              success.
            </p>
            <details className="fit-details">
              <summary>See fit breakdown</summary>
              <div className="score-breakdown">
                {rows.map((row) => (
                  <div className="fit-detail-row" key={row.index}>
                    <div className="fit-detail-heading">
                      <h3>{row.label}</h3>
                      <span>
                        {row.status}
                        {row.score !== null ? ` · ${row.score}%` : ""}
                      </span>
                    </div>
                    {row.score !== null && (
                      <div className="score-track" aria-hidden="true">
                        <i style={{ width: `${row.score}%` }} />
                      </div>
                    )}
                    <p>{row.detail}</p>
                    {typeof person.factorWeights?.[row.index] === "number" && (
                      <small>
                        Weight in the overall fit:{" "}
                        {Math.round(person.factorWeights[row.index] * 100)}%
                      </small>
                    )}
                  </div>
                ))}
              </div>
              <p className="fit-method">
                Matching method: profile word coverage.{" "}
                {person.matchingAlgorithm &&
                  `Algorithm: ${person.matchingAlgorithm}. `}
                Configuration version {person.matchingVersion || "unavailable"}.
              </p>
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
