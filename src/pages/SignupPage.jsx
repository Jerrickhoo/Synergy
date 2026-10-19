import { useApp } from "../state/AppContext.jsx";
import AuthStory from "../components/AuthStory.jsx";
export default function SignupPage() {
  const { onSubmit } = useApp();
  return (
    <div className="page auth-page page-enter">
      <AuthStory />
      <section className="auth-form-panel">
        <div className="card panel">
          <div className="eyebrow">JOIN THE COMMUNITY</div>
          <h1 tabIndex="-1">Create your account</h1>
          <p className="panel-subtitle">
            Start with the basics. You can choose your role and complete your
            profile next.
          </p>
          <form
            id="signup-form"
            className="grid section-gap"
            onSubmit={(event) => onSubmit(event)}
          >
            <div className="form-grid">
              <div className="field">
                <label htmlFor="signup-first">First name</label>
                <input
                  id="signup-first"
                  name="firstName"
                  required
                  autoComplete="given-name"
                />
              </div>
              <div className="field">
                <label htmlFor="signup-last">Last name</label>
                <input
                  id="signup-last"
                  name="lastName"
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                name="password"
                type="password"
                minLength="8"
                required
                autoComplete="new-password"
              />
            </div>
            <button className="btn primary" type="submit">
              Create account
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
