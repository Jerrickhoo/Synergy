import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import NotificationRow, {
  useUpdateClock,
} from "../components/NotificationRow.jsx";
import { groupNotifications, needsAction } from "../data/notifications.js";
import Icon from "../components/Icon.jsx";
import Avatar from "../components/Avatar.jsx";
import { matchReason } from "../data/profile-presentation.js";

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

function digestPeriod(daily, now) {
  if (daily) return "Last 24 hours";
  const format = (time) =>
    new Date(time).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  return `${format(now - 6 * 86400000)} – ${format(now)}`;
}

function Digest({ items, prefs, now }) {
  const { onAction, model } = useApp();
  if (!prefs || prefs.digest === "off") return null;
  const daily = prefs.digest === "daily";
  const span = daily ? 86400000 : 7 * 86400000;
  const recent = items.filter(
    (item) => item.digested && now - Date.parse(item.timestamp) <= span,
  );
  const people = model.rolePeople();
  const seen = new Set();
  const matches = recent
    .filter((item) => item.kind === "match")
    .map((item) => people.find((person) => person.id === item.matchId))
    .filter((person) => person && !seen.has(person.id) && seen.add(person.id))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const activity = recent.filter((item) => item.kind !== "match");
  const summary = [
    matches.length && plural(matches.length, "new match suggestion"),
    activity.length && plural(activity.length, "collaboration update"),
  ].filter(Boolean);
  return (
    <section className="digest-card" aria-labelledby="digest-title">
      <div className="digest-head">
        <div>
          <h2 id="digest-title">Your {daily ? "daily" : "weekly"} digest</h2>
          <p className="digest-summary">
            {summary.length
              ? summary.join(" and ")
              : `Nothing new ${daily ? "today" : "this week"}`}
            <span className="digest-period"> · {digestPeriod(daily, now)}</span>
          </p>
        </div>
        {matches.length > 0 && (
          <button
            className="link-btn digest-all"
            onClick={() => onAction({ page: "discover" })}
          >
            See all matches <Icon name="arrow" />
          </button>
        )}
      </div>
      {matches.length > 0 && (
        <ol className="digest-matches">
          {matches.slice(0, 3).map((person) => (
            <li className="digest-match" key={person.id}>
              <Avatar
                image={person.image}
                name={person.name}
                identity={person.accountId || person.id}
                color={person.color}
              />
              <div className="digest-match-copy">
                <a
                  href={`#/matches/${encodeURIComponent(person.id)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onAction({ action: "match-detail", id: person.id });
                  }}
                >
                  {person.name}
                </a>
                <span>
                  {[person.kind, person.sector].filter(Boolean).join(" · ")}
                </span>
                <span className="digest-match-reason">
                  {matchReason(person)}
                </span>
              </div>
              <span
                className="fit-ring digest-ring"
                style={{ "--fit": `${person.score}%` }}
              >
                <strong>
                  {person.score}
                  <small>%</small>
                  <span className="visually-hidden"> fit</span>
                </strong>
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="digest-note">
        Bundled here instead of separate alerts. Anything that needs your reply
        still arrives straight away.
      </p>
    </section>
  );
}

export default function NotificationsPage() {
  const { state, onAction } = useApp();
  const [filter, setFilter] = useState("all");
  // Only animate the list after the founder switches filters, not on load.
  const [switched, setSwitched] = useState(false);
  const choose = (value) => {
    if (value === filter) return;
    setSwitched(true);
    setFilter(value);
  };
  const now = useUpdateClock();
  const items = (state.notifications || []).filter((item) => !item.muted);
  const unread = items.filter((item) => !item.read).length;
  const actions = items.filter(needsAction);
  const rest = items.filter((item) => !needsAction(item));
  const groups = groupNotifications(
    filter === "unread" ? rest.filter((item) => !item.read) : rest,
    now,
  );
  return (
    <div className="page updates-page page-enter">
      <PageHeader
        title="Updates"
        intro={
          <>
            <span role="status">
              {unread} unread {unread === 1 ? "update" : "updates"}
            </span>
            {actions.length
              ? `. ${actions.length} ${actions.length === 1 ? "needs" : "need"} you first.`
              : unread
                ? "."
                : ". You’re all caught up."}
          </>
        }
        actions={
          <>
            <button
              className="btn"
              disabled={state.busy || !unread}
              onClick={() => onAction({ action: "read-notifications" })}
            >
              Mark all as read
            </button>
            <button
              className="link-btn updates-settings"
              onClick={() => onAction({ page: "settings" })}
            >
              <Icon name="settings" />
              Notification preferences
            </button>
          </>
        }
      />
      {actions.length > 0 && (
        <section className="update-group needs-you" aria-labelledby="needs-you">
          <h2 id="needs-you">
            Needs you <span className="update-count">{actions.length}</span>
          </h2>
          <div className="card update-list">
            {actions.map((item) => (
              <NotificationRow key={item.id} item={item} now={now} />
            ))}
          </div>
        </section>
      )}
      <Digest
        items={state.notifications || []}
        prefs={state.notificationPreferences}
        now={now}
      />
      <div className="updates-toolbar">
        <div className="update-filters" role="group" aria-label="Update filter">
          <button
            className="btn"
            aria-pressed={filter === "all"}
            onClick={() => choose("all")}
          >
            All
          </button>
          <button
            className="btn"
            aria-pressed={filter === "unread"}
            onClick={() => choose("unread")}
          >
            Unread ({unread})
          </button>
        </div>
        {state.incomingByRole[state.role].size > 0 && (
          <button
            className="link-btn updates-intros"
            onClick={() => onAction({ page: "waiting" })}
          >
            Respond to introductions{" "}
            <span className="update-count">
              {state.incomingByRole[state.role].size}
            </span>
          </button>
        )}
      </div>
      <div
        key={filter}
        className={`update-feed ${switched ? "update-feed-enter" : ""}`}
      >
        {groups.length
          ? groups.map(([label, values]) => (
              <section className="update-group" key={label} aria-label={label}>
                <h2>{label}</h2>
                <div className="card update-list">
                  {values.map((item) => (
                    <NotificationRow key={item.id} item={item} now={now} />
                  ))}
                </div>
              </section>
            ))
          : !actions.length && (
              <section className="card update-empty">
                <Icon name="check" />
                <h2>
                  {filter === "unread"
                    ? "You’re all caught up"
                    : "No updates yet"}
                </h2>
                <p>
                  {filter === "unread"
                    ? "Every update has been read. Switch to All to revisit your activity."
                    : "Introductions, collaboration activity and reminders will appear here."}
                </p>
              </section>
            )}
      </div>
    </div>
  );
}
