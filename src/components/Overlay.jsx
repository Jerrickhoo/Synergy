import { useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.jsx";
import { lockDocumentScroll } from "../state/scroll-lock.js";

export default function Overlay({
  id,
  title,
  titleIcon,
  onClose,
  children,
  footer,
  initialFocusSelector,
  busy = false,
}) {
  const titleId = useId();
  const ref = useRef(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    const unlock = lockDocumentScroll();
    dialog.showModal();
    if (initialFocusSelector)
      dialog.querySelector(initialFocusSelector)?.focus();
    return () => {
      dialog.close();
      unlock();
    };
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      id={id}
      className="discovery-overlay"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...ref.current.querySelectorAll(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ].filter(
          (control) => control.tabIndex >= 0 && control.getClientRects().length,
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          if (!busy) onClose();
      }}
    >
      <div className="discovery-overlay-header">
        <h2 id={titleId}>
          {titleIcon}
          {title}
        </h2>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          autoFocus={!initialFocusSelector}
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div
        className="discovery-overlay-body"
        role="region"
        aria-label={`${title} details`}
        tabIndex={0}
      >
        {children}
      </div>
      {footer && <div className="discovery-overlay-footer">{footer}</div>}
    </dialog>,
    document.body,
  );
}
