const formTitles = {
  "login-form": "Couldn't sign in",
  "signup-form": "Couldn't create your account",
  "login-code-form": "Couldn't verify your code",
  "profile-form": "Couldn't save your profile",
  schedule: "Couldn't schedule your session",
};

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
              : validity.patternMismatch &&
                  input.autocomplete === "one-time-code"
                ? "Enter the six-digit code from your email."
                : input.validationMessage;
        return [fieldName(input), message];
      }),
  );
}
