import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";

export default function SettingsPage() {
  const { state, integrationRequest, onAction, notify } = useApp();
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
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
  async function submit(event, path) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await integrationRequest(path, Object.fromEntries(new FormData(form)));
      form.reset();
      if (path === "account/delete") {
        await onAction({ action: "sign-out" });
        notify("Your account has been deleted.");
        return;
      }
      notify(
        path === "account/email"
          ? "Check your new email address for the code."
          : "Account settings updated.",
      );
      await load();
    } catch (error) {
      setError(error.message);
    }
  }
  async function change(path, body) {
    try {
      await integrationRequest(path, body);
      await load();
      return true;
    } catch (error) {
      setError(error.message);
      return false;
    }
  }
  async function exportAccount() {
    try {
      const data = await integrationRequest("account/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "synergy-account.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(error.message);
    }
  }
  return (
    <div className="page page-enter">
      <PageHeader
        title="Account settings"
        intro="Control your visibility, account access and personal data."
      />
      {error && (
        <p className="connection-banner" role="alert">
          {error}
        </p>
      )}
      {!settings ? (
        <section className="card panel">
          <p>Opening account settings…</p>
          {error && (
            <button className="btn" onClick={load}>
              Retry
            </button>
          )}
        </section>
      ) : (
        <>
          <section className="card panel">
            <h2>Profile visibility</h2>
            <p>
              Pausing removes both profiles from discovery and withdraws pending
              introductions. Existing rooms stay available.
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.visible}
                disabled={state.busy}
                onChange={async (event) => {
                  const visible = event.target.checked;
                  const previous = settings.visible;
                  setSettings((current) => ({ ...current, visible }));
                  if (!(await change("account/visibility", { visible })))
                    setSettings((current) => ({
                      ...current,
                      visible: previous,
                    }));
                }}
              />{" "}
              Show my completed profiles in Matches
            </label>
          </section>
          <section className="card panel section-gap">
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
                    disabled={state.busy}
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
          <section className="card panel section-gap">
            <h2>Sign-in sessions</h2>
            {settings.sessions.map((session) => (
              <div className="collaboration-row" key={session.id}>
                <span>
                  {session.current ? "This tab" : "Another signed-in session"} ·
                  expires {new Date(session.expiresAt).toLocaleString()}
                </span>
              </div>
            ))}
            <form
              className="grid section-gap"
              onSubmit={(event) => submit(event, "account/sessions/revoke")}
            >
              <label htmlFor="session-target">Sessions to sign out</label>
              <select id="session-target" name="id" defaultValue="others">
                <option value="others">All other sessions</option>
                {settings.sessions
                  .filter((session) => !session.current)
                  .map((session) => (
                    <option key={session.id} value={session.id}>
                      Session opened{" "}
                      {new Date(session.createdAt).toLocaleString()}
                    </option>
                  ))}
              </select>
              <label htmlFor="session-password">Current password</label>
              <input
                id="session-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={1024}
              />
              <button className="btn" disabled={state.busy}>
                Sign out other sessions
              </button>
            </form>
          </section>
          <section className="card panel section-gap">
            <h2>Change email</h2>
            <p>
              Current address: {state.accountEmail}. Verify the new address to
              finish. Other sessions will be signed out.
            </p>
            {state.integrations.email ? (
              <>
                <form
                  className="grid"
                  onSubmit={(event) => submit(event, "account/email")}
                >
                  <label htmlFor="new-email">New email address</label>
                  <input
                    id="new-email"
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                  />
                  <label htmlFor="email-password">Current password</label>
                  <input
                    id="email-password"
                    name="password"
                    type="password"
                    required
                    maxLength={1024}
                    autoComplete="current-password"
                  />
                  <button className="btn" disabled={state.busy}>
                    Send email change code
                  </button>
                </form>
                {settings.pendingEmail && (
                  <form
                    className="grid section-gap"
                    onSubmit={(event) => submit(event, "account/email/verify")}
                  >
                    <p>
                      Code sent to {settings.pendingEmail.email}. Request
                      another after{" "}
                      {new Date(
                        settings.pendingEmail.resendAt,
                      ).toLocaleTimeString()}
                      .
                    </p>
                    <label htmlFor="email-change-code">Email change code</label>
                    <input
                      id="email-change-code"
                      name="code"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                    />
                    <button className="btn primary" disabled={state.busy}>
                      Verify new email
                    </button>
                  </form>
                )}
              </>
            ) : (
              <p className="muted">
                Email changes will be available when email delivery is enabled.
              </p>
            )}
          </section>
          <section className="card panel section-gap">
            <h2>Your data</h2>
            <p>
              Download your profiles, shared workspace records and preferences.
              Passwords, verification codes and unreleased partner reviews are
              excluded.
            </p>
            <button
              className="btn"
              disabled={state.busy}
              onClick={exportAccount}
            >
              Download my data
            </button>
            <details className="section-gap">
              <summary>Delete my account</summary>
              <p>
                Your profile, email, credentials and preferences will be
                removed. Unfinished rooms close. Shared agreements, messages,
                evidence and reviews remain for collaborators, with your name
                replaced by “Deleted account.” This cannot be undone.
              </p>
              <form
                className="grid"
                onSubmit={(event) => submit(event, "account/delete")}
              >
                <label htmlFor="delete-password">Current password</label>
                <input
                  id="delete-password"
                  name="password"
                  type="password"
                  required
                  maxLength={1024}
                  autoComplete="current-password"
                />
                <label htmlFor="delete-confirmation">
                  Type DELETE to confirm
                </label>
                <input
                  id="delete-confirmation"
                  name="confirmation"
                  pattern="DELETE"
                  required
                  autoComplete="off"
                />
                <button className="btn danger" disabled={state.busy}>
                  Permanently delete account
                </button>
              </form>
            </details>
          </section>
        </>
      )}
    </div>
  );
}
