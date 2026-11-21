import { useEffect, useRef } from "react";

// Applied match filters stay for this browser tab, per account and role, like
// drafts. The synergy-draft: prefix means sign-out clears them with drafts.
export function useMatchFilterMemory(state, dispatch) {
  const key =
    state.authenticated && state.accountId
      ? `synergy-draft:${state.accountId}:match-filters:${state.role}`
      : "";
  const restored = useRef("");
  useEffect(() => {
    if (!key || restored.current === key) return;
    restored.current = key;
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(key))?.filters;
    } catch {
      /* Storage may be disabled. Filters then start fresh. */
    }
    dispatch({ action: "restore-filters", filters: saved });
  }, [key, dispatch]);
  const serialized = JSON.stringify(state.matchFilters);
  useEffect(() => {
    // Wait until this key's saved filters are back before writing over them.
    if (!key || restored.current !== key) return;
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ filters: JSON.parse(serialized) }),
      );
    } catch {
      /* Filtering works without browser storage. */
    }
  }, [key, serialized]);
}
