import { useState } from "react";
import SelectField from "../components/SelectField.jsx";
import FormErrors from "../components/FormErrors.jsx";
import AuthCard from "../components/AuthCard.jsx";
import Icon from "../components/Icon.jsx";
import { useApp } from "../state/AppContext.jsx";

export default function SignupPage() {
  const { state, onSubmit, onAction } = useApp();
  const [passwordVisible, setPasswordVisible] = useState(false);
  return (
    <AuthCard
      title="Create your account"
      intro="Find the startup or mentor who fills your gap, then finish the work together in a shared Deal Room."
      footer={
        <>
          {"Already have an account? "}
          <button
            type="button"
            onClick={(event) => onAction({ action: "back-to-sign-in" }, event)}
          >
            Sign in
          </button>
        </>
      }
    >
      <form
        id="signup-form"
        className="login-form"
        aria-busy={state.busy}
        onSubmit={(event) => onSubmit(event)}
      >
        <FormErrors scope="signup-form" />
        <div className="form-grid signup-names">
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
            inputMode="email"
            required
            autoComplete="email"
            placeholder="you@yourstartup.com"
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
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              aria-pressed={passwordVisible}
              onClick={() => setPasswordVisible(!passwordVisible)}
            >
              <Icon name={passwordVisible ? "eye-off" : "eye"} />
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
        <button
          className="btn primary login-submit"
          type="submit"
          disabled={state.busy}
        >
          {state.busy && <span className="spinner" aria-hidden="true" />}
          {state.busy ? "Creating account…" : "Create account"}
          {!state.busy && <Icon name="arrow" />}
        </button>
      </form>
    </AuthCard>
  );
}
