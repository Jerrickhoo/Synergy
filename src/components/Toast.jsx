import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";

function ToastMessage({ message, type, title, dismiss }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const duration = type === "error" ? 8000 : 5000;
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [paused, duration, dismiss]);
  return (
    <div
      className={`toast toast-${type}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
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
        <strong>
          {title ||
            {
              error: "Something went wrong",
              success: "All set",
              info: "Good to know",
            }[type]}
        </strong>
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
