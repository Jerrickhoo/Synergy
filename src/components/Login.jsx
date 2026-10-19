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
          <div className="brand-mark">sy</div>
          <div>
            <div className="brand-name">synergy</div>
            <div className="brand-note">GOOD THINGS, TOGETHER</div>
          </div>
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
          <div className="login-quote">
            <p>
              “We went from ‘we should work together’ to a clear plan, 50 beta
              testers, and product feedback we could act on.”
            </p>
            <span>Maria Santos · Founder at BudgetBuddy</span>
          </div>
          {"\n      "}
        </div>
        {"\n      "}
        <div className="login-proof">
          <span className="login-proof-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z" />
            </svg>
          </span>
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
            <span className="brand-mark">sy</span>
            {" synergy"}
          </div>
          {"\n        "}
          <div className="eyebrow">WELCOME BACK</div>
          {"\n        "}
          <h2 className="login-heading">Sign in to Synergy</h2>
          {"\n        "}
          <p className="login-subheading">
            Your next good collaboration is waiting.
          </p>
          {"\n        "}
          <form
            className="login-form"
            id="login-form"
            onSubmit={(event) => onSubmit(event)}
          >
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
            </div>
            {"\n          "}
            <div className="login-options">
              <label className="remember-option">
                <input type="checkbox" name="remember" />
                {" Remember me"}
              </label>
              <button
                className="link-btn"
                type="button"
                data-action="forgot-password"
                onClick={(event) =>
                  onAction(
                    {
                      action: "forgot-password",
                    },
                    event,
                  )
                }
              >
                Forgot password?
              </button>
            </div>
            {"\n          "}
            <button className="btn primary login-submit" type="submit">
              Sign in
            </button>
            {"\n        "}
          </form>
          {"\n        "}
          <div className="login-divider">OR CONTINUE WITH</div>
          {"\n        "}
          <button
            className="btn login-google"
            type="button"
            data-action="google-sign-in"
            onClick={(event) =>
              onAction(
                {
                  action: "google-sign-in",
                },
                event,
              )
            }
          >
            <strong
              style={{
                fontSize: "14px",
                marginRight: "7px",
              }}
            >
              G
            </strong>
            {" Continue with Google"}
          </button>
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
