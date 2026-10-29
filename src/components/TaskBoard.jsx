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
  const closed = terminalStatuses.includes(room.status);
  const tasks = room.tasks || [];
  const shown = tasks.filter(
    (task) =>
      (!mine || task.assignee === state.accountId) &&
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
    setEditor(task);
    setDeletePrompt(false);
  }
  function closeEditor() {
    setEditor(null);
    setDeletePrompt(false);
    addButton.current?.focus();
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
  return (
    <section className="task-workspace" aria-label="Collaboration task board">
      <div className="tool-heading">
        <div>
          <span className="eyebrow">A little progress, every day</span>
          <h2>Make room for your next big idea.</h2>
          <p className="muted">
            Break shared milestones into small, actionable tasks.
          </p>
        </div>
        <button
          ref={addButton}
          className="btn primary"
          disabled={closed || state.busy}
          onClick={() => openEditor({ status: "todo", priority: "normal" })}
        >
          + Add task
        </button>
      </div>
      <div className="board-toolbar">
        <label className="board-search">
          <Icon name="search" />
          <input
            type="search"
            aria-label="Search tasks"
            placeholder="Find a task…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          className={`btn small ${mine ? "active-filter" : ""}`}
          aria-pressed={mine}
          onClick={() => setMine(!mine)}
        >
          Assigned to me
        </button>
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
          This collaboration is complete or closed. Its task board is available
          to view.
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
            <h3>{editor.id ? "Edit task" : "A new step forward"}</h3>
            <button
              type="button"
              className="icon-btn"
              aria-label="Close task editor"
              onClick={closeEditor}
            >
              <Icon name="close" />
            </button>
          </div>
          <input type="hidden" name="version" value={editor.version || ""} />
          <div className="field">
            <label htmlFor="task-title">Task title</label>
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
              <label htmlFor="task-status">Status</label>
              <select
                id="task-status"
                name="status"
                defaultValue={editor.status}
              >
                {columns.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="task-owner">Owner</label>
              <select
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
              </select>
            </div>
            <div className="field">
              <label htmlFor="task-priority">Priority</label>
              <select
                id="task-priority"
                name="priority"
                defaultValue={editor.priority}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
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
            <select
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
            </select>
          </div>
          <div className="task-editor-actions">
            <button className="btn primary" disabled={state.busy || closed}>
              {editor.id ? "Save changes" : "Create task"}
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
                {deletePrompt ? "Confirm delete" : "Delete task"}
              </button>
            )}
          </div>
        </form>
      )}
      <div className="task-board">
        {columns.map(([status, label]) => {
          const cards = shown.filter((task) => task.status === status);
          return (
            <section
              key={status}
              className={`task-column column-${status} ${dragging ? "drop-ready" : ""}`}
              aria-label={`${label} tasks`}
              onDragOver={(event) => {
                if (dragging && !closed) event.preventDefault();
              }}
              onDrop={async (event) => {
                event.preventDefault();
                const task = tasks.find((item) => item.id === dragging);
                setDragging("");
                if (task && task.status !== status && !state.busy && !closed)
                  await mutate("task-update", task, { status });
              }}
            >
              <div className="task-column-heading">
                <h3>
                  <span className="column-dot" />
                  {label}
                  <span className="column-count">{cards.length}</span>
                </h3>
                <button
                  className="icon-btn"
                  aria-label={`Add task to ${label}`}
                  disabled={closed || state.busy}
                  onClick={() => openEditor({ status, priority: "normal" })}
                >
                  +
                </button>
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
                      draggable={!closed && !state.busy}
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
                      <label className="task-move">
                        <span className="sr-only">Move {task.title}</span>
                        <select
                          aria-label={`Status of ${task.title}`}
                          value={status}
                          disabled={closed || state.busy}
                          onChange={(event) =>
                            mutate("task-update", task, {
                              status: event.target.value,
                            })
                          }
                        >
                          {columns.map(([id, name]) => (
                            <option key={id} value={id}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </article>
                  );
                })}
                {!cards.length && (
                  <div className="task-column-empty">
                    <span aria-hidden="true">
                      {status === "done" ? "✓" : "+"}
                    </span>
                    <p>
                      {query || mine
                        ? "No matching tasks"
                        : status === "done"
                          ? "Good work lands here."
                          : status === "doing"
                            ? "Ready when you are."
                            : "Start with one small task."}
                    </p>
                  </div>
                )}
              </div>
              {!closed && (
                <button
                  className="add-card"
                  disabled={state.busy}
                  onClick={() => openEditor({ status, priority: "normal" })}
                >
                  + Add a task
                </button>
              )}
            </section>
          );
        })}
      </div>
      <p className="board-hint">
        Drag cards between columns or use their status menu. Tasks help organize
        work; milestones still need both collaborators’ confirmation.
      </p>
    </section>
  );
}
