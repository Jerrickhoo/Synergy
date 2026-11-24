import SelectField from "./SelectField.jsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import { terminalStatuses } from "../data/collaboration.js";
import { scheduleInstant, scheduleLabel } from "../data/selectors.js";
import { validateSchedule } from "../state/validation.js";
import WorkspaceCalendar from "./WorkspaceCalendar.jsx";
import {
  zonedDateKey,
  dateFromKey,
  weeklySchedules,
} from "../data/planning.js";
import Icon from "./Icon.jsx";
import FormErrors from "./FormErrors.jsx";
import { timeZoneLabel } from "../data/dates.js";

export default function SchedulePanel({ room, partner }) {
  return <SessionPlanner key={room.id} room={room} partner={partner} />;
}
function SessionPlanner({ room, partner }) {
  const { state, onSubmit, onAction } = useApp();
  const current = room.milestones.session?.schedule;
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [timeZone] = useState(() => current?.timeZone || deviceTimeZone);
  const schedules =
    room.milestones.session?.schedules || (current ? [current] : []);
  const next = schedules.find(
    (schedule) => scheduleInstant(schedule) > new Date(),
  );
  const initialDate = next ? scheduleInstant(next) : new Date();
  const [date, setDate] = useState(() => zonedDateKey(initialDate, timeZone));
  const [month, setMonth] = useState(() =>
    dateFromKey(zonedDateKey(initialDate, timeZone)),
  );
  const [time, setTime] = useState(() =>
    next
      ? initialDate.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZone,
        })
      : "",
  );
  const [count, setCount] = useState(() => String(schedules.length || 1));
  const [duration, setDuration] = useState(() =>
    String(current?.durationMinutes || 30),
  );
  const [review, setReview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});
  const [, setTick] = useState(0);
  const reviewTitle = useRef(null);
  const dateInput = useRef(null);
  const formRef = useRef(null);
  const previousReview = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  useLayoutEffect(() => {
    if (review) reviewTitle.current?.focus();
    else if (previousReview.current) dateInput.current?.focus();
    previousReview.current = review;
  }, [review]);
  useLayoutEffect(() => {
    const first = Object.keys(errors)[0];
    if (!review && first)
      formRef.current?.querySelector(`[name="${first}"]`)?.focus();
  }, [errors, review]);
  const errorProps = (name) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? "schedule-local-errors" : undefined,
  });
  const closed = terminalStatuses.includes(room.status);
  const values = { date, time, count, durationMinutes: duration, timeZone };
  const proposed = date && time ? weeklySchedules(values, Number(count)) : [];
  const start = date && time ? scheduleInstant(values) : null;
  const dateLabel = date
    ? dateFromKey(date).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Choose a date";
  const changeDate = (value) => {
    setDate(value);
    setTime("");
    setSaved(false);
    setErrors({});
    if (value && Number.isFinite(dateFromKey(value).getTime()))
      setMonth(dateFromKey(value));
  };
  const change = (setter, value) => {
    setter(value);
    setSaved(false);
    setErrors({});
  };
  const past = (value) =>
    !date ||
    scheduleInstant({ ...values, time: value }) <= new Date() ||
    Number.isNaN(scheduleInstant({ ...values, time: value }).getTime());
  const fullTime = (instant, zone = timeZone) =>
    scheduleLabel(instant, { zone, showZone: zone !== deviceTimeZone });
  return (
    <section className="schedule-workspace focused-scheduler">
      <div className="tool-heading">
        <div>
          <span className="section-eyebrow">Mentorship</span>
          <h2>Plan your next session</h2>
          <p className="muted">
            Choose a date and time, then review the schedule together.
          </p>
        </div>
      </div>
      <div className="session-context">
        <Icon name="people" />
        <div>
          <h3>With {partner?.name || "your collaborator"}</h3>
          <p>
            {room.terms.draft.goal ||
              "Agree on a focused session goal together."}
          </p>
        </div>
        <button
          className="link-btn"
          onClick={() => onAction({ action: "room-tab", tab: "chat" })}
        >
          Discuss a meeting link in Chat <Icon name="arrow" />
        </button>
      </div>
      <ol className="booking-steps" aria-label="Scheduling steps">
        <li aria-current={!review && !time ? "step" : undefined}>
          <span>1</span>Date
        </li>
        <li aria-current={!review && time ? "step" : undefined}>
          <span>2</span>Time and duration
        </li>
        <li aria-current={review ? "step" : undefined}>
          <span>3</span>Review
        </li>
      </ol>
      {saved && (
        <div className="schedule-success" role="status">
          <Icon name="check" />
          <div>
            <strong>Your session schedule is saved.</strong>
            <p>
              It’s visible to both collaborators. Agree on a meeting link in
              Chat and confirm the session milestone when you’re ready.
            </p>
          </div>
        </div>
      )}
      {closed && (
        <p className="schedule-closed">
          This collaboration is complete or closed. Saved sessions are available
          below.
        </p>
      )}
      <button
        className="link-btn"
        onClick={() => onAction({ page: "calendar" })}
      >
        View calendar
      </button>
      <form
        ref={formRef}
        data-form="schedule"
        className={`session-planner-form ${review ? "is-review" : ""}`}
        onSubmit={async (event) => {
          event.preventDefault();
          const issues = validateSchedule(values);
          if (Object.keys(issues).length) {
            setErrors(issues);
            setReview(false);
            return;
          }
          setErrors({});
          if (!review) {
            setReview(true);
            return;
          }
          const success = await onSubmit(event);
          if (success) {
            setSaved(true);
            setReview(false);
          }
        }}
      >
        <input type="hidden" name="timeZone" value={timeZone} />
        <FormErrors scope="schedule" />
        {Object.keys(errors).length > 0 && (
          <div
            className="schedule-local-errors"
            id="schedule-local-errors"
            role="alert"
          >
            {Object.entries(errors).map(([key, message]) => (
              <p key={key}>{message}</p>
            ))}
          </div>
        )}
        {!review ? (
          <div className="session-selection-grid">
            <div className="session-calendar">
              <h3>Select a date</h3>
              <div className="field date-jump">
                <label htmlFor="booking-date">Session date</label>
                <input
                  ref={dateInput}
                  id="booking-date"
                  {...errorProps("date")}
                  type="date"
                  name="date"
                  required
                  min={zonedDateKey(new Date(), timeZone)}
                  value={date}
                  disabled={closed || state.busy}
                  onChange={(event) => changeDate(event.target.value)}
                />
              </div>
              <WorkspaceCalendar
                month={month}
                onMonthChange={setMonth}
                selected={date}
                minDate={zonedDateKey(new Date(), timeZone)}
                todayKey={zonedDateKey(new Date(), timeZone)}
                variant="picker"
                disabled={closed || state.busy}
                events={schedules
                  .filter((schedule) =>
                    Number.isFinite(scheduleInstant(schedule).getTime()),
                  )
                  .map((schedule) => ({
                    date: zonedDateKey(scheduleInstant(schedule), timeZone),
                  }))}
                onSelect={changeDate}
              />
            </div>
            <div className="session-times">
              <h3>Choose a time</h3>
              <p className="session-selected-date">{dateLabel}</p>
              <p className="session-zone">
                <Icon name="clock" />
                {timeZoneLabel(timeZone)}
              </p>
              {timeZone !== deviceTimeZone && (
                <p className="series-zone-note">
                  Enter times in {timeZoneLabel(timeZone)}, the saved series
                  timezone. Your device timezone is{" "}
                  {timeZoneLabel(deviceTimeZone)}.
                </p>
              )}
              <p className="availability-note">
                Starting points only. Partner availability and calendar
                conflicts are not checked.
              </p>
              <div
                className="time-options"
                role="group"
                aria-label="Suggested starting times"
              >
                {["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"].map(
                  (value) => (
                    <button
                      type="button"
                      key={value}
                      className={`time-option ${time === value ? "selected" : ""}`}
                      disabled={closed || state.busy || past(value)}
                      aria-pressed={time === value}
                      onClick={() => change(setTime, value)}
                    >
                      {new Date(`2000-01-01T${value}`).toLocaleTimeString(
                        undefined,
                        { hour: "numeric", minute: "2-digit" },
                      )}
                    </button>
                  ),
                )}
              </div>
              <div className="field">
                <label htmlFor="booking-time">Or choose another time</label>
                <input
                  id="booking-time"
                  {...errorProps("time")}
                  type="time"
                  name="time"
                  required
                  value={time}
                  disabled={closed || state.busy}
                  onChange={(event) => change(setTime, event.target.value)}
                />
              </div>
              <div className="session-preferences">
                <div className="field">
                  <label htmlFor="booking-duration">Session duration</label>
                  <SelectField
                    id="booking-duration"
                    {...errorProps("durationMinutes")}
                    name="durationMinutes"
                    value={duration}
                    disabled={closed || state.busy}
                    onChange={(event) =>
                      change(setDuration, event.target.value)
                    }
                  >
                    {[15, 30, 45, 60, 90, 120].map((value) => (
                      <option value={value} key={value}>
                        {value} minutes
                      </option>
                    ))}
                  </SelectField>
                </div>
                <div className="field">
                  <label htmlFor="booking-repeat">Repeat</label>
                  <SelectField
                    id="booking-repeat"
                    {...errorProps("count")}
                    name="count"
                    value={count}
                    disabled={closed || state.busy}
                    onChange={(event) => change(setCount, event.target.value)}
                  >
                    <option value="1">Just this session</option>
                    {Array.from({ length: 11 }, (_, index) => index + 2).map(
                      (value) => (
                        <option key={value} value={value}>
                          {value} weekly sessions
                        </option>
                      ),
                    )}
                  </SelectField>
                </div>
              </div>
              <button
                type="submit"
                className="btn primary schedule-review-button"
                disabled={closed || state.busy || !time || !date}
              >
                Review schedule <Icon name="arrow" />
              </button>
              <p className="schedule-footnote">
                {current
                  ? "Updating replaces the entire saved series and clears both session confirmations."
                  : "Times are shared with your collaborator after you save."}
              </p>
            </div>
          </div>
        ) : (
          <section
            className="schedule-review"
            aria-label="Review session schedule"
          >
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="time" value={time} />
            <input type="hidden" name="count" value={count} />
            <input type="hidden" name="durationMinutes" value={duration} />
            <p className="section-eyebrow">One more look</p>
            <h3 ref={reviewTitle} tabIndex="-1">
              Review your session schedule
            </h3>
            <p>With {partner?.name || "your collaborator"}</p>
            <dl className="schedule-review-facts">
              <div>
                <dt>First session</dt>
                <dd>{start && fullTime(start)}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{duration} minutes</dd>
              </div>
              <div>
                <dt>Timezone</dt>
                <dd>{timeZoneLabel(timeZone)}</dd>
              </div>
              <div>
                <dt>Repeat</dt>
                <dd>
                  {count === "1"
                    ? "One session"
                    : `${count} weekly sessions at the same local time`}
                </dd>
              </div>
              <div>
                <dt>Meeting context</dt>
                <dd>
                  {room.terms.draft.goal ||
                    "Discuss your session goal in Chat."}
                  <br />
                  Agree on the meeting link in Chat.
                </dd>
              </div>
            </dl>
            {proposed.length > 1 && (
              <details className="series-preview">
                <summary>See all {count} session dates</summary>
                <ol>
                  {proposed.map((schedule) => (
                    <li key={schedule.date}>
                      {fullTime(scheduleInstant(schedule))}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <p className="availability-note">
              Saving shares this schedule with your collaborator. It does not
              verify their availability or reserve an external calendar.
            </p>
            {current && (
              <p className="schedule-replacement-note">
                This replaces the entire current series and clears both session
                confirmations.
              </p>
            )}
            <div className="schedule-review-actions">
              <button
                className="btn primary schedule-save"
                type="submit"
                disabled={closed || state.busy}
              >
                {state.busy
                  ? "Saving schedule…"
                  : current
                    ? "Update session schedule"
                    : "Save session schedule"}
              </button>
              <button
                className="btn"
                type="button"
                disabled={state.busy}
                onClick={() => setReview(false)}
              >
                Back to date and time
              </button>
            </div>
          </section>
        )}
      </form>
      {schedules.length > 0 && (
        <section className="card scheduled-list">
          <div className="section-heading">
            <h3>Your saved sessions</h3>
            <span className="status green">{schedules.length} scheduled</span>
          </div>
          <p className="saved-session-zone">
            Shown in your device timezone: {deviceTimeZone}
          </p>
          {schedules.map((schedule) => {
            const instant = scheduleInstant(schedule);
            return (
              <div
                className="scheduled-row"
                key={`${schedule.date}:${schedule.time}`}
              >
                <div className="session-date-badge">
                  <span>
                    {instant.toLocaleDateString(undefined, { month: "short" })}
                  </span>
                  <strong>{instant.getDate()}</strong>
                </div>
                <div>
                  <strong>Mentorship session</strong>
                  <p>
                    {fullTime(instant, deviceTimeZone)} ·{" "}
                    {schedule.durationMinutes
                      ? `${schedule.durationMinutes} minutes`
                      : "Duration not specified"}
                  </p>
                </div>
                <span className="status gray">
                  {instant < new Date() ? "Past" : "Upcoming"}
                </span>
              </div>
            );
          })}
        </section>
      )}
    </section>
  );
}
