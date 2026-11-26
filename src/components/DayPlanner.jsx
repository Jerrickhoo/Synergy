import { useId, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import SelectField from "./SelectField.jsx";
import FormErrors from "./FormErrors.jsx";
import MeetingForm from "./MeetingForm.jsx";

// What a day on Home's calendar can hold: a meeting with a collaborator, a
// task in one of your Deal Rooms, or a milestone's deadline. Tasks and
// deadlines land on the calendar in that collaboration's colour.
const kinds = [
  ["meeting", "Meeting"],
  ["task", "Task"],
  ["deadline", "Deadline"],
];

export default function DayPlanner({ rooms, nameOf, slots, day, onDone }) {
  const id = useId();
  const [kind, setKind] = useState("meeting");
  // Tasks and deadlines belong to Deal Rooms; a mentorship keeps its own.
  const dealRooms = rooms.filter((room) => room.type !== "mentorship");
  return (
    <div className="day-planner">
      <fieldset className="day-plan-kinds">
        <legend>What to add</legend>
        {kinds.map(([value, label]) => (
          <label key={value} className={kind === value ? "is-chosen" : ""}>
            <input
              type="radio"
              name={`${id}-kind`}
              value={value}
              checked={kind === value}
              onChange={() => setKind(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {kind === "meeting" && (
        <MeetingForm rooms={rooms} nameOf={nameOf} date={day} onDone={onDone} />
      )}
      {kind !== "meeting" && !dealRooms.length && (
        <p className="muted">
          Tasks and deadlines belong to a Deal Room. One opens when someone
          accepts your request.
        </p>
      )}
      {kind === "task" && dealRooms.length > 0 && (
        <TaskForm
          rooms={dealRooms}
          nameOf={nameOf}
          slots={slots}
          day={day}
          onDone={onDone}
        />
      )}
      {kind === "deadline" && dealRooms.length > 0 && (
        <DeadlineForm
          rooms={dealRooms}
          nameOf={nameOf}
          slots={slots}
          day={day}
          onDone={onDone}
        />
      )}
    </div>
  );
}

// "StudyLoop · Evaluation and Feedback", with the collaboration's colour.
function RoomPicker({ rooms, nameOf, slots, roomId, onChange, id }) {
  const room = rooms.find((item) => item.id === roomId) || rooms[0];
  // With one collaboration there is nothing to choose; name it instead.
  if (rooms.length === 1)
    return (
      <p className="day-plan-room meeting-with">
        <span
          className={`collab-swatch ${slots.get(room.id) || "collab-other"}`}
          aria-hidden="true"
        />
        With {nameOf(room)} · {room.engagementType || "Collaboration"}
      </p>
    );
  return (
    <div className="field">
      <label htmlFor={id}>Collaboration</label>
      <div className="day-plan-room">
        <span
          className={`collab-swatch ${slots.get(room.id) || "collab-other"}`}
          aria-hidden="true"
        />
        <SelectField
          id={id}
          value={room.id}
          onChange={(event) => onChange(event.target.value)}
        >
          {rooms.map((item) => (
            <option key={item.id} value={item.id}>
              {nameOf(item)} · {item.engagementType || "Collaboration"}
            </option>
          ))}
        </SelectField>
      </div>
    </div>
  );
}

function TaskForm({ rooms, nameOf, slots, day, onDone }) {
  const { state, onSubmit } = useApp();
  const id = useId();
  const [roomId, setRoomId] = useState(rooms[0].id);
  const room = rooms.find((item) => item.id === roomId) || rooms[0];
  return (
    <form
      className="day-plan-form"
      data-form="task-create"
      data-room={room.id}
      onSubmit={async (event) => {
        if (await onSubmit(event)) onDone?.();
      }}
    >
      <FormErrors scope="task-create" />
      <RoomPicker
        id={`${id}-room`}
        rooms={rooms}
        nameOf={nameOf}
        slots={slots}
        roomId={room.id}
        onChange={setRoomId}
      />
      <div className="field">
        <label htmlFor={`${id}-title`}>Task</label>
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={120}
          placeholder="For example: Send the beta build"
        />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${id}-due`}>Due</label>
          <input
            id={`${id}-due`}
            type="date"
            name="dueDate"
            defaultValue={day}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-assignee`}>Assigned to</label>
          <SelectField
            id={`${id}-assignee`}
            name="assignee"
            defaultValue={state.accountId}
            options={[
              { value: state.accountId, label: "Me" },
              { value: room.partnerAccountId, label: nameOf(room) },
              { value: "", label: "Not assigned" },
            ]}
          />
        </div>
      </div>
      <input type="hidden" name="description" value="" />
      <input type="hidden" name="status" value="todo" />
      <input type="hidden" name="priority" value="normal" />
      <input type="hidden" name="milestoneId" value="" />
      <input type="hidden" name="version" value="" />
      <button className="btn primary" type="submit" disabled={state.busy}>
        {state.busy ? "Adding…" : "Add task"}
      </button>
    </form>
  );
}

function DeadlineForm({ rooms, nameOf, slots, day, onDone }) {
  const { state, onSubmit } = useApp();
  const id = useId();
  const [roomId, setRoomId] = useState(rooms[0].id);
  const room = rooms.find((item) => item.id === roomId) || rooms[0];
  // Milestones still to finish; a confirmed one has no deadline left.
  const open = Object.entries(room.milestones || {}).filter(
    ([, item]) => !(item.me && item.partner),
  );
  const [chosen, setChosen] = useState("");
  const milestoneId = open.some(([key]) => key === chosen)
    ? chosen
    : open[0]?.[0] || "";
  const milestone = room.milestones?.[milestoneId];
  // Keep the milestone's owner as it is; only the date changes here.
  const owner =
    milestone?.ownerAccountId === "both"
      ? "both"
      : milestone?.ownerAccountId === state.accountId
        ? "me"
        : milestone?.ownerAccountId === room.partnerAccountId
          ? "partner"
          : "";
  return (
    <form
      className="day-plan-form"
      data-form="milestone-date"
      data-room={room.id}
      data-id={milestoneId}
      onSubmit={async (event) => {
        if (await onSubmit(event)) onDone?.();
      }}
    >
      <FormErrors scope="milestone-date" />
      <RoomPicker
        id={`${id}-room`}
        rooms={rooms}
        nameOf={nameOf}
        slots={slots}
        roomId={room.id}
        onChange={(value) => {
          setRoomId(value);
          setChosen("");
        }}
      />
      {open.length ? (
        <>
          <div className="form-grid">
            <div className="field">
              <label htmlFor={`${id}-milestone`}>Milestone</label>
              <SelectField
                id={`${id}-milestone`}
                value={milestoneId}
                onChange={(event) => setChosen(event.target.value)}
              >
                {open.map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.title}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="field">
              <label htmlFor={`${id}-due`}>Deadline</label>
              <input
                id={`${id}-due`}
                type="date"
                name="dueDate"
                defaultValue={day}
                required
              />
            </div>
          </div>
          <input type="hidden" name="owner" value={owner} />
          <p className="field-help">
            Changing a deadline asks both of you to confirm the milestone again.
          </p>
          <button className="btn primary" type="submit" disabled={state.busy}>
            {state.busy ? "Saving…" : "Set deadline"}
          </button>
        </>
      ) : (
        <p className="muted">Every milestone here is already done.</p>
      )}
    </form>
  );
}
