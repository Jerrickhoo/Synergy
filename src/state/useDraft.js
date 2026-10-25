import { useEffect, useState } from "react";

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
    !draft.dirty || JSON.stringify(draft.values) === serialized
      ? { values: initial, version, dirty: false }
      : draft;
  useEffect(() => {
    setDraft((current) => {
      if (!current.dirty || JSON.stringify(current.values) === serialized)
        return { values: JSON.parse(serialized), version, dirty: false };
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
