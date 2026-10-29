const formTitles = {
  "login-form": "Couldn't sign in",
  "signup-form": "Couldn't create your account",
  "profile-form": "Couldn't save your profile",
  schedule: "Couldn't schedule your session",
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

export function publishToast(state, message, options = {}) {
  state.toast = message;
  state.toastType = options.type || "success";
  state.toastTitle = options.title || "";
  state.toastId = (state.toastId || 0) + 1;
}

export function errorTitle(scope) {
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
          "This field";
        const validity = input.validity;
        const message = validity.valueMissing
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
