import { useEffect, useRef } from "react";
import { useApp } from "../state/AppContext.jsx";
import Brand from "./Brand.jsx";
import Icon from "./Icon.jsx";
import NavButton from "./NavButton.jsx";
import { primaryNavigation, workspaceNavigation } from "./Sidebar.jsx";
import { lockDocumentScroll } from "../state/scroll-lock.js";
export default function MobileMenu() {
  const { state, onAction } = useApp();
  const ref = useRef(null);
  const currentPage = useRef(state.page);
  currentPage.current = state.page;
  useEffect(() => {
    if (!state.moreOpen) return;
    const opener = document.getElementById("navigation-toggle");
    const openedPage = state.page;
    const unlock = lockDocumentScroll();
    ref.current?.querySelector("button")?.focus();
    return () => {
      unlock();
      if (currentPage.current === openedPage)
        queueMicrotask(() => {
          if (!document.querySelector("dialog[open]")) opener?.focus();
        });
    };
  }, [state.moreOpen]);
  if (!state.moreOpen) return null;
  return (
    <div
      className="drawer-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget)
          onAction({ action: "close-overlays" });
      }}
    >
      <section
        ref={ref}
        className="mobile-more-sheet"
        id="mobile-more-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Workspace navigation"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = [
            ...ref.current.querySelectorAll(
              "button:not([disabled]), a[href], input:not([disabled])",
            ),
          ];
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="drawer-head">
          <Brand compact />
          <button
            className="icon-btn"
            aria-label="Close navigation"
            onClick={() => onAction({ action: "close-overlays" })}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav className="drawer-nav" aria-label="Mobile navigation">
          {[...primaryNavigation(state.role), ...workspaceNavigation].map(
            ([page, label, icon]) => (
              <NavButton key={page} page={page}>
                <Icon name={icon} />
                {label}
              </NavButton>
            ),
          )}
          {state.isAdmin && (
            <NavButton page="moderation">
              <Icon name="shield" />
              Moderation
            </NavButton>
          )}
        </nav>
        <button
          className="btn full"
          disabled={state.busy}
          onClick={(event) => onAction({ action: "request-sign-out" }, event)}
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
