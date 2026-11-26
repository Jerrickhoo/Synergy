import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import HomeWelcome from "../components/HomeWelcome.jsx";
import HomeMetrics from "../components/HomeMetrics.jsx";
import { activeRooms } from "../data/selectors.js";
import { partnerName } from "../data/home.js";
import { collaboratorSlots } from "../data/home-planner.js";
import Introductions from "../components/Introductions.jsx";
import MentorHome from "../components/MentorHome.jsx";
import HomeTopMatches from "../components/HomeTopMatches.jsx";
import Icon from "../components/Icon.jsx";
import { markTourDone, tourDone } from "../components/QuickTour.jsx";
import {
  HomeCalendar,
  HomeCollaborations,
  HomeTasks,
} from "../components/HomePlanner.jsx";

// Until someone has taken or skipped it, Home offers the quick tour of how
// a deal works. The tour stays one click away in the header afterwards.
function TourInvite() {
  const { state, onAction } = useApp();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || tourDone(state.accountId)) return null;
  return (
    <section className="home-tour" aria-labelledby="home-tour-heading">
      <span className="home-tour-icon" aria-hidden="true">
        <Icon name="compass" />
      </span>
      <div className="home-tour-copy">
        <h2 id="home-tour-heading">New here? Take the quick tour</h2>
        <p>
          Six short steps from finding a match to a finished, reviewed deal.
        </p>
      </div>
      <div className="home-tour-actions">
        <button
          className="btn primary small"
          onClick={() => onAction({ action: "open-tour" })}
        >
          Start the tour
        </button>
        <button
          className="link-btn"
          onClick={() => {
            markTourDone(state.accountId);
            setDismissed(true);
          }}
        >
          Not now
        </button>
      </div>
    </section>
  );
}

// Founder Home, most important first: the greeting and the one next step,
// introductions waiting on a reply, then the work itself (collaborations
// beside the task list, the calendar under them) or, before any work starts,
// the strongest matches. The overview tiles close the page; the full record
// lives in Activity.
export default function HomePage() {
  const { state } = useApp();
  if (state.role === "mentor") return <MentorHome />;
  const rooms = activeRooms(state);
  const slots = collaboratorSlots(rooms);
  const nameOf = (room) => partnerName(state, room);
  return (
    <div className="page simple-home founder-home page-enter">
      <HomeWelcome />
      <TourInvite />
      <Introductions compact />
      {rooms.length ? (
        <>
          <div className="home-work">
            <HomeCollaborations
              rooms={rooms}
              nameOf={nameOf}
              slots={slots}
              title="Your collaborations"
            />
            <HomeTasks rooms={rooms} nameOf={nameOf} slots={slots} />
          </div>
          <HomeCalendar rooms={rooms} nameOf={nameOf} slots={slots} />
        </>
      ) : (
        <HomeTopMatches />
      )}
      {/* The collaborations list and the Introductions card already say what
          the rooms and introductions tiles would. */}
      <HomeMetrics
        omit={rooms.length ? ["rooms", "introductions"] : ["introductions"]}
      />
    </div>
  );
}
