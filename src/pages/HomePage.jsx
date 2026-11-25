import { useApp } from "../state/AppContext.jsx";
import HomeWelcome from "../components/HomeWelcome.jsx";
import HomeMetrics from "../components/HomeMetrics.jsx";
import { activeRooms } from "../data/selectors.js";
import { partnerName } from "../data/home.js";
import { collaboratorSlots } from "../data/home-planner.js";
import Introductions from "../components/Introductions.jsx";
import MentorHome from "../components/MentorHome.jsx";
import HomeTopMatches from "../components/HomeTopMatches.jsx";
import {
  HomeActivity,
  HomeCalendar,
  HomeCollaborations,
  HomeTasks,
} from "../components/HomePlanner.jsx";

// Founder Home, most important first: the next step, introductions waiting
// on a reply, then either the strongest matches (nothing under way yet) or
// the collaborations followed by the calendar beside the task list (70:30).
// Secondary tiles and recent activity close the page.
export default function HomePage() {
  const { state } = useApp();
  if (state.role === "mentor") return <MentorHome />;
  const rooms = activeRooms(state);
  const slots = collaboratorSlots(rooms);
  const nameOf = (room) => partnerName(state, room);
  return (
    <div className="page simple-home founder-home page-enter">
      <HomeWelcome />
      <Introductions compact />
      {rooms.length ? (
        <>
          <HomeCollaborations
            rooms={rooms}
            nameOf={nameOf}
            slots={slots}
            title="Your collaborations"
          />
          <div className="home-planner">
            <HomeCalendar rooms={rooms} nameOf={nameOf} slots={slots} />
            <HomeTasks rooms={rooms} nameOf={nameOf} slots={slots} />
          </div>
        </>
      ) : (
        <HomeTopMatches />
      )}
      {/* The collaborations list and the Introductions card already say what
          the rooms and introductions tiles would. */}
      <HomeMetrics
        omit={rooms.length ? ["rooms", "introductions"] : ["introductions"]}
      />
      <HomeActivity />
    </div>
  );
}
