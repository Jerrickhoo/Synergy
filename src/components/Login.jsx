import Brand from "./Brand.jsx";
import FormErrors from "./FormErrors.jsx";
import { useApp } from "../state/AppContext.jsx";
export default function Login() {
  const { state, onAction, onSubmit } = useApp();
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
          <div className="eyebrow">WELCOME BACK</div>
          {"\n        "}
          <h2 className="login-heading">Sign in to Synergy</h2>
          {"\n        "}
          <p className="login-subheading">
            Start with a clean workspace and make it yours.
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
                For this demo, enter any password with 4 or more characters.
              </span>
            </div>
            {"\n          "}
            <button className="btn primary login-submit" type="submit">
              Sign in
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
            Prototype sign-in only. Credentials are not checked, saved, or sent
            anywhere.
          </p>
          {"\n      "}
        </div>
        {"\n    "}
      </div>
      {"\n  "}
    </section>
  );
}
