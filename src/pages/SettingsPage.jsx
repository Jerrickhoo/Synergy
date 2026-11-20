import { mentorEmailKinds } from "../data/mentor-email.js";
import { PaymentSettings } from "../components/Payments.jsx";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SelectField from "../components/SelectField.jsx";
import Overlay from "../components/Overlay.jsx";
import FormErrors from "../components/FormErrors.jsx";
import Icon from "../components/Icon.jsx";
import { readTheme, applyTheme, themeKey } from "../state/theme.js";
import MentoringSettings from "../components/MentoringSettings.jsx";

export default function SettingsPage() {
  const { state, integrationRequest, onAction, notify, onSubmit } = useApp();
  const prefs = state.notificationPreferences || {
    match: true,
    activity: true,
    reminders: true,
    digest: "weekly",
  };
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [actionError, setActionError] = useState("");
  const [working, setWorking] = useState(false);
  const [sessionTarget, setSessionTarget] = useState("others");
  const [targetRole, setTargetRole] = useState(null);
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const sync = () => {
      setTheme(readTheme());
      applyTheme(readTheme());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const submitting = useRef(false);
  const opener = useRef(null);
  const busy = working || state.busy;
  async function load() {
    try {
      setSettings(await integrationRequest("account"));
      setError("");
    } catch (error) {
      setError(error.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function openDialog(kind, event) {
    if (busy) return;
    onAction({
      action: "clear-form-errors",
      scope: "account-confirmation-form",
    });
    opener.current = event.currentTarget;
    setActionError("");
    setSessionTarget("others");
    setDialog(kind);
  }
  function closeDialog() {
    if (submitting.current) return;
    onAction({
      action: "clear-form-errors",
      scope: "account-confirmation-form",
    });
    setDialog(null);
    setActionError("");
    requestAnimationFrame(() => opener.current?.focus());
  }
  async function confirm(event) {
    event.preventDefault();
    if (submitting.current || state.busy) return;
    submitting.current = true;
    setWorking(true);
    setActionError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const path =
      dialog === "pause"
        ? "account/visibility"
        : dialog === "sessions"
          ? "account/sessions/revoke"
          : "account/delete";
    try {
      await integrationRequest(
        path,
        dialog === "pause" ? { visible: false } : values,
      );
      if (dialog === "delete") {
        await onAction({ action: "sign-out" });
        notify("Your account has been deleted.");
        return;
      }
      if (dialog === "pause")
        setSettings((current) => ({ ...current, visible: false }));
      else
        setSettings((current) => ({
          ...current,
          sessions: current.sessions.filter(
            (session) =>
              session.current ||
              (values.id !== "others" && session.id !== values.id),
          ),
        }));
      setDialog(null);
      notify(
        dialog === "pause"
          ? "Discovery paused. Existing rooms remain available."
          : "Account settings updated. Selected sessions have been signed out.",
      );
      await load();
      requestAnimationFrame(() => opener.current?.focus());
    } catch (error) {
      setActionError(error.message);
    } finally {
      submitting.current = false;
      setWorking(false);
    }
  }
  async function change(path, body) {
    if (submitting.current || state.busy) return;
    submitting.current = true;
    setWorking(true);
    try {
      await integrationRequest(path, body);
      await load();
      notify(
        path === "account/visibility"
          ? "Discovery resumed. Withdrawn introductions stay withdrawn."
          : "Account settings updated.",
      );
    } catch (error) {
      setError(error.message);
    } finally {
      submitting.current = false;
      setWorking(false);
    }
  }
  const titles = {
    pause: "Pause discovery?",
    sessions: "Sign out other sessions?",
    delete: "Delete your account?",
  };
  return (
    <div className="page settings-page page-enter">
      <PageHeader
        title="Account settings"
        intro={
          state.role === "mentor"
            ? "Set your mentoring limits, then control visibility, account access and personal data."
            : "Control your visibility, account access and personal data."
        }
      />
      {state.role === "mentor" && <MentoringSettings />}
      <PaymentSettings />
      <section className="card panel settings-section appearance-settings">
        <h2>Appearance</h2>
        <p>Choose Light or Dark for this browser. Light is the default.</p>
        <SelectField
          id="appearance-theme"
          label="Color theme"
          value={theme}
          onChange={(event) => {
            const next = event.target.value;
            setTheme(next);
            applyTheme(next);
            try {
              localStorage.setItem(themeKey, next);
            } catch {
              notify(
                "Theme applied for this visit. Browser storage is unavailable.",
                "info",
              );
            }
          }}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </section>
      <section
        className="card panel settings-section section-gap"
        aria-labelledby="notification-settings"
      >
        <h2 id="notification-settings">Notifications</h2>
        <button
          type="button"
          className="link-btn"
          onClick={() => onAction({ page: "calendar" })}
        >
          View calendar
        </button>
        <p>
          Choose what reaches your Updates and bell. Requests that need your
          reply, such as terms to accept or a milestone to confirm, always show.
        </p>
        <form
          data-form="notification-preferences"
          className="grid notification-preferences"
          key={JSON.stringify(prefs)}
          onSubmit={(event) => onSubmit(event)}
        >
          <fieldset className="checkbox-group">
            <legend>Send me</legend>
            {[
              ["match", "New match suggestions"],
              ["activity", "Collaboration activity from partners"],
              [
                "reminders",
                "Reminders about due dates, sessions and quiet deals",
              ],
            ].map(([key, label]) => (
              <label className="checkbox-label" key={key}>
                <input type="checkbox" name={key} defaultChecked={prefs[key]} />{" "}
                {label}
              </label>
            ))}
          </fieldset>
          <SelectField
            id="digest-frequency"
            name="digest"
            label="Digest"
            defaultValue={prefs.digest}
            options={[
              { value: "off", label: "Off: show updates as they happen" },
              { value: "daily", label: "Daily summary" },
              { value: "weekly", label: "Weekly summary" },
            ]}
          />
          <p className="field-help">
            A digest collects match suggestions and partner activity into one
            summary on Updates instead of separate alerts.
          </p>
          {state.role === "mentor" && (
            <SelectField
              id="mentor-request-email"
              name="mentorRequestEmail"
              label="New mentorship request alerts"
              defaultValue={prefs.mentorRequestEmail || "daily"}
              options={[
                {
                  value: "daily",
                  label: `Daily at ${String(state.mentorConfig?.digestHour ?? 8).padStart(2, "0")}:00 in your time zone`,
                },
                { value: "instant", label: "As requests arrive" },
              ]}
            />
          )}
          <fieldset className="checkbox-group">
            <legend>Mentorship emails</legend>
            <input
              type="hidden"
              name="mentorshipEmailPreferences"
              value="yes"
            />
            {Object.entries(mentorEmailKinds)
              .filter(
                ([key]) =>
                  state.role === "mentor" ||
                  ![
                    "request",
                    "mentor-approved",
                    "guidelines-required",
                  ].includes(key),
              )
              .map(([key, label]) => (
                <label className="checkbox-label" key={key}>
                  <input
                    type="checkbox"
                    name={`email-${key}`}
                    defaultChecked={
                      prefs.mentorEmailKinds?.[key] !== false &&
                      !state.mentorEmailStatus?.unsubscribedKinds?.includes(key)
                    }
                  />{" "}
                  {label}
                </label>
              ))}
            {(state.mentorEmailStatus?.bouncedAt ||
              state.mentorEmailStatus?.unsubscribedAt) && (
              <p>
                Email delivery to this address is paused. Your notices are
                available in Updates.
              </p>
            )}
          </fieldset>
          <button className="btn" disabled={state.busy}>
            Save notification preferences
          </button>
        </form>
        {state.matchAlerts?.length > 0 && (
          <section
            className="match-alerts"
            aria-labelledby="match-alerts-title"
          >
            <h3 id="match-alerts-title">Match alerts</h3>
            <p className="field-help">
              These add a match suggestion to Updates when someone new offers
              the help you asked for.
            </p>
            <ul>
              {state.matchAlerts.map((alert) => (
                <li key={alert.need}>
                  <span>Someone offers {alert.need}</span>
                  <form data-form="match-alert" onSubmit={onSubmit}>
                    <input type="hidden" name="need" value={alert.need} />
                    <input type="hidden" name="enabled" value="off" />
                    <button className="link-btn" disabled={state.busy}>
                      Stop
                      <span className="visually-hidden">
                        {" "}
                        alerts for {alert.need}
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
      {state.role === "mentor" && (
        <section className="card panel section-gap">
          <h2>Mentoring survey</h2>
          <form
            data-form="mentorship-survey"
            className="mentor-request-form"
            onSubmit={onSubmit}
          >
            <fieldset>
              <legend>
                Would you charge for any format if Synergy handled payments?
              </legend>
              <label>
                <input
                  type="radio"
                  name="wouldCharge"
                  value="yes"
                  required
                  defaultChecked={state.mentorshipSurvey?.wouldCharge === true}
                />{" "}
                Yes
              </label>
              <label>
                <input
                  type="radio"
                  name="wouldCharge"
                  value="no"
                  required
                  defaultChecked={state.mentorshipSurvey?.wouldCharge === false}
                />{" "}
                No
              </label>
            </fieldset>
            <button className="btn" disabled={state.busy}>
              Save survey response
            </button>
          </form>
        </section>
      )}
      {error && (
        <div className="connection-banner" role="alert">
          <p>{error}</p>
          <button className="btn small" onClick={load}>
            Retry account settings
          </button>
        </div>
      )}
      {!settings ? (
        <section className="card panel">
          <p>Opening account settings…</p>
        </section>
      ) : (
        <>
          <section className="card panel settings-section section-gap">
            <h2>Profiles</h2>
            <p>
              Switch between your founder and mentor profiles. Each keeps its
              own details and drafts.
            </p>
            <SelectField
              id="active-profile"
              label="Active profile"
              value={state.role}
              disabled={busy}
              onChange={(event) => {
                if (event.target.value !== state.role)
                  setTargetRole(event.target.value);
              }}
            >
              <option value="founder">Startup founder</option>
              <option value="mentor">Mentor</option>
            </SelectField>
          </section>
          <section className="card panel settings-section section-gap">
            <h2>Blocked collaborators</h2>
            <p>
              Blocking hides both accounts from each other in Matches, withdraws
              introductions, closes unfinished rooms and stops further chat.
              Shared history remains available.
            </p>
            {settings.blocked.length ? (
              settings.blocked.map((person) => (
                <div className="collaboration-row" key={person.id}>
                  <span>{person.name}</span>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      change("account/block", {
                        accountId: person.id,
                        blocked: false,
                      })
                    }
                  >
                    Unblock {person.name}
                  </button>
                </div>
              ))
            ) : (
              <p className="muted">
                No blocked collaborators. You can block someone from their match
                profile.
              </p>
            )}
          </section>
          <section className="card panel settings-section section-gap">
            <h2>Account access</h2>
            <h3>Sign-in sessions</h3>
            {settings.sessions.map((session) => (
              <div className="collaboration-row" key={session.id}>
                <span>
                  {session.current ? "This tab" : "Another signed-in session"} ·
                  expires {new Date(session.expiresAt).toLocaleString()}
                </span>
              </div>
            ))}
            <p className="muted">
              Manage other sessions in Danger zone below. This tab stays signed
              in.
            </p>
          </section>
          <details
            id="danger-zone"
            className="card panel settings-section danger-zone section-gap"
            aria-labelledby="danger-zone-heading"
          >
            <summary id="danger-zone-heading">
              <span>Danger zone</span>
              <Icon name="chevron" />
            </summary>
            <p>
              Review the consequences before changing account access or removing
              your account.
            </p>
            <div className="account-action-row">
              <div>
                <h3>Profile visibility</h3>
                <p role="status">
                  {settings.visible
                    ? "Your completed profiles are visible in Matches."
                    : "Discovery is paused. Both profiles are hidden from Matches."}
                </p>
                <p>
                  Hide both profiles and withdraw pending introductions.
                  Existing rooms remain available. Resuming does not restore
                  withdrawn introductions.
                </p>
              </div>
              <button
                className="btn"
                disabled={busy}
                onClick={(event) =>
                  settings.visible
                    ? openDialog("pause", event)
                    : change("account/visibility", { visible: true })
                }
              >
                {settings.visible ? "Pause discovery" : "Resume discovery"}
              </button>
            </div>
            <div className="account-action-row">
              <div>
                <h3>Other sign-in sessions</h3>
                <p>
                  Sign out other tabs or devices. Your current session stays
                  active.
                </p>
              </div>
              <button
                className="btn"
                disabled={busy}
                onClick={(event) => openDialog("sessions", event)}
              >
                Sign out other sessions
              </button>
            </div>
            <div className="account-action-row">
              <div>
                <h3>Delete account</h3>
                <p>
                  Permanently remove your private account information. Shared
                  history remains anonymized.
                </p>
              </div>
              <button
                className="btn danger"
                disabled={busy}
                onClick={(event) => openDialog("delete", event)}
              >
                Delete my account
              </button>
            </div>
          </details>
        </>
      )}
      {targetRole && (
        <Overlay
          id="profile-switch-dialog"
          title="Switch active profile?"
          initialFocusSelector="#cancel-profile-switch"
          onClose={() => setTargetRole(null)}
          busy={busy}
          footer={
            <>
              <button
                id="cancel-profile-switch"
                className="btn"
                disabled={busy}
                onClick={() => setTargetRole(null)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  const success = await onAction({
                    action: "choose-role",
                    roleChoice: targetRole,
                  });
                  if (success) setTargetRole(null);
                }}
              >
                {busy ? "Switching…" : "Switch profile"}
              </button>
            </>
          }
        >
          <p>
            Switch from{" "}
            <strong>
              {state.role === "founder" ? "Startup founder" : "Mentor"}
            </strong>{" "}
            to{" "}
            <strong>
              {targetRole === "founder" ? "Startup founder" : "Mentor"}
            </strong>
            ?
          </p>
          <p>
            Each profile keeps its own draft in this tab. Unsaved edits remain
            unpublished until you select Save profile.
          </p>
        </Overlay>
      )}
      {dialog && settings && (
        <Overlay
          id="account-action-dialog"
          title={titles[dialog]}
          onClose={closeDialog}
          initialFocusSelector="#cancel-account-action"
          busy={busy}
          footer={
            <>
              <button
                id="cancel-account-action"
                className="btn"
                disabled={busy}
                onClick={closeDialog}
              >
                Cancel
              </button>
              <button
                form="account-confirmation-form"
                type="submit"
                className={`btn ${dialog === "delete" ? "danger" : "primary"}`}
                disabled={busy}
              >
                {busy
                  ? "Saving…"
                  : dialog === "pause"
                    ? "Pause discovery"
                    : dialog === "sessions"
                      ? "Confirm session sign-out"
                      : "Permanently delete account"}
              </button>
            </>
          }
        >
          <form
            id="account-confirmation-form"
            className="grid"
            aria-busy={busy}
            onSubmit={confirm}
          >
            <FormErrors scope="account-confirmation-form" />
            {dialog === "pause" ? (
              <p>
                Both profiles will disappear from Matches and all pending
                introductions will be withdrawn. Your existing rooms stay
                available. Resuming discovery later will not restore withdrawn
                introductions.
              </p>
            ) : dialog === "delete" ? (
              <p>
                Your profile, email, credentials and preferences will be
                removed. Unfinished rooms close. Shared agreements, messages,
                evidence and reviews remain for collaborators, with your name
                replaced by “Deleted account.” This cannot be undone.
              </p>
            ) : (
              <>
                <SelectField
                  id="session-target"
                  name="id"
                  label="Sessions to sign out"
                  value={sessionTarget}
                  onChange={(event) => setSessionTarget(event.target.value)}
                  disabled={busy}
                >
                  <option value="others">All other sessions</option>
                  {settings.sessions
                    .filter((session) => !session.current)
                    .map((session) => (
                      <option key={session.id} value={session.id}>
                        Session opened{" "}
                        {new Date(session.createdAt).toLocaleString()}
                      </option>
                    ))}
                </SelectField>
                <p>
                  {sessionTarget === "others"
                    ? `All ${settings.sessions.filter((session) => !session.current).length} other active sessions will be signed out.`
                    : "The selected session will be signed out."}{" "}
                  This tab stays signed in. Those tabs must sign in again to
                  continue.
                </p>
              </>
            )}
            {dialog !== "pause" && !state.integrations?.guest && (
              <div className="field">
                <label
                  htmlFor={
                    dialog === "delete" ? "delete-password" : "session-password"
                  }
                >
                  Current password
                </label>
                <input
                  id={
                    dialog === "delete" ? "delete-password" : "session-password"
                  }
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={1024}
                  disabled={busy}
                />
              </div>
            )}
            {dialog === "delete" && (
              <div className="field">
                <label htmlFor="delete-confirmation">
                  Type DELETE to confirm
                </label>
                <input
                  id="delete-confirmation"
                  name="confirmation"
                  pattern="DELETE"
                  required
                  autoComplete="off"
                  disabled={busy}
                />
              </div>
            )}
            {actionError && (
              <p className="account-action-error" role="alert">
                {actionError} Review your details and try again.
              </p>
            )}
          </form>
        </Overlay>
      )}
    </div>
  );
}
