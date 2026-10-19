import { useApp } from "../state/AppContext.jsx";
import { pageLabel } from "../data/filters.js";
export default function Topbar() {
  const { state, model, onAction } = useApp();
  const { roleInitials } = model;
  return (
    <header className="topbar">
      {"\n        "}
      <div className="crumb">
        {"Workspace "}
        <span
          style={{
            padding: "0 6px",
            color: "#adb6b0",
          }}
        >
          /
        </span>{" "}
        <strong id="crumb-page">{pageLabel(state.page)}</strong>
      </div>
      {"\n        "}
      <div className="mobile-brand">
        <span className="brand-mark">sy</span>
        {" synergy"}
      </div>
      {"\n        "}
      <div className="top-actions">
        {"\n          "}
        <button
          className="icon-btn"
          id="notification-toggle"
          aria-label="Notifications"
          aria-expanded={state.notificationOpen}
          onClick={(event) =>
            onAction(
              {
                action: "toggle-notifications",
              },
              event,
            )
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
          </svg>
          <span className="notification-dot" />
        </button>
        {"\n          "}
        <div
          className="avatar"
          style={{
            width: "32px",
            height: "32px",
          }}
        >
          {roleInitials()}
        </div>
        {"\n          "}
        <button
          className="mobile-sign-out"
          data-action="sign-out"
          onClick={(event) =>
            onAction(
              {
                action: "sign-out",
              },
              event,
            )
          }
        >
          Sign out
        </button>
        {"\n        "}
      </div>
      {"\n        "}
      <div
        id="notification-panel"
        className="notification-panel"
        hidden={!state.notificationOpen}
      >
        <h3>Notifications</h3>
        <p>
          <strong>
            {state.role === "founder" ? "Campus Grocer" : "BudgetBuddy"}
          </strong>
          {state.role === "founder"
            ? " confirmed a milestone in Beta Testing Exchange."
            : " confirmed 'Goals defined'."}
        </p>
        <p>
          <strong>New match:</strong>{" "}
          {state.role === "founder"
            ? "David Park is open to a mentorship conversation."
            : "BudgetBuddy is looking for product guidance."}
        </p>
      </div>
      {"\n      "}
    </header>
  );
}
