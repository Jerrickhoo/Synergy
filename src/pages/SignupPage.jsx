import SelectField from "../components/SelectField.jsx";
import FormErrors from "../components/FormErrors.jsx";
import { useApp } from "../state/AppContext.jsx";
import { useState } from "react";
export default function SignupPage() {
  const { state, onSubmit } = useApp();
  const [passwordVisible, setPasswordVisible] = useState(false);
  return (
    <div className="page auth-page page-enter">
      <section className="auth-form-panel">
        <div className="card panel">
          <h1 tabIndex="-1">Create your account</h1>
          <p className="panel-subtitle">
            Find the startup or mentor who fills your gap, then finish the work
            together.
          </p>
          <ol className="signup-steps" aria-label="How Synergy works">
            <li>
              <strong>Tell us what you need</strong>
              <span>
                Describe it in your own words. We suggest the details.
              </span>
            </li>
            <li>
              <strong>Match with a partner</strong>
              <span>Every match explains what each side gets.</span>
            </li>
            <li>
              <strong>Finish in a Deal Room</strong>
              <span>
                Agree terms, confirm milestones together, then review.
              </span>
            </li>
          </ol>
          <form
            id="signup-form"
            className="grid section-gap"
            aria-busy={state.busy}
            onSubmit={(event) => onSubmit(event)}
          >
            <FormErrors scope="signup-form" />
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
              <div className="password-wrap">
                <input
                  id="signup-password"
                  name="password"
                  type={passwordVisible ? "text" : "password"}
                  minLength="8"
                  required
                  autoComplete="new-password"
                  aria-describedby="signup-password-help"
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={
                    passwordVisible ? "Hide password" : "Show password"
                  }
                  aria-pressed={passwordVisible}
                  onClick={() => setPasswordVisible(!passwordVisible)}
                >
                  {passwordVisible ? "Hide" : "Show"}
                </button>
              </div>
              <span className="field-help" id="signup-password-help">
                Use at least 8 characters.
              </span>
            </div>
            <div className="field">
              <label htmlFor="signup-role">I'm here as a</label>
              <SelectField id="signup-role" name="role" defaultValue="founder">
                <option value="founder">Startup founder</option>
                <option value="mentor">Mentor</option>
                <option value="both">Both: founder and mentor</option>
              </SelectField>
              <span className="field-help">
                Choosing both gives you two profiles. Switch between them at any
                time.
              </span>
            </div>
            <button className="btn primary" type="submit" disabled={state.busy}>
              {state.busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
