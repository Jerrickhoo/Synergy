import SelectField from "./SelectField.jsx";
import { useState } from "react";
import Brand from "./Brand.jsx";
import FormErrors from "./FormErrors.jsx";
import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";
import Toast from "./Toast.jsx";
import Overlay from "./Overlay.jsx";

const roleWord = { founder: "founder", mentor: "mentor" };
export default function Login() {
  const { state, onAction, onSubmit } = useApp();
  const demoMode = Boolean(state.integrations?.demoMode);
  const [prototypeRole, setPrototypeRole] = useState("founder");
  // A returning preview account last used in the other role.
  const [roleSwitch, setRoleSwitch] = useState(null);
  const enter = async (command) => {
    const result = await onAction(command);
    if (result?.roleSwitch)
      setRoleSwitch({ command, current: result.roleSwitch });
    return result;
  };
  return (
    <main
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
      <div className="login-panel">
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
            Find the startup or mentor who fills your gap, then finish the work
            together in a shared Deal Room.
          </p>
          {"\n        "}
          <Toast />
          <form
            className="login-form"
            id="login-form"
            aria-busy={state.busy}
            onSubmit={(event) => {
              if (demoMode) {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                enter({
                  action: "enter-demo",
                  roleChoice: prototypeRole,
                  email: String(values.get("email") || ""),
                  password: String(values.get("password") || ""),
                });
              } else onSubmit(event);
            }}
          >
            <FormErrors scope="login-form" />
            {demoMode && (
              <>
                <div className="field">
                  <div className="prototype-role-heading">
                    <label htmlFor="prototype-role">I'm signing in as</label>
                    <details className="prototype-role-help">
                      <summary aria-label="About this prototype">
                        <Icon name="info" />
                      </summary>
                      <p>
                        Sample mentors and startups are fictional. Where they
                        would normally reply, a Prototype only button lets you
                        continue. Nothing is emailed and no money moves.
                      </p>
                    </details>
                  </div>
                  <SelectField
                    id="prototype-role"
                    value={prototypeRole}
                    disabled={state.busy}
                    onChange={(event) => setPrototypeRole(event.target.value)}
                  >
                    <option value="founder">Founder</option>
                    <option value="mentor">Mentor</option>
                  </SelectField>
                </div>
                <p className="field-help" id="demo-password-help">
                  Use any email and password. Sign in with the same ones to come
                  back to your work.
                </p>
              </>
            )}
            {"\n          "}
            <div className="field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder="you@yourstartup.com"
                required
              />
            </div>
            {"\n          "}
            <div className="field">
              <div className="field-label-row">
                <label htmlFor="login-password">Password</label>
                {!demoMode && state.integrations?.emailAuth && (
                  <a className="link-btn" href="#/forgot-password">
                    Forgot password?
                  </a>
                )}
              </div>
              <div className="password-wrap">
                <input
                  id="login-password"
                  name="password"
                  type={state.passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
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
                  <Icon name={state.passwordVisible ? "eye-off" : "eye"} />
                </button>
              </div>
              {!demoMode && (
                <span className="field-help" id="demo-password-help">
                  Use the password you chose when creating your account.
                </span>
              )}
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
        {"\n    "}
      </div>
      {"\n  "}
      {roleSwitch && (
        <Overlay
          id="role-switch-dialog"
          title={`Switch to ${roleWord[roleSwitch.command.roleChoice]}?`}
          initialFocusSelector="#confirm-role-switch"
          busy={state.busy}
          onClose={() => setRoleSwitch(null)}
          footer={
            <>
              <button
                className="btn"
                disabled={state.busy}
                onClick={async () => {
                  const result = await enter({
                    ...roleSwitch.command,
                    roleChoice: roleSwitch.current,
                  });
                  if (!result?.roleSwitch) setRoleSwitch(null);
                }}
              >
                Continue as {roleWord[roleSwitch.current]}
              </button>
              <button
                id="confirm-role-switch"
                className="btn primary"
                disabled={state.busy}
                onClick={async () => {
                  await enter({
                    ...roleSwitch.command,
                    confirmRoleSwitch: true,
                  });
                  setRoleSwitch(null);
                }}
              >
                {state.busy && <span className="spinner" aria-hidden="true" />}
                Switch to {roleWord[roleSwitch.command.roleChoice]}
              </button>
            </>
          }
        >
          <p>
            You were last using Synergy as a {roleWord[roleSwitch.current]}.
            Other open tabs will switch too.
          </p>
        </Overlay>
      )}
    </main>
  );
}
