import { MentorshipBadges } from "./MentorImpact.jsx";
import { FormatPrices } from "./Payments.jsx";
import TrustSummary from "./TrustSummary.jsx";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "./Avatar.jsx";
import Tags from "./Tags.jsx";
import Icon from "./Icon.jsx";
import { useState } from "react";
import Overlay from "./Overlay.jsx";
import {
  cooldownActive,
  cooldownText,
  unavailableText,
} from "../data/mentor-rules.js";
import {
  matchReason,
  needsYouCover,
  offeredToYou,
  stageLabel,
  trustLine,
} from "../data/profile-presentation.js";
import { personVerified } from "../data/collaboration.js";
import { mentorshipFocus, typeLabel } from "../data/collaboration-types.js";

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
  // A mentor who declined this founder stays in Browse all and Saved, but the
  // card says when the founder can ask again (Nov 22, round 3).
  const cooledDown = cooldownActive(person.cooldownUntil);
  const youGet = offeredToYou(person);
  const theyGet = person.exchange?.theyGet || [];
  // Fall back to the profile's own words only when none of your needs
  // matched. The labels then describe that profile, not an exchange with you.
  const fallbackGets = !youGet.length;
  const fallbackGives = !theyGet.length;
  // A mentor sees the startup's needs they can help with, as on the match
  // details page; a mentorship gives the mentor nothing to list in return.
  const covered = mentoring
    ? needsYouCover(person, state.profiles.mentor?.offer)
    : [];
  const gets = mentoring
    ? (covered.length ? covered : person.need)?.slice(0, 2) || []
    : youGet.length
      ? youGet
      : person.offer?.slice(0, 2) || [];
  const gives = mentoring
    ? []
    : theyGet.length
      ? theyGet
      : mentor
        ? []
        : person.need?.slice(0, 2) || [];
  const connection = existingRoom
    ? "You already have a Deal Room together"
    : incoming
      ? "Wants to connect with you · View match to reply"
      : interested
        ? "Request sent"
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
        {mentor && <FormatPrices person={person} />}
        <Avatar
          image={person.image}
          name={person.name}
          identity={person.accountId || person.id}
          verified={personVerified(person)}
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
      {/* A mentor's kinds of guidance, from the tags they offer. */}
      {mentor && mentorshipFocus(person.offer, person.sector).length > 0 && (
        <p className="preview-focus">
          Mentorship · {mentorshipFocus(person.offer, person.sector).join(", ")}
        </p>
      )}
      {person.summary && <p className="preview-summary">{person.summary}</p>}
      {/* "Offers what you need: X" would repeat the You get chips below. */}
      {(mentoring || !youGet.length || person.audienceWarning) && (
        <p
          className={`preview-reason${person.audienceWarning ? " warning" : ""}`}
        >
          {person.audienceWarning && <Icon name="alert" />}
          {matchReason(person)}
        </p>
      )}
      {(gets.length > 0 || gives.length > 0) && (
        <dl className="preview-exchange">
          {gets.length > 0 && (
            <div>
              <dt>
                {mentoring
                  ? covered.length
                    ? "Needs help you offer"
                    : "Needs guidance with"
                  : fallbackGets
                    ? "They offer"
                    : "You get"}
              </dt>
              <dd>
                <Tags values={gets} color="green" />
              </dd>
            </div>
          )}
          {gives.length > 0 && (
            <div>
              <dt>
                {mentoring
                  ? "They offer"
                  : fallbackGives
                    ? "They’re looking for"
                    : "They get"}
              </dt>
              <dd>
                <Tags values={gives} />
              </dd>
            </div>
          )}
        </dl>
      )}
      {!mentor &&
        person.audienceSize &&
        person.engagementTypes?.includes(typeLabel("marketing")) && (
          <p className="preview-audience">
            Audience: {Number(person.audienceSize).toLocaleString()}
          </p>
        )}
      {trustLine(person) && (
        <p className="preview-trust">{trustLine(person)}</p>
      )}
      {/* Nearly every sample mentor is new, so "New Mentor" can't help choose
          between cards; the match details page keeps the trust line. */}
      <MentorshipBadges
        badges={person.badges?.filter((badge) => badge !== "New Mentor")}
      />
      {mentor && !mentoring && !existingRoom && cooledDown ? (
        <p className="match-unavailable">
          {cooldownText(person.cooldownUntil)}
        </p>
      ) : (
        mentor &&
        !mentoring &&
        person.available === false &&
        !existingRoom && (
          <p className="match-unavailable">
            {unavailableText(person.reason, person.name, {
              month: person.reasonMonth,
            })}
          </p>
        )
      )}
      {connection && (
        <p className="preview-connection">
          <Icon name={incoming ? "inbox" : "check"} />
          {existingRoom?.type === "mentorship"
            ? "You have a mentorship room together"
            : connection}
        </p>
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
