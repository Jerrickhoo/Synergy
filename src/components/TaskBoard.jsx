import SelectField from "./SelectField.jsx";
import { useRef, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import { terminalStatuses } from "../data/collaboration.js";
import Icon from "./Icon.jsx";
import { localDateKey } from "../data/planning.js";
import FormErrors from "./FormErrors.jsx";

const columns = [
  ["todo", "To do"],
  ["doing", "In progress"],
  ["done", "Done"],
];

export default function TaskBoard({ room, partner }) {
  const { state, onSubmit, integrationRequest, notify } = useApp();
  const [editor, setEditor] = useState(null);
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(false);
  const [dragging, setDragging] = useState("");
  const [deletePrompt, setDeletePrompt] = useState(false);
  const addButton = useRef(null);
  const editorOpener = useRef(null);
  const closed = terminalStatuses.includes(room.status);
  const tasks = room.tasks || [];
  // Mentorship rooms keep founder-owned action items (roadmap Phase 3): either
  // side adds them, the founder owns them and only the founder marks one done.
  // (Nov 22, round 2) Mentors are never offered Done: no status option, no
  // move-menu entry and no drop target. Exchange rooms keep the task board.
  const mentoring = room.type === "mentorship";
  const canFinish = !mentoring || room.role === "founder";
  const noun = mentoring ? "action item" : "task";
  const statusOptions = (current) =>
    columns.filter(([id]) => canFinish || id !== "done" || current === "done");
  const shown = tasks.filter(
    (task) =>
      (mentoring || !mine || task.assignee === state.accountId) &&
      `${task.title} ${task.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const done = tasks.filter((task) => task.status === "done").length;
  const owner = (id) =>
    id === state.accountId
      ? state.accountName
      : id
        ? partner?.name || "Collaborator"
        : "Unassigned";
  function openEditor(task) {
    editorOpener.current = document.activeElement;
    setEditor(task);
    setDeletePrompt(false);
  }
  function closeEditor() {
    setEditor(null);
    setDeletePrompt(false);
    requestAnimationFrame(() =>
      (editorOpener.current?.isConnected
        ? editorOpener.current
        : addButton.current
      )?.focus(),
    );
  }
  async function mutate(form, task, values = {}) {
    try {
      const result = await integrationRequest("action", {
        form,
        role: state.role,
        activeRoomId: room.id,
        id: task.id,
        values: { ...task, ...values },
      });
      notify(result.state.toast);
      return true;
    } catch {
      return false;
    }
  }
  const founderId =
    room.role === "founder" ? state.accountId : room.partnerAccountId;
  const founderName =
    room.role === "founder" ? state.accountName : partner?.name || "Founder";
  const newItem = (status) => ({
    status,
    priority: "normal",
    ...(mentoring && { assignee: founderId }),
  });
  return (
    <section
      className="task-workspace"
      aria-label={mentoring ? "Action items" : "Collaboration task board"}
    >
      <div className="tool-heading">
        <div>
          <h2>
            {mentoring
              ? "What the founder will do next"
              : "Break milestones into tasks."}
          </h2>
          <p className="muted">
            {mentoring
              ? `${room.role === "founder" ? "You own" : `${founderName} owns`} each action item. ${room.role === "founder" ? "Mark items done as you finish them; your follow-up reports on them." : "Only the founder marks an item done."}`
              : "Break shared milestones into small, actionable tasks."}
          </p>
        </div>
        <button
          ref={addButton}
          className="btn primary"
          disabled={closed || state.busy}
          onClick={() => openEditor(newItem("todo"))}
        >
          <Icon name="plus" />
          {mentoring ? "Add action item" : "Add task"}
        </button>
      </div>
      <div className="board-toolbar">
        <label className="board-search">
          <Icon name="search" />
          <input
            type="search"
            aria-label={`Search ${noun}s`}
            placeholder={mentoring ? "Find an action item…" : "Find a task…"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {!mentoring && (
          <button
            className={`btn small ${mine ? "active-filter" : ""}`}
            aria-pressed={mine}
            onClick={() => setMine(!mine)}
          >
            Assigned to me
          </button>
        )}
        <span className="board-completion">
          {done} of {tasks.length} complete{" "}
          <span className="board-progress" aria-hidden="true">
            <span
              style={{
                width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`,
              }}
            />
          </span>
        </span>
      </div>
      {closed && (
        <p className="tool-notice">
          {mentoring
            ? "This mentorship is complete or closed. Its action items are available to view."
            : "This collaboration is complete or closed. Its task board is available to view."}
        </p>
      )}
      {editor && (
        <form
          key={`${editor.id || "new"}:${editor.status}`}
          className="task-editor card"
          data-form={editor.id ? "task-update" : "task-create"}
          data-id={editor.id}
          onSubmit={async (event) => {
            if (await onSubmit(event)) closeEditor();
          }}
        >
          <FormErrors scope={editor.id ? "task-update" : "task-create"} />
          <div className="section-heading">
            <h3>
              {mentoring
                ? editor.id
                  ? "Edit action item"
                  : "New action item"
                : editor.id
                  ? "Edit task"
                  : "New task"}
            </h3>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Close ${noun} editor`}
              onClick={closeEditor}
            >
              <Icon name="close" />
            </button>
          </div>
          <input type="hidden" name="version" value={editor.version || ""} />
          <div className="field">
            <label htmlFor="task-title">
              {mentoring ? "Action item" : "Task title"}
            </label>
            <input
              autoFocus
              id="task-title"
              name="title"
              required
              maxLength={160}
              defaultValue={editor.title || ""}
              placeholder="What needs to happen?"
            />
          </div>
          <div className="field">
            <label htmlFor="task-description">Description</label>
            <textarea
              id="task-description"
              name="description"
              maxLength={3000}
              defaultValue={editor.description || ""}
              placeholder="Add context, links, or a definition of done"
              rows={2}
            />
          </div>
          <div className="task-fields">
            <div className="field">
              {!canFinish && editor.status === "done" ? (
                <>
                  <strong>Status</strong>
                  <p>Done</p>
                  <input type="hidden" name="status" value="done" />
                </>
              ) : (
                <>
                  <label htmlFor="task-status">Status</label>
                  <SelectField
                    id="task-status"
                    name="status"
                    defaultValue={editor.status}
                  >
                    {statusOptions(editor.status).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </SelectField>
                </>
              )}
            </div>
            {mentoring ? (
              <div className="field">
                <strong>Owner</strong>
                <p>
                  {founderName}
                  {room.role === "founder" ? " (you)" : ""}
                </p>
                <input type="hidden" name="assignee" value={founderId} />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="task-owner">Owner</label>
                <SelectField
                  id="task-owner"
                  name="assignee"
                  defaultValue={editor.assignee || ""}
                >
                  <option value="">Unassigned</option>
                  <option value={state.accountId}>
                    {state.accountName} (you)
                  </option>
                  <option value={room.partnerAccountId}>
                    {partner?.name || "Collaborator"}
                  </option>
                </SelectField>
              </div>
            )}
            <div className="field">
              <label htmlFor="task-priority">Priority</label>
              <SelectField
                id="task-priority"
                name="priority"
                defaultValue={editor.priority}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </SelectField>
            </div>
            <div className="field">
              <label htmlFor="task-due">Due date</label>
              <input
                id="task-due"
                type="date"
                name="dueDate"
                defaultValue={editor.dueDate || ""}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="task-milestone">Linked milestone</label>
            <SelectField
              id="task-milestone"
              name="milestoneId"
              defaultValue={editor.milestoneId || ""}
            >
              <option value="">No milestone</option>
              {Object.entries(room.milestones).map(([id, item]) => (
                <option key={id} value={id}>
                  {item.title}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="task-editor-actions">
            <button className="btn primary" disabled={state.busy || closed}>
              {editor.id ? "Save changes" : `Create ${noun}`}
            </button>
            <button type="button" className="btn" onClick={closeEditor}>
              Cancel
            </button>
            {editor.id && (
              <button
                type="button"
                className="link-btn task-delete"
                disabled={state.busy || closed}
                onClick={async () => {
                  if (!deletePrompt) setDeletePrompt(true);
                  else if (await mutate("task-delete", editor)) closeEditor();
                }}
              >
                {deletePrompt ? "Confirm delete" : `Delete ${noun}`}
              </button>
            )}
          </div>
        </form>
      )}
      <div className="task-board">
        {columns.map(([status, label]) => {
          const cards = shown.filter((task) => task.status === status);
          // A mentor can't finish an item, so Done is never a drop target.
          const droppable = !closed && (canFinish || status !== "done");
          return (
            <section
              key={status}
              className={`task-column column-${status} ${dragging && droppable ? "drop-ready" : ""}`}
              aria-label={`${label} ${noun}s`}
              onDragOver={(event) => {
                if (dragging && droppable) event.preventDefault();
              }}
              onDrop={async (event) => {
                event.preventDefault();
                const task = tasks.find((item) => item.id === dragging);
                setDragging("");
                if (droppable && task && task.status !== status && !state.busy)
                  await mutate("task-update", task, { status });
              }}
            >
              <div className="task-column-heading">
                <h3>
                  <span className="column-dot" />
                  {label}
                  <span className="column-count">{cards.length}</span>
                </h3>
                {droppable && (
                  <button
                    className="icon-btn"
                    aria-label={`Add ${noun} to ${label}`}
                    disabled={state.busy}
                    onClick={() => openEditor(newItem(status))}
                  >
                    <Icon name="plus" />
                  </button>
                )}
              </div>
              <div className="task-card-list">
                {cards.map((task) => {
                  const overdue =
                    task.dueDate &&
                    task.dueDate < localDateKey(new Date()) &&
                    status !== "done";
                  return (
                    <article
                      className="task-card"
                      key={task.id}
                      draggable={
                        !closed &&
                        !state.busy &&
                        (canFinish || task.status !== "done")
                      }
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", task.id);
                        setDragging(task.id);
                      }}
                      onDragEnd={() => setDragging("")}
                    >
                      <div className="task-card-top">
                        <span
                          className={`task-priority priority-${task.priority}`}
                        >
                          {task.priority === "normal"
                            ? "Normal priority"
                            : `${task.priority === "high" ? "High" : "Low"} priority`}
                        </span>
                        <span className="task-grip" aria-hidden="true">
                          ⠿
                        </span>
                      </div>
                      <button
                        className="task-title"
                        onClick={() => openEditor({ ...task })}
                        disabled={closed}
                      >
                        {task.title}
                      </button>
                      {task.description && (
                        <p className="task-excerpt">{task.description}</p>
                      )}
                      {task.milestoneId && (
                        <span className="task-milestone">
                          <Icon name="rooms" />
                          {room.milestones[task.milestoneId]?.title}
                        </span>
                      )}
                      <div className="task-card-meta">
                        {task.dueDate ? (
                          <span className={overdue ? "task-overdue" : ""}>
                            <Icon name="calendar" />
                            {new Date(
                              `${task.dueDate}T12:00:00`,
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                            {overdue ? " · Overdue" : ""}
                          </span>
                        ) : (
                          <span>No due date</span>
                        )}
                        <span
                          className="task-owner"
                          title={owner(task.assignee)}
                          aria-label={`Owner: ${owner(task.assignee)}`}
                        >
                          {task.assignee
                            ? owner(task.assignee)
                                .split(/\s+/)
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                            : "—"}
                        </span>
                      </div>
                      {!canFinish && status === "done" ? (
                        <p className="task-move muted">Done by {founderName}</p>
                      ) : (
                        <label className="task-move">
                          <span className="sr-only">Move {task.title}</span>
                          <SelectField
                            aria-label={`Status of ${task.title}`}
                            value={status}
                            disabled={closed || state.busy}
                            onChange={(event) =>
                              mutate("task-update", task, {
                                status: event.target.value,
                              })
                            }
                          >
                            {statusOptions(status).map(([id, name]) => (
                              <option key={id} value={id}>
                                {name}
                              </option>
                            ))}
                          </SelectField>
                        </label>
                      )}
                    </article>
                  );
                })}
                {!cards.length && (
                  <div className="task-column-empty">
                    <Icon name={status === "done" ? "check" : "plus"} />
                    <p>
                      {query || (mine && !mentoring)
                        ? `No matching ${noun}s`
                        : status === "done"
                          ? canFinish
                            ? "Good work lands here."
                            : `${founderName} moves finished items here.`
                          : status === "doing"
                            ? "Ready when you are."
                            : `Start with one small ${noun}.`}
                    </p>
                  </div>
                )}
              </div>
              {droppable && (
                <button
                  className="add-card"
                  disabled={state.busy}
                  onClick={() => openEditor(newItem(status))}
                >
                  <Icon name="plus" />
                  {mentoring ? "Add an action item" : "Add a task"}
                </button>
              )}
            </section>
          );
        })}
      </div>
      <p className="board-hint">
        {!mentoring
          ? "Drag cards between columns or use their status menu. Tasks help organize work; milestones still need both collaborators’ confirmation."
          : canFinish
            ? "Drag items between columns or use their status menu."
            : `Drag items between To do and In progress, or use their status menu. ${founderName} marks items done.`}
      </p>
    </section>
  );
}
