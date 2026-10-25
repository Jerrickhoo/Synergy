import NavButton from "./NavButton.jsx";
import Brand from "./Brand.jsx";
import Icon from "./Icon.jsx";
import { useApp } from "../state/AppContext.jsx";

export const navigation = [
  ["home", "Home", "home"],
  ["discover", "Matches", "search"],
  ["rooms", "Rooms", "rooms"],
  ["profile", "Profile", "profile"],
];
export const workspaceNavigation = [
  ["waiting", "Introductions", "people"],
  ["notifications", "Updates", "bell"],
  ["settings", "Settings", "settings"],
];

export default function Sidebar() {
  const { state, model, onAction } = useApp();
  return (
    <aside className="sidebar" aria-label="Workspace sidebar">
      <Brand />
      <div className="workspace-label">Workspace</div>
      <nav className="nav" aria-label="Main navigation">
        {navigation.map(([page, label, icon]) => (
          <NavButton key={page} page={page}>
            <span className="nav-icon">
              <Icon name={icon} />
            </span>
            <span className="nav-label">{label}</span>
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
            {page === "waiting" &&
              state.incomingByRole[state.role].size > 0 && (
                <span className="nav-count">
                  {state.incomingByRole[state.role].size}
                </span>
              )}
          </NavButton>
        ))}
      </nav>
      <div className="user-mini">
        <div className="avatar">{model.roleInitials()}</div>
        <div className="user-mini-copy">
          <div className="user-mini-name">{model.roleName()}</div>
          <div className="user-mini-role">{model.roleLabel()}</div>
          <button
            className="link-btn"
            disabled={state.busy}
            onClick={() => onAction({ action: "sign-out" })}
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
