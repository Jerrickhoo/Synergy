import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import WorkspaceCalendar from "./WorkspaceCalendar.jsx";
import Overlay from "./Overlay.jsx";
import DayPlanner from "./DayPlanner.jsx";
import Icon from "./Icon.jsx";
import { calendarEvents, localDateKey, dateFromKey } from "../data/planning.js";
import {
  milestoneDate,
  roomNextAction,
  scheduleLabel,
} from "../data/selectors.js";
import { homeTasks } from "../data/home-planner.js";
import GoogleSync from "./GoogleSync.jsx";

const longDay = (key) =>
  dateFromKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
const eventTime = (event) =>
  event.kind === "session" && event.instant
    ? scheduleLabel(event.instant, { timeOnly: true })
    : event.kind === "task"
      ? "Task due"
      : "Milestone due";

// A collaborator's colour mark; the name beside it carries the identity.
export function CollabSwatch({ slot }) {
  return <span className={`collab-swatch ${slot}`} aria-hidden="true" />;
}

// The month calendar: each item is tinted by collaborator and opens its room;
// choosing a day opens that day's events and a meeting form. Inside a Deal
// Room (`room`) it shows that collaboration only, and an item opens in place:
// a deadline scrolls to its milestone, anything else switches tab.
export function HomeCalendar({ rooms, nameOf, slots, room: only = null }) {
  const { state, onAction } = useApp();
  const [month, setMonth] = useState(() => new Date());
  const [day, setDay] = useState("");
  const today = localDateKey(new Date());
  // Only collaboration events: open Office Hours have no collaborator yet.
  const events = calendarEvents(state).filter(
    (event) => event.room && (!only || event.room.id === only.id),
  );
  const open = (event) => {
    if (!only)
      return onAction({
        action: "open-room",
        id: event.room.id,
        tab: event.tab,
      });
    const milestone =
      event.kind === "milestone" &&
      document.getElementById(`milestone-${event.milestoneId}`);
    if (milestone) {
      milestone.scrollIntoView({ block: "center", behavior: "smooth" });
      milestone.classList.remove("is-flashing");
      // Restart the highlight even when the same milestone is chosen twice.
      void milestone.offsetWidth;
      milestone.classList.add("is-flashing");
      return;
    }
    onAction({ action: "room-tab", tab: event.tab });
  };
  const dayEvents = events.filter((event) => event.date === day);
  const pending = state.waitingByRole?.[state.role]?.size || 0;
  const legend = only ? [] : rooms.filter((room) => slots.has(room.id));
  return (
    <section
      className="card home-calendar"
      aria-labelledby="home-calendar-heading"
    >
      <h2 id="home-calendar-heading" className="visually-hidden">
        Calendar
      </h2>
      <WorkspaceCalendar
        month={month}
        onMonthChange={setMonth}
        selected=""
        onSelect={setDay}
        events={events}
        variant="overview"
        onOpenEvent={open}
        eventClass={(event) => slots.get(event.room.id) || "collab-other"}
        eventName={(event) => nameOf(event.room)}
        // A meeting shows its time and collaborator; deadlines their title.
        eventLabel={(event) =>
          event.kind === "session" && event.instant
            ? `${scheduleLabel(event.instant, { timeOnly: true })} ${nameOf(event.room)}`
            : `${event.kind === "task" ? "Task" : "Due"}: ${event.title}`
        }
        toolbar={
          <button
            className="btn small calendar-today"
            onClick={() => setMonth(new Date())}
          >
            Today
          </button>
        }
      />
      {legend.length > 0 && (
        <ul className="home-calendar-legend" aria-label="Collaborators">
          {legend.map((room) => (
            <li key={room.id}>
              <CollabSwatch slot={slots.get(room.id)} />
              {nameOf(room)}
            </li>
          ))}
        </ul>
      )}
      <p className="home-calendar-hint">
        {only
          ? `Meetings, tasks and milestone deadlines with ${nameOf(only)}. Choose a day to add one, or an item to open it.`
          : rooms.length
            ? "Choose a day to see it or add a meeting, task or deadline. Each item takes its collaboration's colour; choose one to open its room."
            : "Meetings and due dates from your Deal Rooms show here once someone accepts a request."}
      </p>
      {day && (
        <Overlay title={longDay(day)} onClose={() => setDay("")}>
          <div className="home-day">
            {dayEvents.length > 0 && (
              <section aria-labelledby="home-day-events">
                <h3 id="home-day-events">On this day</h3>
                <ul className="home-day-events">
                  {dayEvents.map((event) => (
                    <li key={event.id}>
                      <button
                        className="home-day-event interactive-surface"
                        onClick={() => {
                          setDay("");
                          open(event);
                        }}
                      >
                        <CollabSwatch
                          slot={slots.get(event.room.id) || "collab-other"}
                        />
                        <span>
                          <strong>{event.title}</strong>
                          <span className="muted">
                            {eventTime(event)} · {nameOf(event.room)}
                          </span>
                        </span>
                        <Icon name="arrow" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section aria-labelledby="home-day-schedule">
              <h3 id="home-day-schedule">Add to this day</h3>
              {day < today ? (
                <p className="muted">
                  This day has passed. Choose today or a later date to add a
                  meeting, task or deadline.
                </p>
              ) : rooms.length ? (
                <DayPlanner
                  rooms={rooms}
                  nameOf={nameOf}
                  slots={slots}
                  day={day}
                  onDone={() => setDay("")}
                />
              ) : (
                // Nothing to attach a meeting or task to yet: say why, and
                // where to go next.
                <div className="home-day-locked">
                  <p>
                    Meetings, tasks and deadlines belong to a collaboration, so
                    you can add them here once someone accepts a request and
                    your Deal Room opens.
                  </p>
                  <p className="muted">
                    {pending
                      ? `You have ${pending} request${pending === 1 ? "" : "s"} waiting for a reply.`
                      : "Send a request to someone who fits what you need to get started."}
                  </p>
                  <div className="chip-row">
                    <button
                      className="btn primary small"
                      onClick={() => {
                        setDay("");
                        onAction({ page: "discover" });
                      }}
                    >
                      {state.role === "mentor"
                        ? "Browse startups"
                        : "Find matches"}
                    </button>
                    {pending > 0 && (
                      <button
                        className="btn small"
                        onClick={() => {
                          setDay("");
                          onAction({ page: "waiting" });
                        }}
                      >
                        View your requests
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        </Overlay>
      )}
    </section>
  );
}

// "Task — Collaborator": what is waiting on you, soonest due first. Dated
// tasks also show on the calendar; Sync to Google copies the list to Google
// Tasks and the dates to Google Calendar.
export function HomeTasks({ rooms, nameOf, slots, extra = [] }) {
  const { state, onAction } = useApp();
  const tasks = homeTasks(state, rooms, nameOf, extra);
  return (
    <section className="card home-tasks" aria-labelledby="home-tasks-heading">
      <div className="home-tasks-head">
        <h2 id="home-tasks-heading">Your tasks</h2>
        <GoogleSync tasks={tasks} nameOf={nameOf} />
      </div>
      {tasks.length ? (
        <ul
          className="home-task-list"
          tabIndex={0}
          aria-labelledby="home-tasks-heading"
        >
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                className="home-task interactive-surface"
                onClick={() =>
                  onAction({
                    action: "open-room",
                    id: task.room.id,
                    tab: task.tab,
                    review: task.review,
                  })
                }
              >
                <CollabSwatch
                  slot={slots.get(task.room.id) || "collab-other"}
                />
                <span className="home-task-copy">
                  <span className="home-task-title">
                    {task.title}
                    <span className="home-task-who"> — {task.who}</span>
                  </span>
                  <span className="home-task-due">
                    {task.due
                      ? `Due ${milestoneDate(task.due)} · on your calendar`
                      : "No due date"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted home-tasks-empty">
          {rooms.length
            ? "Nothing is waiting on you right now."
            : "Tasks from your Deal Rooms show here, with their due dates on the calendar."}
        </p>
      )}
    </section>
  );
}

// Each collaboration with its next step and one standard "Open room".
export function HomeCollaborations({ rooms, nameOf, slots, title }) {
  const { onAction } = useApp();
  return (
    <section
      className="card panel home-collaborations"
      aria-labelledby="home-collaborations-heading"
    >
      <h2 id="home-collaborations-heading">{title}</h2>
      <ul className="home-collaboration-list">
        {rooms.map((room) => {
          const name = nameOf(room);
          const next = roomNextAction(room, name);
          const kind =
            room.type === "mentorship"
              ? "Mentorship"
              : room.engagementType || "Collaboration";
          return (
            <li className="home-collaboration" key={room.id}>
              <CollabSwatch slot={slots.get(room.id) || "collab-other"} />
              <div className="home-collaboration-copy">
                <strong>
                  {kind} with {name}
                </strong>
                <span className={next.mine ? "deal-next mine" : "deal-next"}>
                  {next.mine ? "Your turn: " : ""}
                  {next.text.replace(/^Your turn: /, "").replace(/^Next: /, "")}
                  {next.due ? ` · due ${milestoneDate(next.due)}` : ""}
                </span>
              </div>
              <button
                className="btn small"
                onClick={() =>
                  onAction({
                    action: "open-room",
                    id: room.id,
                    tab: next.tab,
                    review: next.review && next.mine,
                  })
                }
              >
                Open room
                <span className="visually-hidden">
                  : {kind} with {name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
