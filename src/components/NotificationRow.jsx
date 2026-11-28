import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";
import { scheduleLabel } from "../data/selectors.js";
import {
  notificationKind,
  notificationDestination,
  needsAction,
  relativeTime,
} from "../data/notifications.js";

export function useUpdateClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function NotificationRow({ item, now, compact = false }) {
  const { state, model, onAction } = useApp();
  const [kind, icon] = notificationKind(item.kind);
  const destination = notificationDestination(item, state, model.rolePeople());
  const alternatives = item.alternatives?.filter(({ id }) =>
    model.rolePeople().some((person) => person.id === id && person.available),
  );
  const date = new Date(Date.parse(item.timestamp));
  const validDate = Number.isFinite(date.getTime());
  const actionable = destination.command || !item.read;
  // "With Dev Startup" says nothing new under "Dev Startup is a 91% fit."
  const context =
    destination.context?.startsWith("With ") &&
    item.text.includes(destination.context.slice(5))
      ? null
      : destination.context;
  // One muted line under the title: what kind of update, and its context.
  const details = [
    kind,
    context,
    item.dueAt &&
      `Due ${new Date(item.dueAt).toLocaleDateString(undefined, {
        timeZone: "UTC",
        weekday: "short",
        day: "numeric",
        month: "short",
      })}`,
    item.sessionAt && `Session ${scheduleLabel(item.sessionAt)}`,
  ].filter(Boolean);
  const open = async (command) => {
    if (state.notificationOpen) onAction({ action: "toggle-notifications" });
    await onAction(command);
    if (!item.read) onAction({ action: "read-notifications", id: item.id });
  };
  return (
    <article
      className={`notification-entry update-row ${item.read ? "read" : "unread"} ${needsAction(item) ? "update-urgent" : ""} ${compact ? "update-compact" : ""}`}
    >
      <span className="update-icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <div className="update-content">
        <p className="update-title">{item.text}</p>
        <p className="update-context">{details.join(" · ")}</p>
        {alternatives?.length > 0 && (
          <div className="mentoring-alternatives">
            <p>Suggested mentors</p>
            <ul>
              {alternatives.map(({ id, name }) => (
                <li key={id}>
                  <button
                    className="btn small"
                    onClick={() => open({ action: "match-detail", id })}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {/* When it happened and what to do about it, at the row's end. */}
      <div className="update-side">
        <span className="update-meta">
          {!item.read && <i className="update-dot" aria-hidden="true" />}
          <span className="visually-hidden">
            {item.read ? "Read" : "Unread"},{" "}
          </span>
          <time
            dateTime={validDate ? date.toISOString() : undefined}
            title={validDate ? date.toLocaleString() : undefined}
          >
            {relativeTime(item.timestamp, now)}
          </time>
        </span>
        {actionable && (
          <div className="update-actions">
            {destination.command && (
              // Rows stay secondary so a list of updates has no primary
              // action competing with the page's own (readiness plan P3).
              <button
                className="btn small"
                onClick={() => open(destination.command)}
              >
                {destination.label}
              </button>
            )}
            {!item.read && (
              <button
                className="btn small update-read-action"
                disabled={state.busy}
                onClick={() =>
                  onAction({ action: "read-notifications", id: item.id })
                }
              >
                Mark as read
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
