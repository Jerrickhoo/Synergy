import Brand from "./Brand.jsx";
import FormErrors from "./FormErrors.jsx";
import { useApp } from "../state/AppContext.jsx";
import LoginCode from "./LoginCode.jsx";
import Icon from "./Icon.jsx";
import { useState } from "react";
import PasswordRecovery from "./PasswordRecovery.jsx";
export default function Login() {
  const { state, onAction, onSubmit, authChallenge } = useApp();
  const [recovering, setRecovering] = useState(false);
  return (
    <section
      id="login-shell"
      className="login-screen"
      hidden={state.authenticated}
      aria-label="Sign in to Synergy"
    >
      {"\n    "}
      <div className="login-story">
        {"\n      "}
        <div className="login-brand">
          <Brand />
        </div>
        {"\n      "}
        <div className="login-story-copy">
          {"\n        "}
          <div className="login-story-kicker">Build better, together</div>
          {"\n        "}
          <h1>The right people change everything.</h1>
          {"\n        "}
          <p>
            Find the partners, early users, and mentors who complement what
            you’re building—and turn a promising introduction into real
            progress.
          </p>
          <div className="login-benefits">
            <div>
              <span>
                <Icon name="people" />
              </span>
              <div>
                <strong>Find your people</strong>
                <p>Connect through shared goals and complementary skills.</p>
              </div>
            </div>
            <div>
              <span>
                <Icon name="rooms" />
              </span>
              <div>
                <strong>Turn a connection into progress</strong>
                <p>Keep commitments, milestones, and conversations together.</p>
              </div>
            </div>
          </div>
          {"\n        "}

          {"\n      "}
        </div>
        {"\n      "}
        <div className="login-proof">
          <span>
            <strong>Thoughtful matches.</strong>
            {" Clear commitments. Work that moves forward."}
          </span>
        </div>
        {"\n    "}
      </div>
      {"\n    "}
      <div className="login-panel">
        {"\n      "}
        <div className="login-form-wrap">
          {"\n        "}
          <div className="login-mobile-brand">
            <Brand compact />
          </div>
          {"\n        "}
          {authChallenge ? (
            <LoginCode />
          ) : recovering ? (
            <PasswordRecovery onClose={() => setRecovering(false)} />
          ) : (
            <>
              <div className="eyebrow">WELCOME BACK</div>
              {"\n        "}
              <h2 className="login-heading">Sign in to Synergy</h2>
              {"\n        "}
              <p className="login-subheading">
                Your next collaboration starts here. Sign in to pick up where
                you left off.
              </p>
              {"\n        "}
              <form
                className="login-form"
                id="login-form"
                aria-busy={state.busy}
                onSubmit={(event) => onSubmit(event)}
              >
                <FormErrors scope="login-form" />
                {"\n          "}
                <div className="field">
                  <label htmlFor="login-email">Email address</label>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@yourstartup.com"
                    required
                  />
                </div>
                {"\n          "}
                <div className="field">
                  <div className="field-label-row">
                    <label htmlFor="login-password">Password</label>
                    <button
                      className="link-btn"
                      type="button"
                      onClick={() => setRecovering(true)}
                    >
                      Forgot your password?
                    </button>
                  </div>
                  <div className="password-wrap">
                    <input
                      id="login-password"
                      name="password"
                      type={state.passwordVisible ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      required
                      minLength="4"
                      aria-describedby="demo-password-help"
                    />
                    <button
                      className="password-toggle"
                      type="button"
                      aria-label={
                        state.passwordVisible
                          ? "Hide password"
                          : "Show password"
                      }
                      aria-pressed={state.passwordVisible}
                      data-action="toggle-password"
                      onClick={(event) =>
                        onAction(
                          {
                            action: "toggle-password",
                          },
                          event,
                        )
                      }
                    >
                      {state.passwordVisible ? "Hide" : "Show"}
                    </button>
                  </div>
                  <span className="field-help" id="demo-password-help">
                    Use the password you chose when creating your account.
                  </span>
                </div>
                {"\n          "}
                <button
                  className="btn primary login-submit"
                  type="submit"
                  disabled={state.busy}
                >
                  {state.busy && (
                    <span className="spinner" aria-hidden="true" />
                  )}
                  {state.busy ? "Signing in…" : "Sign in"}
                  {!state.busy && <Icon name="arrow" />}
                </button>
                {"\n        "}
              </form>
              {"\n        "}
              <p className="login-join">
                {"New to Synergy? "}
                <button
                  type="button"
                  data-action="create-account"
                  onClick={(event) =>
                    onAction(
                      {
                        action: "create-account",
                      },
                      event,
                    )
                  }
                >
                  Create an account
                </button>
              </p>
              {"\n        "}
              <p className="login-disclaimer">
                <Icon name="shield" /> Your workspace, all in one place.
              </p>
            </>
          )}
          {"\n      "}
        </div>
        {"\n    "}
      </div>
      {"\n  "}
    </section>
  );
}
