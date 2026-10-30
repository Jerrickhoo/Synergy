import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";
import {
  notificationKind,
  notificationDestination,
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
  const date = new Date(Date.parse(item.timestamp));
  const validDate = Number.isFinite(date.getTime());
  return (
    <article
      className={`notification-entry update-row ${item.read ? "read" : "unread"} ${compact ? "update-compact" : ""}`}
    >
      <span className="update-icon">
        <Icon name={icon} />
      </span>
      <div className="update-content">
        <div className="update-meta">
          <span>{kind}</span>
          <span className="update-read-state">
            {!item.read && <i aria-hidden="true" />}
            {item.read ? "Read" : "Unread"}
          </span>
        </div>
        <p className="update-title">{item.text}</p>
        {destination.context && (
          <p className="update-context">{destination.context}</p>
        )}
        {item.dueAt && (
          <p className="update-context">
            Due{" "}
            {new Date(item.dueAt).toLocaleDateString(undefined, {
              timeZone: "UTC",
            })}{" "}
            (UTC)
          </p>
        )}
        {item.sessionAt && (
          <p className="update-context">
            Session:{" "}
            {new Date(item.sessionAt).toLocaleString(undefined, {
              timeZoneName: "short",
            })}
          </p>
        )}
        <div className="update-footer">
          <time
            dateTime={validDate ? date.toISOString() : undefined}
            title={validDate ? date.toLocaleString() : undefined}
          >
            {relativeTime(item.timestamp, now)}
          </time>
          <div className="update-actions">
            {destination.command && (
              <button
                className="btn primary small"
                onClick={() => {
                  if (state.notificationOpen)
                    onAction({ action: "toggle-notifications" });
                  onAction(destination.command);
                }}
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
        </div>
      </div>
    </article>
  );
}
