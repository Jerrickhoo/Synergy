import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";
import Brand from "./Brand.jsx";

export default function Topbar() {
  const { state, model, onAction } = useApp();
  const activity = state.activity
    .filter((item) => item.role === state.role)
    .slice(0, 4);
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
      <span className="workspace-heading">Your workspace</span>
      <div className="top-actions">
        <button
          className="icon-btn tablet-signout"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => onAction({ action: "sign-out" })}
        >
          <Icon name="logout" />
        </button>
        <div className="notification-anchor">
          <button
            className="icon-btn"
            id="notification-toggle"
            aria-label="Notifications"
            aria-expanded={state.notificationOpen}
            aria-controls="notification-panel"
            onClick={() => onAction({ action: "toggle-notifications" })}
          >
            <Icon name="bell" />
          </button>
          {state.notificationOpen && (
            <section
              id="notification-panel"
              className="notification-panel"
              aria-label="Notifications"
            >
              <h2>Updates</h2>
              {activity.length ? (
                activity.map((item) => <p key={item.id}>{item.text}</p>)
              ) : (
                <p>No updates yet. You're all caught up.</p>
              )}
            </section>
          )}
        </div>
        <button
          className="account-button"
          aria-label={`Open profile for ${model.roleName()}`}
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
