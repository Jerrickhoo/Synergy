import SelectField from "../components/SelectField.jsx";
import BlockCollaborator from "../components/BlockCollaborator.jsx";
import VerificationGate from "../components/VerificationGate.jsx";
import { verificationRequired } from "../data/collaboration.js";
import DeclineIntroduction from "../components/DeclineIntroduction.jsx";
import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Tags from "../components/Tags.jsx";
import PageHeader from "../components/PageHeader.jsx";
import TrustSummary from "../components/TrustSummary.jsx";
import Icon from "../components/Icon.jsx";
import SimulateAcceptance from "../components/SimulateAcceptance.jsx";
import ReportCollaborator from "../components/ReportCollaborator.jsx";
import defaultTemplates from "../data/engagement-templates.json" with { type: "json" };
import { ownUnavailableText, unavailableText } from "../data/mentor-rules.js";
import {
  fitFactors,
  fitSummary,
  stageLabel,
  preferenceLabel,
} from "../data/profile-presentation.js";

const typeNames = {
  beta: "Beta Testing Exchange",
  marketing: "Co-Marketing Swap",
  mentorship: "Mentorship",
};

export default function MatchDetailPage() {
  const { state } = useApp();
  return <MatchDetail key={`${state.role}:${state.activeMatch}`} />;
}
function MatchDetail() {
  const { state, model, onAction } = useApp();
  const [engagementType, setEngagementType] = useState("");
  const [note, setNote] = useState("");
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
  const proposed =
    state.introductionTypesByRole?.[state.role]?.[person.id] ||
    model.roomTypeForPerson(person);
  const chosenType = engagementType || proposed;
  const template =
    (state.engagementTemplates || defaultTemplates)[chosenType] ||
    defaultTemplates[chosenType];
  const meta = state.introductionMetaByRole?.[state.role]?.[person.id];
  const founderPair = state.role === "founder" && !mentor;
  const pastRooms = Object.values(state.rooms).filter(
    (room) =>
      room.role === state.role &&
      room.partnerId === person.id &&
      ["launched", "reviewed"].includes(room.status),
  );
  const myAudience = Number(state.profiles.founder?.audienceSize);
  const swapWithoutAudience = chosenType === "marketing" && !(myAudience > 0);
  const youGet = person.exchange?.youGet || [];
  const theyGet = person.exchange?.theyGet || [];
  // A mentor who can't take requests (paused, full, guidelines) blocks sending
  // here, and a mentor whose own limits are full can't accept. The server
  // enforces both; this explains why and offers similar mentors.
  const mentorUnavailable =
    state.role === "founder" && mentor && person.available === false;
  const ownUnavailable =
    state.role === "mentor" &&
    state.mentorUsage &&
    !state.mentorUsage.available;
  const startBlocked =
    !existingRoom && !interested && (mentorUnavailable || ownUnavailable);
  const alternatives = mentorUnavailable
    ? model.people.mentors
        .filter((item) => item.id !== person.id && item.available)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, 3)
    : [];
  return (
    <div className="page match-detail-page page-enter">
      <button
        className="link-btn back-link"
        onClick={() => onAction({ page: "discover" })}
      >
        <Icon name="back" /> Back to matches
      </button>
      <p className="page-kicker">Match details</p>
      <div className="match-detail-layout">
        <section className="card identity-panel match-identity-panel">
          <div className="identity-heading">
            <Avatar
              image={person.image}
              name={person.name}
              identity={person.accountId || person.id}
              color={person.color}
              size={64}
            />
            <PageHeader
              title={person.name}
              intro={[
                person.kind,
                person.founderName && person.founderName !== person.name
                  ? `Founder: ${person.founderName}`
                  : "",
                person.sector,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          </div>
          <p className="identity-summary preserve-lines">
            {person.summary || "An introduction has not been added yet."}
          </p>
          <div className="identity-metadata">
            {person.affiliation && (
              <span className="badge-verified">
                <Icon name="check" /> Verified:{" "}
                {person.affiliation.organization}
              </span>
            )}
            {!mentor && person.stage && <span>{stageLabel(person.stage)}</span>}
            {!mentor && person.teamSize && (
              <span>Team of {person.teamSize}</span>
            )}
            {!mentor && person.audienceSize && (
              <span>
                Audience {Number(person.audienceSize).toLocaleString()}
              </span>
            )}
            {mentor && person.availability && (
              <span>
                <Icon name="clock" />
                {person.availability}
              </span>
            )}
            <span className="identity-fit">
              {isScore ? `${person.score}% match` : "Match unavailable"}
            </span>
          </div>
          {pastRooms.length > 0 && (
            <p className="info-note">
              You completed {pastRooms.length === 1 ? "a" : pastRooms.length}{" "}
              {pastRooms.map((room) => room.engagementType).join(" and ")}{" "}
              together
              {pastRooms[0].completedAt || pastRooms[0].launchedAt
                ? ` in ${new Date(pastRooms[0].completedAt || pastRooms[0].launchedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
                : ""}
              .
            </p>
          )}
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
                  ? "Waiting for a reply"
                  : "Your next step"}
          </span>
          <h2>
            {existingRoom
              ? "Continue in your Deal Room"
              : incoming
                ? `${person.name} wants to work with you`
                : interested
                  ? "Introduction sent"
                  : pastRooms.length
                    ? "Start another collaboration"
                    : "Send an introduction"}
          </h2>
          <p>
            {existingRoom
              ? "Your shared Deal Room has the agreed terms and next steps."
              : incoming
                ? `Accepting opens a Deal Room where you agree terms together. Nothing is committed until you both accept the terms.`
                : interested
                  ? `If ${person.name} accepts, a Deal Room opens automatically. Introductions expire after 14 days without a reply. You can withdraw it while you wait.`
                  : `If ${person.name} accepts, a Deal Room opens where you agree terms before any work starts.`}
          </p>
          {incoming && meta?.note && (
            <blockquote className="intro-note">“{meta.note}”</blockquote>
          )}
          {startBlocked && (
            <div className="mentoring-banner" role="status">
              <p>
                {mentorUnavailable
                  ? unavailableText(person.reason, person.name)
                  : ownUnavailableText(state.mentorUsage.reason)}
              </p>
              {ownUnavailable && (
                <button
                  className="btn small"
                  onClick={() => onAction({ page: "settings" })}
                >
                  Open mentoring settings
                </button>
              )}
            </div>
          )}
          {alternatives.length > 0 && !existingRoom && (
            <div className="mentoring-alternatives">
              <h3>Ask one of these mentors instead</h3>
              <ul>
                {alternatives.map((item) => (
                  <li key={item.id}>
                    <span>
                      <strong>{item.name}</strong>
                      <span className="muted">
                        {item.score}% fit · {item.availability}
                      </span>
                    </span>
                    <button
                      className="btn small"
                      onClick={() =>
                        onAction({ action: "match-detail", id: item.id })
                      }
                    >
                      View match
                      <span className="visually-hidden">: {item.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!existingRoom && !interested && (
            <div className="field">
              <label htmlFor="introduction-type">
                {incoming ? "Accept as" : "Collaboration type"}
              </label>
              <SelectField
                id="introduction-type"
                value={chosenType}
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
              </SelectField>
              <p className="field-help">
                {incoming
                  ? `${person.name} proposed ${typeNames[proposed]}. Choosing another type tells them when the room opens.`
                  : `First step: ${template?.milestones?.[0]?.title || "agree on terms"}. ${person.name} sees this before accepting.`}
              </p>
              {swapWithoutAudience && (
                <p className="warning-note">
                  Add your audience size to your profile so {person.name} can
                  judge whether the swap is fair.
                </p>
              )}
              {chosenType === "marketing" && person.audienceWarning && (
                <p className="warning-note">{person.audienceWarning}.</p>
              )}
            </div>
          )}
          {!existingRoom && !incoming && !interested && (
            <div className="field">
              <label htmlFor="introduction-note">
                Add a short note (optional)
              </label>
              <textarea
                id="introduction-note"
                maxLength={280}
                value={note}
                placeholder={`Why ${person.name}? For example: your 600 student users are exactly who we want to test with.`}
                onChange={(event) => setNote(event.target.value)}
              />
              <span className="field-count">{note.length} / 280</span>
            </div>
          )}
          {interested && !existingRoom && !incoming && meta?.sentAt && (
            <p className="muted">
              Sent {new Date(meta.sentAt).toLocaleDateString()} · expires{" "}
              {new Date(
                Date.parse(meta.sentAt) + 14 * 86400000,
              ).toLocaleDateString()}
            </p>
          )}
          <button
            className="btn primary full"
            data-action="interest"
            data-id={person.id}
            disabled={
              state.busy ||
              startBlocked ||
              (!existingRoom && verificationRequired(state)) ||
              (interested && !existingRoom && !incoming)
            }
            onClick={() =>
              onAction({
                action: existingRoom
                  ? "open-room"
                  : incoming
                    ? "accept-interest"
                    : "interest",
                id: existingRoom?.id || person.id,
                engagementType: chosenType,
                values: incoming || existingRoom ? undefined : { note },
              })
            }
          >
            {existingRoom
              ? "Open Deal Room"
              : verificationRequired(state)
                ? "Verify to send introductions"
                : incoming
                  ? "Accept introduction"
                  : interested
                    ? "Introduction sent"
                    : "Send introduction"}
            <Icon name="arrow" />
          </button>
          {!existingRoom && <VerificationGate />}
          {incoming && !existingRoom && <DeclineIntroduction person={person} />}
          {interested && !incoming && !existingRoom && (
            <SimulateAcceptance person={person} />
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
            className={`btn full ${model.savedMatches().has(person.id) ? "is-saved" : ""}`}
            aria-pressed={model.savedMatches().has(person.id)}
            disabled={state.busy}
            data-action="save"
            data-id={person.id}
            onClick={() => onAction({ action: "save", id: person.id })}
          >
            <Icon name="bookmark" />
            {model.savedMatches().has(person.id)
              ? "Saved for later"
              : "Save for later"}
          </button>
          <details className="match-safety">
            <summary>Safety and privacy</summary>
            <p className="field-help">
              Send a private report for moderator review, or block further
              contact. Blocking withdraws introductions and closes unfinished
              rooms.
            </p>
            <ReportCollaborator person={person} />
            <BlockCollaborator person={person} />
          </details>
        </aside>
        <div className="match-reading-column">
          <section className="card panel profile-section fit-section">
            <p className="section-eyebrow">Why this match</p>
            <h2>{isScore ? `${person.score}% match` : "Why this match"}</h2>
            <p>{fitSummary(person, factors)}</p>
            {(youGet.length > 0 || theyGet.length > 0) && (
              <dl className="exchange-pair">
                <div>
                  <dt>{state.role === "mentor" ? "They need" : "You get"}</dt>
                  <dd>
                    {youGet.length ? (
                      <Tags values={youGet} color="green" />
                    ) : (
                      <span className="muted">Nothing matched yet</span>
                    )}
                  </dd>
                </div>
                {!mentor && (
                  <div>
                    <dt>They get</dt>
                    <dd>
                      {theyGet.length ? (
                        <Tags values={theyGet} />
                      ) : (
                        <span className="muted">
                          Nothing you offer matches their needs yet
                        </span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            <p className="muted">
              The match score is a guide based on both profiles, not a
              prediction of success.
            </p>
            <details className="fit-details">
              <summary>See the factor breakdown</summary>
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
                        Weight in the overall score:{" "}
                        {Math.round(person.factorWeights[row.index] * 100)}%
                      </small>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </section>
          <section className="card panel profile-section">
            <p className="section-eyebrow">
              {mentor ? "Mentorship" : "Collaboration focus"}
            </p>
            <h2>
              {mentor
                ? "Expertise and support"
                : state.role === "mentor"
                  ? "What this startup needs"
                  : "What you could trade"}
            </h2>
            {mentor && person.expertise && (
              <p className="expertise-lead">{person.expertise}</p>
            )}
            <div className="profile-section-pair">
              <div>
                <h3>{mentor ? "Can help with" : "They offer"}</h3>
                {(mentor ? person.offer : person.offer)?.length ? (
                  <Tags values={person.offer} color="green" />
                ) : (
                  <p className="muted">Not added yet.</p>
                )}
              </div>
              <div>
                <h3>{mentor ? "What they need from founders" : "They need"}</h3>
                {person.need?.length ? (
                  <Tags values={person.need} />
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
            </p>
          </section>
          <section className="card panel profile-section">
            <p className="section-eyebrow">Trust</p>
            <h2>Experience and collaboration history</h2>
            {person.pastExperience && (
              <div className="profile-section-block">
                <h3>Past experience</h3>
                <p className="preserve-lines">{person.pastExperience}</p>
              </div>
            )}
            <TrustSummary person={person} detailed />
          </section>
        </div>
      </div>
    </div>
  );
}
