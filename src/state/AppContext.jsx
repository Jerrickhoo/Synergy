import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { enableMapSet, produce } from "immer";
import { createInitialState, createModel } from "../data/model.js";
import { fieldKey, readField } from "./fields.js";
import { transition } from "./transitions.js";
import { applyRoute, parseRoute, routeHash } from "./routes.js";
enableMapSet();
const AppContext = createContext(null);
const reducer = (state, payload) =>
  produce(state, (draft) => {
    if (payload.action === "route-change") applyRoute(draft, payload.route);
    else transition(draft, payload);
    if (!draft.authenticated) {
      draft.notificationOpen = false;
      draft.demoOpen = false;
      draft.moreOpen = false;
    }
  });
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const initial = createInitialState();
    applyRoute(initial, parseRoute(window.location.hash));
    return initial;
  });
  const lastRouteTick = useRef(null);
  const model = useMemo(() => createModel(state), [state]);
  useEffect(() => {
    if (!state.toast) return;
    const timer = setTimeout(
      () =>
        dispatch({
          action: "clear-toast",
        }),
      2600,
    );
    return () => clearTimeout(timer);
  }, [state.toast]);
  useEffect(() => {
    if (!state.confirmation) return;
    const timer = setTimeout(
      () =>
        dispatch({
          action: "dismiss-confirmation",
        }),
      5000,
    );
    return () => clearTimeout(timer);
  }, [state.confirmation]);
  useEffect(() => {
    if (!state.onboarding.verifying) return;
    const timer = setTimeout(
      () =>
        dispatch({
          action: "verification-done",
        }),
      1000,
    );
    return () => clearTimeout(timer);
  }, [state.onboarding.verifying]);
  useEffect(() => {
    if (!state.onboarding.analyzing) return;
    const timer = setTimeout(
      () =>
        dispatch({
          action: "analysis-done",
        }),
      900,
    );
    return () => clearTimeout(timer);
  }, [state.onboarding.analyzing]);
  useEffect(() => {
    const onHashChange = () =>
      dispatch({
        action: "route-change",
        route: parseRoute(window.location.hash),
      });
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  useEffect(() => {
    const hash = routeHash(state);
    if (window.location.hash !== hash) {
      const method =
        lastRouteTick.current !== state.routeTick
          ? "replaceState"
          : "pushState";
      window.history[method](null, "", hash);
    }
    lastRouteTick.current = state.routeTick;
  }, [
    state.authenticated,
    state.page,
    state.activeMatch,
    state.activeRoomId,
    state.routeTick,
    state.routePath,
  ]);
  function onAction(payload, event) {
    event?.preventDefault();
    if (payload.action === "skip-to-content") {
      event.currentTarget.parentElement.querySelector("main")?.focus();
      return;
    }
    if (payload.action === "verify-email") {
      const email = readField(state, "verify-email");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        dispatch({
          action: "set-toast",
          message: "Enter a valid email address.",
        });
        return;
      }
    }
    if (payload.action === "lock-terms") {
      const form = event.currentTarget.form;
      if (!form.reportValidity()) return;
      payload = {
        ...payload,
        values: Object.fromEntries(new FormData(form)),
      };
    }
    dispatch({
      ...payload,
      roomId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    });
  }
  function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    dispatch({
      form: form.dataset.form || form.id,
      id: form.dataset.id,
      values: Object.fromEntries(new FormData(form)),
      timestamp: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      time: new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    });
    if (form.id === "chat-form") form.reset();
  }
  function onTabKeyDown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [
      ...event.currentTarget.parentElement.querySelectorAll('[role="tab"]'),
    ];
    const index = tabs.indexOf(event.currentTarget);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length;
    event.preventDefault();
    tabs[nextIndex].click();
    tabs[nextIndex].focus({
      preventScroll: true,
    });
  }
  const value = {
    state,
    model,
    onAction,
    onSubmit,
    onTabKeyDown,
    onFilter: (key, value) =>
      dispatch({
        action: "set-filter",
        key,
        value,
      }),
    onField: (id, value) =>
      dispatch({
        action: "set-field",
        key: fieldKey(state, id),
        value,
      }),
    fieldValue: (id, fallback) => readField(state, id, fallback),
    onRating: (value) =>
      dispatch({
        action: "set-rating",
        value,
      }),
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() {
  return useContext(AppContext);
}
