import { Fragment } from "react";
import TrustSummary from "./TrustSummary.jsx";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Tags from "../components/Tags.jsx";
export default function MatchCard({ person, large = false }) {
  const { state, model, onAction } = useApp();
  const { scoreFactors } = model;
  const saved = state.savedByRole[state.role].has(person.id);
  const interested = state.interestByRole[state.role].has(person.id);
  const expanded = state.expanded.has(person.id);
  const existingRoom = model.existingRoomFor(state.role, person.id);
  const incoming = state.incomingByRole[state.role].has(person.id);
  return (
    <article className={"match-card " + (large ? "large" : "")}>
      {"\n          "}
      <Avatar initials={person.initials} color={person.color} />
      {"\n          "}
      <div className="match-identity">
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
          <span className="verified">Community profile</span>
        </div>
        {"\n            "}
      </div>
      <div className="match-body">
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
            {...(interested && !existingRoom
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
                },
                event,
              )
            }
          >
            {existingRoom
              ? "Open room"
              : incoming
                ? "Accept introduction"
                : interested
                  ? "Interest sent"
                  : "Express interest"}
          </button>
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
          {"\n            "}
        </div>

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
          aria-expanded={expanded}
          aria-controls={`match-why-${person.id}`}
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
        <div
          id={`match-why-${person.id}`}
          className={"why-content " + (expanded ? "open" : "")}
        >
          {"\n                "}
          {expanded ? (
            <>
              <div className="why-box">
                {scoreFactors(person).map(([name, index], itemIndex) => (
                  <Fragment key={itemIndex}>
                    <div className="why-metric">
                      <span>{name}</span>
                      <strong>{person.why[index]}</strong>
                      <small>{person.factorDetails?.[index]}</small>
                    </div>
                  </Fragment>
                ))}
              </div>
              <p
                style={{
                  margin: "8px 0 0",
                }}
              >
                Review the profile signals before connecting. This score is a
                guide—not a decision made for you.
              </p>
            </>
          ) : (
            ""
          )}
          {"\n              "}
        </div>
        {"\n            "}
        <TrustSummary person={person} />
        {"\n          "}
      </div>
      {"\n          "}
      <div className="match-side">
        <div className="score">
          {person.score}%<span>profile fit</span>
        </div>
      </div>
      {"\n        "}
    </article>
  );
}
