import { useEffect, useRef, useState } from "react";
import { priceLabel } from "../data/pricing.js";
import { useApp } from "../state/AppContext.jsx";
import { verificationRequired } from "../data/collaboration.js";
import VerificationGate from "./VerificationGate.jsx";
import { scheduleInstant, scheduleLabel } from "../data/selectors.js";
import { isMentorRoom, mentorSessions } from "../data/mentor-room.js";
import { localDateKey } from "../data/planning.js";
import {
  formatDate,
  formatTimeRange,
  formatWeekday,
  timeZoneLabel,
} from "../data/dates.js";
import SelectField from "./SelectField.jsx";
import Icon from "./Icon.jsx";
import PrototypeShortcut from "./PrototypeShortcut.jsx";

const slotLabel = (slot) =>
  `${scheduleLabel(slot)} · ${slot.durationMinutes} min`;

// "Tuesdays from Nov 24 · 6:00–7:00 PM" or "Tue, Nov 24 · 6:00–7:00 PM",
// naming the zone when it differs from the viewer's.
export function officeSlotLabel(slot) {
  const viewer = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const time = formatTimeRange(slot.time, slot.durationMinutes);
  const zone =
    slot.timeZone && slot.timeZone !== viewer
      ? ` (${slot.timeZone.replaceAll("_", " ")})`
      : "";
  return slot.recurring
    ? `${formatWeekday(slot.date)}s from ${formatDate(slot.date)} · ${time}${zone}`
    : `${formatDate(slot.date, { weekday: true })} · ${time}${zone}`;
}

// Upcoming bookings of one slot, from the mentor's own rooms.
function slotBookings(state, people, slotId) {
  return Object.values(state.rooms)
    .filter((room) => isMentorRoom(room) && room.role === "mentor")
    .flatMap((room) =>
      mentorSessions(room)
        .filter(
          (session) =>
            session.officeSlotId === slotId &&
            !session.cancelledAt &&
            !session.outcome &&
            scheduleInstant(session).getTime() > Date.now(),
        )
        .map((session) => ({
          session,
          name:
            people.find((person) => person.id === room.partnerId)?.name ||
            "A founder",
        })),
    );
}

function OfficeSlot({ slot, otherOpenings }) {
  const { onAction, state, model } = useApp();
  const [date, setDate] = useState("");
  const [confirming, setConfirming] = useState(null);
  const booked = slotBookings(state, model.allPeople(), slot.id);
  const change = (action, event) =>
    onAction({ action, id: slot.id, values: { date } }, event);
  // Closing or skipping a booked time cancels that booking, so ask first.
  const request = (action, event) => {
    event?.preventDefault();
    const affected =
      action === "skip-office-date"
        ? booked.filter(({ session }) => session.date === date)
        : booked;
    if (affected.length) setConfirming({ action, affected });
    else change(action, event);
  };
  const today = localDateKey(new Date());
  const skipping = confirming?.action === "skip-office-date";
  return (
    <article className="mentor-session office-slot">
      <h3>{officeSlotLabel(slot)}</h3>
      {booked.length > 0 ? (
        <ul className="office-slot-bookings">
          {booked.map(({ session, name }) => (
            <li key={session.id}>
              Booked by {name} · {formatDate(session.date, { weekday: true })}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No bookings yet.</p>
      )}
      {slot.closedDates?.length > 0 && (
        <p className="muted">
          Skipped{" "}
          {slot.closedDates
            .map((value) => formatDate(value, { weekday: true }))
            .join(", ")}
        </p>
      )}
      {confirming ? (
        <div className="office-slot-confirm" role="alert">
          <p>
            {skipping
              ? "Skipping this date cancels "
              : "Closing this slot cancels "}
            {confirming.affected
              .map(
                ({ session, name }) =>
                  `${name}'s booking on ${formatDate(session.date, { weekday: true })}`,
              )
              .join(", ")}
            . It counts as a mentor cancellation.{" "}
            {otherOpenings
              ? "The founder is offered your next open times."
              : "You have no other open times, so the founder is told to find another mentor."}
          </p>
          {/* (Nov 22, round 2) Keeping the booking is the safe default and
              takes focus; cancelling it uses the danger style. */}
          <div className="mentor-request-controls">
            <button
              className="btn small"
              autoFocus
              disabled={state.busy}
              onClick={() => setConfirming(null)}
            >
              {skipping ? "Keep date" : "Keep slot"}
            </button>
            <button
              className="btn small danger"
              disabled={state.busy}
              onClick={async (event) => {
                await change(confirming.action, event);
                setConfirming(null);
              }}
            >
              {state.busy && <span className="spinner" aria-hidden="true" />}
              {skipping
                ? "Skip date and cancel booking"
                : "Close slot and cancel booking"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mentor-request-controls">
          <button
            className="btn small"
            disabled={state.busy}
            onClick={(event) => request("close-office-slot", event)}
          >
            Close slot
          </button>
        </div>
      )}
      {slot.recurring && !confirming && (
        <form
          className="mentor-request-form"
          onSubmit={(event) => request("skip-office-date", event)}
        >
          <label htmlFor={`skip-${slot.id}`}>Skip one date</label>
          <input
            id={`skip-${slot.id}`}
            type="date"
            min={slot.date > today ? slot.date : today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
          <button className="btn small" disabled={state.busy}>
            Skip date
          </button>
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
  // A slot that would close another format waits for the mentor's go-ahead.
  // (Nov 22, round 2) The server answers with `officeSlotCheck` instead of an
  // error, so no error alert or failed request appears.
  const [pending, setPending] = useState(null);
  const slots = profile.officeHours || [];
  // With a slot open, the form waits behind "Open another slot".
  const [adding, setAdding] = useState(false);
  const showForm = offers && (slots.length === 0 || adding);
  const another = useRef(null);
  const warning =
    pending?.sent &&
    state.officeSlotCheck?.reason === "closes-formats" &&
    state.officeSlotCheck.message;
  const open = async (values, event, form) => {
    const success = await onAction(
      { action: "open-office-slot", values },
      event,
    );
    setPending(success ? { values, form, sent: true } : null);
  };
  // A successful answer either opened the slot or asks to confirm first.
  useEffect(() => {
    if (pending?.sent && !state.officeSlotCheck) {
      pending.form?.reset();
      setPending(null);
      // The new slot joins the list and the form folds away again.
      setAdding(false);
      requestAnimationFrame(() => another.current?.focus());
    }
  }, [pending, state.officeSlotCheck]);
  const submit = (event) => {
    const form = event.currentTarget;
    open(Object.fromEntries(new FormData(form)), event, form);
  };
  const today = localDateKey(new Date());
  const openings = state.mentorOfficeOpenings || [];
  const nextOpening = [...openings].sort((a, b) => a.instant - b.instant)[0];
  return (
    <section
      className="card panel section-gap"
      aria-labelledby="office-hours-title"
      id="office-hours"
    >
      <h2 id="office-hours-title" tabIndex={-1}>
        Office Hours
      </h2>
      <p className="muted office-hours-intro">
        Optional. Open drop-in times that founders can book with you.
      </p>
      {slots.map((slot) => (
        <OfficeSlot
          key={slot.id}
          slot={slot}
          otherOpenings={
            !profile.paused &&
            openings.some((opening) => opening.slotId !== slot.id)
          }
        />
      ))}
      {offers && !showForm && (
        <button
          ref={another}
          type="button"
          className="btn office-hours-add"
          onClick={() => setAdding(true)}
        >
          <Icon name="plus" /> Open another slot
        </button>
      )}
      {showForm ? (
        <form className="mentor-request-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="office-date">First date</label>
            <input
              type="date"
              name="date"
              id="office-date"
              min={today}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="office-time">
              Start time ({timeZoneLabel(profile.timeZone)})
            </label>
            <input type="time" name="time" id="office-time" required />
          </div>
          <div className="field">
            <label htmlFor="office-duration">Duration</label>
            <SelectField
              name="durationMinutes"
              id="office-duration"
              defaultValue="30"
            >
              {[15, 30, 45, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </SelectField>
          </div>
          <label>
            <input type="checkbox" name="recurring" /> Repeat weekly
          </label>
          {warning ? (
            <div className="office-slot-confirm" role="alert">
              <p>{warning}</p>
              <div className="mentor-request-controls">
                <button
                  type="button"
                  className="btn primary"
                  disabled={state.busy}
                  onClick={(event) =>
                    open(
                      { ...pending.values, confirmClosing: true },
                      event,
                      pending.form,
                    )
                  }
                >
                  Open slot anyway
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={state.busy}
                  onClick={() => setPending(null)}
                >
                  Change the slot
                </button>
              </div>
            </div>
          ) : (
            <div className="mentor-request-controls">
              <button className="btn" disabled={state.busy}>
                {state.busy && <span className="spinner" aria-hidden="true" />}
                {state.busy ? "Saving…" : "Open slot"}
              </button>
              {slots.length > 0 && (
                <button
                  type="button"
                  className="btn"
                  disabled={state.busy}
                  onClick={() => {
                    setAdding(false);
                    requestAnimationFrame(() => another.current?.focus());
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </form>
      ) : offers ? null : (
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
          <SelectField
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
          </SelectField>
          <label htmlFor="preferred-time">
            Preferred time ({timeZoneLabel(profile.timeZone)})
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
      {state.prototypeMentor && nextOpening && (
        <PrototypeShortcut
          note={`No real founder books in this preview. Simulate a sample founder booking your next open slot, ${scheduleLabel(nextOpening)}.`}
        >
          <button
            className="btn small"
            disabled={state.busy}
            onClick={(event) =>
              onAction(
                {
                  action: "simulate-office-booking",
                  values: { occurrenceId: nextOpening.id },
                },
                event,
              )
            }
          >
            {state.busy ? "Booking…" : "Simulate a founder booking this slot"}
          </button>
        </PrototypeShortcut>
      )}
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
  // "Copied" shows on the button for a moment; if the browser refuses the
  // clipboard, the link is selected so it can be copied by hand.
  const [copied, setCopied] = useState(false);
  const input = useRef(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(input.current.value);
      setCopied(true);
    } catch {
      input.current.select();
    }
  };
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
    <section
      className="card panel section-gap calendar-feed"
      aria-labelledby="calendar-feed-title"
    >
      <h2 id="calendar-feed-title">Calendar subscription</h2>
      <p className="calendar-feed-intro">
        Subscribe to this private link in Google Calendar, Outlook or Apple
        Calendar to see your sessions and deadlines there.
      </p>
      {path ? (
        <>
          <div className="field">
            <label htmlFor="private-calendar-link">Private calendar link</label>
            <div className="calendar-feed-row">
              <input
                ref={input}
                id="private-calendar-link"
                type="url"
                value={new URL(path, location.origin).href}
                readOnly
                aria-describedby="calendar-feed-help"
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className={`btn calendar-feed-copy${copied ? " is-copied" : ""}`}
                onClick={copy}
              >
                <Icon name={copied ? "check" : "calendar"} />
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <p className="field-help" id="calendar-feed-help">
              Anyone with this link can see your calendar. Reset it to stop the
              old link working.
            </p>
          </div>
          <button
            type="button"
            className="link-btn calendar-feed-reset"
            disabled={state.busy}
            onClick={(event) => refresh(true, event)}
          >
            {pending && <span className="spinner" aria-hidden="true" />}
            Reset link
          </button>
          <span className="visually-hidden" role="status">
            {copied ? "Calendar link copied." : ""}
          </span>
        </>
      ) : (
        <button
          className="btn"
          disabled={state.busy}
          onClick={(event) => refresh(false, event)}
        >
          {pending && <span className="spinner" aria-hidden="true" />}
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
          <SelectField
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
          </SelectField>
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
          <button className="btn primary" disabled={state.busy}>
            {state.busy ? "Booking…" : "Book Office Hours"}
          </button>
        </form>
      )}
    </section>
  );
}
