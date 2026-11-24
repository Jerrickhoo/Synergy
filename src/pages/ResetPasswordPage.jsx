import { useState } from "react";
import AccountBackLink from "../components/AccountBackLink.jsx";
import AuthCard from "../components/AuthCard.jsx";
import FormErrors from "../components/FormErrors.jsx";
import Icon from "../components/Icon.jsx";
import { useApp } from "../state/AppContext.jsx";

export default function ResetPasswordPage() {
  const { state, accountEmailRequest, dismissToast } = useApp();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  // The server's reason when the link can't be used any more.
  const [unusable, setUnusable] = useState(
    state.linkToken ? "" : "This page needs the link from your reset email.",
  );
  async function submit(event) {
    event.preventDefault();
    const password = String(
      new FormData(event.currentTarget).get("password") || "",
    );
    setSaving(true);
    try {
      await accountEmailRequest(
        "auth/reset",
        { token: state.linkToken, password },
        {
          scope: "reset-password-form",
          signedInMessage:
            "Password changed. Every other session was signed out.",
        },
      );
    } catch (error) {
      // The card itself explains a dead link; the toast would repeat it.
      if (error.status === 410) {
        dismissToast();
        setUnusable(error.message);
      }
      setSaving(false);
    }
  }
  if (unusable)
    return (
      <AuthCard
        title="Ask for a new reset link"
        intro={unusable}
        footer={<AccountBackLink />}
      >
        <a className="btn primary login-submit" href="#/forgot-password">
          Ask for a new link
          <Icon name="arrow" />
        </a>
      </AuthCard>
    );
  return (
    <AuthCard
      title="Choose a new password"
      intro="Saving it signs you in here and signs out every other session."
      footer={<AccountBackLink />}
    >
      <form
        id="reset-password-form"
        className="login-form"
        aria-busy={saving}
        onSubmit={submit}
      >
        <FormErrors scope="reset-password-form" />
        <div className="field">
          <label htmlFor="reset-password">New password</label>
          <div className="password-wrap">
            <input
              id="reset-password"
              name="password"
              type={visible ? "text" : "password"}
              minLength="8"
              maxLength="1024"
              required
              autoComplete="new-password"
              aria-describedby="reset-password-help"
            />
            <button
              className="password-toggle"
              type="button"
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              onClick={() => setVisible(!visible)}
            >
              <Icon name={visible ? "eye-off" : "eye"} />
            </button>
          </div>
          <span className="field-help" id="reset-password-help">
            Use at least 8 characters.
          </span>
        </div>
        <button
          className="btn primary login-submit"
          type="submit"
          disabled={saving || state.busy}
        >
          {saving && <span className="spinner" aria-hidden="true" />}
          {saving ? "Saving password…" : "Save new password"}
          {!saving && <Icon name="arrow" />}
        </button>
      </form>
    </AuthCard>
  );
}
