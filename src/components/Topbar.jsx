import { useApp } from "../state/AppContext.jsx";
import { useEffect } from "react";
import Icon from "./Icon.jsx";
import Brand from "./Brand.jsx";
import { pageLabel } from "../data/filters.js";
import NotificationRow, { useUpdateClock } from "./NotificationRow.jsx";

export default function Topbar() {
  const { state, model, onAction } = useApp();
  const now = useUpdateClock();
  useEffect(() => {
    if (!state.notificationOpen) return;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      onAction({ action: "close-notifications" });
      document.getElementById("notification-toggle")?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [state.notificationOpen, onAction]);
  const activity = (state.notifications || []).slice(0, 6);
  const unread = (state.notifications || []).filter(
    (item) => !item.read,
  ).length;
  return (
    <header className="topbar simple-topbar">
      <button
        id="navigation-toggle"
        className="icon-btn mobile-menu-toggle"
        aria-label="Open navigation"
        aria-expanded={state.moreOpen}
        aria-controls="mobile-more-sheet"
        onClick={() => onAction({ action: "more-menu" })}
      >
        <Icon name="menu" />
      </button>
      <div className="mobile-brand">
        <Brand compact />
      </div>
      <div className="workspace-heading">
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <strong>{pageLabel(state.page)}</strong>
      </div>
      <div className="top-actions">
        <button
          className="icon-btn tablet-signout"
          aria-label="Sign out"
          disabled={state.busy}
          title="Sign out"
          onClick={() => onAction({ action: "sign-out" })}
        >
          <Icon name="logout" />
        </button>
        <div className="notification-anchor">
          <button
            className="icon-btn"
            id="notification-toggle"
            aria-label={
              unread ? `Notifications, ${unread} unread` : "Notifications"
            }
            aria-expanded={state.notificationOpen}
            aria-controls="notification-panel"
            onClick={() => onAction({ action: "toggle-notifications" })}
          >
            <Icon name="bell" />
            {unread > 0 && (
              <span className="notification-dot" aria-hidden="true">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
          {state.notificationOpen && (
            <section
              id="notification-panel"
              className="notification-panel"
              aria-label="Notifications"
            >
              <h2>Updates</h2>
              <button
                className="link-btn"
                onClick={() => onAction({ page: "notifications" })}
              >
                View all updates and preferences
              </button>
              {state.incomingByRole[state.role].size > 0 && (
                <button
                  className="btn small"
                  onClick={() => onAction({ page: "waiting" })}
                >
                  Respond to introductions (
                  {state.incomingByRole[state.role].size})
                </button>
              )}
              {activity.length ? (
                activity.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    now={now}
                    compact
                  />
                ))
              ) : (
                <p>No updates yet. You're all caught up.</p>
              )}
            </section>
          )}
        </div>
        <button
          className="account-button"
          aria-label={`Open profile for ${model.roleName()}`}
          aria-current={state.page === "profile" ? "page" : undefined}
          title="Your profile"
          onClick={() => onAction({ page: "profile" })}
        >
          <span className="avatar">{model.roleInitials()}</span>
          <span className="account-copy">
            <strong>{model.roleName()}</strong>
            <span>{model.roleLabel()}</span>
          </span>
        </button>
      </div>
    </header>
  );
}
