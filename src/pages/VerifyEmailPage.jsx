import { useEffect, useState } from "react";
import AccountBackLink from "../components/AccountBackLink.jsx";
import AuthCard from "../components/AuthCard.jsx";
import Icon from "../components/Icon.jsx";
import { useApp } from "../state/AppContext.jsx";
import { useSecondsUntil } from "../state/useSecondsUntil.js";

// One request per link, so React's second effect run in development (and a
// remount) reuses the first answer.
const checks = new Map();

export default function VerifyEmailPage() {
  const { state, accountEmailRequest, onAction } = useApp();
  const token = state.linkToken;
  const [status, setStatus] = useState(token ? "checking" : "failed");
  const [message, setMessage] = useState(
    token ? "" : "This page needs the link from your verification email.",
  );
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  // As on the banner: until another link may be sent, the button counts down.
  const wait = useSecondsUntil(state.emailVerificationRetryAt);
  useEffect(() => {
    if (!token || status !== "checking") return;
    let active = true;
    if (!checks.has(token))
      checks.set(token, accountEmailRequest("auth/verify", { token }));
    checks.get(token).then(
      () => active && setStatus("verified"),
      (error) => {
        // A dropped connection can be retried with the same link.
        if (error.connectionIssue) checks.delete(token);
        if (!active) return;
        setMessage(error.message);
        setStatus(error.connectionIssue ? "offline" : "failed");
      },
    );
    return () => {
      active = false;
    };
  }, [token, status]);
  async function resend() {
    setResending(true);
    try {
      await accountEmailRequest(
        "auth/resend",
        {},
        { scope: "resend-verification" },
      );
      setResent(true);
    } catch {
      /* Shown as a toast. */
    } finally {
      setResending(false);
    }
  }
  const signIn = (event) => onAction({ action: "back-to-sign-in" }, event);
  if (status === "checking")
    return (
      <AuthCard
        title="Verifying your email"
        intro={
          <span className="account-email-progress" role="status">
            <span className="spinner" aria-hidden="true" />
            Checking your link…
          </span>
        }
      />
    );
  if (status === "verified")
    return (
      <AuthCard
        title="Your email is verified"
        intro={
          state.authenticated
            ? "Your account is ready."
            : "Your account is ready. Sign in to start using Synergy."
        }
      >
        <button
          className="btn primary login-submit"
          type="button"
          onClick={(event) =>
            state.authenticated
              ? onAction({ page: "home" }, event)
              : signIn(event)
          }
        >
          {state.authenticated ? "Continue to Synergy" : "Sign in"}
          <Icon name="arrow" />
        </button>
      </AuthCard>
    );
  if (status === "offline")
    return (
      <AuthCard
        title="We couldn't check your link"
        intro={message}
        footer={<AccountBackLink />}
      >
        <button
          className="btn primary login-submit"
          type="button"
          onClick={() => setStatus("checking")}
        >
          Try again
        </button>
      </AuthCard>
    );
  if (!state.authenticated)
    return (
      <AuthCard title="This link can't be used" intro={message}>
        <button
          className="btn primary login-submit"
          type="button"
          onClick={signIn}
        >
          Sign in to send a new link
          <Icon name="arrow" />
        </button>
      </AuthCard>
    );
  return (
    <AuthCard
      title={resent ? "Check your email" : "This link can't be used"}
      intro={
        resent
          ? `We sent the link again to ${state.accountEmail}. It works for 24 hours.`
          : message
      }
      footer={<AccountBackLink />}
    >
      <button
        className="btn primary login-submit countdown-button"
        type="button"
        disabled={resending || wait > 0 || state.busy}
        onClick={resend}
      >
        {resending && <span className="spinner" aria-hidden="true" />}
        {resending
          ? "Sending link…"
          : wait > 0
            ? `Send again in ${wait}s`
            : "Send a new link"}
      </button>
    </AuthCard>
  );
}
