import { useEffect, useState, useRef } from "react";
import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";

function ToastMessage({ message, type, title, field, dismiss }) {
  const timerRef = useRef(null);
  const elementRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  // Errors stay until dismissed, except a summary of errors already shown
  // beside the fields: it would otherwise cover the form being corrected.
  const duration = type === "error" && !field ? null : field ? 6000 : 5000;
  useEffect(() => {
    if (paused || duration === null) return;
    timerRef.current = setTimeout(() => {
      if (!elementRef.current?.matches(":hover, :focus-within")) dismiss();
    }, duration);
    return () => clearTimeout(timerRef.current);
  }, [paused, duration, dismiss]);
  // Fixing a field (typing or picking a value) means the summary has done
  // its job. Deferred like onFormInput: changing state during the input
  // event made controlled fields drop that keystroke.
  useEffect(() => {
    if (!field) return;
    const fixing = (event) => {
      if (!elementRef.current?.contains(event.target)) setTimeout(dismiss);
    };
    document.addEventListener("input", fixing, true);
    document.addEventListener("change", fixing, true);
    return () => {
      document.removeEventListener("input", fixing, true);
      document.removeEventListener("change", fixing, true);
    };
  }, [field, dismiss]);
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
      field={state.toastField}
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
