import { useApp } from "../state/AppContext.jsx";
import Avatar from "./Avatar.jsx";
import Icon from "./Icon.jsx";
import { matchReason } from "../data/profile-presentation.js";
import { homeNextStep } from "../data/home.js";
import { mentorHelpReason } from "../data/mentor-home.js";
import { personVerified } from "../data/collaboration.js";

// The strongest suggestions, so Home shows real people rather than empty boxes.
// A mentor sees the startups they can help, each with the need that matches
// their expertise; with none to suggest, the card points to Startups instead.
// `lead` makes its link the page's main action (P3); founders derive it.
export default function HomeTopMatches({ limit = 3, lead }) {
  const { state, model, onAction } = useApp();
  const mentor = state.role === "mentor";
  const people = [...model.suggestedMatches()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
  const primary = lead ?? homeNextStep(state).generic;
  const browse = () => onAction({ page: "discover" });
  if (!people.length) {
    if (!mentor) return null;
    return (
      <section
        className="card panel home-top-matches"
        aria-labelledby="top-matches"
      >
        <div className="top-matches-head">
          <div>
            <h2 id="top-matches">No startups match your expertise yet</h2>
            <p className="top-matches-intro">
              Browse every startup on Synergy and send help where it fits.
            </p>
          </div>
          <button
            className={primary ? "btn primary small" : "btn small"}
            onClick={browse}
          >
            Browse startups
          </button>
        </div>
      </section>
    );
  }
  const profile = state.profiles.mentor;
  return (
    <section
      className="card panel home-top-matches"
      aria-labelledby="top-matches"
    >
      <div className="top-matches-head">
        <h2 id="top-matches">
          {mentor ? "Startups you can help" : "Your strongest matches"}
        </h2>
        {/* The main action when Home has nothing more specific (P3). */}
        <button
          className={primary ? "btn primary small" : "link-btn"}
          onClick={browse}
        >
          {mentor ? "See all startups" : "See all matches"}{" "}
          <Icon name="arrow" />
        </button>
      </div>
      <ul className="top-match-list">
        {people.map((person) => (
          // The whole tile opens the match.
          <li key={person.id}>
            <button
              type="button"
              className="top-match"
              onClick={(event) =>
                onAction({ action: "match-detail", id: person.id }, event)
              }
            >
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
                <span className="top-match-reason">
                  {mentor
                    ? mentorHelpReason(model.helpedNeeds(person), profile)
                    : matchReason(person)}
                </span>
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
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
