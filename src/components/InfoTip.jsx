import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.jsx";

// A small "i" that explains on hover, on keyboard focus or on a tap, and
// closes on Escape. The panel is fixed to the viewport so a scrolling table
// never clips it.
export default function InfoTip({ label, children }) {
  const id = useId();
  const button = useRef(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(null);
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = button.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(340, window.innerWidth - 16);
      const below = window.innerHeight - rect.bottom > 260;
      setPlace({
        left: Math.max(
          8,
          Math.min(rect.left - width / 2, window.innerWidth - width - 8),
        ),
        width,
        ...(below
          ? { top: rect.bottom + 8 }
          : { bottom: window.innerHeight - rect.top + 8 }),
      });
    };
    measure();
    const close = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    document.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <span
      className="info-tip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={button}
        type="button"
        className="info-tip-button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="info" />
      </button>
      {open &&
        place &&
        createPortal(
          <span role="tooltip" id={id} className="info-tip-panel" style={place}>
            {children}
          </span>,
          document.body,
        )}
    </span>
  );
}
