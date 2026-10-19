import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Tags from "../components/Tags.jsx";
import PageHeader from "../components/PageHeader.jsx";
export default function MatchDetailPage() {
  const { state, model, onAction } = useApp();
  const { allPeople, savedMatches, interestedMatches, scoreFactors } = model;
  const person = allPeople().find((item) => item.id === state.activeMatch);
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
  const explanations = [
    "Needs and offers complement",
    "Experience fits your goals",
    "Relevant industry context",
    "Stage and team size align",
    "Shared outcomes",
  ];
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
                {" · VERIFIED"}
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
              {person.score}%<span>match</span>
            </div>
          </div>
          {"\n            "}
          <p className="match-copy">{person.summary}</p>
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
            <p className="panel-subtitle">
              The same signals shown on your match card explain where your goals
              align.
            </p>
            <div className="grid score-breakdown">
              {scoreFactors(person).map(([label, index], itemIndex) => {
                const strength = person.why[index] || "Good";
                const width =
                  strength === "Strong" || strength === "High"
                    ? 90
                    : strength === "Good"
                      ? 72
                      : 55;
                return (
                  <Fragment key={itemIndex}>
                    <div className="score-row">
                      <div>
                        <strong>{label}</strong>
                        <span>{explanations[index]}</span>
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
          <button
            className="btn primary full"
            data-action="interest"
            data-id={person.id}
            {...(interestedMatches().has(person.id)
              ? {
                  disabled: true,
                }
              : {})}
            onClick={(event) =>
              onAction(
                {
                  action: "interest",
                  id: person.id,
                },
                event,
              )
            }
          >
            {interestedMatches().has(person.id)
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
        </aside>
        {"\n        "}
      </div>
    </div>
  );
}
