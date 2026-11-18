import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";
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
        <div className="update-meta">
          <span className="update-kind">{kind}</span>
          <time
            dateTime={validDate ? date.toISOString() : undefined}
            title={validDate ? date.toLocaleString() : undefined}
          >
            {relativeTime(item.timestamp, now)}
          </time>
          <span className="update-read-state">
            {!item.read && <i aria-hidden="true" />}
            <span className="visually-hidden">
              {item.read ? "Read" : "Unread"}
            </span>
          </span>
        </div>
        <p className="update-title">{item.text}</p>
        {(destination.context || item.dueAt || item.sessionAt) && (
          <p className="update-context">
            {[
              destination.context,
              item.dueAt &&
                `Due ${new Date(item.dueAt).toLocaleDateString(undefined, {
                  timeZone: "UTC",
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}`,
              item.sessionAt &&
                `Session ${new Date(item.sessionAt).toLocaleString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZoneName: "short",
                })}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
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
        {actionable && (
          <div className="update-actions">
            {destination.command && (
              <button
                className="btn primary small"
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
