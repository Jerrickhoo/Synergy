import { useEffect, useRef, useState } from "react";

// A textarea with a live character count. It never cuts text off: over the
// limit it says by how much, and the form won't submit until it fits.
export default function LimitedTextarea({
  id,
  name,
  label,
  limit,
  defaultValue = "",
  help,
  required = false,
  placeholder,
  minLength,
}) {
  const [length, setLength] = useState(String(defaultValue || "").length);
  const field = useRef(null);
  const over = length - limit;
  const message =
    over > 0
      ? `${over.toLocaleString("en")} ${over === 1 ? "character" : "characters"} over the ${limit.toLocaleString("en")}-character limit. Shorten it to send.`
      : "";
  useEffect(() => field.current?.setCustomValidity(message), [message]);
  const describedBy = [
    help && `${id}-help`,
    `${id}-count`,
    message && `${id}-over`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="field limited-field">
      <label htmlFor={id}>{label}</label>
      <textarea
        ref={field}
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        aria-describedby={describedBy}
        aria-invalid={over > 0 ? true : undefined}
        onChange={(event) => setLength(event.target.value.length)}
      />
      <div className="field-footer">
        {help && (
          <p className="field-help" id={`${id}-help`}>
            {help}
          </p>
        )}
        <span
          className={`field-count${over > 0 ? " over" : ""}`}
          id={`${id}-count`}
          aria-live="polite"
        >
          {length.toLocaleString("en")} / {limit.toLocaleString("en")}
        </span>
      </div>
      {message && (
        <p className="field-error" id={`${id}-over`} role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
