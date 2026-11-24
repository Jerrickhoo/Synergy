import { useState } from "react";
import AccountBackLink from "../components/AccountBackLink.jsx";
import AuthCard from "../components/AuthCard.jsx";
import FormErrors from "../components/FormErrors.jsx";
import Icon from "../components/Icon.jsx";
import { useApp } from "../state/AppContext.jsx";

export default function ForgotPasswordPage() {
  const { state, accountEmailRequest, notify } = useApp();
  const [sentTo, setSentTo] = useState("");
  const [sending, setSending] = useState(false);
  async function send(email) {
    setSending(true);
    try {
      await accountEmailRequest(
        "auth/forgot",
        { email },
        { scope: "forgot-password-form" },
      );
      if (sentTo)
        notify("If this address has an account, another link is on its way.");
      setSentTo(email);
    } catch {
      /* Shown by the toast and the field's red border. */
    } finally {
      setSending(false);
    }
  }
  if (sentTo)
    return (
      <AuthCard
        title="Check your email"
        intro={
          <>
            If an account uses <strong>{sentTo}</strong>, we sent it a link to
            choose a new password. The link works for 1 hour.
          </>
        }
        footer={<AccountBackLink />}
      >
        <p className="field-help">
          Nothing after a few minutes? Check your spam folder, or{" "}
          <button
            type="button"
            className="link-btn inline-link"
            disabled={sending || state.busy}
            onClick={() => send(sentTo)}
          >
            send another link
          </button>
          .
        </p>
      </AuthCard>
    );
  return (
    <AuthCard
      title="Reset your password"
      intro="Enter the email you sign in with. We'll send you a link to choose a new password."
      footer={<AccountBackLink />}
    >
      <form
        id="forgot-password-form"
        className="login-form"
        aria-busy={sending}
        onSubmit={(event) => {
          event.preventDefault();
          send(
            String(new FormData(event.currentTarget).get("email") || "").trim(),
          );
        }}
      >
        <FormErrors scope="forgot-password-form" />
        <div className="field">
          <label htmlFor="forgot-email">Email address</label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="you@yourstartup.com"
            defaultValue={state.authenticated ? state.accountEmail : ""}
            required
          />
        </div>
        <button
          className="btn primary login-submit"
          type="submit"
          disabled={sending || state.busy}
        >
          {sending && <span className="spinner" aria-hidden="true" />}
          {sending ? "Sending link…" : "Send reset link"}
          {!sending && <Icon name="arrow" />}
        </button>
      </form>
    </AuthCard>
  );
}
