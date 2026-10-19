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

export default function Sidebar() {
  const { model, onAction } = useApp();
  return (
    <aside className="sidebar" aria-label="Workspace sidebar">
      <Brand />
      <nav className="nav" aria-label="Main navigation">
        {navigation.map(([page, label, icon]) => (
          <NavButton key={page} page={page}>
            <span className="nav-icon">
              <Icon name={icon} />
            </span>
            <span className="nav-label">{label}</span>
          </NavButton>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <div className="user-mini">
        <div className="avatar">{model.roleInitials()}</div>
        <div className="user-mini-copy">
          <div className="user-mini-name">{model.roleName()}</div>
          <div className="user-mini-role">{model.roleLabel()}</div>
          <button
            className="link-btn"
            onClick={() => onAction({ action: "sign-out" })}
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
