import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
export default function PasswordRecovery({ onClose }) {
  const { state, integrationRequest, notify } = useApp();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  async function request(event) {
    event.preventDefault();
    try {
      const result = await integrationRequest("password/request", { email });
      setSent(true);
      setMessage(result.message);
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function reset(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await integrationRequest("password/reset", { ...values, email });
      setDone(true);
      setMessage(
        "Password updated. Sign in with your new password. Previous sessions have been signed out.",
      );
      notify("Password updated. Sign in with your new password.");
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <div>
      <h2 className="login-heading">Recover your account</h2>
      {message && <p role="status">{message}</p>}
      {!done && (
        <>
          <form className="grid" onSubmit={request}>
            <div className="field">
              <label htmlFor="reset-email">Account email</label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setSent(false);
                }}
                required
                autoComplete="email"
              />
            </div>
            <button className="btn" disabled={state.busy}>
              {sent ? "Request another code" : "Send reset code"}
            </button>
          </form>
          {sent && (
            <form className="grid section-gap" onSubmit={reset}>
              <div className="field">
                <label htmlFor="reset-code">Reset code</label>
                <input
                  id="reset-code"
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                />
              </div>
              <div className="field">
                <label htmlFor="reset-password">New password</label>
                <input
                  id="reset-password"
                  name="password"
                  type="password"
                  minLength={8}
                  maxLength={1024}
                  required
                  autoComplete="new-password"
                />
              </div>
              <button className="btn primary" disabled={state.busy}>
                Reset password
              </button>
            </form>
          )}
        </>
      )}
      <button
        className="link-btn section-gap"
        type="button"
        disabled={state.busy}
        onClick={onClose}
      >
        Back to sign in
      </button>
    </div>
  );
}
