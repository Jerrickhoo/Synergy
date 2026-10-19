import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Tags from "../components/Tags.jsx";
import Icon from "../components/Icon.jsx";
export default function MatchCard({ person, large = false }) {
  const { state, model, onAction } = useApp();
  const { scoreFactors } = model;
  const saved = state.savedByRole[state.role].has(person.id);
  const interested = state.interestByRole[state.role].has(person.id);
  const expanded = state.expanded.has(person.id);
  return (
    <article className={"match-card " + (large ? "large" : "")}>
      {"\n          "}
      <Avatar initials={person.initials} color={person.color} />
      {"\n          "}
      <div>
        {"\n            "}
        <div className="match-title">
          {person.name}{" "}
          <span
            className="tag"
            style={{
              verticalAlign: "1px",
              marginLeft: "4px",
            }}
          >
            {person.kind}
          </span>
        </div>
        {"\n            "}
        <div className="match-meta">
          {person.sector}{" "}
          <span
            style={{
              margin: "0 3px",
            }}
          >
            ·
          </span>{" "}
          <span className="verified">
            <span className="verify-icon">
              <Icon name="check" />
            </span>
            Verified
          </span>
        </div>
        {"\n            "}
        <p className="match-copy">{person.summary}</p>
        {"\n            "}
        <div
          style={{
            display: "flex",
            gap: "13px",
            flexWrap: "wrap",
          }}
        >
          {"\n              "}
          <div>
            <div className="match-chip-label">THEY OFFER</div>
            <Tags values={person.offer} color="green" />
          </div>
          {"\n              "}
          <div>
            <div className="match-chip-label">THEY'RE LOOKING FOR</div>
            <Tags values={person.need} />
          </div>
          {"\n            "}
        </div>
        {"\n            "}
        <button
          className="link-btn why"
          data-action="why"
          data-id={person.id}
          onClick={(event) =>
            onAction(
              {
                action: "why",
                id: person.id,
              },
              event,
            )
          }
        >
          {expanded ? "Hide" : "Why this match?"}
        </button>
        {"\n              "}
        <div className={"why-content " + (expanded ? "open" : "")}>
          {"\n                "}
          {expanded ? (
            <>
              <div className="why-box">
                {scoreFactors(person).map(([name, index], itemIndex) => (
                  <Fragment key={itemIndex}>
                    <div className="why-metric">
                      <span>{name}</span>
                      <strong>{person.why[index]}</strong>
                    </div>
                  </Fragment>
                ))}
              </div>
              <p
                style={{
                  margin: "8px 0 0",
                }}
              >
                Your needs and offers complement each other. This score is a
                guide—not a decision made for you.
              </p>
            </>
          ) : (
            ""
          )}
          {"\n              "}
        </div>
        {"\n            "}
        <div className="match-actions">
          {"\n              "}
          <button
            className="btn primary small"
            data-action="match-detail"
            data-id={person.id}
            onClick={(event) =>
              onAction(
                {
                  action: "match-detail",
                  id: person.id,
                },
                event,
              )
            }
          >
            View match
          </button>
          {"\n              "}
          <button
            className="btn small"
            data-action="interest"
            data-id={person.id}
            {...(interested
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
            {interested ? "Interest sent" : "Express interest"}
          </button>
          {"\n            "}
        </div>
        {"\n          "}
      </div>
      {"\n          "}
      <div className="match-side">
        <div className="score">
          {person.score}%<span>match</span>
        </div>
        <button
          className="bookmark-btn"
          type="button"
          data-action="save"
          data-id={person.id}
          aria-label={saved ? "Remove from saved matches" : "Save match"}
          aria-pressed={saved}
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
          <svg
            viewBox="0 0 24 24"
            width="19"
            height="19"
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
      {"\n        "}
    </article>
  );
}
