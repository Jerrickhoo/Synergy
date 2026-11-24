import { useLayoutEffect, useRef, useState, useId } from "react";
import Icon from "./Icon.jsx";
import { scheduleLabel } from "../data/selectors.js";
import {
  localDateKey,
  dateFromKey,
  monthCells,
  calendarKeyDate,
} from "../data/planning.js";

export function CalendarMonthNavigation({
  month,
  onMonthChange,
  previousDisabled = false,
  disabled = false,
  titleId,
  heading = "h2",
}) {
  const Heading = heading;
  return (
    <div className="calendar-month-navigation">
      <button
        type="button"
        className="icon-btn calendar-prev"
        aria-label="Previous month"
        disabled={previousDisabled || disabled}
        onClick={() =>
          onMonthChange(
            new Date(month.getFullYear(), month.getMonth() - 1, 1, 12),
          )
        }
      >
        <Icon name="chevron" />
      </button>
      <Heading id={titleId} aria-live="polite">
        {month.toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        })}
      </Heading>
      <button
        type="button"
        className="icon-btn calendar-next"
        aria-label="Next month"
        disabled={disabled}
        onClick={() =>
          onMonthChange(
            new Date(month.getFullYear(), month.getMonth() + 1, 1, 12),
          )
        }
      >
        <Icon name="chevron" />
      </button>
    </div>
  );
}

export default function WorkspaceCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  minDate,
  events = [],
  variant = "overview",
  controls,
  disabled = false,
  toolbar,
  todayKey,
  // Home: each event is its own button (opening its room) beside the day
  // button, tinted by `eventClass`; the day button itself still selects.
  onOpenEvent,
  eventClass = () => "",
  eventName = () => "",
  eventLabel,
}) {
  const root = useRef(null);
  const pendingFocus = useRef(null);
  const [focused, setFocused] = useState(selected);
  const titleId = useId();
  const helpId = useId();
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const today = todayKey || localDateKey(new Date());
  const weeks = monthCells(first, variant === "picker");
  const available = weeks
    .flat()
    .filter(
      (day) => day.inMonth && !disabled && (!minDate || day.key >= minDate),
    );
  const focusKey = available.some((day) => day.key === focused)
    ? focused
    : available.some((day) => day.key === selected)
      ? selected
      : available.some((day) => day.key === today)
        ? today
        : available[0]?.key;
  const byDate = new Map();
  for (const event of events) {
    if (!byDate.has(event.date)) byDate.set(event.date, []);
    byDate.get(event.date).push(event);
  }
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    root.current
      ?.querySelector(`[data-date="${pendingFocus.current}"]`)
      ?.focus();
    pendingFocus.current = null;
  }, [month, focused]);
  const navigate = (event, key) => {
    const next = calendarKeyDate(key, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    const target = minDate && next < minDate ? minDate : next;
    pendingFocus.current = target;
    setFocused(target);
    const date = dateFromKey(target);
    if (
      date.getFullYear() !== first.getFullYear() ||
      date.getMonth() !== first.getMonth()
    )
      onMonthChange(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    else {
      root.current?.querySelector(`[data-date="${target}"]`)?.focus();
      pendingFocus.current = null;
    }
  };
  const eventText = (item) =>
    `${
      ["session", "office-hours"].includes(item.kind) && item.instant
        ? `${scheduleLabel(item.instant, { timeOnly: true })} `
        : ""
    }${item.kind === "task" ? "Task: " : item.kind === "milestone" ? "Due: " : ""}${
      item.title || "Session"
    }`;
  const previousDisabled =
    disabled ||
    Boolean(
      minDate &&
      localDateKey(new Date(first.getFullYear(), first.getMonth(), 0)) <
        minDate,
    );
  return (
    <div ref={root} className={`workspace-calendar calendar-${variant}`}>
      <div className="calendar-month">
        <CalendarMonthNavigation
          month={first}
          onMonthChange={onMonthChange}
          previousDisabled={previousDisabled}
          disabled={disabled}
          titleId={titleId}
          heading={variant === "overview" ? "h2" : "h3"}
        />
        {toolbar}
      </div>
      <p className="sr-only" id={helpId}>
        Use arrow keys to move by day or week, Home and End within a week, Page
        Up and Page Down by month, or Shift with Page Up and Page Down by year.
        Press Enter or Space to select.
      </p>
      <div
        className="calendar-grid"
        role="grid"
        aria-labelledby={titleId}
        aria-describedby={helpId}
      >
        <div className="calendar-weekdays" role="row">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span className="calendar-weekday" role="columnheader" key={day}>
              {day}
            </span>
          ))}
        </div>
        {weeks.map((week, index) => (
          <div className="calendar-week" role="row" key={index}>
            {week.map((day) => {
              const items = byDate.get(day.key) || [];
              const unavailable =
                disabled || Boolean(minDate && day.key < minDate);
              return (
                <div
                  key={day.key}
                  role="gridcell"
                  aria-selected={day.inMonth && day.key === selected}
                  className={`calendar-cell ${day.inMonth ? "" : "calendar-outside"}`}
                >
                  {day.inMonth ? (
                    <>
                      <button
                        type="button"
                        data-date={day.key}
                        className={`calendar-day ${day.key === selected ? "selected" : ""} ${day.key === today ? "is-today" : ""}`}
                        tabIndex={day.key === focusKey ? 0 : -1}
                        aria-pressed={day.key === selected}
                        aria-current={day.key === today ? "date" : undefined}
                        aria-controls={controls}
                        aria-label={`${day.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${items.length ? `, ${items.length} ${items.length === 1 ? "event" : "events"}` : ""}`}
                        disabled={unavailable}
                        onFocus={() => setFocused(day.key)}
                        onKeyDown={(event) => navigate(event, day.key)}
                        onClick={() => onSelect(day.key)}
                      >
                        <span className="calendar-date-number">
                          {day.date.getDate()}
                        </span>
                        {variant === "overview" &&
                        items.length > 0 &&
                        onOpenEvent ? (
                          <span
                            className="calendar-mobile-count"
                            aria-hidden="true"
                          >
                            {items.length}{" "}
                            {items.length === 1 ? "event" : "events"}
                          </span>
                        ) : variant === "overview" && items.length > 0 ? (
                          <span
                            className="calendar-cell-events"
                            aria-hidden="true"
                          >
                            <span className="calendar-mobile-count">
                              {items.length}{" "}
                              {items.length === 1 ? "event" : "events"}
                            </span>
                            {items.slice(0, 2).map((item, i) => (
                              <span
                                className={`calendar-event-label kind-${item.kind || "session"}`}
                                key={item.id || i}
                              >
                                {["session", "office-hours"].includes(
                                  item.kind,
                                ) && item.instant
                                  ? `${scheduleLabel(item.instant, { timeOnly: true })} `
                                  : ""}
                                {item.kind === "task"
                                  ? "Task: "
                                  : item.kind === "milestone"
                                    ? "Due: "
                                    : ""}
                                {item.title || "Session"}
                              </span>
                            ))}
                            {items.length > 2 && (
                              <span className="calendar-event-more">
                                +{items.length - 2} more
                              </span>
                            )}
                          </span>
                        ) : items.length > 0 ? (
                          <span
                            className="calendar-day-dots"
                            aria-hidden="true"
                          >
                            <span className="calendar-event-dot" />
                          </span>
                        ) : null}
                      </button>
                      {onOpenEvent && items.length > 0 && (
                        // Pointer shortcuts to each room. Keyboard users open
                        // the day, whose dialog lists the same events.
                        <div className="calendar-event-buttons">
                          {items.slice(0, 3).map((item) => (
                            <button
                              type="button"
                              key={item.id}
                              tabIndex={-1}
                              className={`calendar-event-chip ${eventClass(item)}`}
                              title={`${eventText(item)} · ${eventName(item)}`}
                              aria-label={`${eventText(item)}, ${eventName(item)}. Open room.`}
                              onClick={() => onOpenEvent(item)}
                            >
                              {eventLabel ? eventLabel(item) : eventText(item)}
                            </button>
                          ))}
                          {items.length > 3 && (
                            <span className="calendar-event-more">
                              +{items.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="outside-date" aria-hidden="true">
                      {day.date.getDate()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
