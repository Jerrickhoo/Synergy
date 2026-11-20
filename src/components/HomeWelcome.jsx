import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import { homeNextStep, primaryNeed } from "../data/home.js";
import { activeRooms, profileKeys } from "../data/selectors.js";
import Confirmation from "./Confirmation.jsx";
import Icon from "./Icon.jsx";

// One specific sentence about the state of this workspace right now, split so
// the count can carry the emphasis. `urgent` marks things waiting on the user.
function statusLine(state, model) {
  const mentor = state.role === "mentor";
  const incoming = state.incomingByRole[state.role].size;
  const rooms = activeRooms(state).length;
  const suggested = model.suggestedMatches().length;
  const one = (count, single, many) => (count === 1 ? single : many);
  if (incoming)
    return {
      count: incoming,
      text: `${one(incoming, "introduction", "introductions")} waiting for your reply.`,
      urgent: true,
    };
  if (rooms)
    return {
      count: rooms,
      text: `${mentor ? one(rooms, "mentorship", "mentorships") : one(rooms, "collaboration", "collaborations")} in progress.`,
    };
  if (suggested)
    return {
      count: suggested,
      text: mentor
        ? `${one(suggested, "startup", "startups")} could use your expertise.`
        : `${one(suggested, "person fits", "people fit")} what you need right now.`,
    };
  const profile = state.profiles[state.role];
  const incomplete = profileKeys(state.role).some(
    (key) => !String(profile[key] || "").trim(),
  );
  if (incomplete)
    return { text: "Finish your profile so people can find you." };
  const need = primaryNeed(profile);
  return {
    text: need ? `No close matches yet for ${need}.` : "No close matches yet.",
    browse: true,
  };
}

// Greetings by time of day; one is picked per visit so it never flickers.
const GREETINGS = [
  { until: 5, lines: ["Up late", "Burning the midnight oil", "Still at it"] },
  { until: 12, lines: ["Good morning", "Morning", "Fresh start today"] },
  {
    until: 17,
    lines: ["Good afternoon", "Hope the day's going well", "Afternoon"],
  },
  { until: 22, lines: ["Good evening", "Evening", "Winding down"] },
  { until: 24, lines: ["Up late", "Working late", "Still at it"] },
];

function pickGreeting(date = new Date()) {
  const hour = date.getHours();
  const { lines } = GREETINGS.find((slot) => hour < slot.until);
  return lines[Math.floor(Math.random() * lines.length)];
}

const STACK_LIMIT = 8;

// One plain person icon per match, so the count reads as people at a glance.
function PeopleStack({ count }) {
  const shown = Math.min(count, STACK_LIMIT);
  const extra = count - shown;
  return (
    <span className="people-stack" aria-hidden="true">
      {Array.from({ length: shown }, (_, index) => (
        <span className="people-stack-item" key={index}>
          <Icon name="profile" />
        </span>
      ))}
      {extra > 0 && (
        <span className="people-stack-item people-stack-more">+{extra}</span>
      )}
    </span>
  );
}

export default function HomeWelcome() {
  const { state, model, onAction } = useApp();
  const next = homeNextStep(state);
  const status = statusLine(state, model);
  const [greeting] = useState(pickGreeting);
  const firstName = state.accountName ? state.accountName.split(" ")[0] : "";
  return (
    <>
      <header className="home-welcome">
        <h1 tabIndex="-1">
          {firstName ? `${greeting}, ${firstName}` : "Welcome to Synergy"}
        </h1>
        <p className={`intro home-status${status.urgent ? " urgent" : ""}`}>
          {status.count ? <PeopleStack count={status.count} /> : null}
          <span>
            {status.count ? (
              <strong className="home-status-count">{status.count}</strong>
            ) : null}{" "}
            {status.text}
            {status.browse && (
              <>
                {" "}
                <button
                  className="link-btn"
                  onClick={() => {
                    onAction({ page: "discover" });
                    onAction({ action: "match-tab", tab: "browse" });
                  }}
                >
                  Browse all profiles
                </button>
              </>
            )}
          </span>
        </p>
      </header>
      <section className="home-next" aria-label="Your next step">
        <div className="home-next-copy">
          <h2>{next.title}</h2>
          {next.detail && <p>{next.detail}</p>}
        </div>
        <button
          className="btn primary home-next-go"
          onClick={() => onAction(next.command)}
        >
          {next.label}
          <Icon name="arrow" />
        </button>
      </section>
      <Confirmation />
    </>
  );
}
