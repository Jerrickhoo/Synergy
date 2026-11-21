import { useEffect, useRef, useState } from "react";
import { priceLabel } from "../data/pricing.js";
import { useApp } from "../state/AppContext.jsx";
import { verificationRequired } from "../data/collaboration.js";
import VerificationGate from "./VerificationGate.jsx";
import { scheduleLabel } from "../data/selectors.js";

const slotLabel = (slot) =>
  `${scheduleLabel(slot)} · ${slot.durationMinutes} min`;

function OfficeSlot({ slot }) {
  const { onAction, state } = useApp();
  const [date, setDate] = useState("");
  const change = (action, event) =>
    onAction({ action, id: slot.id, values: { date } }, event);
  return (
    <article className="mentor-session">
      <h3>
        {slot.recurring ? "Weekly starting" : "One time"} {slot.date}
      </h3>
      <p>
        {slot.time} · {slot.timeZone} · {slot.durationMinutes} minutes
      </p>
      <div className="mentor-request-controls">
        <button
          className="btn small"
          disabled={state.busy}
          onClick={(event) => change("close-office-slot", event)}
        >
          Close slot
        </button>
      </div>
      {slot.recurring && (
        <form
          className="mentor-request-form"
          onSubmit={(event) => change("skip-office-date", event)}
        >
          <label htmlFor={`skip-${slot.id}`}>Skip one date</label>
          <input
            id={`skip-${slot.id}`}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
          <button className="btn small" disabled={state.busy}>
            Skip date
          </button>
          {slot.closedDates?.length > 0 && (
            <p>Skipped {slot.closedDates.join(", ")}</p>
          )}
        </form>
      )}
    </article>
  );
}

export function OfficeHoursManager() {
  const { onAction, state } = useApp();
  const profile = state.profiles.mentor;
  const offers = profile.formats?.some(
    (format) => format.id === "office-hours",
  );
  const submit = async (event) => {
    const form = event.currentTarget;
    const success = await onAction(
      {
        action: "open-office-slot",
        values: Object.fromEntries(new FormData(form)),
      },
      event,
    );
    if (success) form.reset();
  };
  return (
    <section className="card panel section-gap" aria-label="Office Hours">
      <h2>Office Hours</h2>
      {offers ? (
        <form className="mentor-request-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="office-date">First date</label>
            <input type="date" name="date" id="office-date" required />
          </div>
          <div className="field">
            <label htmlFor="office-time">Start time ({profile.timeZone})</label>
            <input type="time" name="time" id="office-time" required />
          </div>
          <div className="field">
            <label htmlFor="office-duration">Duration</label>
            <select
              name="durationMinutes"
              id="office-duration"
              defaultValue="30"
            >
              {[15, 30, 45, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </div>
          <label>
            <input type="checkbox" name="recurring" /> Repeat weekly
          </label>
          <button className="btn primary" disabled={state.busy}>
            {state.busy ? "Saving…" : "Open slot"}
          </button>
        </form>
      ) : (
        <p>
          Enable Office Hours in{" "}
          <button
            className="link-btn"
            onClick={() => onAction({ page: "settings" })}
          >
            Mentoring settings
          </button>{" "}
          to open a slot.
        </p>
      )}
      <details className="section-gap">
        <summary>Preferred session time</summary>
        <form
          className="mentor-request-form"
          onSubmit={(event) =>
            onAction(
              {
                action: "set-office-preferred-time",
                values: Object.fromEntries(new FormData(event.currentTarget)),
              },
              event,
            )
          }
        >
          <p>
            Suggest a weekly time for collaborators scheduling a mentorship
            session.
          </p>
          <label htmlFor="preferred-weekday">Preferred weekday</label>
          <select
            id="preferred-weekday"
            name="weekday"
            defaultValue={profile.preferredHours?.weekday ?? 1}
          >
            {[
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ].map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </select>
          <label htmlFor="preferred-time">
            Preferred time ({profile.timeZone})
          </label>
          <input
            id="preferred-time"
            name="time"
            type="time"
            required
            defaultValue={profile.preferredHours?.time}
          />
          <div className="mentor-request-controls">
            <button className="btn small" disabled={state.busy}>
              Save preferred time
            </button>
            {profile.preferredHours && (
              <button
                type="button"
                className="btn small"
                disabled={state.busy}
                onClick={(event) =>
                  onAction(
                    {
                      action: "set-office-preferred-time",
                      values: { clear: true },
                    },
                    event,
                  )
                }
              >
                Clear preferred time
              </button>
            )}
          </div>
        </form>
      </details>
      {(profile.officeHours || []).map((slot) => (
        <OfficeSlot key={slot.id} slot={slot} />
      ))}
    </section>
  );
}

export function CalendarFeed({ room, session }) {
  const { onAction, state } = useApp();
  const token = state.calendarToken;
  const path = token ? `/api/calendar/${token}.ics` : null;
  // The spinner belongs to the session button that was clicked.
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [startDownload, setStartDownload] = useState(false);
  const link = useRef(null);
  // The private path arrives with the next state, so the file is fetched from
  // the link once it renders: one click creates the path and downloads.
  useEffect(() => {
    if (!startDownload || !link.current) return;
    setStartDownload(false);
    link.current.click();
    link.current.focus();
  }, [startDownload, path]);
  const refresh = async (reset, event) => {
    setPending(true);
    setFailed(false);
    try {
      const ok = await onAction(
        { action: "calendar-link", values: { reset } },
        event,
      );
      if (session && ok) {
        setDownloaded(true);
        setStartDownload(true);
      } else if (session) setFailed(true);
    } finally {
      setPending(false);
    }
  };
  if (session)
    return path ? (
      <a
        ref={link}
        className="btn small"
        href={`${path}?session=${encodeURIComponent(`${room.id}-${session.id}`)}`}
        download
        onClick={() => setDownloaded(true)}
      >
        {downloaded ? "Download .ics again" : "Get calendar file"}
      </a>
    ) : (
      <span className="calendar-file">
        <button
          className="btn small"
          disabled={state.busy}
          aria-describedby={failed ? `calendar-error-${session.id}` : undefined}
          onClick={(event) => refresh(false, event)}
        >
          {pending && <span className="spinner" aria-hidden="true" />}
          Get calendar file
        </button>
        {failed && (
          <span
            id={`calendar-error-${session.id}`}
            className="field-error"
            role="alert"
          >
            Couldn’t create the calendar file. Try again.
          </span>
        )}
      </span>
    );
  return (
    <section className="card panel section-gap">
      <h2>Calendar subscription</h2>
      <p>
        Add your private calendar link to an app that supports calendar
        subscriptions.
      </p>
      {path ? (
        <>
          <label htmlFor="private-calendar-link">Private calendar link</label>
          <input
            id="private-calendar-link"
            type="url"
            value={new URL(path, location.origin).href}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            className="btn"
            disabled={state.busy}
            onClick={(event) => refresh(true, event)}
          >
            Reset link
          </button>
        </>
      ) : (
        <button
          className="btn"
          disabled={state.busy}
          onClick={(event) => refresh(false, event)}
        >
          Create calendar link
        </button>
      )}
    </section>
  );
}

export function OfficeHoursBooking({ person }) {
  const { state, onAction } = useApp();
  const [selected, setSelected] = useState("");
  const available = person.officeHours || [];
  const slot = available.find((entry) => entry.id === selected) || available[0];
  const locked = verificationRequired(state);
  if (!person.formats?.some((format) => format.id === "office-hours"))
    return null;
  const problem =
    state.formErrors?.scope === "book-office-hours" && state.formErrors.fields;
  const failure =
    state.mentorshipActionError?.id === person.id &&
    state.mentorshipActionError.message;
  return (
    <section className="mentor-requests-list" aria-label="Office Hours booking">
      <h2>Book Office Hours</h2>
      {!slot ? (
        <p>No Office Hours slots are currently available.</p>
      ) : (
        <form
          className="mentor-request-form"
          data-form="book-office-hours"
          onSubmit={(event) =>
            onAction(
              {
                action: "book-office-hours",
                id: person.id,
                values: {
                  ...Object.fromEntries(new FormData(event.currentTarget)),
                  slotId: slot.slotId,
                  date: slot.date,
                },
              },
              event,
            )
          }
        >
          {failure && (
            <p className="warning-note" role="status">
              {failure}
            </p>
          )}
          <label htmlFor="office-book-option">Available slots</label>
          <select
            id="office-book-option"
            value={slot.id}
            onChange={(event) => setSelected(event.target.value)}
            required
          >
            {available.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {slotLabel(entry)}
              </option>
            ))}
          </select>
          <label htmlFor="office-book-problem">
            What's the problem for Office Hours?
          </label>
          <textarea
            id="office-book-problem"
            name="problem"
            aria-invalid={Boolean(problem?.problem)}
            minLength={20}
            maxLength={1000}
            required
          />
          {problem?.problem && <p role="alert">{problem.problem}</p>}
          <label htmlFor="office-book-question">Office Hours question</label>
          <textarea
            id="office-book-question"
            name="question"
            aria-invalid={Boolean(problem?.question)}
            minLength={20}
            maxLength={1000}
            required
          />
          {problem?.question && <p role="alert">{problem.question}</p>}
          <label htmlFor="office-book-outcome">
            Office Hours desired outcome (optional)
          </label>
          <textarea
            id="office-book-outcome"
            name="desiredOutcome"
            maxLength={1000}
            aria-invalid={Boolean(problem?.desiredOutcome)}
          />
          {problem?.desiredOutcome && (
            <p role="alert">{problem.desiredOutcome}</p>
          )}
          <p>
            {priceLabel(
              person.formats.find((format) => format.id === "office-hours")
                ?.price || 0,
            )}{" "}
            · Only {person.name} will see your request details.
          </p>
          {locked && <VerificationGate />}
          <button className="btn primary" disabled={state.busy || locked}>
            {state.busy ? "Booking…" : "Book Office Hours"}
          </button>
        </form>
      )}
    </section>
  );
}
