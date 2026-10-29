import { useEffect, useState, useRef } from "react";
import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";

function ToastMessage({ message, type, title, dismiss }) {
  const timerRef = useRef(null);
  const elementRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const duration = type === "error" ? null : 5000;
  useEffect(() => {
    if (paused || duration === null) return;
    timerRef.current = setTimeout(() => {
      if (!elementRef.current?.matches(":hover, :focus-within")) dismiss();
    }, duration);
    return () => clearTimeout(timerRef.current);
  }, [paused, duration, dismiss]);
  return (
    <div
      ref={elementRef}
      className={`toast toast-${type}`}
      onMouseEnter={() => {
        clearTimeout(timerRef.current);
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => {
        clearTimeout(timerRef.current);
        setFocused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <span className="toast-icon">
        <Icon
          name={
            type === "error" ? "alert" : type === "success" ? "check" : "info"
          }
        />
      </span>
      <div className="toast-copy">
        {(title || type === "error") && (
          <strong>{title || "Something went wrong"}</strong>
        )}
        <p>{message}</p>
      </div>
      <button
        className="toast-dismiss"
        type="button"
        aria-label="Dismiss notification"
        onClick={dismiss}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}

export default function Toast() {
  const { state, dismissToast } = useApp();
  const type = state.toastType || "info";
  const message = state.toast && (
    <ToastMessage
      key={state.toastId}
      message={state.toast}
      type={type}
      title={state.toastTitle}
      dismiss={dismissToast}
    />
  );
  return (
    <div id="toast-root">
      <div role="alert" aria-atomic="true">
        {type === "error" ? message : null}
      </div>
      <div role="status" aria-atomic="true">
        {type !== "error" ? message : null}
      </div>
    </div>
  );
}
