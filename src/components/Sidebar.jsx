import { useEffect, useLayoutEffect, useRef, useState } from "react";
import NavButton from "./NavButton.jsx";
import Brand from "./Brand.jsx";
import Icon from "./Icon.jsx";
import { useApp } from "../state/AppContext.jsx";
import { applySidebar, readSidebar, saveSidebar } from "../state/sidebar.js";

// Activity is the dated record of requests and deals, with
// what each status means, plus the full activity log.
export const navigation = [
  ["home", "Home", "home"],
  ["discover", "Matches", "search"],
  ["waiting", "Requests", "inbox"],
  ["rooms", "Rooms", "rooms"],
  ["activity", "Activity", "history"],
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
  ["activity", "Activity", "history"],
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

// The rail and open widths come from the theme (--rail-width and
// --sidebar-open-width), so the handle snaps to what the CSS draws.
function sidebarWidths() {
  const style = getComputedStyle(document.documentElement);
  const read = (name, fallback) =>
    parseFloat(style.getPropertyValue(name)) || fallback;
  const rail = read("--rail-width", 90);
  const open = read("--sidebar-open-width", 252);
  return { rail, open, max: open + 72 };
}

// A pointer has to travel this far before a press on the handle counts as a
// drag; anything shorter is a click, which toggles the sidebar.
const dragThreshold = 4;

export default function Sidebar() {
  const { state, onAction } = useApp();
  const tablet = useTablet();
  const [saved, setSaved] = useState(readSidebar);
  const [overlay, setOverlay] = useState(false);
  // The sidebar's width while the handle is being dragged, else null.
  const [drag, setDrag] = useState(null);
  const handleRef = useRef(null);
  const asideRef = useRef(null);
  const rail = tablet ? !overlay : saved === "collapsed";
  const widths = useRef(null);
  // While dragging, the labels show or hide as the width passes the midpoint.
  const midpoint = widths.current
    ? (widths.current.rail + widths.current.open) / 2
    : 0;
  const shownAsRail = drag === null ? rail : drag < midpoint;
  useEffect(() => applySidebar(saved), [saved]);
  // Opening a page, or leaving tablet width, closes the overlay.
  useEffect(() => setOverlay(false), [state.page, state.role, tablet]);
  useEffect(() => {
    if (!overlay) return;
    const escape = (event) => {
      if (event.key !== "Escape") return;
      setOverlay(false);
      handleRef.current?.focus();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [overlay]);
  // On desktop the page follows the handle as it moves; tablets slide the
  // sidebar over the page instead. Transitions pause until the drag ends.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (drag === null) {
      root.style.removeProperty("--sidebar-width");
      delete root.dataset.sidebarDragging;
      return;
    }
    root.dataset.sidebarDragging = "true";
    if (!tablet) root.style.setProperty("--sidebar-width", `${drag}px`);
  }, [drag, tablet]);
  useEffect(
    () => () => {
      document.documentElement.style.removeProperty("--sidebar-width");
      delete document.documentElement.dataset.sidebarDragging;
    },
    [],
  );

  const setOpen = (open) => {
    if (tablet) return setOverlay(open);
    const next = open ? "expanded" : "collapsed";
    saveSidebar(next);
    setSaved(next);
  };
  const toggle = () => setOpen(rail);

  const startDrag = (event) => {
    if (event.button !== 0) return;
    const handle = event.currentTarget;
    const left = asideRef.current.getBoundingClientRect().left;
    const startX = event.clientX;
    widths.current = sidebarWidths();
    const { rail: railWidth, open, max } = widths.current;
    const clamp = (x) => Math.min(max, Math.max(railWidth, x - left));
    let moved = false;
    handle.setPointerCapture?.(event.pointerId);
    // Keep focus on the handle in every browser, as a click would.
    handle.focus({ preventScroll: true });
    event.preventDefault();
    const move = (next) => {
      if (!moved && Math.abs(next.clientX - startX) < dragThreshold) return;
      moved = true;
      setDrag(clamp(next.clientX));
    };
    const finish = (end, cancelled = false) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", cancel);
      handle.releasePointerCapture?.(end.pointerId);
      setDrag(null);
      if (cancelled) return;
      if (!moved) return toggle();
      setOpen(clamp(end.clientX) >= (railWidth + open) / 2);
    };
    const up = (end) => finish(end);
    const cancel = (end) => finish(end, true);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", cancel);
  };
  // The keyboard version of the same handle (WAI-ARIA window splitter).
  const keyDown = (event) => {
    const open = {
      ArrowLeft: false,
      Home: false,
      ArrowRight: true,
      End: true,
      Enter: rail,
      " ": rail,
    }[event.key];
    if (open === undefined) return;
    event.preventDefault();
    setOpen(open);
  };

  const incoming = state.incomingByRole[state.role].size;
  const handleLabel = shownAsRail
    ? "Drag or click to expand the sidebar"
    : "Drag or click to collapse the sidebar";
  return (
    <>
      <aside
        ref={asideRef}
        className={`sidebar${shownAsRail ? " is-rail" : ""}${overlay || (tablet && drag !== null) ? " is-overlay" : ""}${drag !== null ? " is-dragging" : ""}`}
        id="workspace-sidebar"
        aria-label="Workspace sidebar"
        style={tablet && drag !== null ? { width: `${drag}px` } : undefined}
      >
        <div className="sidebar-head">
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
        {/* The account itself lives at the top right; the footer keeps only
            Sign out, in the danger colour so it is never pressed by mistake
            for a navigation item. */}
        <div className="user-mini sidebar-signout-row">
          <button
            className="sidebar-signout"
            aria-label="Sign out"
            title="Sign out"
            // Never disabled: a click during a save is ignored (see
            // request-sign-out), so the button doesn't flash on every save.
            onClick={(event) => onAction({ action: "request-sign-out" }, event)}
          >
            <span className="nav-icon">
              <Icon name="logout" />
            </span>
            <span className="nav-label" aria-hidden="true">
              Sign out
            </span>
          </button>
        </div>
      </aside>
      {/* Drag the sidebar's edge to open or close it; a click toggles it and
          the arrow keys work from the keyboard. */}
      <div
        ref={handleRef}
        className={`sidebar-resizer${overlay ? " is-overlay" : ""}${drag !== null ? " is-dragging" : ""}`}
        role="separator"
        aria-orientation="vertical"
        aria-controls="workspace-sidebar"
        aria-label="Resize sidebar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rail ? 0 : 100}
        aria-valuetext={rail ? "Collapsed" : "Expanded"}
        title={handleLabel}
        tabIndex={0}
        style={tablet && drag !== null ? { left: `${drag}px` } : undefined}
        onPointerDown={startDrag}
        onKeyDown={keyDown}
      >
        <span className="sidebar-resizer-grip" aria-hidden="true" />
      </div>
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
