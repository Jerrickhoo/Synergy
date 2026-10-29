import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import NotificationRow, {
  useUpdateClock,
} from "../components/NotificationRow.jsx";
import { groupNotifications } from "../data/notifications.js";
import Icon from "../components/Icon.jsx";
export default function NotificationsPage() {
  const { state, onAction } = useApp();
  const [filter, setFilter] = useState("all");
  const now = useUpdateClock();
  const items = state.notifications || [];
  const unread = items.filter((item) => !item.read).length;
  const groups = groupNotifications(
    filter === "unread" ? items.filter((item) => !item.read) : items,
    now,
  );
  return (
    <div className="page updates-page page-enter">
      <PageHeader
        title="Updates"
        intro="Keep up with your collaborations and find your next step."
        actions={
          <button
            className="btn"
            disabled={state.busy || !unread}
            onClick={() => onAction({ action: "read-notifications" })}
          >
            Mark all as read
          </button>
        }
      />
      <div className="updates-toolbar">
        <div className="update-filters" role="group" aria-label="Update filter">
          <button
            className="btn"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className="btn"
            aria-pressed={filter === "unread"}
            onClick={() => setFilter("unread")}
          >
            Unread ({unread})
          </button>
        </div>
        <span className="muted" role="status">
          {unread} unread {unread === 1 ? "update" : "updates"}
        </span>
        {state.incomingByRole[state.role].size > 0 && (
          <button
            className="link-btn"
            onClick={() => onAction({ page: "waiting" })}
          >
            Respond to introductions
          </button>
        )}
      </div>
      {groups.length ? (
        groups.map(([label, values]) => (
          <section className="update-group" key={label} aria-label={label}>
            <h2>{label}</h2>
            <div className="card update-list">
              {values.map((item) => (
                <NotificationRow key={item.id} item={item} now={now} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <section className="card update-empty">
          <Icon name="check" />
          <h2>
            {filter === "unread" ? "You’re all caught up" : "No updates yet"}
          </h2>
          <p>
            {filter === "unread"
              ? "Every update has been read. Switch to All to revisit your activity."
              : "Introductions, collaboration activity and reminders will appear here."}
          </p>
        </section>
      )}
    </div>
  );
}
