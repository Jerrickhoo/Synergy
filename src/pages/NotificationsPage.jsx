import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
export default function NotificationsPage() {
  const { state, onAction, onSubmit } = useApp();
  const items = state.notifications || [];
  return (
    <div className="page page-enter">
      <PageHeader
        title="Updates"
        intro="Match suggestions, collaboration activity and reminders."
      />
      <section className="card panel">
        <h2>Email digest</h2>
        <p>
          Digests are opt-in and include unread updates from both roles.
          Delivery requires a verified email and a running workspace server.
        </p>
        <form
          data-form="notification-preferences"
          onSubmit={onSubmit}
          className="schedule-form"
        >
          <label htmlFor="digest-frequency">Digest frequency</label>
          <select
            id="digest-frequency"
            name="digest"
            defaultValue={state.notificationPreferences?.digest || "off"}
          >
            <option value="off">Off</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <button className="btn" disabled={state.busy}>
            Save preferences
          </button>
        </form>
      </section>
      {state.notificationPreferences?.lastSentAt && (
        <p className="muted">
          Last digest sent:{" "}
          {new Date(state.notificationPreferences.lastSentAt).toLocaleString()}
        </p>
      )}
      {state.notificationPreferences?.deliveryError && (
        <p role="status">{state.notificationPreferences.deliveryError}</p>
      )}
      <section className="card panel section-gap">
        <div className="panel-head">
          <h2>
            All updates ({items.filter((item) => !item.read).length} unread)
          </h2>
          <button
            className="btn small"
            disabled={state.busy || !items.some((item) => !item.read)}
            onClick={() => onAction({ action: "read-notifications" })}
          >
            Mark all as read
          </button>
        </div>
        {state.incomingByRole[state.role].size > 0 && (
          <button className="btn" onClick={() => onAction({ page: "waiting" })}>
            Respond to introductions
          </button>
        )}
        {items.length ? (
          items.map((item) => (
            <article
              className={`notification-entry ${item.read ? "" : "unread"}`}
              key={item.id}
            >
              <p>{item.text}</p>
              <span className="muted">
                {item.kind} · {item.read ? "Read" : "Unread"}
              </span>
              <div className="tag-row">
                {item.roomId && (
                  <button
                    className="link-btn"
                    onClick={() =>
                      onAction({ action: "open-room", id: item.roomId })
                    }
                  >
                    Open room
                  </button>
                )}
                {item.matchId && (
                  <button
                    className="link-btn"
                    onClick={() =>
                      onAction({ action: "match-detail", id: item.matchId })
                    }
                  >
                    View match
                  </button>
                )}
                {!item.read && (
                  <button
                    className="link-btn"
                    disabled={state.busy}
                    onClick={() =>
                      onAction({ action: "read-notifications", id: item.id })
                    }
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <p>No updates yet.</p>
        )}
      </section>
    </div>
  );
}
