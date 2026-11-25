import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import NavButton from "./NavButton.jsx";
import Brand from "./Brand.jsx";
import Icon from "./Icon.jsx";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "./Avatar.jsx";
import { applySidebar, readSidebar, saveSidebar } from "../state/sidebar.js";

export const navigation = [
  ["home", "Home", "home"],
  ["discover", "Matches", "search"],
  ["waiting", "Introductions", "people"],
  ["rooms", "Rooms", "rooms"],
];
// Mentors work mainly from requests, mentees and sessions; Startups is the
// match feed for mentors who reach out first.
export const mentorNavigation = [
  ["home", "Home", "home"],
  ["requests", "Requests", "inbox"],
  ["discover", "Startups", "search"],
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

// Tablets always start with the icon rail; opening it lays the full sidebar
// over the page for the moment, and is not remembered.
const tabletWidth = "(min-width: 761px) and (max-width: 1250px)";
function useTablet() {
  const [tablet, setTablet] = useState(
    () => window.matchMedia(tabletWidth).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(tabletWidth);
    const change = () => setTablet(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return tablet;
}

// The avatar opens the account actions at either width. The menu sits
// beside the sidebar, level with the avatar.
function AccountMenu({ name, role, actions }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const items = () => [...(menuRef.current?.querySelectorAll("button") || [])];
  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const close = () => {
      setOpen(false);
      triggerRef.current?.focus();
    };
    const escape = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    };
    // A click on another control lands there; anywhere else, focus comes
    // back to the avatar once the click is done.
    const outside = (event) => {
      if (event.target.closest(".account-menu, .user-mini-trigger")) return;
      setOpen(false);
      requestAnimationFrame(() => {
        if (
          !document.activeElement?.closest(
            "button, a[href], input, select, textarea",
          )
        )
          triggerRef.current?.focus();
      });
    };
    document.addEventListener("keydown", escape, true);
    document.addEventListener("pointerdown", outside, true);
    return () => {
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [open]);
  const move = (event) => {
    const list = items();
    const at = list.indexOf(document.activeElement);
    const next = {
      ArrowDown: (at + 1) % list.length,
      ArrowUp: (at - 1 + list.length) % list.length,
      Home: 0,
      End: list.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    list[next]?.focus();
  };
  return (
    <div className="account-menu-anchor">
      <button
        ref={triggerRef}
        className="user-mini-trigger"
        aria-label={`Account menu for ${name}`}
        title={name}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="sidebar-account-menu"
        onClick={() => {
          const avatar = triggerRef.current.getBoundingClientRect();
          const sidebar = triggerRef.current
            .closest(".sidebar")
            .getBoundingClientRect();
          setPlace({
            left: `calc(${sidebar.right}px + var(--space-3))`,
            bottom: window.innerHeight - avatar.bottom,
          });
          setOpen((value) => !value);
        }}
      >
        {actions.avatar}
      </button>
      {/* On the page body, so page content never covers it. */}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="account-menu"
            id="sidebar-account-menu"
            style={place}
            role="menu"
            aria-label={`Account menu for ${name}`}
            onKeyDown={move}
            onBlur={(event) => {
              // Tabbing out closes the menu without pulling focus back.
              if (!event.currentTarget.contains(event.relatedTarget))
                setOpen(false);
            }}
          >
            <div className="account-menu-head" aria-hidden="true">
              <strong>{name}</strong>
              <span>{role}</span>
            </div>
            {actions.list.map(({ label, run }) => (
              <button
                key={label}
                role="menuitem"
                tabIndex={-1}
                className="account-menu-item"
                onClick={() => {
                  setOpen(false);
                  // Focus first, so a cancelled sign-out returns to the avatar.
                  triggerRef.current?.focus();
                  run();
                }}
              >
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function Sidebar() {
  const { state, model, onAction } = useApp();
  const tablet = useTablet();
  const [saved, setSaved] = useState(readSidebar);
  const [overlay, setOverlay] = useState(false);
  const toggleRef = useRef(null);
  const rail = tablet ? !overlay : saved === "collapsed";
  useEffect(() => applySidebar(saved), [saved]);
  // Opening a page, or leaving tablet width, closes the overlay.
  useEffect(() => setOverlay(false), [state.page, state.role, tablet]);
  useEffect(() => {
    if (!overlay) return;
    const escape = (event) => {
      if (event.key !== "Escape") return;
      setOverlay(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [overlay]);
  const toggle = () => {
    // Safari does not focus a clicked button; keep focus here in every browser.
    toggleRef.current?.focus();
    if (tablet) return setOverlay((open) => !open);
    const next = rail ? "expanded" : "collapsed";
    saveSidebar(next);
    setSaved(next);
  };
  const otherRole = state.role === "founder" ? "mentor" : "founder";
  const accountActions = [
    ...(state.bothRoles
      ? [
          {
            label: `Switch to ${otherRole}`,
            run: () =>
              onAction({
                action: "choose-role",
                roleChoice: otherRole,
                goHome: true,
              }),
          },
        ]
      : []),
    {
      label: "Sign out",
      run: (event) => onAction({ action: "request-sign-out" }, event),
    },
  ];
  const avatar = (
    <Avatar
      image={
        // The person, not the startup: a founder's own photo first.
        state.profiles[state.role].personImage ||
        state.profiles[state.role].image
      }
      name={model.roleName()}
      identity={state.accountId}
    />
  );
  const incoming = state.incomingByRole[state.role].size;
  return (
    <>
      <aside
        className={`sidebar${rail ? " is-rail" : ""}${overlay ? " is-overlay" : ""}`}
        id="workspace-sidebar"
        aria-label="Workspace sidebar"
      >
        {/* The toggle keeps one place at either width; the brand is
            revealed beside it. */}
        <div className="sidebar-head">
          <button
            ref={toggleRef}
            className="sidebar-toggle"
            aria-expanded={!rail}
            aria-controls="workspace-sidebar"
            aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
            title={rail ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggle}
          >
            <Icon name="panel" />
          </button>
          <Brand />
        </div>
        <nav className="nav" aria-label="Main navigation">
          {primaryNavigation(state.role).map(([page, label, icon]) => {
            const count = ["waiting", "requests"].includes(page) ? incoming : 0;
            return (
              <NavButton key={page} page={page} count={count}>
                <span className="nav-icon">
                  <Icon name={icon} />
                </span>
                <span className="nav-label">{label}</span>
                {count > 0 && (
                  <span className="nav-count">
                    <span className="visually-hidden">, </span>
                    {count}
                    <span className="visually-hidden"> waiting for you</span>
                  </span>
                )}
              </NavButton>
            );
          })}
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
        {/* One footer row at either width: avatar, then name, role and
            Sign out. */}
        <div className="user-mini">
          <AccountMenu
            name={model.roleName()}
            role={model.roleLabel()}
            actions={{ avatar, list: accountActions }}
          />
          <div className="user-mini-copy">
            <div className="user-mini-name">{model.roleName()}</div>
            <div className="user-mini-role">{model.roleLabel()}</div>
          </div>
          <button
            className="user-mini-signout"
            aria-label="Sign out"
            title="Sign out"
            disabled={state.busy}
            onClick={(event) => onAction({ action: "request-sign-out" }, event)}
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      {overlay && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setOverlay(false)}
        />
      )}
    </>
  );
}
