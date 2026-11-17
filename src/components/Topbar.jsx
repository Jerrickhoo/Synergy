import { useApp } from "../state/AppContext.jsx";
import { useRef } from "react";
import Icon from "./Icon.jsx";
import Brand from "./Brand.jsx";
import { pageLabel } from "../data/filters.js";
import NotificationPreview from "./NotificationPreview.jsx";
import Avatar from "./Avatar.jsx";

export default function Topbar() {
  const { state, model, onAction } = useApp();
  const headerRef = useRef(null);
  const actionsRef = useRef(null);
  const unread = (state.notifications || []).filter(
    (item) => !item.read,
  ).length;
  return (
    <header ref={headerRef} className="topbar simple-topbar">
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
      {["room-detail", "match-detail", "review", "trust"].includes(
        state.page,
      ) && (
        <div className="workspace-heading">
          <span>Workspace</span>
          <span aria-hidden="true">/</span>
          <strong>{pageLabel(state.page, state.role)}</strong>
        </div>
      )}
      <div ref={actionsRef} className="top-actions">
        <button
          className="icon-btn tablet-signout"
          aria-label="Sign out"
          disabled={state.busy}
          title="Sign out"
          onClick={(event) => onAction({ action: "request-sign-out" }, event)}
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
            onClick={() => {
              if (!state.notificationOpen)
                window.dispatchEvent(
                  new CustomEvent("synergy:popover", {
                    detail: "notifications",
                  }),
                );
              onAction({ action: "toggle-notifications" });
            }}
          >
            <Icon name="bell" />
            {unread > 0 && (
              <span className="notification-dot" aria-hidden="true">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
          {state.notificationOpen && (
            <NotificationPreview
              headerRef={headerRef}
              actionsRef={actionsRef}
            />
          )}
        </div>
        <button
          className="account-button"
          aria-label={`Open profile for ${model.roleName()} ${model.roleLabel()}`}
          aria-current={state.page === "profile" ? "page" : undefined}
          title="Your profile"
          onClick={() => onAction({ page: "profile" })}
        >
          <Avatar
            image={state.profiles[state.role].image}
            name={model.roleName()}
            identity={state.accountId}
          />
          <span className="account-copy">
            <strong>{model.roleName()}</strong>
            <span>{model.roleLabel()}</span>
          </span>
        </button>
      </div>
    </header>
  );
}
