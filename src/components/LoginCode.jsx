import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import FormErrors from "./FormErrors.jsx";

export default function LoginCode() {
  const { state, authChallenge, onSubmit, resendLoginCode, cancelLogin } =
    useApp();
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const formRef = useRef(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((authChallenge.resendAt - now) / 1000));
  const expired = authChallenge.expiresAt <= now;
  async function resend() {
    setError("");
    try {
      await resendLoginCode();
      formRef.current?.reset();
      setNow(Date.now());
      setResent(true);
    } catch (error) {
      setError(error.message);
    }
  }
  return (
    <>
      <div className="eyebrow">CHECK YOUR EMAIL</div>
      <h2 className="login-heading">Enter your verification code</h2>
      <p className="login-subheading">
        {authChallenge.sent
          ? `We sent a six-digit code to ${authChallenge.email}.`
          : `Request a new code for ${authChallenge.email}.`}{" "}
        Enter it to finish{" "}
        {authChallenge.purpose === "signup"
          ? "creating your account"
          : "signing in"}
        .
      </p>
      {authChallenge.deliveryError && !error && (
        <p className="integration-error" role="alert">
          {authChallenge.deliveryError}
        </p>
      )}
      {expired && (
        <p className="integration-error" role="alert">
          This sign-in request has expired. Go back and sign in again for a new
          code.
        </p>
      )}
      <form
        ref={formRef}
        id="login-code-form"
        className="login-form"
        onSubmit={onSubmit}
      >
        <FormErrors scope="login-code-form" />
        <div className="field">
          <label htmlFor="login-code">Six-digit verification code</label>
          <input
            id="login-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            required
            autoFocus
            aria-describedby="login-code-help"
          />
          <span id="login-code-help" className="field-help">
            Check your inbox and spam folder. Use the latest code. Codes expire
            after 15 minutes.
          </span>
        </div>
        <button
          className="btn primary login-submit"
          type="submit"
          disabled={state.busy || expired || !authChallenge.sent}
        >
          {state.busy ? "Please wait…" : "Verify and continue"}
        </button>
      </form>
      <div className="login-code-actions">
        <button
          className="btn"
          type="button"
          onClick={resend}
          disabled={state.busy || seconds > 0 || expired}
        >
          {seconds > 0 ? `Resend code in ${seconds}s` : "Resend code"}
        </button>
        <button
          className="link-btn"
          type="button"
          onClick={cancelLogin}
          disabled={state.busy}
        >
          Back to sign in
        </button>
      </div>
      {resent && !error && (
        <p role="status">
          A new code has been sent. Your previous code no longer works.
        </p>
      )}
      {error && (
        <p className="integration-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
