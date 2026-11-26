import { useState } from "react";
import Icon from "./Icon.jsx";
import { profileEntries } from "../data/profile-content.js";
import { tagGroups } from "../data/collaboration-types.js";

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
  // Tags already chosen on the other side (needs vs offers): shown greyed
  // out, because something you need can't also be something you offer.
  taken = "",
  takenBy = "",
  // Lists the tags under the collaboration type each one serves.
  grouped = false,
}) {
  const [selected, setSelected] = useState(() => profileEntries(value));
  const blocked = profileEntries(taken);
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
  const chip = (tag) => {
    const pressed = selected.includes(tag);
    // A tag picked on the other side can't be picked here; one saved on both
    // sides before this rule can still be removed.
    const unavailable = !pressed && blocked.includes(tag);
    return (
      <button
        key={tag}
        type="button"
        className={`tag-choice${unavailable ? " is-unavailable" : ""}`}
        aria-pressed={pressed}
        aria-disabled={unavailable || undefined}
        title={unavailable ? `Already in ${takenBy}` : undefined}
        onClick={() => !unavailable && toggle(tag)}
      >
        {pressed && <Icon name="check" />}
        {tag}
      </button>
    );
  };
  return (
    <div className="field">
      {!inNamedGroup && (
        <span className="tag-picker-label" id={`${id}-label`}>
          {label}
        </span>
      )}
      <div
        className={`tag-choices${grouped ? " is-grouped" : ""}`}
        id={`${id}-choices`}
        role={inNamedGroup ? undefined : "group"}
        aria-labelledby={inNamedGroup ? undefined : `${id}-label`}
        aria-describedby={help ? `${id}-help` : undefined}
      >
        {grouped
          ? tagGroups(choices).map((group) => (
              <div
                className="tag-group"
                key={group.id}
                role="group"
                aria-label={group.label}
              >
                <span className="tag-group-label" aria-hidden="true">
                  {group.label}
                </span>
                <div className="tag-group-choices">{group.tags.map(chip)}</div>
              </div>
            ))
          : choices.map(chip)}
      </div>
      {help && (
        <p className="field-help" id={`${id}-help`}>
          {help}
        </p>
      )}
      {blocked.length > 0 && takenBy && (
        <p className="field-help tag-taken-help">
          Greyed-out tags are already in {takenBy}.
        </p>
      )}
      <input type="hidden" name={name} value={selected.join(", ")} />
    </div>
  );
}
