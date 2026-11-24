import { useState } from "react";
import AuthCard from "../components/AuthCard.jsx";
import { useApp } from "../state/AppContext.jsx";
import { useSecondsUntil } from "../state/useSecondsUntil.js";

// What a signed-in account sees until its email is verified. The workspace
// keeps checking the account, so opening the link (even on another device)
// opens Synergy here without a reload.
export default function CheckInboxPage() {
  const { state, accountEmailRequest, notify, onAction } = useApp();
  const [sending, setSending] = useState(false);
  // Another link can be sent a minute after the last one.
  const wait = useSecondsUntil(state.emailVerificationRetryAt);
  async function resend() {
    setSending(true);
    try {
      await accountEmailRequest(
        "auth/resend",
        {},
        { scope: "resend-verification" },
      );
      notify(`We sent a new link to ${state.accountEmail}.`);
    } catch {
      /* Shown as a toast. */
    } finally {
      setSending(false);
    }
  }
  return (
    <AuthCard
      title="Check your inbox"
      intro={
        <>
          We sent a link to <strong>{state.accountEmail}</strong>. Open it to
          finish creating your account. The link works for 24 hours.
        </>
      }
      footer={
        <>
          {"Used the wrong email? "}
          <button
            type="button"
            disabled={state.busy}
            onClick={(event) => onAction({ action: "sign-out" }, event)}
          >
            Sign out
          </button>
        </>
      }
    >
      <div className="login-form">
        <button
          className="btn primary login-submit countdown-button"
          type="button"
          disabled={sending || wait > 0 || state.busy}
          onClick={resend}
        >
          {sending && <span className="spinner" aria-hidden="true" />}
          {sending
            ? "Sending link…"
            : wait > 0
              ? `Send a new link in ${wait}s`
              : "Send a new link"}
        </button>
        <p className="field-help">
          Nothing after a few minutes? Check your spam folder.
        </p>
      </div>
    </AuthCard>
  );
}
