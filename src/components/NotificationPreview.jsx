import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../state/AppContext.jsx";
import NotificationRow, { useUpdateClock } from "./NotificationRow.jsx";
import Icon from "./Icon.jsx";

export default function NotificationPreview({ headerRef, actionsRef }) {
  const { state, onAction } = useApp();
  const now = useUpdateClock();
  const ref = useRef(null);
  const [placement, setPlacement] = useState(null);
  useLayoutEffect(() => {
    const position = () => {
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft || 0;
      const viewportTop = viewport?.offsetTop || 0;
      const width = viewport?.width || innerWidth;
      const height = viewport?.height || innerHeight;
      const top = Math.max(
        viewportTop + 8,
        headerRef.current.getBoundingClientRect().bottom + 8,
      );
      const panelWidth = Math.min(440, width - 24);
      const right = actionsRef.current.getBoundingClientRect().right;
      let scale = 1;
      for (let element = ref.current; element; element = element.parentElement)
        scale *= Number.parseFloat(getComputedStyle(element).zoom) || 1;
      setPlacement({
        top: top / scale,
        left:
          Math.max(
            viewportLeft + 12,
            Math.min(
              right - panelWidth,
              viewportLeft + width - panelWidth - 12,
            ),
          ) / scale,
        width: panelWidth / scale,
        maxHeight: Math.max(0, viewportTop + height - top - 12) / scale,
      });
    };
    const close = (returnFocus = false) => {
      onAction({ action: "close-notifications" });
      if (returnFocus) document.getElementById("notification-toggle")?.focus();
    };
    const escape = (event) => {
      if (event.key === "Escape") close(true);
    };
    const outside = (event) => {
      if (!event.target.closest("#notification-panel, #notification-toggle"))
        close();
    };
    const competing = (event) => {
      if (event.detail !== "notifications") close();
    };
    const observer = new ResizeObserver(position);
    observer.observe(headerRef.current);
    observer.observe(actionsRef.current);
    position();
    ref.current.querySelector(".notification-preview-heading button")?.focus();
    document.addEventListener("keydown", escape, true);
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("synergy:popover", competing);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("synergy:popover", competing);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [headerRef, actionsRef]);
  const activity = (state.notifications || []).slice(0, 6);
  return createPortal(
    <section
      ref={ref}
      id="notification-panel"
      className="notification-panel"
      aria-label="Notifications"
      style={placement || { visibility: "hidden" }}
    >
      <div className="notification-preview-heading">
        <h2>Updates</h2>
        <button
          className="icon-btn"
          aria-label="Close notifications"
          onClick={() => {
            onAction({ action: "close-notifications" });
            document.getElementById("notification-toggle")?.focus();
          }}
        >
          <Icon name="close" />
        </button>
      </div>
      <div
        className="notification-preview-body"
        role="region"
        aria-label="Recent updates"
        tabIndex={0}
      >
        {state.incomingByRole[state.role].size > 0 && (
          <button
            className="btn small"
            onClick={() => onAction({ page: "waiting" })}
          >
            Respond to introductions ({state.incomingByRole[state.role].size})
          </button>
        )}
        {activity.length ? (
          activity.map((item) => (
            <NotificationRow key={item.id} item={item} now={now} compact />
          ))
        ) : (
          <p className="notification-preview-empty">
            No updates yet. You're all caught up.
          </p>
        )}
      </div>
      <div className="notification-preview-footer">
        <button
          className="link-btn"
          onClick={() => onAction({ page: "notifications" })}
        >
          View all updates and preferences <Icon name="arrow" />
        </button>
      </div>
    </section>,
    document.body,
  );
}
