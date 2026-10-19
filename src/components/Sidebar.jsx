import NavButton from "./NavButton.jsx";
import { useApp } from "../state/AppContext.jsx";
export default function Sidebar() {
  const { state, model, onAction } = useApp();
  const {
    roleName,
    roleInitials,
    matches,
    rolePeople,
    waitingMatches,
    roleLabel,
  } = model;
  return (
    <aside className="sidebar" aria-label="Main navigation">
      {"\n      "}
      <div className="brand">
        {"\n        "}
        <div className="brand-mark">sy</div>
        {"\n        "}
        <div>
          <div className="brand-name">synergy</div>
          <div className="brand-note">GOOD THINGS, TOGETHER</div>
        </div>
        {"\n      "}
      </div>
      {"\n      "}
      <div className="workspace-label">Workspace</div>
      {"\n      "}
      <nav className="nav">
        {"\n        "}
        <NavButton page="home">
          <span className="nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m3 10 9-7 9 7" />
              <path d="M5 9v11h14V9M9 20v-6h6v6" />
            </svg>
          </span>
          <span>Home</span>
        </NavButton>
        {"\n        "}
        <NavButton page="discover">
          <span className="nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 5 5" />
            </svg>
          </span>
          <span>Matches</span>
          <span className="nav-count" id="matches-count">
            {matches().length}
          </span>
        </NavButton>
        {"\n        "}
        <NavButton page="waiting">
          <span className="nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <span>Waiting</span>
          <span className="nav-count" id="waiting-count">
            {
              rolePeople().filter((person) => waitingMatches().has(person.id))
                .length
            }
          </span>
        </NavButton>
        {"\n        "}
        <NavButton page="rooms">
          <span className="nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <path d="M8 7h8M8 11h8M8 15h5" />
            </svg>
          </span>
          <span>Rooms</span>
          <span className="nav-count" id="rooms-count">
            {
              Object.values(state.rooms).filter(
                (room) => room.role === state.role,
              ).length
            }
          </span>
        </NavButton>
        {"\n        "}
        <NavButton page="profile">
          <span className="nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </span>
          <span>Profile</span>
        </NavButton>
        {"\n        "}
        <button
          className="nav-btn mobile-more"
          data-action="more-menu"
          aria-expanded={state.moreOpen}
          onClick={(event) =>
            onAction(
              {
                action: "more-menu",
              },
              event,
            )
          }
        >
          <span className="nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="12" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
            </svg>
          </span>
          <span>More</span>
        </button>
        {"\n      "}
      </nav>
      {"\n      "}
      <div className="sidebar-spacer" />
      {"\n      "}
      <div className="sidebar-tip">
        {"\n        "}
        <div className="tip-kicker">A little reminder</div>
        {"\n        "}
        <p>
          Great partnerships start with a clear ask. Keep your profile fresh to
          find your next fit.
        </p>
        {"\n        "}
        <button
          className="tip-link"
          data-page="profile"
          onClick={(event) =>
            onAction(
              {
                page: "profile",
              },
              event,
            )
          }
        >
          Update your profile →
        </button>
        {"\n      "}
      </div>
      {"\n      "}
      <div className="demo-controls" id="demo-controls">
        {"\n        "}
        <button
          className="demo-trigger"
          type="button"
          data-action="toggle-demo"
          aria-expanded={state.demoOpen}
          aria-controls="demo-popover"
          onClick={(event) =>
            onAction(
              {
                action: "toggle-demo",
              },
              event,
            )
          }
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3 1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4L7.3 15a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4L19.3 13a7 7 0 0 1 .1 2Z" />
          </svg>
          {" Demo controls"}
        </button>
        {"\n        "}
        <section
          className="demo-popover"
          id="demo-popover"
          role="dialog"
          aria-label="Demo controls"
          hidden={!state.demoOpen}
        >
          {"\n          "}
          <h2>Prototype controls</h2>
          {"\n          "}
          <div className="role-switch" aria-label="Preview role">
            {"\n            "}
            <button
              className={state.role === "founder" ? "selected" : ""}
              data-role="founder"
              onClick={(event) =>
                onAction(
                  {
                    role: "founder",
                  },
                  event,
                )
              }
            >
              Founder
            </button>
            {"\n            "}
            <button
              data-role="mentor"
              onClick={(event) =>
                onAction(
                  {
                    role: "mentor",
                  },
                  event,
                )
              }
              className={state.role === "mentor" ? "selected" : ""}
            >
              Mentor
            </button>
            {"\n          "}
          </div>
          {"\n          "}
          <button
            className="btn"
            data-action="demo-mutual"
            onClick={(event) =>
              onAction(
                {
                  action: "demo-mutual",
                },
                event,
              )
            }
          >
            Simulate mutual match
          </button>
          {"\n          "}
          <button
            className="btn"
            data-action="demo-partner-confirm"
            onClick={(event) =>
              onAction(
                {
                  action: "demo-partner-confirm",
                },
                event,
              )
            }
          >
            Simulate partner confirmation
          </button>
          {"\n          "}
          <button
            className="btn"
            data-action="demo-partner-review"
            onClick={(event) =>
              onAction(
                {
                  action: "demo-partner-review",
                },
                event,
              )
            }
          >
            Simulate partner review
          </button>
          {"\n        "}
        </section>
        {"\n      "}
      </div>
      {"\n      "}
      <div className="user-mini">
        {"\n        "}
        <div className="avatar">{roleInitials()}</div>
        {"\n        "}
        <div>
          <div className="user-mini-name">{roleName()}</div>
          <div className="user-mini-role" id="mini-role">
            {roleLabel()}
          </div>
        </div>
        {"\n        "}
        <button
          className="link-btn"
          data-action="sign-out"
          style={{
            marginLeft: "auto",
          }}
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
        {"\n      "}
      </div>
      {"\n    "}
    </aside>
  );
}
