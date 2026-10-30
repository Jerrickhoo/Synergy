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
            Choose your role, then complete your profile to find collaborators.
          </p>
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
              </SelectField>
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
