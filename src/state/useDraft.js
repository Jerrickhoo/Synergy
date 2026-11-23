import { useEffect, useState } from "react";

const fieldValue = (value) =>
  value == null
    ? ""
    : typeof value === "string"
      ? value
      : JSON.stringify(value);

// A draft matches the saved record when every field reads the same. Saved
// records can carry fields the form never edited (optional template terms are
// stored as ""), so an absent field reads as empty and key order is ignored.
export function sameDraftValues(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const key of keys)
    if (fieldValue(a?.[key]) !== fieldValue(b?.[key])) return false;
  return true;
}

// Drafts are scoped to one account and browser tab. They never enter API state.
export function useDraft(key, initial, version = 0) {
  const storageKey = `synergy-draft:${key}`;
  const [draft, setDraft] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (saved?.values && typeof saved.values === "object") return saved;
    } catch {
      /* Storage may be disabled. Editing still works. */
    }
    return { values: initial, version, dirty: false };
  });
  const serialized = JSON.stringify(initial);
  // A clean form must expose the current revision in the same render that
  // enables editing. Waiting for an effect leaves a race after reopening terms.
  const effective =
    !draft.dirty || sameDraftValues(draft.values, initial)
      ? { values: initial, version, dirty: false }
      : draft;
  useEffect(() => {
    setDraft((current) => {
      const saved = serialized === undefined ? initial : JSON.parse(serialized);
      if (!current.dirty || sameDraftValues(current.values, saved))
        return { values: saved, version, dirty: false };
      return current;
    });
  }, [serialized, version]);
  useEffect(() => {
    try {
      if (draft.dirty)
        sessionStorage.setItem(storageKey, JSON.stringify(draft));
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* Avoid blocking editing when browser storage is unavailable. */
    }
  }, [storageKey, draft]);
  const clear = () => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Optional storage. */
    }
    setDraft({ values: initial, version, dirty: false });
  };
  return {
    ...effective,
    conflict: effective.dirty && effective.version !== version,
    update: (values) => {
      const next = { values, version: effective.version, dirty: true };
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* Editing remains possible without browser storage. */
      }
      setDraft(next);
    },
    clear,
  };
}
