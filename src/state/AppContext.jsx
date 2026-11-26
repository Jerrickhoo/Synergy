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
import { fetchWithDeadline } from "./request.js";
import { decode } from "./serialization.js";
import { validateCredentials } from "./validation.js";
import { useMatchFilterMemory } from "./useMatchFilterMemory.js";
import { paymentActionNames } from "../data/pricing.js";
import { verificationNeededFor } from "../data/collaboration.js";
import { withCurrentTypeNames } from "../data/collaboration-types.js";
import {
  errorMessage,
  errorTitle,
  waitTitles,
  connectionInterrupted,
  connectionRestored,
  fieldName,
  formValidation,
  publishToast,
} from "./feedback.js";
import { markTourPending } from "../data/tour.js";

enableMapSet();
const AppContext = createContext(null);
const dataKeys = [
  "accountId",
  "accountName",
  "accountEmail",
  "emailVerified",
  "emailVerificationRetryAt",
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
  "introductionTypesByRole",
  "introductionMetaByRole",
  "introHistoryByRole",
  "bothRoles",
  "profileWentLive",
  "verification",
  "myTagProposals",
  "mentorUsage",
  "mentorListing",
  "mentorVerification",
  "mentorOfficeOpenings",
  "prototypeMentor",
  "officeSlotCheck",
  "mentorConfig",
  "mentorApplication",
  "mentorSuspension",
  "mentorshipSurvey",
  "mentorEmailStatus",
  "mentorRequests",
  "referralChoices",
  "mentorRequestLimit",
  "calendarToken",
  "pricingConfig",
  "pricingHistory",
  "paymentRecords",
  "paymentCheckout",
  "paymentCheckoutData",
  "paymentModeration",
  "firstRunChoice",
  "matchAlerts",
];
const remoteActions = new Set([
  ...paymentActionNames,
  "choose-role",
  "first-run-choice",
  "mentor-onboarding-save",
  "mentor-onboarding-back",
  "approve-mentor",
  "suspend-mentor",
  "reinstate-mentor",
  "lift-limit",
  "reject-mentor",
  "simulate-mentor-approval",
  "open-office-slot",
  "set-office-preferred-time",
  "close-office-slot",
  "skip-office-date",
  "book-office-hours",
  "rebook-office-slot",
  "calendar-link",
  "send-request",
  "accept-request",
  "confirm-goal",
  "simulate-goal-confirmation",
  "simulate-session-held",
  "simulate-delivery",
  "simulate-check-in-confirmation",
  "simulate-cycle-review",
  "simulate-upgrade-acceptance",
  "simulate-upgrade-decline",
  "simulate-founder-rating",
  "simulate-doc-upload",
  "simulate-revisions",
  "simulate-check-in-proposal",
  "simulate-office-booking",
  "simulate-office-rebooking",
  "simulate-sample-request",
  "confirm-check-in-time",
  "report-attendance",
  "reschedule-session",
  "cancel-session",
  "resolve-session-dispute",
  "deliver-answer",
  "rate-answer",
  "log-revision",
  "submit-followup",
  "propose-upgrade",
  "accept-upgrade",
  "decline-upgrade",
  "end-mentorship",
  "set-testimonial-public",
  "decline-request",
  "refer-request",
  "withdraw-request",
  "save",
  "interest",
  "cancel-interest",
  "edit-interest",
  "accept-interest",
  "simulate-acceptance",
  "decline-interest",
  "lock-terms",
  "accept-terms",
  "confirm-milestone",
  "cancel-meeting",
  "dispute",
  "resolve-dispute",
  "launch-room",
  "reopen-terms",
  "accept-reopen",
  "decline-reopen",
  "read-notifications",
  "simulate-verification",
  "affiliation-seen",
  "withdraw-dispute",
  "escalate-dispute",
  "send-back",
  "nudge-partner",
  "undo-launch",
  "cycle-decision",
]);
const reducer = (state, payload) =>
  produce(state, (draft) => {
    if (payload.action === "capabilities") {
      draft.integrations = { ...draft.integrations, ...payload.integrations };
    } else if (payload.action === "restore-error") {
      draft.connectionError = payload.message;
    } else if (payload.action === "restore") {
      Object.assign(draft, payload.state, {
        restoring: false,
        busy: false,
        toast: "",
        confirmation: "",
        formErrors: null,
        profileEditing: false,
        connectionError: "",
      });
      Object.assign(draft, withCurrentTypeNames(draft));
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
      Object.assign(draft, withCurrentTypeNames(draft));
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
      connectionRestored(draft, !payload.command);
      if (payload.command) {
        draft.formErrors = payload.state.formErrors;
        if (payload.state.toast)
          publishToast(draft, payload.state.toast, {
            type: payload.state.formErrors ? "error" : payload.state.toastType,
            title: payload.state.toastTitle,
            // The form's own field checks (see `invalid` in transitions).
            field: Boolean(
              payload.state.formErrors && payload.state.toastField,
            ),
          });
        else if (payload.state.formErrors)
          publishToast(draft, "Review the highlighted details and try again.", {
            type: "error",
            title: errorTitle(
              payload.state.formErrors.scope,
              draft.rooms?.[draft.activeRoomId],
            ),
          });
        draft.confirmation = payload.state.confirmation;
        if (!payload.state.formErrors) {
          if (payload.command.form === "profile-form") {
            draft.profileEditing = false;
          }
          if (payload.command.form === "report-form") draft.reportOpen = false;
          if (
            payload.command.action === "mentor-onboarding-save" &&
            payload.state.mentorApplication?.status === "pending"
          )
            draft.page = "onboarding";
          if (payload.command.action === "choose-role") {
            draft.role = payload.state.role;
            if (payload.command.goHome)
              draft.page =
                payload.state.mentorApplication?.status === "draft"
                  ? "onboarding"
                  : "home";
          }
          if (
            [
              "book-office-hours",
              "simulate-office-booking",
              "simulate-payment",
              "send-request",
              "accept-request",
              "interest",
              "accept-interest",
              "simulate-acceptance",
              "launch-room",
            ].includes(payload.command.action)
          ) {
            draft.page = payload.state.page;
            draft.activeRoomId = payload.state.activeRoomId;
            draft.activeWaitingMatch = payload.state.activeWaitingMatch;
            if (payload.command.action === "send-request")
              draft.activeMentorRequest =
                payload.state.activeMentorRequest || null;
            draft.roomTab = payload.state.roomTab || "terms";
            draft.rating = 0;
          }
          // A finished Deal Room opens its review. An Ongoing Advisory that
          // finishes stays in the room, where its cycle reviews live.
          if (
            payload.state.rooms[payload.command.activeRoomId]?.status ===
              "launched" &&
            previousRooms[payload.command.activeRoomId]?.status !==
              "launched" &&
            payload.state.rooms[payload.command.activeRoomId]?.type !==
              "mentorship" &&
            ["confirm-milestone", "cycle-decision"].includes(
              payload.command.action,
            )
          ) {
            draft.page = "review";
            draft.activeRoomId = payload.command.activeRoomId;
            draft.rating = 0;
          }
          if (payload.command.action === "undo-launch") {
            draft.page = "room-detail";
            draft.roomTab = "milestones";
          }
        }
      }
    } else if (payload.action === "request-status") {
      draft.busy = payload.busy;
      if (payload.busy) draft.mentorshipActionError = null;
    } else if (payload.action === "request-error") {
      if (payload.mentorError)
        draft.mentorshipActionError = payload.mentorError;
      if (payload.connectionIssue && draft.authenticated)
        connectionInterrupted(draft, {
          scope: payload.scope,
          saving: payload.saving !== false,
        });
      else {
        publishToast(
          draft,
          errorMessage(payload.scope, payload.fields, payload.message),
          {
            type: "error",
            title: errorTitle(payload.scope, draft.rooms?.[draft.activeRoomId]),
            // Only the browser's own field checks; a server rejection (such as
            // wrong credentials) stays until dismissed.
            field: Boolean(payload.field),
          },
        );
        draft.formErrors = payload.fields
          ? { scope: payload.scope, fields: payload.fields }
          : payload.scope === "profile-form"
            ? { scope: payload.scope, fields: { _request: payload.message } }
            : null;
      }
    } else if (payload.action === "connection-error") {
      if (!draft.connectionError) connectionInterrupted(draft);
    } else if (payload.action === "connection-restored") {
      connectionRestored(draft);
    } else if (payload.action === "clear-form-errors") {
      if (draft.formErrors?.scope === payload.scope) draft.formErrors = null;
    } else if (payload.action === "clear-field-error") {
      if (draft.formErrors?.scope === payload.scope) {
        delete draft.formErrors.fields[payload.field];
        if (!Object.keys(draft.formErrors.fields).length)
          draft.formErrors = null;
      }
    } else if (payload.action === "signed-out") {
      Object.assign(draft, createInitialState(), {
        restoring: false,
        busy: false,
        integrations: draft.integrations,
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
  const [workspaceConnection, setWorkspaceConnection] = useState("loading");
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [restoreTick, setRestoreTick] = useState(0);
  const [signOutOpen, setSignOutOpen] = useState(false);
  // Which gated action asked an unverified account to verify first, if any.
  const [verificationPrompt, setVerificationPrompt] = useState(null);
  // The quick tour of how deals (or mentorships) move through Synergy.
  const [tourOpen, setTourOpen] = useState(false);
  const [mentorshipWarning, setMentorshipWarning] = useState(null);
  const [signOutError, setSignOutError] = useState("");
  const requestedPath = useRef(
    (() => {
      const route = parseRoute(window.location.hash);
      return [
        "requests",
        "waiting",
        "room-detail",
        "review",
        "settings",
        "onboarding",
      ].includes(route.page)
        ? window.location.hash
        : "";
    })(),
  );
  const signOutReturn = useRef(null);
  const token = useRef(sessionStorage.getItem("synergy-session"));
  const revision = useRef(-1);
  const refreshKey = useRef("");
  const pending = useRef(false);
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const initial = createInitialState();
    initial.restoring = Boolean(token.current);
    if (!initial.restoring)
      applyRoute(initial, parseRoute(window.location.hash));
    return initial;
  });
  const model = useMemo(() => createModel(state), [state]);
  useMatchFilterMemory(state, dispatch);
  useEffect(() => {
    if (state.authenticated) return;
    setSignOutOpen(false);
    setVerificationPrompt(null);
    setTourOpen(false);
  }, [state.authenticated]);
  const dismissToast = useCallback(
    () => dispatch({ action: "clear-toast" }),
    [],
  );
  // Error toasts have no timer, so leaving the page clears one that was
  // already showing. A toast raised by the navigation itself stays.
  const lastView = useRef({ view: "", toastId: 0 });
  useEffect(() => {
    const view = `${state.page}:${state.activeRoomId || ""}`;
    const before = lastView.current;
    if (
      before.view &&
      view !== before.view &&
      state.toastType === "error" &&
      state.toast &&
      state.toastId === before.toastId
    )
      dispatch({ action: "clear-toast" });
    lastView.current = { view, toastId: state.toastId };
  }, [state.page, state.activeRoomId, state.toastId]);
  const notify = useCallback(
    (message, type = "success", title = "") =>
      dispatch({ action: "set-toast", message, type, title }),
    [],
  );
  const lastRouteTick = useRef(null);
  async function request(path, body) {
    let response;
    try {
      response = await fetchWithDeadline(`/api/${path}`, {
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
      throw Object.assign(
        new Error(
          "We couldn't reach the server. Check your connection and try again.",
        ),
        { connectionIssue: true },
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
          reason: result.reason,
          currentRole: result.currentRole,
          alternatives: result.alternatives,
        },
      );
    return result;
  }
  function acceptSession(result, message) {
    token.current = result.token;
    sessionStorage.setItem("synergy-session", result.token);
    revision.current = result.revision;
    const target =
      requestedPath.current ||
      (result.state.mentorApplication?.status === "draft"
        ? "#/onboarding"
        : "#/");
    requestedPath.current = "";
    window.history.replaceState(null, "", target);
    dispatch({
      action: "restore",
      state: result.state,
      message,
    });
  }
  useEffect(() => {
    let stopped = false;
    request("capabilities")
      .then((integrations) => {
        if (stopped) return;
        if (typeof integrations?.demoMode !== "boolean") {
          setWorkspaceConnection("unavailable");
          return;
        }
        dispatch({ action: "capabilities", integrations });
        setWorkspaceConnection("ready");
      })
      .catch(() => {
        if (!stopped) setWorkspaceConnection("unavailable");
      });
    return () => {
      stopped = true;
    };
  }, [connectionAttempt]);
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
            action: "restore-error",
            message:
              "Could not reach your saved workspace. Your session is preserved. Retry when your connection is available.",
          });
      });
    return () => {
      stopped = true;
    };
  }, [restoreTick]);
  useEffect(() => {
    if (!state.authenticated || state.restoring) return;
    let stopped = false;
    let refreshing = false;
    let failures = 0;
    let retryAt = 0;
    async function refresh() {
      if (
        pending.current ||
        refreshing ||
        document.hidden ||
        Date.now() < retryAt
      )
        return;
      refreshing = true;
      try {
        const result = await request(
          `state?role=${state.role}&since=${revision.current}&key=${encodeURIComponent(refreshKey.current || "")}`,
        );
        failures = 0;
        retryAt = 0;
        if (result.unchanged) {
          if (!stopped) dispatch({ action: "connection-restored" });
          return;
        }
        if (
          !stopped &&
          !pending.current &&
          result.revision >= revision.current
        ) {
          revision.current = result.revision;
          refreshKey.current = result.refreshKey;
          dispatch({ action: "remote", state: result.state });
        }
      } catch (error) {
        if (stopped) return;
        refreshKey.current = "";
        retryAt = Date.now() + Math.min(30000, 1500 * 2 ** failures++);
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
          });
      } finally {
        refreshing = false;
      }
    }
    refresh();
    const timer = setInterval(refresh, 1500);
    const resume = () => {
      retryAt = 0;
      refresh();
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
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
    state.activeMentorRequest,
    state.mentorReferralId,
  ]);

  async function send(command, trigger) {
    if (pending.current) return false;
    pending.current = true;
    // The button that started the request shows its own spinner until done.
    const control =
      trigger instanceof HTMLButtonElement &&
      !trigger.classList.contains("login-submit")
        ? trigger
        : null;
    control?.setAttribute("data-pending", "");
    dispatch({ action: "request-status", busy: true });
    // A command can name its room, e.g. a meeting scheduled from Home.
    const roomId = command.activeRoomId || state.activeRoomId;
    const payload = {
      ...command,
      engagementType: command.engagementType,
      role: state.role,
      activeRoomId: roomId,
      // Lets the server read the open room's informational notices.
      roomOpen: state.page === "room-detail",
      timeZone:
        command.form === "schedule" && command.values?.timeZone
          ? command.values.timeZone
          : Intl.DateTimeFormat().resolvedOptions().timeZone,
      termsRevision:
        command.values?.revision !== undefined
          ? Number(command.values.revision)
          : state.rooms[roomId]?.terms.revision || 0,
      milestoneVersion:
        state.rooms[roomId]?.milestones[command.id]?.contentVersion || 0,
    };
    try {
      if (["login-form", "signup-form"].includes(command.form)) {
        const result = await request(
          command.form === "signup-form" ? "signup" : "login",
          command.values,
        );
        // A new account's first Home opens the quick tour.
        if (command.form === "signup-form")
          markTourPending(result.state?.accountId);
        acceptSession(result);
      } else {
        const result = await request(
          command.form === "profile-form" ? "profile" : "action",
          payload,
        );
        revision.current = result.revision;
        dispatch({ action: "remote", state: result.state, command: payload });
        return !result.state.formErrors;
      }
      return true;
    } catch (error) {
      if (error.reason === "mentor-safety-warning") {
        setMentorshipWarning({
          command,
          roomId: payload.activeRoomId,
          role: payload.role,
          message: error.message,
        });
        return false;
      }
      dispatch({
        action: "request-error",
        message: error.message || "Could not save. Please try again.",
        fields: error.fields,
        scope: command.form || command.action,
        mentorError:
          command.action?.endsWith("-request") ||
          ["book-office-hours", "open-office-slot"].includes(command.action)
            ? {
                id: command.id,
                message: error.message,
                reason: error.reason,
                alternatives: error.alternatives,
              }
            : null,
        connectionIssue: error.connectionIssue,
      });
      return false;
    } finally {
      pending.current = false;
      control?.removeAttribute("data-pending");
      dispatch({ action: "request-status", busy: false });
    }
  }
  async function onAction(payload, event) {
    event?.preventDefault();
    // Opening and saving matches, and requests, wait for verification: ask first
    // and offer the way to Verification, rather than a disabled button.
    if (payload.action === "verification-prompt") {
      dispatch({ action: "close-overlays" });
      setVerificationPrompt(payload.reason || "connect");
      return;
    }
    if (payload.action === "close-verification-prompt") {
      setVerificationPrompt(null);
      return;
    }
    if (payload.action === "open-tour") {
      dispatch({ action: "close-overlays" });
      setTourOpen(true);
      return;
    }
    if (payload.action === "close-tour") {
      setTourOpen(false);
      return;
    }
    if (verificationNeededFor(state, payload)) {
      dispatch({ action: "close-overlays" });
      setVerificationPrompt(payload.action);
      return;
    }
    if (payload.action === "request-sign-out") {
      if (pending.current || !state.authenticated) return;
      signOutReturn.current = event?.currentTarget || document.activeElement;
      dispatch({ action: "close-overlays" });
      setSignOutError("");
      setSignOutOpen(true);
      return;
    }
    if (payload.action === "cancel-sign-out") {
      if (pending.current) return;
      setSignOutOpen(false);
      requestAnimationFrame(() => {
        const opener = signOutReturn.current;
        const available = opener?.isConnected && opener.getClientRects().length;
        (available
          ? opener
          : document.getElementById("navigation-toggle") ||
            document.querySelector(".account-button")
        )?.focus();
      });
      return;
    }
    if (payload.action === "enter-demo") {
      if (pending.current) return;
      pending.current = true;
      dispatch({ action: "request-status", busy: true });
      try {
        const email = String(payload.email || "").trim();
        const errors = validateCredentials({
          email,
          password: payload.password || "",
        });
        // Preview passwords may be short; only the format rules apply here.
        if (errors.password && payload.password) delete errors.password;
        if (Object.keys(errors).length) {
          dispatch({
            action: "request-error",
            scope: "login-form",
            fields: errors,
            message: "Check your sign-in details.",
          });
          return;
        }
        acceptSession(
          await request("demo", {
            role: payload.roleChoice,
            email,
            password: payload.password,
            ...(payload.confirmRoleSwitch && { confirmRoleSwitch: true }),
          }),
        );
      } catch (error) {
        // A returning account in another role: the sign-in form confirms.
        if (error.reason === "role-switch")
          return { roleSwitch: error.currentRole };
        // Field messages show once, beside their fields; the toast stays short.
        dispatch({
          action: "request-error",
          scope: "login-form",
          fields: error.fields,
          message: error.fields ? "Check your sign-in details." : error.message,
        });
      } finally {
        pending.current = false;
        dispatch({ action: "request-status", busy: false });
      }
      return;
    }
    if (payload.action === "sign-out") {
      if (pending.current) return;
      pending.current = true;
      dispatch({ action: "request-status", busy: true });
      try {
        await request("logout", {});
      } catch (error) {
        if (error.status !== 401) {
          setSignOutError(
            "Could not sign out. Your session and drafts are preserved. Try again.",
          );
          pending.current = false;
          dispatch({ action: "request-status", busy: false });
          return false;
        }
      }
      try {
        for (const key of Object.keys(sessionStorage))
          if (key.startsWith(`synergy-draft:${state.accountId}:`))
            sessionStorage.removeItem(key);
      } catch {
        /* Sign-out remains available if storage is blocked. */
      }
      token.current = null;
      sessionStorage.removeItem("synergy-session");
      revision.current = -1;
      pending.current = false;
      setSignOutOpen(false);
      dispatch({ action: "signed-out" });
      return;
    }
    if (payload.action === "lock-terms") {
      const form = event.currentTarget.form;
      if (!form.reportValidity()) return;
      payload = { ...payload, values: Object.fromEntries(new FormData(form)) };
    }
    if (
      payload.action === "interest" &&
      !payload.engagementType &&
      !state.incomingByRole[state.role].has(payload.id)
    ) {
      dispatch({
        action: "match-detail",
        id: payload.id,
        referralId: payload.referralId,
      });
      return;
    }
    if (payload.action === "open-verification") {
      dispatch({ page: "profile" });
      requestAnimationFrame(() => {
        const section = document.getElementById("verification");
        section?.scrollIntoView({ block: "start" });
        section?.querySelector("h2")?.setAttribute("tabindex", "-1");
        section?.querySelector("h2")?.focus({ preventScroll: true });
      });
      return;
    }
    if (payload.action === "open-profile-switch") {
      dispatch({ page: "settings" });
      // Settings shows its sections once account settings load, so wait up
      // to about a second for this one before giving up.
      let frames = 60;
      const jump = () => {
        const section = document.getElementById("settings-profiles");
        if (!section) {
          if (--frames > 0) requestAnimationFrame(jump);
          return;
        }
        section.scrollIntoView({ block: "start" });
        section.querySelector("h2")?.setAttribute("tabindex", "-1");
        section.querySelector("h2")?.focus({ preventScroll: true });
      };
      requestAnimationFrame(jump);
      return;
    }
    if (remoteActions.has(payload.action))
      return send(payload, event?.currentTarget);
    dispatch(payload);
  }
  async function onSubmit(event, extraValues = {}) {
    event.preventDefault();
    const form = event.currentTarget;
    const success = await send(
      {
        form: form.dataset.form || form.id,
        id: form.dataset.id,
        ...(form.dataset.room && { activeRoomId: form.dataset.room }),
        values: { ...Object.fromEntries(new FormData(form)), ...extraValues },
      },
      event.nativeEvent?.submitter ||
        form.querySelector('button[type="submit"], button:not([type])'),
    );
    if (success && ["login-form", "signup-form"].includes(form.id))
      form.reset();
    if (success && form.id === "chat-form") form.reset();
    return success;
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
      field: true,
    });
    (firstInvalid.dataset.selectTrigger
      ? document.getElementById(firstInvalid.dataset.selectTrigger)
      : firstInvalid
    )?.focus();
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
      // Defer until the input's own change handler has committed. Clearing the
      // error during the same event made controlled fields drop that input.
      setTimeout(() =>
        dispatch({
          action: "clear-field-error",
          scope,
          field: fieldName(input),
        }),
      );
  }
  // Verification, resend and password reset. With a `scope`, a failure also
  // shows as a toast and field errors; the page gets the error either way. A
  // returned session signs in.
  async function accountEmailRequest(
    path,
    body,
    { scope, signedInMessage } = {},
  ) {
    if (pending.current)
      throw new Error("Please wait for your current request to finish.");
    pending.current = true;
    dispatch({ action: "request-status", busy: true });
    try {
      const result = await request(path, body);
      if (result.token) acceptSession(result, signedInMessage);
      else if (result.state) {
        revision.current = result.revision;
        dispatch({ action: "remote", state: result.state });
      }
      return result;
    } catch (error) {
      // Asked again too soon: a notice to wait, not a failure.
      if (scope && error.status === 429)
        dispatch({
          action: "set-toast",
          message: error.message,
          type: "info",
          title: waitTitles[scope] || "Please wait a moment",
        });
      else if (scope)
        dispatch({
          action: "request-error",
          scope,
          message: error.message,
          fields: error.fields,
          connectionIssue: error.connectionIssue,
        });
      throw error;
    } finally {
      pending.current = false;
      dispatch({ action: "request-status", busy: false });
    }
  }
  async function integrationRequest(path, body) {
    if (body === undefined) return request(path);
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
      dispatch({
        action: "request-error",
        message: error.message || "Please try again.",
        connectionIssue: error.connectionIssue,
      });
      throw error;
    } finally {
      pending.current = false;
      dispatch({ action: "request-status", busy: false });
    }
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
      return "Choose a file smaller than 5 MB.";
    }
    pending.current = true;
    dispatch({ action: "request-status", busy: true });
    try {
      const query = new URLSearchParams({
        role: state.role,
        room: state.activeRoomId,
        milestone: form.dataset.id,
      });
      const response = await fetchWithDeadline(`/api/upload?${query}`, {
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
      return true;
    } catch (error) {
      dispatch({
        action: "request-error",
        message:
          error.message || "Could not upload the file. Please try again.",
        connectionIssue: error.connectionIssue,
      });
      // The caller also shows this next to the file field.
      return error.message || "Could not upload the file. Please try again.";
    } finally {
      pending.current = false;
      dispatch({ action: "request-status", busy: false });
    }
  }
  async function downloadFile(file) {
    try {
      const response = await fetchWithDeadline(`/api/files/${file.id}`, {
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
        connectionIssue: error.connectionIssue,
        saving: false,
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
        retryRestore: () => setRestoreTick((value) => value + 1),
        workspaceConnection,
        retryConnection: () => {
          setWorkspaceConnection("loading");
          setConnectionAttempt((attempt) => attempt + 1);
        },
        state,
        signOutOpen,
        signOutError,
        verificationPrompt,
        tourOpen,
        mentorshipWarning,
        dismissMentorshipWarning: () => setMentorshipWarning(null),
        confirmMentorshipWarning: async () => {
          const warning = mentorshipWarning;
          if (
            !warning ||
            warning.roomId !== state.activeRoomId ||
            warning.role !== state.role
          ) {
            setMentorshipWarning(null);
            return;
          }
          setMentorshipWarning(null);
          const success = await send({
            ...warning.command,
            values: { ...warning.command.values, acknowledgeSafety: true },
          });
          if (success && warning.command.form === "chat-form")
            document.getElementById("chat-form")?.reset();
        },
        notify,
        dismissToast,
        onInvalid,
        onFormInput,
        model,
        onAction,
        onSubmit,
        integrationRequest,
        accountEmailRequest,
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
