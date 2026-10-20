import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { enableMapSet, produce } from "immer";
import { createInitialState, createModel } from "../data/model.js";
import { fieldKey, readField } from "./fields.js";
import { transition } from "./transitions.js";
import { applyRoute, parseRoute, routeHash } from "./routes.js";
import { decode } from "./serialization.js";
import {
  errorTitle,
  fieldName,
  formValidation,
  publishToast,
} from "./feedback.js";

enableMapSet();
const AppContext = createContext(null);
function savedLoginChallenge() {
  try {
    const challenge = JSON.parse(
      sessionStorage.getItem("synergy-login-challenge"),
    );
    if (
      challenge?.expiresAt > Date.now() &&
      /^[a-f0-9]{64}$/.test(challenge.challengeId)
    )
      return challenge;
  } catch {
    /* An expired or malformed pending sign-in can be started again. */
  }
  return null;
}
const dataKeys = [
  "accountId",
  "accountName",
  "accountEmail",
  "emailVerified",
  "integrations",
  "profiles",
  "directory",
  "rooms",
  "activity",
  "savedByRole",
  "waitingByRole",
  "interestByRole",
  "incomingByRole",
  "trustHistoryByRole",
  "trustSummary",
  "isAdmin",
  "moderation",
  "vocabulary",
  "notifications",
  "notificationPreferences",
  "affiliation",
  "engagementTemplates",
  "matchingConfig",
];
const remoteActions = new Set([
  "choose-role",
  "save",
  "interest",
  "cancel-interest",
  "accept-interest",
  "decline-interest",
  "lock-terms",
  "accept-terms",
  "confirm-milestone",
  "dispute",
  "resolve-dispute",
  "launch-room",
  "reopen-terms",
  "read-notifications",
]);
const reducer = (state, payload) =>
  produce(state, (draft) => {
    if (payload.action === "restore") {
      Object.assign(draft, payload.state, {
        restoring: false,
        busy: false,
        toast: "",
        confirmation: "",
        formErrors: null,
        profileEditing: false,
      });
      applyRoute(draft, parseRoute(window.location.hash));
      if (payload.message) publishToast(draft, payload.message);
    } else if (payload.action === "remote") {
      const previousRooms = draft.rooms;
      // React can invoke a reducer twice in development. Never mutate rooms
      // owned by the action: Immer may have frozen them during the first call.
      for (const key of dataKeys)
        draft[key] =
          key === "rooms"
            ? structuredClone(payload.state[key])
            : payload.state[key];
      for (const room of Object.values(draft.rooms))
        for (const [id, item] of Object.entries(room.milestones)) {
          item.evidenceOpen =
            previousRooms[room.id]?.milestones[id]?.evidenceOpen || false;
          if (
            payload.command?.form === "evidence" &&
            payload.command.id === id &&
            payload.command.activeRoomId === room.id &&
            !payload.state.formErrors
          )
            item.evidenceOpen = false;
        }
      if (draft.connectionError && !payload.command)
        publishToast(
          draft,
          "You're connected again. Your workspace is up to date.",
        );
      draft.connectionError = "";
      if (payload.command) {
        draft.formErrors = payload.state.formErrors;
        if (payload.state.toast)
          publishToast(draft, payload.state.toast, {
            type: payload.state.formErrors ? "error" : payload.state.toastType,
            title: payload.state.toastTitle,
          });
        else if (payload.state.formErrors)
          publishToast(draft, "Review the highlighted details and try again.", {
            type: "error",
            title: errorTitle(payload.state.formErrors.scope),
          });
        draft.confirmation = payload.state.confirmation;
        if (!payload.state.formErrors) {
          if (payload.command.form === "profile-form")
            draft.profileEditing = false;
          if (payload.command.form === "report-form") draft.reportOpen = false;
          if (payload.command.action === "choose-role")
            draft.role = payload.state.role;
          if (
            ["interest", "accept-interest", "launch-room"].includes(
              payload.command.action,
            )
          ) {
            draft.page = payload.state.page;
            draft.activeRoomId = payload.state.activeRoomId;
            draft.activeWaitingMatch = payload.state.activeWaitingMatch;
            draft.roomTab = "terms";
            draft.rating = 0;
          }
        }
      }
    } else if (payload.action === "request-status") draft.busy = payload.busy;
    else if (payload.action === "request-error") {
      publishToast(draft, payload.message, {
        type: "error",
        title: errorTitle(payload.scope),
      });
      draft.formErrors = payload.fields
        ? { scope: payload.scope, fields: payload.fields }
        : null;
    } else if (payload.action === "connection-error") {
      if (draft.connectionError !== payload.message)
        publishToast(draft, payload.message, {
          type: "error",
          title: "Connection interrupted",
        });
      draft.connectionError = payload.message;
    } else if (payload.action === "clear-field-error") {
      if (draft.formErrors?.scope === payload.scope) {
        delete draft.formErrors.fields[payload.field];
        if (!Object.keys(draft.formErrors.fields).length)
          draft.formErrors = null;
      }
    } else if (payload.action === "signed-out") {
      Object.assign(draft, createInitialState(), {
        restoring: false,
      });
      if (payload.message)
        publishToast(draft, payload.message, {
          type: "error",
          title: "Please sign in again",
        });
    } else if (payload.action === "report")
      draft.reportOpen = !draft.reportOpen;
    else if (payload.action === "route-change")
      applyRoute(draft, payload.route);
    else transition(draft, payload);
    if (!draft.authenticated) {
      draft.notificationOpen = false;
      draft.demoOpen = false;
      draft.moreOpen = false;
    }
  });

export function AppProvider({ children }) {
  const [authChallenge, setAuthChallenge] = useState(savedLoginChallenge);
  const token = useRef(sessionStorage.getItem("synergy-session"));
  const revision = useRef(-1);
  const pending = useRef(false);
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const initial = createInitialState();
    initial.restoring = Boolean(token.current);
    if (!initial.restoring)
      applyRoute(initial, parseRoute(window.location.hash));
    return initial;
  });
  const model = useMemo(() => createModel(state), [state]);
  const dismissToast = useCallback(
    () => dispatch({ action: "clear-toast" }),
    [],
  );
  const notify = useCallback(
    (message, type = "success", title = "") =>
      dispatch({ action: "set-toast", message, type, title }),
    [],
  );
  const lastRouteTick = useRef(null);
  async function request(path, body) {
    let response;
    try {
      response = await fetch(`/api/${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(token.current
            ? { Authorization: `Bearer ${token.current}` }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new Error(
        "We couldn't reach the server. Check your connection and try again.",
      );
    }
    let result;
    try {
      result = decode(await response.text());
    } catch {
      throw new Error(
        "The server couldn't complete your request. Please try again.",
      );
    }
    if (!response.ok)
      throw Object.assign(
        new Error(result.error || "Something went wrong. Please try again."),
        {
          status: response.status,
          fields: result.fields,
          challenge: result.challenge,
        },
      );
    return result;
  }
  function rememberLoginChallenge(challenge) {
    setAuthChallenge(challenge);
    if (challenge) {
      token.current = null;
      sessionStorage.removeItem("synergy-session");
      sessionStorage.setItem(
        "synergy-login-challenge",
        JSON.stringify(challenge),
      );
    } else sessionStorage.removeItem("synergy-login-challenge");
  }
  function acceptSession(result) {
    token.current = result.token;
    sessionStorage.setItem("synergy-session", result.token);
    revision.current = result.revision;
    rememberLoginChallenge(null);
    window.history.replaceState(null, "", "#/");
    dispatch({
      action: "restore",
      state: result.state,
      message: "Welcome to your workspace.",
    });
  }
  useEffect(() => {
    if (!token.current) return;
    let stopped = false;
    request("state")
      .then((result) => {
        if (stopped) return;
        revision.current = result.revision;
        dispatch({ action: "restore", state: result.state });
      })
      .catch((error) => {
        if (stopped) return;
        token.current = null;
        sessionStorage.removeItem("synergy-session");
        dispatch({
          action: "signed-out",
          message:
            error.status === 401
              ? "Your session ended. Sign in to recover your saved workspace."
              : "Could not reach the workspace server. Please sign in again when it is available.",
        });
      });
    return () => {
      stopped = true;
    };
  }, []);
  useEffect(() => {
    if (!state.authenticated || state.restoring) return;
    let stopped = false;
    async function refresh() {
      if (pending.current) return;
      try {
        const result = await request(`state?role=${state.role}`);
        if (
          !stopped &&
          !pending.current &&
          result.revision >= revision.current
        ) {
          revision.current = result.revision;
          dispatch({ action: "remote", state: result.state });
        }
      } catch (error) {
        if (stopped) return;
        if (error.status === 401) {
          token.current = null;
          sessionStorage.removeItem("synergy-session");
          dispatch({
            action: "signed-out",
            message:
              "Your session ended. Sign in to recover your saved workspace.",
          });
        } else
          dispatch({
            action: "connection-error",
            message:
              "Connection interrupted. Your saved work is safe; updates will resume when the server is available.",
          });
      }
    }
    refresh();
    const timer = setInterval(refresh, 1500);
    window.addEventListener("focus", refresh);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [state.authenticated, state.restoring, state.role]);
  useEffect(() => {
    if (!state.confirmation) return;
    const timer = setTimeout(
      () => dispatch({ action: "dismiss-confirmation" }),
      5000,
    );
    return () => clearTimeout(timer);
  }, [state.confirmation]);
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
    if (state.restoring) return;
    const hash = routeHash(state);
    if (window.location.hash !== hash)
      window.history[
        lastRouteTick.current !== state.routeTick ? "replaceState" : "pushState"
      ](null, "", hash);
    lastRouteTick.current = state.routeTick;
  }, [
    state.authenticated,
    state.restoring,
    state.page,
    state.activeMatch,
    state.activeRoomId,
    state.routeTick,
    state.routePath,
  ]);

  async function send(command) {
    if (pending.current) return false;
    pending.current = true;
    dispatch({ action: "request-status", busy: true });
    const payload = {
      ...command,
      role: state.role,
      activeRoomId: state.activeRoomId,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      termsRevision: state.rooms[state.activeRoomId]?.terms.revision || 0,
    };
    try {
      if (["login-form", "signup-form"].includes(command.form)) {
        const result = await request(
          command.form === "signup-form" ? "signup" : "login",
          command.values,
        );
        if (result.verificationRequired) {
          rememberLoginChallenge(result);
          notify(
            `We sent a verification code to ${result.email}.`,
            "success",
            "Check your email",
          );
        } else acceptSession(result);
      } else if (command.form === "login-code-form") {
        const result = await request("auth/verify", {
          challengeId: authChallenge?.challengeId,
          code: command.values.code,
        });
        acceptSession(result);
      } else {
        const result = await request("action", payload);
        revision.current = result.revision;
        dispatch({ action: "remote", state: result.state, command: payload });
        return !result.state.formErrors;
      }
      return true;
    } catch (error) {
      if (error.challenge)
        rememberLoginChallenge({
          ...error.challenge,
          deliveryError: error.message,
        });
      dispatch({
        action: "request-error",
        message: error.message || "Could not save. Please try again.",
        fields: error.fields,
        scope: command.form,
      });
      return false;
    } finally {
      pending.current = false;
      dispatch({ action: "request-status", busy: false });
    }
  }
  async function onAction(payload, event) {
    event?.preventDefault();
    if (payload.action === "sign-out") {
      if (pending.current) return;
      try {
        await request("logout", {});
      } catch {
        /* Local sign-out remains possible offline. */
      }
      token.current = null;
      sessionStorage.removeItem("synergy-session");
      revision.current = -1;
      dispatch({ action: "signed-out" });
      return;
    }
    if (payload.action === "lock-terms") {
      const form = event.currentTarget.form;
      if (!form.reportValidity()) return;
      payload = { ...payload, values: Object.fromEntries(new FormData(form)) };
    }
    if (remoteActions.has(payload.action)) return send(payload);
    dispatch(payload);
  }
  async function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const success = await send({
      form: form.dataset.form || form.id,
      id: form.dataset.id,
      values: Object.fromEntries(new FormData(form)),
    });
    if (
      success &&
      ["login-form", "signup-form", "login-code-form"].includes(form.id)
    )
      form.reset();
    if (success && form.id === "chat-form") form.reset();
  }
  function onInvalid(event) {
    event.preventDefault();
    const form = event.target.form;
    if (!form) return;
    const firstInvalid = [...form.elements].find(
      (input) => input.willValidate && !input.validity.valid,
    );
    if (event.target !== firstInvalid) return;
    const scope =
      form.querySelector("[data-error-scope]")?.dataset.errorScope ||
      form.dataset.form ||
      form.id;
    dispatch({
      action: "request-error",
      scope,
      fields: formValidation(form),
      message: "Review the highlighted details and try again.",
    });
    firstInvalid.focus();
  }
  function onFormInput(event) {
    if (!state.formErrors) return;
    const input = event.target;
    const form = input.form;
    if (!form) return;
    const scope =
      form.querySelector("[data-error-scope]")?.dataset.errorScope ||
      form.dataset.form ||
      form.id;
    if (
      state.formErrors.scope === scope &&
      state.formErrors.fields[fieldName(input)]
    )
      dispatch({ action: "clear-field-error", scope, field: fieldName(input) });
  }
  async function integrationRequest(path, body) {
    if (pending.current)
      throw new Error("Please wait for your current request to finish.");
    pending.current = true;
    dispatch({ action: "request-status", busy: true });
    try {
      const result = await request(path, body);
      if (result.state) {
        revision.current = result.revision;
        dispatch({ action: "remote", state: result.state });
      }
      return result;
    } catch (error) {
      notify(error.message || "Please try again.", "error");
      throw error;
    } finally {
      pending.current = false;
      dispatch({ action: "request-status", busy: false });
    }
  }
  async function resendLoginCode() {
    try {
      const result = await integrationRequest("auth/resend", {
        challengeId: authChallenge?.challengeId,
      });
      rememberLoginChallenge(result);
      dispatch({ action: "request-error", message: "" });
      notify("A new code has been sent. Use the latest code from your email.");
    } catch (error) {
      if (error.challenge)
        rememberLoginChallenge({
          ...error.challenge,
          deliveryError: error.message,
        });
      throw error;
    }
  }
  function cancelLogin() {
    if (pending.current) return;
    rememberLoginChallenge(null);
    dispatch({ action: "signed-out" });
  }
  async function onUpload(event) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const file = form.elements.file.files[0];
    if (!file) return;
    if (file.size > state.integrations.maxFileBytes) {
      dispatch({
        action: "request-error",
        message: "Choose a file smaller than 5 MB.",
      });
      return;
    }
    pending.current = true;
    dispatch({ action: "request-status", busy: true });
    try {
      const query = new URLSearchParams({
        role: state.role,
        room: state.activeRoomId,
        milestone: form.dataset.id,
      });
      const response = await fetch(`/api/upload?${query}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.current}`,
          "Content-Type": "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      const result = decode(await response.text());
      if (!response.ok) throw new Error(result.error);
      revision.current = result.revision;
      dispatch({
        action: "remote",
        state: result.state,
        command: {
          form: "evidence",
          id: form.dataset.id,
          activeRoomId: state.activeRoomId,
        },
      });
      form.reset();
    } catch (error) {
      dispatch({
        action: "request-error",
        message:
          error.message || "Could not upload the file. Please try again.",
      });
    } finally {
      pending.current = false;
      dispatch({ action: "request-status", busy: false });
    }
  }
  async function downloadFile(file) {
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        headers: { Authorization: `Bearer ${token.current}` },
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      dispatch({
        action: "request-error",
        message: error.message || "Could not download the file.",
      });
    }
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
    tabs[nextIndex].focus({ preventScroll: true });
  }
  return (
    <AppContext.Provider
      value={{
        authChallenge,
        resendLoginCode,
        cancelLogin,
        state,
        notify,
        dismissToast,
        onInvalid,
        onFormInput,
        model,
        onAction,
        onSubmit,
        integrationRequest,
        onUpload,
        downloadFile,
        onTabKeyDown,
        onFilter: (key, value) =>
          dispatch({ action: "set-filter", key, value }),
        onField: (id, value) =>
          dispatch({ action: "set-field", key: fieldKey(state, id), value }),
        fieldValue: (id, fallback) => readField(state, id, fallback),
        onRating: (value) => dispatch({ action: "set-rating", value }),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  return useContext(AppContext);
}
