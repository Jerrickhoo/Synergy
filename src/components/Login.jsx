import Brand from "./Brand.jsx";
import FormErrors from "./FormErrors.jsx";
import { useApp } from "../state/AppContext.jsx";
import LoginCode from "./LoginCode.jsx";
export default function Login() {
  const { state, onAction, onSubmit, authChallenge } = useApp();
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
          ) : (
            <>
              <div className="eyebrow">WELCOME BACK</div>
              {"\n        "}
              <h2 className="login-heading">Sign in to Synergy</h2>
              {"\n        "}
              <p className="login-subheading">
                Enter your password, then confirm the code we email you to
                return to your workspace.
              </p>
              {"\n        "}
              <form
                className="login-form"
                id="login-form"
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
                  <label htmlFor="login-password">Password</label>
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
                  {state.busy ? "Signing in…" : "Sign in"}
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
                Local prototype. Accounts and work are saved on this server.
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
