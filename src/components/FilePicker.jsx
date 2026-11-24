import { useRef, useState } from "react";
import Icon from "./Icon.jsx";

// A styled file chooser in place of the browser's own "Choose File" control.
// The native input stays in the form for FormData and required validation;
// its label still opens the picker.
export default function FilePicker({
  id,
  name = "file",
  accept,
  required = false,
  disabled = false,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  onChange,
}) {
  const input = useRef(null);
  const [fileName, setFileName] = useState("");
  return (
    <div className="file-picker">
      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        className="visually-hidden"
        accept={accept}
        required={required}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        onChange={(event) => {
          setFileName(event.target.files?.[0]?.name || "");
          onChange?.(event);
        }}
      />
      <button
        type="button"
        className="btn small"
        disabled={disabled}
        aria-controls={id}
        onClick={() => input.current?.click()}
      >
        <Icon name="upload" />
        Choose file
      </button>
      <span
        className={fileName ? "file-picker-name" : "file-picker-name muted"}
      >
        {fileName || "No file chosen"}
      </span>
    </div>
  );
}
