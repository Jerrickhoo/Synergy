const formTitles = {
  "login-form": "Couldn't sign in",
  "signup-form": "Couldn't create your account",
  "profile-form": "Couldn't save your profile",
  schedule: "Couldn't schedule your session",
  "send-request": "Couldn't send your request",
  "chat-form": "Couldn't send your message",
  "session-note": "Couldn't add your note",
  "task-create": "Couldn't save the task",
  "task-update": "Couldn't save the task",
  "calendar-link": "Couldn't create the calendar file",
  "forgot-password-form": "Couldn't send the reset link",
  "reset-password-form": "Couldn't change your password",
  "resend-verification": "Couldn't send a new link",
};

export const connectionMessage =
  "We can't reach your workspace. Updates will resume automatically when the connection returns.";

export function connectionInterrupted(state, { scope, saving = false } = {}) {
  if (state.connectionError && !saving) return;
  state.connectionError = connectionMessage;
  // One persistent banner owns the outage; repeated polls do not publish toasts.
  if (saving) {
    state.connectionError =
      "We couldn't confirm your last change was saved. Reconnect, review your workspace, and try again.";
    if (scope)
      state.formErrors = {
        scope,
        fields: {
          _request:
            "We couldn't confirm this change was saved. Your form is still open. Review it and try again once connected.",
        },
      };
  }
}

export function connectionRestored(state, announce = true) {
  if (!state.connectionError) return;
  state.connectionError = "";
  if (announce)
    publishToast(
      state,
      "You're connected again. Your workspace is up to date.",
    );
}

// `field: true` marks an error that the form also shows next to each field.
// The toast is then only a summary: it leaves once the person starts fixing
// the form, so it never sits over the fields being corrected.
// Short sign-in forms show a single floating error: the toast carries the
// field messages, and the list beside the form is kept for screen readers
// only, so the fields never move.
export const toastOnlyScopes = new Set([
  "login-form",
  "signup-form",
  "forgot-password-form",
  "reset-password-form",
]);
export function errorMessage(scope, fields, fallback) {
  if (!toastOnlyScopes.has(scope) || !fields) return fallback;
  const messages = [...new Set(Object.values(fields).filter(Boolean))];
  return messages.length ? messages.join(" ") : fallback;
}

// Titles for a request refused only because it came too soon after the last.
export const waitTitles = {
  "resend-verification": "Link already sent",
};

export function publishToast(state, message, options = {}) {
  state.toast = message;
  state.toastType = options.type || "success";
  state.toastTitle = options.title || "";
  state.toastField = Boolean(options.field);
  state.toastId = (state.toastId || 0) + 1;
}

// Mentorship rooms call tasks action items (Nov 22, round 2).
export function errorTitle(scope, room) {
  if (
    room?.type === "mentorship" &&
    ["task-create", "task-update", "task-delete"].includes(scope)
  )
    return "Couldn't save the action item";
  return formTitles[scope] || "Something needs your attention";
}

export function fieldName(input) {
  return (
    input.name || input.id.replace(/^confirm-/, "").replace("team", "teamSize")
  );
}

export function formValidation(form) {
  return Object.fromEntries(
    [...form.elements]
      .filter((input) => input.willValidate && !input.validity.valid)
      .map((input) => {
        const label =
          input.labels?.[0]?.textContent.trim() ||
          input.getAttribute("aria-label") ||
          input.dataset.validationLabel ||
          "This field";
        const validity = input.validity;
        // A field can name its own requirement, e.g. "Add at least 20 characters."
        const custom =
          input.dataset.validationMessage &&
          (validity.valueMissing || validity.tooShort)
            ? input.dataset.validationMessage
            : "";
        const message = custom
          ? custom
          : validity.valueMissing
            ? `${label} is required.`
            : validity.typeMismatch && input.type === "email"
              ? "Enter a valid email address, like you@example.com."
              : validity.tooShort
                ? `Use at least ${input.minLength} characters for ${label.toLowerCase()}.`
                : input.validationMessage;
        return [fieldName(input), message];
      }),
  );
}
