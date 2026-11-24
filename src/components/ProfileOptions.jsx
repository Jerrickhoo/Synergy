import { useState } from "react";
import Icon from "./Icon.jsx";
import { profileEntries } from "../data/profile-content.js";

// Toggle chips replace typed tags; the hidden input keeps FormData unchanged.
// `inNamedGroup` is for a picker that fills a card whose legend already names
// the group, so it adds no label or group of its own.
export function TagPicker({
  name,
  label,
  help,
  inNamedGroup = false,
  value,
  vocabulary,
  onChange,
}) {
  const [selected, setSelected] = useState(() => profileEntries(value));
  // Saved tags that left the vocabulary stay visible so they can be removed.
  const choices = [...new Set([...vocabulary, ...selected])];
  const id = `profile-${name}`;
  function toggle(tag) {
    const next = selected.includes(tag)
      ? selected.filter((item) => item !== tag)
      : [...selected, tag];
    const ordered = choices.filter((item) => next.includes(item));
    setSelected(ordered);
    onChange?.(name, ordered.join(", "));
  }
  return (
    <div className="field">
      {!inNamedGroup && (
        <span className="tag-picker-label" id={`${id}-label`}>
          {label}
        </span>
      )}
      <div
        className="tag-choices"
        id={`${id}-choices`}
        role={inNamedGroup ? undefined : "group"}
        aria-labelledby={inNamedGroup ? undefined : `${id}-label`}
        aria-describedby={help ? `${id}-help` : undefined}
      >
        {choices.map((tag) => {
          const pressed = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              className="tag-choice"
              aria-pressed={pressed}
              onClick={() => toggle(tag)}
            >
              {pressed && <Icon name="check" />}
              {tag}
            </button>
          );
        })}
      </div>
      {help && (
        <p className="field-help" id={`${id}-help`}>
          {help}
        </p>
      )}
      <input type="hidden" name={name} value={selected.join(", ")} />
    </div>
  );
}
