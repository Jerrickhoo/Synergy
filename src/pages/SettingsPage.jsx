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
import { formatDateTime } from "../data/dates.js";

// The page's sections as a menu: beside them on wide screens, a row of
// links above them on narrow ones. It marks the section in view and moves
// focus to the one chosen, as a page change would.
function SettingsNav({ sections }) {
  const [current, setCurrent] = useState(sections[0]?.[0]);
  const ids = sections.map(([id]) => id).join(" ");
  // A chosen section stays marked while the page scrolls to it.
  const chosen = useRef(null);
  const nav = useRef(null);
  useEffect(() => {
    // The section in view is the last one whose top has passed a line 40%
    // down the window.
    const lineAt = () => Math.max(140, window.innerHeight * 0.4);
    const list = () =>
      ids
        .split(" ")
        .map((id) => document.getElementById(id))
        .filter(Boolean);
    let frame = 0;
    const update = () => {
      frame = 0;
      if (chosen.current) return;
      const sections = list();
      if (!sections.length) return;
      const line = lineAt();
      let active = sections[0].id;
      for (const element of sections)
        if (element.getBoundingClientRect().top <= line) active = element.id;
      setCurrent(active);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // Room below the last section, just enough for it to scroll up to the
    // line, so every section above it passes the line too and stays marked
    // while it is read. Only beside the sections, where the menu stays in
    // view; above them it scrolls away with the page.
    const content = nav.current?.nextElementSibling;
    const fit = () => {
      const last = list().at(-1);
      if (!content || !last) return;
      content.style.paddingBottom = "";
      if (getComputedStyle(nav.current).position !== "sticky") return;
      const below =
        document.documentElement.scrollHeight -
        (last.getBoundingClientRect().top + window.scrollY);
      const need = window.innerHeight - lineAt() - below;
      if (need > 0) content.style.paddingBottom = `${Math.ceil(need)}px`;
      schedule();
    };
    const resized = new ResizeObserver(fit);
    if (content) for (const child of content.children) resized.observe(child);
    // Sections that load later (account details) are watched as they come.
    const added = new MutationObserver(() => {
      if (content) for (const child of content.children) resized.observe(child);
      fit();
    });
    if (content) added.observe(content, { childList: true });
    fit();
    // Scrolling by hand after choosing a section hands marking back.
    const release = () => {
      chosen.current = null;
      schedule();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", fit);
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", release);
    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
      added.disconnect();
      if (content) content.style.paddingBottom = "";
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", fit);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", release);
    };
  }, [ids]);
  const go = (id) => {
    const element = document.getElementById(id);
    if (!element) return;
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    element.focus({ preventScroll: true });
    chosen.current = id;
    setCurrent(id);
  };
  return (
    <nav ref={nav} className="settings-nav" aria-label="Settings sections">
      <ul>
        {sections.map(([id, label]) => (
          <li key={id}>
            <button
              type="button"
              aria-current={current === id ? "true" : undefined}
              onClick={() => go(id)}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

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
          ? "Discovery resumed. Withdrawn requests stay withdrawn."
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
  const others = settings?.sessions.filter((session) => !session.current) || [];
  const thisSession = settings?.sessions.find((session) => session.current);
  // Mentorship emails, split so the payment ones read as their own group.
  const emailKinds = Object.entries(mentorEmailKinds).filter(
    ([key]) =>
      state.role === "mentor" ||
      !["request", "mentor-approved", "guidelines-required"].includes(key),
  );
  const isPayment = ([key]) => /^(payment|payout|refund)/.test(key);
  const emailBox = ([key, label]) => (
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
  );
  const showPayments =
    state.role === "mentor" || (state.paymentRecords || []).length > 0;
  // The page's sections, in order, for the menu beside them.
  const sections = [
    state.role === "mentor" && ["settings-mentoring", "Mentoring"],
    showPayments && [
      "settings-payouts",
      state.role === "mentor" ? "Payouts" : "Payments",
    ],
    ["settings-notifications", "Notifications"],
    ["settings-profiles", "Profiles"],
    ["settings-appearance", "Appearance"],
    ["settings-blocked", "Blocked people"],
    ["settings-account", "Account"],
  ].filter(Boolean);
  return (
    <div className="page settings-page page-enter">
      <PageHeader title="Settings" />
      <div className="settings-layout">
        <SettingsNav sections={sections} />
        <div className="settings-content">
          {state.role === "mentor" && <MentoringSettings />}
          <PaymentSettings />
          <section
            id="settings-notifications"
            tabIndex={-1}
            className="card panel settings-section"
            aria-labelledby="notification-settings"
          >
            <h2 id="notification-settings">Notifications</h2>
            <p className="settings-intro">
              Anything that needs your reply always shows.
            </p>
            <form
              data-form="notification-preferences"
              className="grid notification-preferences"
              key={JSON.stringify(prefs)}
              onSubmit={(event) => onSubmit(event)}
            >
              <fieldset className="checkbox-group">
                <legend>In Updates</legend>
                {[
                  ["match", "New match suggestions"],
                  ["activity", "Collaboration activity from partners"],
                  [
                    "reminders",
                    "Reminders about due dates, sessions and quiet deals",
                  ],
                ].map(([key, label]) => (
                  <label className="checkbox-label" key={key}>
                    <input
                      type="checkbox"
                      name={key}
                      defaultChecked={prefs[key]}
                    />{" "}
                    {label}
                  </label>
                ))}
              </fieldset>
              <div className="settings-fields">
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
              </div>
              <fieldset className="checkbox-group settings-emails">
                <legend>Emails</legend>
                <input
                  type="hidden"
                  name="mentorshipEmailPreferences"
                  value="yes"
                />
                <div className="settings-email-columns">
                  <div>
                    <p className="settings-email-group">Mentorship</p>
                    {emailKinds
                      .filter((kind) => !isPayment(kind))
                      .map(emailBox)}
                  </div>
                  <div>
                    <p className="settings-email-group">Payments</p>
                    {emailKinds.filter(isPayment).map(emailBox)}
                  </div>
                </div>
                {(state.mentorEmailStatus?.bouncedAt ||
                  state.mentorEmailStatus?.unsubscribedAt) && (
                  <p>
                    Email delivery to this address is paused. Your notices are
                    available in Updates.
                  </p>
                )}
              </fieldset>
              <button className="btn settings-save" disabled={state.busy}>
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
                  Each adds a suggestion to Updates when someone new offers it.
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
          {error && (
            <div className="connection-banner" role="alert">
              <p>{error}</p>
              <button className="btn small" onClick={load}>
                Retry account settings
              </button>
            </div>
          )}
          {!settings ? (
            <section className="card panel settings-section" aria-busy="true">
              <span className="visually-hidden" role="status">
                Opening account settings…
              </span>
              <span className="skeleton" style={{ width: "30%", height: 22 }} />
              <span className="skeleton" style={{ width: "60%", height: 16 }} />
              <span className="skeleton" style={{ height: 44 }} />
            </section>
          ) : (
            <section
              id="settings-profiles"
              tabIndex={-1}
              className="card panel settings-section"
            >
              <h2>Profiles</h2>
              <p className="settings-intro">
                Your founder and mentor profiles each keep their own details.
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
          )}
          <section
            id="settings-appearance"
            tabIndex={-1}
            className="card panel settings-section appearance-settings"
          >
            <h2>Appearance</h2>
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
            <p className="field-help">Saved in this browser.</p>
          </section>
          {settings && (
            <>
              <section
                id="settings-blocked"
                tabIndex={-1}
                className="card panel settings-section"
              >
                <h2>Blocked people</h2>
                <p className="settings-intro">
                  You can't find or message each other. Shared history stays.
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
                    No one is blocked. You can block someone from their profile.
                  </p>
                )}
              </section>
              <section
                id="settings-account"
                tabIndex={-1}
                className="card panel settings-section"
                aria-labelledby="account-access-title"
              >
                <h2 id="account-access-title">Account</h2>
                <div className="account-action-row">
                  <div>
                    <h3>Signed in</h3>
                    <p className="settings-sessions">
                      {thisSession
                        ? `This tab, until ${formatDateTime(thisSession.expiresAt)}`
                        : "This tab"}
                      {others.length > 0 &&
                        ` · ${others.length} other ${others.length === 1 ? "session" : "sessions"}`}
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
              </section>
              <details
                id="danger-zone"
                className="card panel settings-section danger-zone"
                aria-labelledby="danger-zone-heading"
              >
                <summary id="danger-zone-heading">
                  <span>Pause or delete account</span>
                  <Icon name="chevron" />
                </summary>
                <div className="account-action-row">
                  <div>
                    <h3>Profile visibility</h3>
                    <p role="status">
                      {settings.visible
                        ? "Your completed profiles are visible in Matches."
                        : "Discovery is paused. Both profiles are hidden from Matches."}
                    </p>
                    <p className="muted">
                      Pausing hides both profiles and withdraws pending
                      requests. Rooms stay open.
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
                    <h3>Delete account</h3>
                    <p className="muted">
                      Removes your private details. Shared history stays,
                      anonymized.
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
        </div>
      </div>
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
                requests will be withdrawn. Your existing rooms stay available.
                Resuming discovery later will not restore withdrawn requests.
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
                        Session opened {formatDateTime(session.createdAt)}
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
