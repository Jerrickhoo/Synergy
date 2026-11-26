import { createContext, useContext, useEffect, useRef, useState } from "react";
import { CheckoutPanel } from "./Payments.jsx";
import LinkedText from "./LinkedText.jsx";
import { priceLabel } from "../data/pricing.js";
import { useApp } from "../state/AppContext.jsx";
import { CalendarFeed } from "./OfficeHours.jsx";
import PageHeader from "./PageHeader.jsx";
import TaskBoard from "./TaskBoard.jsx";
import ChatPanel from "./ChatPanel.jsx";
import BlockCollaborator from "./BlockCollaborator.jsx";
import ReportCollaborator from "./ReportCollaborator.jsx";
import Icon from "./Icon.jsx";
import Overlay from "./Overlay.jsx";
import PrototypeShortcut from "./PrototypeShortcut.jsx";
import RatingScale from "./RatingScale.jsx";
import { mentorFormat } from "../data/mentor-formats.js";
import {
  attendanceOpen,
  awaitingPayment,
  dayMs,
  followupEngagement,
  followupTasks,
  closedRoomText,
  goalMilestone,
  mentorSessions,
  mentorshipNextAction,
  reviewCategories,
  stageMarks,
  noteSessions,
  roomFormat,
} from "../data/mentor-room.js";
import { scheduleInstant, scheduleLabel } from "../data/selectors.js";
import { roomStep } from "../data/room-progress.js";
import { formatDate, timeZoneLabel } from "../data/dates.js";
import SelectField from "./SelectField.jsx";
import FilePicker from "./FilePicker.jsx";

const reports = {
  held: "Session held",
  "partner-absent": "My partner missed it",
  "i-missed": "I missed it",
};
const outcomes = {
  held: "Held",
  "no-show-mentor": "Mentor missed it",
  "no-show-founder": "Founder missed it",
  "no-show-both": "Both participants missed it",
  disputed: "Attendance under review",
};

// Room forms share their error scope with their fields, which show any error
// for themselves inline.
const RoomFormScope = createContext("");

// Ending a mentorship is one red button; the reason is asked in a dialog
// before anything ends.
function EndMentorship() {
  const { state } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div className="end-mentorship">
      <button
        type="button"
        className="btn end-mentorship-btn"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        End mentorship
      </button>
      {open && (
        <Overlay
          id="end-mentorship"
          title="End this mentorship?"
          onClose={() => setOpen(false)}
          busy={state.busy}
          initialFocusSelector="#end-mentorship [name=reason]"
        >
          <p>
            This closes the mentorship for both of you. Your partner sees the
            reason you give.
          </p>
          <RoomForm
            command={{ action: "end-mentorship" }}
            label="End mentorship"
            fields={
              <RoomField
                name="reason"
                label="Reason for ending"
                required
                maxLength={300}
              />
            }
          />
        </Overlay>
      )}
    </div>
  );
}

function RoomForm({
  command,
  fields,
  label,
  reset = false,
  disabled = false,
  primary = false,
}) {
  const { onAction, onSubmit, state } = useApp();
  return (
    <form
      data-form={command.form || command.action}
      data-id={command.id}
      className="mentor-request-form"
      onSubmit={async (event) => {
        const form = event.currentTarget;
        const success = command.form
          ? await onSubmit(event)
          : await onAction(
              {
                ...command,
                values: {
                  ...Object.fromEntries(new FormData(form)),
                  ...command.values,
                },
              },
              event,
            );
        if (success && reset) form.reset();
      }}
    >
      <RoomFormScope.Provider value={command.form || command.action}>
        {fields}
      </RoomFormScope.Provider>
      <button
        className={primary ? "btn primary" : "btn"}
        disabled={state.busy || disabled}
      >
        {state.busy ? "Saving…" : label}
      </button>
    </form>
  );
}

function RoomAction({ action, children, values, disabled }) {
  const { state, onAction } = useApp();
  return (
    <button
      className="btn"
      disabled={state.busy || disabled}
      onClick={(event) => onAction({ action, values }, event)}
    >
      {children}
    </button>
  );
}

// Prototype only: the next booked session or check-in with a fictional
// partner can take place now, so either side can try follow-up and reviews
// in one sitting.
function SimulateSessionHeld({ room, closed, partner }) {
  const format = roomFormat(room);
  const sessions = mentorSessions(room);
  if (
    closed ||
    !partner?.prototypePartner ||
    !mentorFormat(format).sync ||
    !sessions.some((session) => !session.cancelledAt && !session.outcome)
  )
    return null;
  const advisory = format === "ongoing-advisory";
  const fictional = `${partner.name} is a fictional ${room.role === "founder" ? "mentor" : "founder"}.`;
  const note = advisory
    ? `${fictional} Simulate each check-in taking place. After all ${sessions.length}, the cycle review opens.`
    : format === "single-session" && room.role === "mentor"
      ? `${fictional} Simulate the session taking place; they share a follow-up so you can try reviews.`
      : format === "single-session"
        ? `${fictional} Simulate the session taking place to try follow-up and reviews.`
        : `${fictional} Simulate the session taking place to try reviews.`;
  return (
    <PrototypeShortcut note={note}>
      <RoomAction action="simulate-session-held">
        {advisory
          ? "Simulate the next check-in taking place"
          : "Simulate the session taking place"}
      </RoomAction>
    </PrototypeShortcut>
  );
}

function RoomField({
  name,
  label,
  id = name,
  value,
  required = false,
  type = "textarea",
  maxLength = 3000,
}) {
  const { state } = useApp();
  const scope = useContext(RoomFormScope);
  const error =
    scope && state.formErrors?.scope === scope
      ? state.formErrors.fields?.[name]
      : "";
  const invalid = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {type === "textarea" ? (
        <textarea
          name={name}
          id={id}
          defaultValue={value}
          maxLength={maxLength}
          required={required}
          {...invalid}
        />
      ) : (
        <input
          name={name}
          id={id}
          type={type}
          defaultValue={value}
          required={required}
          {...invalid}
        />
      )}
      {error && (
        <p id={`${id}-error`} className="field-help field-error">
          {error}
        </p>
      )}
    </div>
  );
}

function EvidenceList({ items = [] }) {
  const { downloadFile } = useApp();
  return (
    items.length > 0 && (
      <ul>
        {items.map((item, index) => (
          <li key={item.file?.id || index}>
            {item.file ? (
              <button
                className="link-btn"
                onClick={() => downloadFile(item.file)}
              >
                Download {item.file.name}
              </button>
            ) : (
              item.label
            )}
          </li>
        ))}
      </ul>
    )
  );
}

function PrepChecklist({ room, closed, doc = false }) {
  const { onUpload, state } = useApp();
  const prep = room.mentorship.prep;
  const shared = doc ? room.milestones.uploaded?.attachment : prep?.sharedAt;
  const upcoming = mentorSessions(room)
    .filter((session) => !session.cancelledAt && !session.outcome)
    .map((session) => scheduleInstant(session).getTime())
    .filter((instant) => instant > Date.now())
    .sort((a, b) => a - b)[0];
  const noticeHours = state.mentorConfig?.lateNoticeHours || 24;
  const lateNotice = noticeHours * 3600000;
  // A session can be booked sooner than 24 hours ahead; the ask then is
  // "as soon as you can", not a deadline that has already passed.
  const prepAdvice = !upcoming
    ? "Share your deck, metrics and links before your session."
    : upcoming - Date.now() < lateNotice
      ? `Your session starts ${scheduleLabel(new Date(upcoming))}. Share your deck, metrics and links as soon as you can.`
      : `Share your deck, metrics and links by ${scheduleLabel(new Date(upcoming - lateNotice))}, ${noticeHours} hours before the session.`;
  return (
    <section className="card panel" id="room-prep">
      <h2>{doc ? "Review materials" : "Session prep"}</h2>
      {/* While a payment is due, the line below already says prep waits. */}
      {!(room.role === "founder" && !shared && awaitingPayment(room)) && (
        <p>{shared ? "Prep shared" : "Prep not shared yet"}</p>
      )}
      {prep && (
        <dl className="mentor-request-answers">
          {["deck", "metrics", "links"]
            .filter((key) => prep[key])
            .map((key) => (
              <div key={key}>
                <dt>
                  {key === "deck"
                    ? "Deck"
                    : key === "metrics"
                      ? "Metrics"
                      : "Links"}
                </dt>
                <dd className="preserve-lines">
                  <LinkedText text={prep[key]} />
                </dd>
              </div>
            ))}
        </dl>
      )}
      <EvidenceList
        items={
          doc
            ? room.milestones.uploaded?.evidenceItems
            : room.mentorship.prepFiles
        }
      />
      {room.role === "founder" && !closed && awaitingPayment(room) && (
        <p>
          {doc
            ? "Share your document here once your payment goes through."
            : "Share your deck, metrics and links here once your payment goes through."}
        </p>
      )}
      {room.role === "founder" && !closed && !awaitingPayment(room) && (
        <>
          {!doc && <p>{prepAdvice}</p>}
          <form
            className="mentor-request-form"
            data-id={doc ? "uploaded" : "prep"}
            onSubmit={onUpload}
          >
            <div className="field">
              <label htmlFor="mentorship-file">
                {doc ? "Document file" : "Prep file"}
              </label>
              <FilePicker id="mentorship-file" required disabled={state.busy} />
            </div>
            <button className="btn small" disabled={state.busy}>
              Upload file
            </button>
          </form>
          {doc ? (
            <RoomForm
              command={{ form: "evidence", id: "uploaded" }}
              fields={
                <RoomField name="attachment" label="Document link" required />
              }
              label="Share document link"
              reset
            />
          ) : (
            <RoomForm
              command={{ form: "prep-checklist" }}
              fields={
                <>
                  <RoomField name="deck" label="Deck" value={prep?.deck} />
                  <RoomField
                    name="metrics"
                    label="Metrics"
                    value={prep?.metrics}
                  />
                  <RoomField name="links" label="Links" value={prep?.links} />
                </>
              }
              label="Share preparation"
              primary={!shared}
            />
          )}
        </>
      )}
    </section>
  );
}

function SessionNotes({ room, closed, partner }) {
  const [editing, setEditing] = useState("");
  const sessions = mentorSessions(room);
  const history = noteSessions(room);
  return (
    <section className="card panel">
      <h2>Shared notes</h2>
      {!room.notes?.length && <p>No session notes yet.</p>}
      {room.notes?.map((note) => {
        const session = note.sessionId
          ? history.find(({ id }) => id === note.sessionId)
          : sessions[note.sessionIndex];
        return (
          <article key={note.id}>
            <h3>
              {note.authorRole === "mentor" ? "Mentor" : "Founder"} ·{" "}
              {formatDate(note.at)}
            </h3>
            {session && (
              <p className="muted">Session {scheduleLabel(session)}</p>
            )}
            {editing === note.id ? (
              <RoomForm
                command={{ form: "session-note", id: note.id }}
                label="Save edit"
                fields={
                  <RoomField
                    name="text"
                    label="Edit session note"
                    id={`edit-note-${note.id}`}
                    value={note.text}
                    required
                  />
                }
              />
            ) : (
              <div>
                <p className="preserve-lines">{note.text}</p>
                {note.authorRole !== room.role &&
                  note.safetyFlags?.length > 0 && (
                    <ReportCollaborator person={partner} compact />
                  )}
              </div>
            )}
            {!closed &&
              note.authorRole === room.role &&
              Date.now() < Date.parse(note.at) + dayMs && (
                <button
                  className="btn small"
                  onClick={() => setEditing(editing === note.id ? "" : note.id)}
                >
                  {editing === note.id ? "Close editor" : "Edit note"}
                </button>
              )}
          </article>
        );
      })}
      {!closed && (
        <RoomForm
          command={{ form: "session-note" }}
          label="Add note"
          reset
          fields={
            <>
              {history.some(({ id }) => id) && (
                <div className="field">
                  <label htmlFor="note-session">Session</label>
                  <SelectField id="note-session" name="sessionId">
                    <option value="">General note</option>
                    {history
                      .filter(({ id }) => id)
                      .map((session) => (
                        <option key={session.id} value={session.id}>
                          {scheduleLabel(session)}
                        </option>
                      ))}
                  </SelectField>
                </div>
              )}
              <RoomField name="text" label="New session note" required />
            </>
          }
        />
      )}
    </section>
  );
}

function FollowupForm({ room }) {
  const followup = followupEngagement(room)?.followup;
  if (!followup) return null;
  const ready = Date.parse(followup.availableAt) <= Date.now();
  return (
    <section className="card panel" id="room-followup">
      <h2>Founder follow-up</h2>
      {followup.submittedAt ? (
        <p>{followup.summary || "Action item outcomes submitted."}</p>
      ) : ready ? (
        <p>
          {followup.overdue || Date.parse(followup.overdueAt) <= Date.now()
            ? "Follow-up is overdue. Submit it to restore your full request limit."
            : "Share what happened after the session."}
        </p>
      ) : (
        <p>Opens {formatDate(followup.availableAt)}.</p>
      )}
      {ready && !followup.submittedAt && room.role === "founder" && (
        <RoomForm
          command={{ action: "submit-followup" }}
          label="Submit follow-up"
          primary
          fields={
            <>
              {followupTasks(room, followup).map((task) => (
                <div className="field" key={task.id}>
                  <label htmlFor={`followup-${task.id}`}>{task.title}</label>
                  <SelectField
                    id={`followup-${task.id}`}
                    name={task.id}
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      Choose outcome
                    </option>
                    <option value="done">Done</option>
                    <option value="in-progress">In progress</option>
                    <option value="did-not-do">Didn't do</option>
                  </SelectField>
                </div>
              ))}
              <RoomField
                name="summary"
                label="What happened? (optional)"
                maxLength={280}
              />
              <label>
                <input type="checkbox" name="shareable" /> Share this outcome on
                the mentor's Impact Profile
              </label>
            </>
          }
        />
      )}
      {followup.submittedAt && (
        <ul>
          {Object.entries(followup.outcomes || {}).map(([id, status]) => (
            <li key={id}>
              {room.tasks?.find((item) => item.id === id)?.title ||
                "Action item"}{" "}
              ·{" "}
              {
                {
                  done: "Done",
                  "in-progress": "In progress",
                  "did-not-do": "Didn't do",
                }[status]
              }
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AdvisoryCycle({ room, partner }) {
  const { state } = useApp();
  const cycle = room.cycle;
  if (!cycle) return null;
  const mine = cycle.reviews?.[state.accountId];
  const theirs = cycle.reviews?.[room.partnerAccountId];
  // Prototype only: after this person's own review, a fictional partner can
  // review the cycle too, and agree when this person chose Continue.
  const reviewDue = mine && !theirs && !cycle.reviewWindowClosed;
  const continueDue =
    cycle.decisions?.[state.accountId] === "continue" &&
    !cycle.decisions?.[room.partnerAccountId];
  const other = room.role === "founder" ? "mentor" : "founder";
  const simulateCycle =
    partner?.prototypePartner &&
    room.status !== "reviewed" &&
    cycle.phase === "review" &&
    (reviewDue || continueDue);
  return (
    <section className="card panel mentor-requests-list">
      <h2>Mentorship cycle {cycle.number}</h2>
      <p>
        {cycle.checkIns} check-ins · ends {formatDate(cycle.dueAt)}
      </p>
      {cycle.phase === "review" &&
        !mine &&
        !cycle.reviewWindowClosed &&
        !room.review.windowClosed && (
          <RoomForm
            command={{ form: "cycle-review" }}
            label="Submit private cycle review"
            fields={
              <>
                {reviewCategories(room, Date.now(), { cycle: true }).map(
                  (category) => (
                    <RatingScale
                      key={category.id}
                      category={category}
                      idPrefix="cycle-rating"
                    />
                  ),
                )}
                <RoomField
                  name="note"
                  id="cycle-note"
                  label="Cycle review note"
                />
              </>
            }
          />
        )}
      {mine && (
        <p>
          Your private rating {mine.rating}/5 · {mine.note}
        </p>
      )}
      {theirs && (
        <p>
          Partner's rating {theirs.rating}/5 · {theirs.note}
          {theirs.simulated && " (simulated)"}
        </p>
      )}
      {simulateCycle && (
        <PrototypeShortcut
          note={
            reviewDue
              ? `${partner.name} is a fictional ${other}. Simulate their private cycle review${continueDue ? " and their agreement to continue" : ""}.`
              : `${partner.name} is a fictional ${other}. Simulate them agreeing to continue.`
          }
        >
          <RoomAction action="simulate-cycle-review">
            {reviewDue
              ? `Simulate ${other}'s cycle review`
              : `Simulate ${other} agreeing to continue`}
          </RoomAction>
        </PrototypeShortcut>
      )}
      {(mine || cycle.reviewWindowClosed) && !room.mentorship.endedAt && (
        <div className="mentor-request-controls">
          {room.nextCyclePrice > 0 && (
            <p>Next cycle {priceLabel(room.nextCyclePrice)}</p>
          )}
          <RoomAction
            action="cycle-decision"
            values={{
              decision: "continue",
              acceptedPrice: room.nextCyclePrice || 0,
            }}
          >
            Continue
          </RoomAction>
          <RoomAction action="cycle-decision" values={{ decision: "finish" }}>
            Finish
          </RoomAction>
        </div>
      )}
      {room.cycleHistory?.map((previous) => (
        <details key={previous.number}>
          <summary>Cycle {previous.number} history</summary>
          <p>{previous.goals}</p>
          <p>{previous.summary}</p>
        </details>
      ))}
    </section>
  );
}

function Upgrade({ room, partner }) {
  const format = mentorFormat(roomFormat(room));
  const proposal = room.mentorship.upgrade;
  if (
    !format.upgradeTo.length ||
    (!room.mentorship.deliveredAt && !room.milestones.held?.me) ||
    room.status === "cancelled"
  )
    return null;
  return (
    <section className="card panel">
      <h2>Continue mentoring</h2>
      {proposal ? (
        <>
          <p>
            Upgrade to {mentorFormat(proposal.format)?.label}. Expires{" "}
            {formatDate(proposal.expiresAt)}.
          </p>
          {proposal.proposedBy !== room.role ? (
            <div className="mentor-request-controls">
              <RoomAction action="accept-upgrade">Accept upgrade</RoomAction>
              <RoomAction action="decline-upgrade">Decline upgrade</RoomAction>
            </div>
          ) : // Prototype only: a fictional partner never answers, so their
          // answer can be simulated.
          partner?.prototypePartner ? (
            <PrototypeShortcut
              note={`${partner.name} is a fictional ${room.role === "founder" ? "mentor" : "founder"}. Simulate their answer to your upgrade.`}
            >
              <div className="mentor-request-controls">
                <RoomAction action="simulate-upgrade-acceptance">
                  Simulate acceptance
                </RoomAction>
                <RoomAction action="simulate-upgrade-decline">
                  Simulate decline
                </RoomAction>
              </div>
            </PrototypeShortcut>
          ) : (
            <p>Waiting for your partner to reply.</p>
          )}
        </>
      ) : (
        <RoomForm
          command={{ action: "propose-upgrade" }}
          label="Propose upgrade"
          fields={
            <div className="field">
              <label htmlFor="upgrade-format">Next format</label>
              <SelectField id="upgrade-format" name="format">
                {format.upgradeTo.map((id) => (
                  <option key={id} value={id}>
                    {mentorFormat(id).label}
                  </option>
                ))}
              </SelectField>
            </div>
          }
        />
      )}
    </section>
  );
}

function Schedule({ room, closed, partner }) {
  const { state, onAction } = useApp();
  const sessions = mentorSessions(room);
  const format = roomFormat(room);
  const goal = room.milestones[goalMilestone(room)]?.me;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dateTime = (prefix) => (
    <>
      <RoomField
        name="date"
        id={`${prefix}-date`}
        type="date"
        label="Date"
        required
      />
      <RoomField
        name="time"
        id={`${prefix}-time`}
        type="time"
        label="Time"
        required
      />
      <input type="hidden" name="timeZone" value={zone} />
      <p className="field-help">{timeZoneLabel(zone)}</p>
    </>
  );
  const timeSuggestions = [
    ...(room.officeHoursSuggestions || []),
    ...(room.preferredHoursSuggestions || []),
  ];
  const scheduleActive = sessions.some(
    (session) => !session.cancelledAt && !session.outcome,
  );
  return (
    <section className="card panel mentor-requests-list" id="room-schedule">
      <h2>Schedule</h2>
      {!sessions.length && (
        <p>
          {!goal && !closed && format === "single-session"
            ? room.role === "founder"
              ? `You can pick a time once ${partner?.name || "your mentor"} confirms the goal.`
              : "Confirm the goal on Overview, then pick a time together."
            : "No sessions scheduled yet."}
        </p>
      )}
      {room.cycle?.confirmedSimulated && (
        <p className="field-help">
          Check-in time confirmed in a prototype simulation.
        </p>
      )}
      {/* Prototype only: a fictional founder never books another slot after
          the mentor cancels, so the booking can be simulated. */}
      {!closed &&
        room.role === "mentor" &&
        partner?.prototypePartner &&
        format === "office-hours" &&
        room.mentorship.slotReleased &&
        !room.milestones.held?.me &&
        (() => {
          const [next] = [...(state.mentorOfficeOpenings || [])].sort(
            (a, b) => a.instant - b.instant,
          );
          return next ? (
            <PrototypeShortcut
              note={`${partner.name} is a fictional founder. Simulate them booking your next open slot, ${scheduleLabel(next)}.`}
            >
              <RoomAction action="simulate-office-rebooking">
                Simulate founder booking another slot
              </RoomAction>
            </PrototypeShortcut>
          ) : (
            <PrototypeShortcut
              note={`${partner.name} is a fictional founder. Open a slot in Calendar, then simulate them booking it.`}
            >
              <button
                className="btn small"
                onClick={() => onAction({ page: "calendar" })}
              >
                Open Calendar
              </button>
            </PrototypeShortcut>
          );
        })()}
      {!closed &&
        room.role === "founder" &&
        format === "office-hours" &&
        room.mentorship.slotReleased &&
        !room.milestones.held?.me && (
          <div>
            <h3>Choose another Office Hours slot</h3>
            {room.officeHoursSuggestions?.length ? (
              room.officeHoursSuggestions.slice(0, 5).map((slot) => (
                <p key={slot.id}>
                  <RoomAction
                    action="rebook-office-slot"
                    values={{
                      slotId: slot.slotId,
                      date: slot.date,
                    }}
                  >
                    Book {scheduleLabel(slot)}
                  </RoomAction>
                </p>
              ))
            ) : (
              <p>No replacement slots are currently available.</p>
            )}
          </div>
        )}
      {/* (Nov 22, round 2) The times show under their heading, named for
          the viewer; with no times there is no heading. */}
      {timeSuggestions.length > 0 && format !== "office-hours" && !closed && (
        <div>
          <h3>
            {room.role === "mentor"
              ? "Your open times"
              : `Times ${partner?.name || "your mentor"} is available`}
          </h3>
          <ul>
            {timeSuggestions.slice(0, 5).map((slot) => (
              <li key={slot.id}>{scheduleLabel(slot)}</li>
            ))}
          </ul>
        </div>
      )}
      {sessions.map((session, index) => {
        const future = scheduleInstant(session).getTime() > Date.now();
        const open = !closed && !session.outcome && !session.cancelledAt;
        const retry =
          !closed &&
          format === "ongoing-advisory" &&
          room.cycle?.phase === "active" &&
          (session.cancelledAt || session.outcome?.startsWith("no-show-"));
        const values = { scheduleIndex: index, scheduleId: session.id };
        const partnerZone =
          room.mentorship[
            room.role === "founder" ? "mentorTimeZone" : "founderTimeZone"
          ] || session.timeZone;
        return (
          <article className="mentor-session" key={session.id || index}>
            <h3>{scheduleLabel(session)}</h3>
            <p>
              {session.durationMinutes} minutes ·{" "}
              {session.simulated && session.outcome === "held"
                ? "Held in a prototype simulation"
                : outcomes[session.outcome] ||
                  (session.cancelledAt ? "Cancelled" : "Scheduled")}
            </p>
            {!session.cancelledAt && (
              <CalendarFeed room={room} session={session} />
            )}
            {partnerZone !== zone && (
              <p className="field-help">
                Their time:{" "}
                {scheduleLabel(session, { zone: partnerZone, showZone: true })}
              </p>
            )}
            {((open && future) || retry) && (
              <details>
                <summary>
                  {retry ? "Reschedule check-in" : "Reschedule or cancel"}
                </summary>
                <RoomForm
                  command={{ action: "reschedule-session", values }}
                  label="Reschedule session"
                  fields={dateTime(`reschedule-${index}`)}
                />
                {!retry && (
                  <RoomForm
                    command={{ action: "cancel-session", values }}
                    label="Cancel session"
                    fields={
                      <RoomField
                        name="reason"
                        id={`cancel-${index}`}
                        label="Cancellation reason"
                        required
                        maxLength={280}
                      />
                    }
                  />
                )}
              </details>
            )}
            {!closed && attendanceOpen(session, room.role) && (
              <RoomForm
                command={{ action: "report-attendance", values }}
                label="Report attendance"
                fields={
                  <label>
                    What happened?
                    <SelectField name="status">
                      {Object.entries(reports).map(([status, label]) => (
                        <option key={status} value={status}>
                          {label}
                        </option>
                      ))}
                    </SelectField>
                  </label>
                }
              />
            )}
            {open && session.attendance?.[room.role] && (
              <p>Your attendance report is saved.</p>
            )}
          </article>
        );
      })}
      <SimulateSessionHeld room={room} closed={closed} partner={partner} />
      {!closed &&
        goal &&
        !scheduleActive &&
        format === "single-session" &&
        !room.milestones.held?.me && (
          <RoomForm
            command={{ form: "schedule" }}
            label="Schedule session"
            fields={
              <>
                {dateTime("single-session")}
                <div className="field">
                  <label htmlFor="session-duration">Duration</label>
                  <SelectField
                    id="session-duration"
                    name="durationMinutes"
                    defaultValue="60"
                  >
                    {[15, 30, 45, 60].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutes
                      </option>
                    ))}
                  </SelectField>
                </div>
              </>
            }
          />
        )}
      {!closed &&
        format === "ongoing-advisory" &&
        goal &&
        !room.cycle?.confirmedAt &&
        room.cycle?.phase === "active" &&
        (() => {
          // (Nov 22, round 2) The founder proposes; the mentor confirms or
          // suggests another time, which the founder then confirms.
          const proposal = room.cycle.proposedTime;
          const proposedBy = proposal && (proposal.proposedBy || "founder");
          const other =
            partner?.name ||
            (room.role === "founder" ? "your mentor" : "the founder");
          if (!proposal && room.role === "mentor")
            return partner?.prototypePartner ? (
              <PrototypeShortcut
                note={`${partner.name} is a fictional founder. Simulate them proposing the first check-in time, then confirm it.`}
              >
                <RoomAction action="simulate-check-in-proposal">
                  Simulate founder proposing a check-in time
                </RoomAction>
              </PrototypeShortcut>
            ) : (
              <p>Waiting for the founder to propose a check-in time.</p>
            );
          if (!proposal)
            return (
              <RoomForm
                command={{ form: "propose-check-in-time" }}
                label="Propose regular check-in time"
                fields={
                  <>
                    <p>Choose the date and time of the first check-in.</p>
                    {dateTime("check-in")}
                  </>
                }
              />
            );
          const suggest = (
            <details>
              <summary>Suggest another time</summary>
              <RoomForm
                command={{ form: "propose-check-in-time" }}
                label="Send suggested time"
                fields={
                  <>
                    <p>
                      {other} confirms your time, and it sets the cycle's
                      check-ins.
                    </p>
                    {dateTime("suggest-check-in")}
                  </>
                }
              />
            </details>
          );
          return proposedBy === room.role ? (
            <>
              <p>
                You proposed {scheduleLabel(proposal)} for the first check-in.
                Waiting for {other} to confirm.
              </p>
              {room.role === "founder" && partner?.prototypePartner && (
                <PrototypeShortcut
                  note={`${partner.name} is a fictional mentor. Simulate them confirming this time; it books all ${room.cycle.checkIns} check-ins.`}
                >
                  <RoomAction action="simulate-check-in-confirmation">
                    Simulate mentor confirming the check-in time
                  </RoomAction>
                </PrototypeShortcut>
              )}
              {suggest}
            </>
          ) : (
            <>
              <p>
                {proposedBy === "mentor" ? `${other} suggested` : "Proposed"}{" "}
                first check-in {scheduleLabel(proposal)}.
              </p>
              <RoomAction action="confirm-check-in-time">
                Confirm check-in time
              </RoomAction>
              {suggest}
            </>
          );
        })()}
    </section>
  );
}

export default function MentorshipRoom({ room }) {
  const { state, model, onAction, onTabKeyDown } = useApp();
  const partner = model
    .allPeople()
    .find((person) => person.id === room.partnerId);
  const format = mentorFormat(roomFormat(room));
  const info = room.mentorship;
  const closed = ["launched", "reviewed", "cancelled"].includes(room.status);
  // Prep is for the session ahead: once a one-off session is held, the next
  // step is the follow-up. Ongoing Advisory keeps prep open between check-ins.
  const prepOver =
    format.sync &&
    format.id !== "ongoing-advisory" &&
    Boolean(room.milestones.held?.me);
  const next = mentorshipNextAction(room);
  // Prototype only: a fictional partner never answers chat or action items.
  const fictionalNote = partner?.prototypePartner ? (
    <PrototypeShortcut
      note={`${partner.name} is fictional and won't reply here.`}
    />
  ) : null;
  // The next-step button opens the step's tab, then brings its section into
  // view and focuses its first control.
  const goToStep = async (step) => {
    if (step.tab && step.tab !== tab)
      await onAction({ action: "room-tab", tab: step.tab });
    requestAnimationFrame(() =>
      setTimeout(() => {
        const target = step.target && document.getElementById(step.target);
        if (!target) return;
        const reduce = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        target.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "start",
        });
        target
          .querySelector(
            "textarea, input:not([type=hidden]), [role=combobox], select, button",
          )
          ?.focus({ preventScroll: true });
      }, 0),
    );
  };
  // When an action hands the viewer a new step (for example a review after
  // the follow-up), bring the next-step line back into view.
  const lastStep = useRef(next.text);
  useEffect(() => {
    if (lastStep.current === next.text) return;
    lastStep.current = next.text;
    if (!next.mine && !next.review) return;
    const line = document.querySelector(".room-next-step");
    if (!line || line.getBoundingClientRect().top >= 0) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    line.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "center",
    });
  }, [next.text, next.mine, next.review]);
  const goalItem = room.milestones[goalMilestone(room)];
  const goalConfirmed = Boolean(goalItem?.me || goalItem?.partner);
  const tabs = [
    ["overview", "Overview"],
    ...(format.sync ? [["schedule", "Schedule"]] : []),
    ["notes", "Notes"],
    ["tasks", "Action items"],
    ["chat", "Chat"],
  ];
  const tab = tabs.find(([id]) => id === state.roomTab)?.[0] || "overview";
  return (
    <div className="page room-detail-page page-enter">
      <PageHeader
        title="Mentorship room"
        intro={`${format.label} with ${partner?.name || "your collaborator"}`}
        actions={
          <button
            className="btn"
            onClick={() =>
              onAction({ page: state.role === "mentor" ? "mentees" : "rooms" })
            }
          >
            <Icon name="back" /> All rooms
          </button>
        }
      />
      {/* Same progress line as a Deal Room (readiness plan F5). */}
      {/* The step count shows at every width; the step's name only on
          small screens, where it stands in for the stage line. */}
      <p className="stage-compact" aria-hidden="true">
        {(() => {
          const step = roomStep(room);
          return (
            <>
              Step {step.number} of {step.total}
              <span className="stage-compact-label">: {step.label}</span>
            </>
          );
        })()}
      </p>
      <ol
        className="stage-line mentor-stage-line"
        aria-label="Mentorship progress"
      >
        {stageMarks(room).map(({ label, done, current }) => (
          <li
            key={label}
            className={["stage", done && "done", current && "current"]
              .filter(Boolean)
              .join(" ")}
            aria-current={current ? "step" : undefined}
          >
            <span className="stage-dot" aria-hidden="true">
              {done && <Icon name="check" />}
            </span>
            <span>
              {label}
              {/* aria-current already announces the current step. */}
              {done && <span className="visually-hidden">, completed</span>}
            </span>
          </li>
        ))}
      </ol>
      {room.status === "cancelled" ? (
        <section className="card panel mentor-room-closed" role="status">
          <h2>{closedRoomText(room)}</h2>
          {room.role === "founder" && (
            <>
              <p>
                {room.closeReason === "payment-lapsed" &&
                  "Nothing was charged. "}
                Ask {partner?.name || "this mentor"} again, or find another
                mentor who can help now.
              </p>
              <div className="mentor-request-controls">
                {partner && (
                  <button
                    className="btn primary"
                    onClick={(event) =>
                      onAction(
                        { action: "match-detail", id: room.partnerId },
                        event,
                      )
                    }
                  >
                    Request again
                  </button>
                )}
                <button
                  className="btn"
                  onClick={() => onAction({ page: "discover" })}
                >
                  Find another mentor
                </button>
              </div>
            </>
          )}
        </section>
      ) : (
        // The same "whose turn" panel as a Deal Room (readiness plan F5).
        <section
          className={`now-bar room-next-step${next.mine ? " mine" : ""}`}
          aria-label="What happens next"
        >
          <div className="now-copy">
            <span className="section-eyebrow">
              {next.done
                ? "Status"
                : next.mine
                  ? "Your turn"
                  : next.upNext
                    ? "Up next"
                    : "Their turn"}
            </span>
            <strong>{next.text}</strong>
          </div>
          <div className="now-actions">
            {/* One button takes the viewer to their step. */}
            {next.mine &&
              !next.done &&
              !next.pay &&
              !next.review &&
              (next.target || (next.tab && next.tab !== tab)) && (
                // When the step's form is on this tab, its own button is the
                // primary action and this one only brings it into view.
                <button
                  className={next.tab === tab ? "btn" : "btn primary"}
                  onClick={() => goToStep(next)}
                >
                  {next.action || "Open"}
                </button>
              )}
            {next.pay && (
              <button
                className="btn primary"
                disabled={state.busy}
                onClick={() =>
                  onAction({ action: "pay", values: { providerRef: next.pay } })
                }
              >
                {state.busy && <span className="spinner" aria-hidden="true" />}
                {next.action}
              </button>
            )}
            {next.review && (
              <button
                className={
                  room.review.me || room.review.windowClosed
                    ? "btn"
                    : "btn primary"
                }
                onClick={() => onAction({ page: "review" })}
              >
                {room.review.me || room.review.windowClosed
                  ? "Read reviews"
                  : "Write review"}
              </button>
            )}
          </div>
        </section>
      )}
      <div
        className="tabs room-tabs"
        role="tablist"
        aria-label="Mentorship room"
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab${tab === id ? " active" : ""}`}
            role="tab"
            id={`tab-${id}`}
            aria-controls="mentorship-room-panel"
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onKeyDown={onTabKeyDown}
            onClick={() => onAction({ action: "room-tab", tab: id })}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        id="mentorship-room-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="mentor-requests-list"
      >
        {tab === "overview" && (
          <>
            <section className="card panel" id="room-goal">
              <h2>Mentorship goal</h2>
              {/* (Nov 22, round 2) Free mentoring shows no price label. */}
              {(room.payment?.amount || room.terms.draft.price || 0) > 0 && (
                <p>
                  {priceLabel(room.payment?.amount || room.terms.draft.price)}
                </p>
              )}
              {!state.paymentCheckoutData && room.status !== "cancelled" && (
                <CheckoutPanel room={room} />
              )}
              {/* The founder reads their own request in the second person.
                  A confirmed goal that repeats the question shows once. */}
              {[
                ["problem", "The problem"],
                [
                  "tried",
                  room.role === "founder"
                    ? "What you already tried"
                    : "What they already tried",
                ],
                [
                  "question",
                  room.role === "founder"
                    ? "Your question"
                    : "Founder's question",
                ],
                ["desiredOutcome", "Desired outcome"],
              ]
                .filter(([key]) => info[key])
                .filter(
                  ([key]) =>
                    !(
                      ["question", "desiredOutcome"].includes(key) &&
                      goalConfirmed &&
                      room.terms.draft.goal?.trim() === info[key].trim()
                    ),
                )
                .map(([key, label]) => (
                  <div key={key}>
                    <h3>{label}</h3>
                    <p className="preserve-lines">{info[key]}</p>
                  </div>
                ))}
              {goalConfirmed ? (
                <div>
                  <h3>
                    {[info.question, info.desiredOutcome].some(
                      (value) =>
                        value?.trim() === room.terms.draft.goal?.trim(),
                    )
                      ? "Goal (confirmed)"
                      : "Confirmed goal"}
                  </h3>
                  <p className="preserve-lines">
                    {room.terms.draft.goal || "Agree on a focus in chat."}
                  </p>
                </div>
              ) : (
                !info.question &&
                !info.desiredOutcome && (
                  <div>
                    <h3>Proposed goal</h3>
                    <p className="preserve-lines">
                      {room.terms.draft.goal || "Agree on a focus in chat."}
                    </p>
                  </div>
                )
              )}
              {!closed &&
                room.role === "mentor" &&
                !awaitingPayment(room) &&
                room.milestones[goalMilestone(room)] &&
                !room.milestones[goalMilestone(room)].me && (
                  <RoomForm
                    command={{ action: "confirm-goal" }}
                    label="Confirm goal"
                    primary
                    fields={
                      <RoomField
                        name="goal"
                        label="Goal to confirm"
                        value={room.terms.draft.goal}
                        required
                        maxLength={1000}
                      />
                    }
                  />
                )}
              {!closed &&
                room.role === "founder" &&
                partner?.prototypePartner &&
                room.milestones[goalMilestone(room)] &&
                !room.milestones[goalMilestone(room)].me && (
                  <PrototypeShortcut
                    note={`${partner.name} is a fictional mentor. Simulate them confirming this goal to continue.`}
                  >
                    <RoomAction action="simulate-goal-confirmation">
                      Simulate mentor confirming the goal
                    </RoomAction>
                  </PrototypeShortcut>
                )}
              <SimulateSessionHeld
                room={room}
                closed={closed}
                partner={partner}
              />
            </section>
            {(format.sync || format.id === "doc-review") &&
            // A closed room, or a one-off session that has been held, keeps
            // shared prep visible and read-only, never an empty prep form.
            ((room.status !== "cancelled" && !prepOver) ||
              info.prep?.sharedAt ||
              info.prepFiles?.length ||
              room.milestones.uploaded?.attachment) ? (
              <PrepChecklist
                room={room}
                closed={closed || prepOver}
                doc={!format.sync}
              />
            ) : null}
            {!format.sync && (
              <section className="card panel">
                <h2>
                  {format.id === "quick-ask" ? "Answer" : "Document review"}
                </h2>
                {info.answer ? (
                  <>
                    <p className="preserve-lines">{info.answer}</p>
                    {info.answerSimulated && (
                      <p className="field-help">
                        Sample response from a fictional mentor, added in a
                        prototype simulation.
                      </p>
                    )}
                  </>
                ) : info.answerExpiredAt ? (
                  <p>The answer window ended.</p>
                ) : room.role === "founder" ? (
                  <p>Waiting for the mentor's response.</p>
                ) : null}
                {!closed &&
                  room.role === "mentor" &&
                  partner?.prototypePartner &&
                  format.id === "doc-review" &&
                  !room.milestones.uploaded?.me && (
                    <PrototypeShortcut
                      note={`${partner.name} is a fictional founder. Simulate them sharing the document to review.`}
                    >
                      <RoomAction action="simulate-doc-upload">
                        Simulate founder sharing the document
                      </RoomAction>
                    </PrototypeShortcut>
                  )}
                {!closed && room.role === "mentor" && !info.deliveredAt && (
                  <RoomForm
                    command={{ action: "deliver-answer" }}
                    label="Deliver response"
                    fields={
                      <RoomField
                        name="answer"
                        label="Write your response"
                        required
                      />
                    }
                  />
                )}
                {!closed &&
                  room.role === "founder" &&
                  partner?.prototypePartner &&
                  !info.deliveredAt &&
                  !info.answerExpiredAt && (
                    <PrototypeShortcut
                      note={
                        format.id === "doc-review" &&
                        !room.milestones.uploaded?.me
                          ? `${partner.name} is a fictional mentor. Share your document in Review materials first, then simulate their review.`
                          : `${partner.name} is a fictional mentor. Simulate them ${format.id === "quick-ask" ? "answering your question" : "reviewing your document"} to continue.`
                      }
                    >
                      <RoomAction
                        action="simulate-delivery"
                        disabled={
                          format.id === "doc-review" &&
                          !room.milestones.uploaded?.me
                        }
                      >
                        {format.id === "quick-ask"
                          ? "Simulate mentor answering"
                          : "Simulate mentor delivering the review"}
                      </RoomAction>
                    </PrototypeShortcut>
                  )}
                {room.role === "founder" &&
                  info.deliveredAt &&
                  !info.answerRating && (
                    <div className="mentor-request-controls">
                      <RoomAction
                        action="rate-answer"
                        values={{ rating: "helpful" }}
                      >
                        Helpful
                      </RoomAction>
                      <RoomAction
                        action="rate-answer"
                        values={{ rating: "not-helpful" }}
                      >
                        Not helpful
                      </RoomAction>
                    </div>
                  )}
                {room.role === "founder" &&
                  format.id === "doc-review" &&
                  info.deliveredAt &&
                  !info.revisions && (
                    <RoomForm
                      command={{ action: "log-revision" }}
                      label="Log revisions"
                      fields={
                        <RoomField
                          name="summary"
                          label="What did you revise?"
                          required
                        />
                      }
                    />
                  )}
                {info.revisions && <p>{info.revisions.summary}</p>}
                {room.role === "mentor" &&
                  partner?.prototypePartner &&
                  room.status !== "cancelled" &&
                  info.deliveredAt &&
                  (!info.answerRating ||
                    (format.id === "doc-review" && !info.revisions)) && (
                    <PrototypeShortcut
                      note={`${partner.name} is a fictional founder. Simulate their reply to your ${format.id === "quick-ask" ? "answer" : "review"}.`}
                    >
                      <div className="mentor-request-controls">
                        {!info.answerRating && (
                          <RoomAction action="simulate-founder-rating">
                            Simulate founder marking it helpful
                          </RoomAction>
                        )}
                        {format.id === "doc-review" && !info.revisions && (
                          <RoomAction action="simulate-revisions">
                            Simulate founder logging revisions
                          </RoomAction>
                        )}
                      </div>
                    </PrototypeShortcut>
                  )}
              </section>
            )}
            <FollowupForm room={room} />
            <AdvisoryCycle room={room} partner={partner} />
            <Upgrade room={room} partner={partner} />
            {!closed && <EndMentorship />}
          </>
        )}
        {tab === "schedule" && (
          <Schedule room={room} closed={closed} partner={partner} />
        )}
        {tab === "notes" && (
          <SessionNotes room={room} closed={closed} partner={partner} />
        )}
        {tab === "tasks" && (
          <>
            {fictionalNote}
            <TaskBoard room={room} partner={partner} />
          </>
        )}
        {tab === "chat" && fictionalNote}
        {tab === "chat" && (
          <ChatPanel
            room={room}
            agreement={room.terms}
            partner={partner}
            milestones={Object.entries(room.milestones)}
          />
        )}
      </div>
      {partner && (
        <details className="room-safety section-gap">
          <summary>Safety</summary>
          <p className="field-help">
            Report a concern privately to moderators, or block further contact.
            Reporting does not block.
          </p>
          <ReportCollaborator person={partner} quiet />
          <BlockCollaborator person={partner} />
        </details>
      )}
    </div>
  );
}
