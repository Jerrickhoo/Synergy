import { useState } from "react";
import SelectField from "./SelectField.jsx";
import Icon from "./Icon.jsx";
import { useApp } from "../state/AppContext.jsx";
import { profileEntries } from "../data/profile-content.js";

// Toggle chips replace typed tags; the hidden input keeps FormData unchanged.
function TagPicker({ name, label, help, value, vocabulary, onChange }) {
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
      <span className="tag-picker-label" id={`${id}-label`}>
        {label}
      </span>
      <div
        className="tag-choices"
        role="group"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-help`}
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
      <p className="field-help" id={`${id}-help`}>
        {help}
      </p>
      <input type="hidden" name={name} value={selected.join(", ")} />
    </div>
  );
}

export default function ProfileOptions({
  profile,
  founder = true,
  onFieldChange,
}) {
  const { state } = useApp();
  const vocabulary = state.vocabulary || [];
  return (
    <fieldset className="profile-options" disabled={state.busy}>
      <legend className="visually-hidden">Collaboration preferences</legend>
      <div className="field">
        <label htmlFor="profile-goals">Goals for collaborating</label>
        <textarea
          id="profile-goals"
          name="goals"
          defaultValue={profile.goals || ""}
          maxLength={2000}
          placeholder="For example: validate onboarding with 20 student testers"
        />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="profile-engagement">Engagement preference</label>
          <SelectField
            id="profile-engagement"
            name="engagementPreference"
            defaultValue={profile.engagementPreference || ""}
          >
            <option value="">Not specified</option>
            <option value="one-off">One-off</option>
            <option value="ongoing">Ongoing</option>
            <option value="either">Either</option>
          </SelectField>
        </div>
        {founder && (
          <div className="field">
            <label htmlFor="profile-audience">Audience size</label>
            <input
              id="profile-audience"
              name="audienceSize"
              type="number"
              min="0"
              step="1"
              defaultValue={profile.audienceSize || ""}
              aria-describedby="profile-audience-help"
            />
            <span className="field-help" id="profile-audience-help">
              Used to compare audience sizes for co-marketing.
            </span>
          </div>
        )}
      </div>
      <TagPicker
        name="offerTags"
        label="Offer tags"
        help="Approved tags for what you can offer. They help suggest better matches."
        value={profile.offerTags}
        vocabulary={vocabulary}
        onChange={onFieldChange}
      />
      <TagPicker
        name="needTags"
        label="Need tags"
        help="Approved tags for the help you’re looking for."
        value={profile.needTags}
        vocabulary={vocabulary}
        onChange={onFieldChange}
      />
    </fieldset>
  );
}
