import { useApp } from "../state/AppContext.jsx";
import Avatar from "./Avatar.jsx";
import Icon from "./Icon.jsx";
import { matchReason } from "../data/profile-presentation.js";
import { homeNextStep } from "../data/home.js";
import { personVerified } from "../data/collaboration.js";

// The strongest suggestions, so Home shows real people rather than empty boxes.
export default function HomeTopMatches({ limit = 3 }) {
  const { state, model, onAction } = useApp();
  const people = [...model.suggestedMatches()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
  if (!people.length) return null;
  return (
    <section
      className="card panel home-top-matches"
      aria-labelledby="top-matches"
    >
      <div className="top-matches-head">
        <h2 id="top-matches">Your strongest matches</h2>
        {/* The main action when Home has nothing more specific (P3). */}
        <button
          className={
            homeNextStep(state).generic ? "btn primary small" : "link-btn"
          }
          onClick={() => onAction({ page: "discover" })}
        >
          See all matches <Icon name="arrow" />
        </button>
      </div>
      <ul className="top-match-list">
        {people.map((person) => (
          <li className="top-match" key={person.id}>
            <Avatar
              image={person.image}
              name={person.name}
              identity={person.accountId || person.id}
              verified={personVerified(person)}
              color={person.color}
            />
            <div className="top-match-copy">
              <strong>{person.name}</strong>
              <span>
                {[person.kind, person.sector].filter(Boolean).join(" · ")}
              </span>
              <span className="top-match-reason">{matchReason(person)}</span>
            </div>
            <span
              className="fit-ring top-match-ring"
              style={{ "--fit": `${person.score}%` }}
            >
              <strong>
                {person.score}
                <small>%</small>
                <span className="visually-hidden"> fit</span>
              </strong>
            </span>
            <button
              className="btn small"
              onClick={(event) =>
                onAction({ action: "match-detail", id: person.id }, event)
              }
            >
              View<span className="visually-hidden"> {person.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
