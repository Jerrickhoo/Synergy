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

// Founder Home: next step, then the calendar beside the task list (70:30),
// the room count beside the collaborations, and labelled recent activity.
export default function HomePage() {
  const { state } = useApp();
  if (state.role === "mentor") return <MentorHome />;
  const rooms = activeRooms(state);
  const slots = collaboratorSlots(rooms);
  const nameOf = (room) => partnerName(state, room);
  return (
    <div className="page simple-home page-enter">
      <HomeWelcome />
      {!rooms.length && <HomeTopMatches />}
      <Introductions compact />
      {rooms.length > 0 && (
        <div className="home-planner section-gap">
          <HomeCalendar rooms={rooms} nameOf={nameOf} slots={slots} />
          <HomeTasks rooms={rooms} nameOf={nameOf} slots={slots} />
        </div>
      )}
      <div
        className={`home-overview section-gap${rooms.length ? " paired" : ""}`}
      >
        <HomeMetrics />
        {rooms.length > 0 && (
          <HomeCollaborations
            rooms={rooms}
            nameOf={nameOf}
            slots={slots}
            title="Your collaborations"
          />
        )}
      </div>
      <HomeActivity />
    </div>
  );
}
