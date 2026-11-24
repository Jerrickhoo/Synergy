import { useApp } from "../state/AppContext.jsx";
import MeetingForm from "./MeetingForm.jsx";
import { roomMeetings, meetingInstant } from "../data/meetings.js";
import { scheduleLabel } from "../data/selectors.js";
import { terminalStatuses } from "../data/collaboration.js";

// The Meetings tab of an exchange collaboration: what is planned, and a form
// to add one. Either collaborator can cancel a meeting that has not started.
export default function MeetingsPanel({ room, partner }) {
  const { state, onAction } = useApp();
  const name = partner?.name || "your collaborator";
  const now = new Date();
  const meetings = roomMeetings(room);
  const upcoming = meetings.filter((meeting) => meetingInstant(meeting) > now);
  const past = meetings
    .filter((meeting) => meetingInstant(meeting) <= now)
    .reverse();
  const closed = terminalStatuses.includes(room.status);
  const row = (meeting, canCancel) => (
    <li className="meeting-row" key={meeting.id}>
      <div>
        <strong>{scheduleLabel(meetingInstant(meeting))}</strong>
        <span className="muted">
          {meeting.durationMinutes} minutes · Scheduled by{" "}
          {meeting.byAccountId === state.accountId ? "you" : name}
        </span>
        {meeting.note && <p className="preserve-lines">{meeting.note}</p>}
      </div>
      {canCancel && (
        <button
          className="btn small"
          disabled={state.busy}
          onClick={(event) =>
            onAction(
              {
                action: "cancel-meeting",
                id: meeting.id,
                activeRoomId: room.id,
              },
              event,
            )
          }
        >
          Cancel meeting
          <span className="visually-hidden">
            {" "}
            on {scheduleLabel(meetingInstant(meeting))}
          </span>
        </button>
      )}
    </li>
  );
  return (
    <div className="meetings-panel">
      <section
        className="card panel section-gap"
        aria-labelledby="meetings-heading"
      >
        <h2 id="meetings-heading">Meetings with {name}</h2>
        {upcoming.length ? (
          <ul className="meeting-list">
            {upcoming.map((meeting) => row(meeting, !closed))}
          </ul>
        ) : (
          <p className="muted">No meetings planned yet.</p>
        )}
        {past.length > 0 && (
          <details className="meeting-past">
            <summary>Past meetings ({past.length})</summary>
            <ul className="meeting-list">
              {past.map((meeting) => row(meeting, false))}
            </ul>
          </details>
        )}
      </section>
      {!closed && (
        <section
          className="card panel section-gap"
          aria-labelledby="meeting-new-heading"
        >
          <h2 id="meeting-new-heading">Schedule a meeting</h2>
          <MeetingForm rooms={[room]} nameOf={() => name} />
        </section>
      )}
    </div>
  );
}
