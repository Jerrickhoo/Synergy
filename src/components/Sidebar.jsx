import NavButton from "./NavButton.jsx";
import Brand from "./Brand.jsx";
import Icon from "./Icon.jsx";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "./Avatar.jsx";

export const navigation = [
  ["home", "Home", "home"],
  ["discover", "Matches", "search"],
  ["waiting", "Introductions", "people"],
  ["rooms", "Deal Rooms", "rooms"],
];
// Mentors work from requests, mentees and sessions rather than a match feed.
// Startups stay reachable from Requests ("Browse startups").
export const mentorNavigation = [
  ["home", "Home", "home"],
  ["requests", "Requests", "inbox"],
  ["mentees", "Mentees", "people"],
  ["calendar", "Calendar", "calendar"],
  ["impact", "Impact", "star"],
];
export const primaryNavigation = (role) =>
  role === "mentor" ? mentorNavigation : navigation;
export const workspaceNavigation = [
  ["notifications", "Updates", "bell"],
  ["settings", "Settings", "settings"],
];

export default function Sidebar() {
  const { state, model, onAction } = useApp();
  return (
    <aside className="sidebar" aria-label="Workspace sidebar">
      <Brand />
      <nav className="nav" aria-label="Main navigation">
        {primaryNavigation(state.role).map(([page, label, icon]) => (
          <NavButton key={page} page={page}>
            <span className="nav-icon">
              <Icon name={icon} />
            </span>
            <span className="nav-label">{label}</span>
            {["waiting", "requests"].includes(page) &&
              state.incomingByRole[state.role].size > 0 && (
                <span className="nav-count">
                  <span className="visually-hidden">, </span>
                  {state.incomingByRole[state.role].size}
                  <span className="visually-hidden"> waiting for you</span>
                </span>
              )}
          </NavButton>
        ))}
        {state.isAdmin && (
          <NavButton page="moderation">
            <span className="nav-icon">
              <Icon name="shield" />
            </span>
            <span className="nav-label">Moderation</span>
          </NavButton>
        )}
      </nav>
      <div className="sidebar-spacer" />
      <nav className="nav secondary-nav" aria-label="Workspace tools">
        {workspaceNavigation.map(([page, label, icon]) => (
          <NavButton key={page} page={page}>
            <span className="nav-icon">
              <Icon name={icon} />
            </span>
            <span className="nav-label">{label}</span>
          </NavButton>
        ))}
      </nav>
      <div className="user-mini">
        <Avatar
          image={state.profiles[state.role].image}
          name={model.roleName()}
          identity={state.accountId}
        />
        <div className="user-mini-copy">
          <div className="user-mini-name">{model.roleName()}</div>
          <div className="user-mini-role">{model.roleLabel()}</div>
          {state.bothRoles && (
            <button
              className="link-btn"
              disabled={state.busy}
              onClick={() =>
                onAction({
                  action: "choose-role",
                  roleChoice: state.role === "founder" ? "mentor" : "founder",
                  goHome: true,
                })
              }
            >
              Switch to {state.role === "founder" ? "mentor" : "founder"}
            </button>
          )}
          <button
            className="link-btn"
            disabled={state.busy}
            onClick={(event) => onAction({ action: "request-sign-out" }, event)}
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
