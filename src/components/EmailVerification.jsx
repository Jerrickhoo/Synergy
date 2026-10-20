import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import FormErrors from "./FormErrors.jsx";

export default function EmailVerification() {
  const { state, integrationRequest, notify } = useApp();
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  useEffect(() => {
    if (!resendSeconds) return;
    const timer = setTimeout(
      () => setResendSeconds((value) => value - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [resendSeconds]);
  async function send() {
    setError("");
    setMessage("");
    try {
      const result = await integrationRequest("email/send", {});
      setSent(true);
      setCode("");
      setResendSeconds(result.retryAfterSeconds || 60);
      setMessage(
        `Code sent to ${state.accountEmail}. Check your inbox and spam folder. It expires in 15 minutes.`,
      );
      notify(
        `Code sent to ${state.accountEmail}. Check your inbox and spam folder.`,
      );
    } catch (error) {
      setError(error.message);
    }
  }
  async function verify(event) {
    event.preventDefault();
    setError("");
    try {
      await integrationRequest("email/verify", { code, role: state.role });
      setMessage("Your email is verified.");
      notify("Your email is verified. You're ready to connect.");
    } catch (error) {
      setError(error.message);
    }
  }
  return (
    <section className="card panel integration-card">
      <h2>Email verification</h2>
      <p>{state.accountEmail}</p>
      {state.emailVerified ? (
        <p className="status green">Email verified</p>
      ) : state.integrations?.email ? (
        <>
          <p className="muted">
            {state.integrations.requireVerification
              ? "Verify your email to make your profile visible and connect with collaborators."
              : "Confirm that this email address belongs to you."}
          </p>
          <button
            className="btn"
            type="button"
            disabled={state.busy || resendSeconds > 0}
            onClick={send}
          >
            {resendSeconds > 0
              ? `Send a new code in ${resendSeconds}s`
              : sent
                ? "Send a new code"
                : "Send verification code"}
          </button>
          <form
            id="email-verification-form"
            className="verification-form"
            onSubmit={verify}
          >
            <FormErrors scope="email-verification-form" />
            <div className="field">
              <label htmlFor="email-code">Six-digit verification code</label>
              <input
                id="email-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />
            </div>
            <button className="btn primary" disabled={state.busy}>
              Verify email
            </button>
          </form>
        </>
      ) : (
        <p className="muted">
          Email delivery has not been enabled for this workspace yet.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="integration-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
