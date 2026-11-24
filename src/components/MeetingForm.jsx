import { useId, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import SelectField from "./SelectField.jsx";
import FormErrors from "./FormErrors.jsx";
import { localDateKey } from "../data/planning.js";
import {
  meetingDurations,
  meetingNoteLimit,
  takesMeetings,
} from "../data/meetings.js";

// Schedules a meeting with one accepted collaborator. From Home the
// collaborator is chosen here; in a room it is that room's partner. A
// mentorship keeps its own scheduling rules, so choosing one leads there.
export default function MeetingForm({
  rooms,
  nameOf,
  date: initialDate = "",
  onDone,
}) {
  const { state, onSubmit, onAction } = useApp();
  const id = useId();
  const [roomId, setRoomId] = useState(rooms[0]?.id || "");
  const room = rooms.find((item) => item.id === roomId) || rooms[0];
  const today = localDateKey(new Date());
  if (!room) return null;
  const label = (item) =>
    `${nameOf(item)} · ${item.type === "mentorship" ? "Mentorship" : item.engagementType || "Collaboration"}`;
  const picker =
    rooms.length > 1 ? (
      <div className="field">
        <label htmlFor={`${id}-room`}>Collaborator</label>
        <SelectField
          id={`${id}-room`}
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
        >
          {rooms.map((item) => (
            <option key={item.id} value={item.id}>
              {label(item)}
            </option>
          ))}
        </SelectField>
      </div>
    ) : (
      <p className="meeting-with">With {label(room)}</p>
    );
  if (!takesMeetings(room))
    return (
      <div className="meeting-form">
        {picker}
        <p className="field-help">
          Mentorship sessions are scheduled in the mentorship room, where the
          agreed goal and format set the options.
        </p>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            onDone?.();
            onAction({ action: "open-room", id: room.id, tab: "schedule" });
          }}
        >
          Go to the mentorship schedule
        </button>
      </div>
    );
  return (
    <form
      className="meeting-form"
      data-form="meeting"
      data-room={room.id}
      onSubmit={async (event) => {
        event.preventDefault();
        const success = await onSubmit(event);
        if (success) onDone?.();
      }}
    >
      <FormErrors scope="meeting" />
      {picker}
      <div className="form-grid meeting-when">
        <div className="field">
          <label htmlFor={`${id}-date`}>Date</label>
          <input
            id={`${id}-date`}
            type="date"
            name="date"
            min={today}
            defaultValue={initialDate >= today ? initialDate : today}
            required
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-time`}>Time</label>
          <input id={`${id}-time`} type="time" name="time" required />
        </div>
        <div className="field">
          <label htmlFor={`${id}-duration`}>Length</label>
          <SelectField
            id={`${id}-duration`}
            name="durationMinutes"
            defaultValue="30"
          >
            {meetingDurations.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      <div className="field">
        <div className="profile-label-row">
          <label htmlFor={`${id}-note`}>Note</label>
          <span className="field-optional">Optional</span>
        </div>
        <textarea
          id={`${id}-note`}
          name="note"
          maxLength={meetingNoteLimit}
          placeholder="What to cover, or where you'll meet"
        />
      </div>
      <p className="field-help">
        Times use your timezone. {nameOf(room)} sees the meeting in the room and
        on their calendar.
      </p>
      <button className="btn primary" type="submit" disabled={state.busy}>
        {state.busy && <span className="spinner" aria-hidden="true" />}
        {state.busy ? "Scheduling…" : "Schedule meeting"}
      </button>
    </form>
  );
}
