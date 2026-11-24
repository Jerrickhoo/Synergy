import {
  CalendarFeed,
  OfficeHoursManager,
} from "../components/OfficeHours.jsx";
import SelectField from "../components/SelectField.jsx";
import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import { activeRooms, scheduleLabel } from "../data/selectors.js";
import {
  calendarEvents,
  localDateKey,
  dateFromKey,
  monthEvents,
} from "../data/planning.js";
import PageHeader from "../components/PageHeader.jsx";
import WorkspaceCalendar, {
  CalendarMonthNavigation,
} from "../components/WorkspaceCalendar.jsx";
import Icon from "../components/Icon.jsx";
import { timeZoneLabel } from "../data/dates.js";

function CalendarEvent({ event, partnerName, openEvent }) {
  return (
    <button
      className={`agenda-event event-${event.kind}`}
      onClick={() => openEvent(event)}
    >
      <span className="agenda-kind">
        {event.kind === "session" || event.kind === "office-hours"
          ? scheduleLabel(event.instant, { timeOnly: true, showZone: true })
          : event.kind === "milestone"
            ? "Milestone due · UTC"
            : "Task deadline"}
        {event.durationMinutes ? ` · ${event.durationMinutes} min` : ""}
      </span>
      <strong>{event.title}</strong>
      <span>
        {event.room ? partnerName(event.room) : "Founders can book this time"}
      </span>
      <span className="agenda-open">
        {event.kind === "office-hours"
          ? "Manage slots"
          : `Open ${
              event.kind === "task"
                ? "board"
                : event.kind === "session"
                  ? "schedule"
                  : "milestones"
            }`}{" "}
        <Icon name="arrow" />
      </span>
    </button>
  );
}
export default function CalendarPage() {
  const { state } = useApp();
  return <CalendarContent key={state.role} />;
}
function CalendarContent() {
  const { state, model, onAction } = useApp();
  const [month, setMonth] = useState(() => new Date());
  const [date, setDate] = useState(() => localDateKey(new Date()));
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("month");
  const rooms = activeRooms(state);
  const effectiveFilter = rooms.some((room) => room.id === filter)
    ? filter
    : "all";
  const events = calendarEvents(state).filter(
    (event) => effectiveFilter === "all" || event.room?.id === effectiveFilter,
  );
  const dayEvents = events.filter((event) => event.date === date);
  const groups = monthEvents(events, month);
  const people = model.allPeople();
  const partnerName = (room) =>
    people.find((person) => person.id === room.partnerId)?.name ||
    "Your collaborator";
  const openEvent = (event) => {
    if (!event.room) {
      const section = document.getElementById("office-hours");
      section?.scrollIntoView({ block: "start" });
      section?.querySelector("h2")?.focus({ preventScroll: true });
      return;
    }
    onAction({ action: "open-room", id: event.room.id, tab: event.tab });
  };
  const today = () => {
    setDate(localDateKey(new Date()));
    setMonth(new Date());
  };
  const todayButton = (
    <button className="btn calendar-today" onClick={today}>
      Today
    </button>
  );
  const label = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const mentorships = rooms.filter(
    (room) =>
      room.type === "mentorship" &&
      (effectiveFilter === "all" || room.id === effectiveFilter),
  );
  return (
    <div className="page calendar-page page-enter">
      <PageHeader
        title="Calendar"
        intro="Sessions and deadlines across your collaborations."
      />
      {state.role === "mentor" && <OfficeHoursManager />}
      <CalendarFeed />
      <div className="calendar-controls">
        <div
          className="calendar-view-switch"
          role="group"
          aria-label="Calendar view"
        >
          <button
            className="btn"
            aria-pressed={view === "month"}
            onClick={() => setView("month")}
          >
            Month
          </button>
          <button
            className="btn"
            aria-pressed={view === "agenda"}
            onClick={() => setView("agenda")}
          >
            Agenda
          </button>
        </div>
        <div className="field calendar-collaboration-filter">
          <label htmlFor="calendar-collaboration">Collaboration</label>
          <SelectField
            id="calendar-collaboration"
            aria-label="Filter calendar by collaboration"
            value={effectiveFilter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All collaborations</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {partnerName(room)} · {room.engagementType || "Collaboration"}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      <div className={`calendar-layout calendar-view-${view}`}>
        <section
          className="card calendar-main"
          aria-label={view === "month" ? "Month overview" : "Monthly agenda"}
        >
          {view === "month" ? (
            <WorkspaceCalendar
              month={month}
              onMonthChange={setMonth}
              selected={date}
              onSelect={setDate}
              events={events}
              variant="overview"
              controls="selected-day-agenda"
              toolbar={todayButton}
            />
          ) : (
            <>
              <div className="calendar-month">
                <CalendarMonthNavigation
                  month={month}
                  onMonthChange={setMonth}
                />
                {todayButton}
              </div>
              {groups.length ? (
                <div className="month-agenda">
                  {groups.map(([key, items]) => (
                    <section className="month-agenda-day" key={key}>
                      <h3>
                        {dateFromKey(key).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </h3>
                      <div className="agenda-events">
                        {items.map((event) => (
                          <CalendarEvent
                            key={event.id}
                            event={event}
                            partnerName={partnerName}
                            openEvent={openEvent}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="calendar-month-empty">
                  <Icon name="calendar" />
                  <h2>No events in {label}</h2>
                  <p>
                    Sessions and deadlines will appear here when you add them in
                    a room. Choose another month or collaboration to explore
                    more.
                  </p>
                </div>
              )}
            </>
          )}
          <div className="calendar-legend">
            <span>
              <i className="legend-dot kind-session" />
              Sessions
            </span>
            <span>
              <i className="legend-dot kind-task" />
              Task deadlines
            </span>
            <span>
              <i className="legend-dot kind-milestone" />
              Milestones (UTC)
            </span>
            {state.role === "mentor" && (
              <span>
                <i className="legend-dot kind-office-hours" />
                Open Office Hours
              </span>
            )}
          </div>
          <p className="calendar-timezone">
            <Icon name="clock" />
            Session times:{" "}
            {timeZoneLabel(Intl.DateTimeFormat().resolvedOptions().timeZone)}
          </p>
          <p className="calendar-date-note">
            Task deadlines keep their assigned date. Milestone deadlines use
            UTC.
          </p>
        </section>
        {view === "month" && (
          <aside
            className="card day-agenda"
            id="selected-day-agenda"
            aria-label="Selected day agenda"
          >
            <p className="section-eyebrow">Selected day</p>
            <h2>
              {dateFromKey(date).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
              })}
            </h2>
            <p className="agenda-day-description" role="status">
              {dateFromKey(date).toLocaleDateString(undefined, {
                weekday: "long",
              })}{" "}
              · {dateFromKey(date).getFullYear()} · {dayEvents.length}{" "}
              {dayEvents.length === 1 ? "event" : "events"}
            </p>
            <div className="agenda-events">
              {dayEvents.length ? (
                dayEvents.map((event) => (
                  <CalendarEvent
                    key={event.id}
                    event={event}
                    partnerName={partnerName}
                    openEvent={openEvent}
                  />
                ))
              ) : (
                <div className="agenda-empty">
                  <h3>No events on this day</h3>
                  <p>
                    Select another date or add a session or deadline in a
                    collaboration.
                  </p>
                </div>
              )}
            </div>
            <div className="agenda-plan">
              <h3>Plan a session</h3>
              {mentorships.length ? (
                mentorships.map((room) => (
                  <button
                    className="schedule-room-link"
                    key={room.id}
                    onClick={() =>
                      onAction({
                        action: "open-room",
                        id: room.id,
                        tab: "schedule",
                      })
                    }
                  >
                    <Icon name="people" />
                    <span>{partnerName(room)}</span>
                    <Icon name="arrow" />
                  </button>
                ))
              ) : (
                <>
                  <p className="muted">
                    {state.role === "mentor"
                      ? "Connect with a founder to plan a mentorship session."
                      : "Start a mentorship collaboration to plan a session together."}
                  </p>
                  <button
                    className="btn full"
                    onClick={() => onAction({ page: "discover" })}
                  >
                    {state.role === "mentor"
                      ? "Browse startups"
                      : "Find a collaborator"}
                  </button>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
