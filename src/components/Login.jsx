import { useState } from "react";
import Brand from "./Brand.jsx";
import FormErrors from "./FormErrors.jsx";
import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";
export default function Login() {
  const { state, onAction, onSubmit } = useApp();
  const demoMode = Boolean(state.integrations?.demoMode);
  const [prototypeRole, setPrototypeRole] = useState("founder");
  return (
    <section
      id="login-shell"
      className="login-screen"
      hidden={state.authenticated}
      aria-label="Sign in to Synergy"
    >
      <img
        className="login-artwork"
        src="/brand/login-connections.svg"
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      {"\n    "}
      <div className={`login-panel${demoMode ? " prototype-login" : ""}`}>
        {"\n      "}
        <div className="login-form-wrap">
          {"\n        "}
          <div className="login-mobile-brand">
            <Brand compact />
          </div>
          {"\n        "}
          {"\n        "}
          <h1 className="login-heading">Sign in to Synergy</h1>
          {"\n        "}
          <p className="login-subheading">
            Access your profiles, introductions and collaboration rooms.
          </p>
          {"\n        "}
          <form
            className="login-form"
            id="login-form"
            aria-busy={state.busy}
            onSubmit={(event) => {
              if (demoMode) {
                event.preventDefault();
                onAction({ action: "enter-demo", roleChoice: prototypeRole });
              } else onSubmit(event);
            }}
          >
            <FormErrors scope="login-form" />
            {"\n          "}
            <div className="field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                name="email"
                type={demoMode ? "text" : "email"}
                inputMode="email"
                autoComplete={demoMode ? "off" : "username"}
                placeholder="you@yourstartup.com"
                required
              />
            </div>
            {"\n          "}
            <div className="field">
              <div className="field-label-row">
                <label htmlFor="login-password">Password</label>
              </div>
              <div className="password-wrap">
                <input
                  id="login-password"
                  name="password"
                  type={state.passwordVisible ? "text" : "password"}
                  autoComplete={demoMode ? "off" : "current-password"}
                  placeholder="Enter your password"
                  required
                  minLength={demoMode ? undefined : 4}
                  aria-describedby="demo-password-help"
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={
                    state.passwordVisible ? "Hide password" : "Show password"
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
                {demoMode
                  ? "Use any email and password to explore the prototype."
                  : "Use the password you chose when creating your account."}
              </span>
            </div>
            {"\n          "}
            <button
              className="btn primary login-submit"
              type="submit"
              disabled={state.busy}
            >
              {state.busy && <span className="spinner" aria-hidden="true" />}
              {state.busy ? "Signing in…" : "Sign in"}
              {!state.busy && <Icon name="arrow" />}
            </button>
            {"\n        "}
          </form>
          {"\n        "}
          {!demoMode && (
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
          )}
          {"\n        "}
          {"\n      "}
        </div>
        {demoMode && (
          <div className="prototype-role-control">
            <label htmlFor="prototype-role">Prototype role</label>
            <select
              id="prototype-role"
              value={prototypeRole}
              disabled={state.busy}
              onChange={(event) => setPrototypeRole(event.target.value)}
            >
              <option value="founder">Founder</option>
              <option value="mentor">Mentor</option>
            </select>
          </div>
        )}
        {"\n    "}
      </div>
      {"\n  "}
    </section>
  );
}
