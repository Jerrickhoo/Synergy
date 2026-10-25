import BlockCollaborator from "../components/BlockCollaborator.jsx";
import { Fragment, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Tags from "../components/Tags.jsx";
import PageHeader from "../components/PageHeader.jsx";
import TrustSummary from "../components/TrustSummary.jsx";
export default function MatchDetailPage() {
  const { state, model, onAction } = useApp();
  const { savedMatches, interestedMatches, scoreFactors } = model;
  const [engagementType, setEngagementType] = useState("");
  const person = model
    .rolePeople()
    .find((item) => item.id === state.activeMatch);
  if (!person)
    return (
      <div className="page page-enter">
        <PageHeader
          eyebrow="MATCH DETAILS"
          title="Match unavailable"
          intro="Choose someone from Matches to see their profile."
        />
        <button
          className="btn"
          data-page="discover"
          onClick={(event) =>
            onAction(
              {
                page: "discover",
              },
              event,
            )
          }
        >
          Back to matches
        </button>
      </div>
    );
  const existingRoom = model.existingRoomFor(state.role, person.id);
  const incoming = state.incomingByRole[state.role].has(person.id);
  return (
    <div className="page page-enter">
      <button
        className="link-btn back-link"
        data-page="discover"
        onClick={(event) =>
          onAction(
            {
              page: "discover",
            },
            event,
          )
        }
      >
        ← Back to matches
      </button>
      <PageHeader
        eyebrow="YOUR MATCH, EXPLAINED"
        title="Match details"
        intro="A clear view of what you can build together."
      />
      <div className="detail-layout">
        {"\n          "}
        <section className="card panel">
          {"\n            "}
          <div className="profile-hero">
            <Avatar initials={person.initials} color={person.color} />
            <div>
              <div className="eyebrow">
                {person.kind}
                {" · COMMUNITY PROFILE"}
              </div>
              <h2>{person.name}</h2>
              <p>{person.sector}</p>
            </div>
            <div
              className="score"
              style={{
                marginLeft: "auto",
              }}
            >
              {person.score}%<span>profile fit</span>
            </div>
          </div>
          {"\n            "}
          <p className="match-copy">{person.summary}</p>
          {person.pastExperience && (
            <div>
              <h3>Past experience</h3>
              <p className="preserve-lines">{person.pastExperience}</p>
            </div>
          )}
          {person.goals && (
            <p>
              <strong>Collaboration goals:</strong> {person.goals}
            </p>
          )}
          <p className="muted">
            {[
              person.stage,
              person.teamSize && `Team of ${person.teamSize}`,
              person.audienceSize && `Audience: ${person.audienceSize}`,
              person.engagementPreference,
              person.availability,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <TrustSummary person={person} detailed />
          {"\n            "}
          <div className="section-gap">
            <h3>What they offer</h3>
            <Tags values={person.offer} color="green" />
            <h3
              style={{
                marginTop: "16px",
              }}
            >
              What they need
            </h3>
            <Tags values={person.need} />
          </div>
          {"\n            "}
          <section className="section-gap">
            <h2>Why this match</h2>
            <p className="muted">
              Profile fit uses provisional word-overlap weights (version{" "}
              {person.matchingVersion || 1}). It is not a prediction of
              collaboration success.
            </p>
            <p className="panel-subtitle">
              The same signals shown on your match card explain where your goals
              align.
            </p>
            <div className="grid score-breakdown">
              {scoreFactors(person).map(([label, index], itemIndex) => {
                const strength = person.why[index] || "Good";
                const width =
                  person.factorScores?.[index] ??
                  (strength === "Strong" || strength === "High"
                    ? 90
                    : strength === "Good"
                      ? 72
                      : 55);
                return (
                  <Fragment key={itemIndex}>
                    <div className="score-row">
                      <div>
                        <strong>{label}</strong>
                        {person.factorWeights && (
                          <span>
                            Weight:{" "}
                            {Math.round(person.factorWeights[index] * 100)}%
                          </span>
                        )}
                        <span>
                          {person.factorDetails?.[index] ||
                            `${strength} based on profile word overlap.`}
                        </span>
                      </div>
                      <div
                        className="score-track"
                        role="img"
                        aria-label={label + ": " + strength}
                      >
                        <i
                          style={{
                            width: width + "%",
                          }}
                        />
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </section>
          {"\n          "}
        </section>
        {"\n          "}
        <aside className="card panel detail-next">
          <div className="eyebrow">NEXT STEP</div>
          <h2
            style={{
              marginTop: "8px",
            }}
          >
            Start a conversation
          </h2>
          <p className="panel-subtitle">
            A simple show of interest opens the door. You decide what happens
            next.
          </p>
          {"\n            "}
          {!existingRoom &&
            !incoming &&
            !interestedMatches().has(person.id) && (
              <div className="field section-gap">
                <label htmlFor="introduction-type">Collaboration type</label>
                <select
                  id="introduction-type"
                  value={engagementType || model.roomTypeForPerson(person)}
                  onChange={(event) => setEngagementType(event.target.value)}
                >
                  {state.role === "mentor" || person.kind === "Mentor" ? (
                    <option value="mentorship">Mentorship</option>
                  ) : (
                    <>
                      <option value="beta">Beta Testing Exchange</option>
                      <option value="marketing">Co-Marketing Swap</option>
                    </>
                  )}
                </select>
                <p className="muted">
                  Your collaborator reviews this type before accepting. You will
                  agree on the scope together in the room.
                </p>
              </div>
            )}
          {(incoming || interestedMatches().has(person.id)) && (
            <p>
              Proposed collaboration: <strong>{person.engagement}</strong>
            </p>
          )}
          <button
            className="btn primary full"
            data-action="interest"
            data-id={person.id}
            {...(interestedMatches().has(person.id) && !existingRoom
              ? {
                  disabled: true,
                }
              : {})}
            onClick={(event) =>
              onAction(
                {
                  action: existingRoom
                    ? "open-room"
                    : incoming
                      ? "accept-interest"
                      : "interest",
                  id: existingRoom?.id || person.id,
                  engagementType:
                    engagementType || model.roomTypeForPerson(person),
                },
                event,
              )
            }
          >
            {existingRoom
              ? "Open room"
              : incoming
                ? "Accept introduction"
                : interestedMatches().has(person.id)
                  ? "Interest sent"
                  : "Express interest"}
          </button>
          {"\n            "}
          <button
            className="btn full"
            data-action="save"
            data-id={person.id}
            style={{
              marginTop: "10px",
            }}
            onClick={(event) =>
              onAction(
                {
                  action: "save",
                  id: person.id,
                },
                event,
              )
            }
          >
            {savedMatches().has(person.id)
              ? "Saved for later"
              : "Save for later"}
          </button>
          {"\n          "}
          <BlockCollaborator person={person} />
        </aside>
        {"\n        "}
      </div>
    </div>
  );
}
