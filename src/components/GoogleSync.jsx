import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";
import { calendarEvents, localDateKey } from "../data/planning.js";
import {
  connectGoogle,
  googleConnected,
  preloadGoogle,
  syncGoogleCalendar,
  syncGoogleTasks,
} from "../data/google-sync.js";

const storageKey = (accountId) => `synergy-google-sync:${accountId}`;
function readLast(accountId) {
  try {
    return localStorage.getItem(storageKey(accountId)) || "";
  } catch {
    return "";
  }
}
function saveLast(accountId, value) {
  try {
    localStorage.setItem(storageKey(accountId), value);
  } catch {
    // Private browsing: the time shows until the page reloads.
  }
}

const roomLink = (room, tab) =>
  `${window.location.origin}${window.location.pathname}#/rooms/${encodeURIComponent(room.id)}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// Copies "Your tasks" to a Synergy list in Google Tasks, and every dated
// item on the Home calendar (sessions, meetings, milestone and task due
// dates) to Google Calendar. Signing in to Google happens in Google's own
// pop-up; nothing about the Google account is stored by Synergy.
export default function GoogleSync({ tasks, nameOf }) {
  const { state, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(() => readLast(state.accountId));
  const clientId = state.integrations?.googleClientId || "";
  const sync = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!googleConnected()) await connectGoogle(clientId);
      // A room's next step gets a new Google task whenever the step
      // changes, so the finished one is ticked off rather than renamed.
      const taskCounts = await syncGoogleTasks(
        tasks.map((task) => ({
          id:
            task.tab === "tasks"
              ? task.id
              : `${task.id}:${encodeURIComponent(task.title).slice(0, 120)}`,
          title: `${task.title} — ${task.who}`,
          due: task.due || "",
          link: roomLink(task.room, task.tab),
        })),
      );
      const today = localDateKey(new Date());
      const events = calendarEvents(state)
        .filter((event) => event.room && event.date >= today)
        .map((event) => {
          const name = nameOf(event.room);
          const session = event.kind === "session" && event.instant;
          return {
            id: event.id,
            title: session
              ? `${event.title} with ${name}`
              : `${event.kind === "task" ? "Task" : "Due"}: ${event.title} — ${name}`,
            date: event.date,
            start: session ? event.instant : undefined,
            minutes: event.durationMinutes,
            link: roomLink(event.room, event.tab),
          };
        });
      const eventCounts = await syncGoogleCalendar(events);
      const at = new Date().toISOString();
      saveLast(state.accountId, at);
      setLast(at);
      const changed =
        taskCounts.created +
        taskCounts.updated +
        taskCounts.completed +
        eventCounts.created +
        eventCounts.updated +
        eventCounts.removed;
      notify(
        changed
          ? `${plural(tasks.length, "task is", "tasks are")} in Google Tasks and ${plural(events.length, "date is", "dates are")} on Google Calendar.`
          : "Google Tasks and Google Calendar already match Synergy.",
        "success",
        "Synced with Google",
      );
    } catch (error) {
      notify(
        error?.message || "Something went wrong. Try again.",
        "error",
        "Couldn't sync with Google",
      );
    } finally {
      setBusy(false);
    }
  };
  const lastText = last
    ? `Synced ${new Date(last).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "Google Calendar and Tasks";
  return (
    <div className="google-sync">
      <button
        className="btn small google-sync-button"
        disabled={busy || state.busy}
        aria-describedby="google-sync-status"
        title={
          clientId
            ? "Copy your tasks to Google Tasks and your dates to Google Calendar"
            : "Google sync isn't set up on this server yet"
        }
        onPointerEnter={clientId ? preloadGoogle : undefined}
        onFocus={clientId ? preloadGoogle : undefined}
        onClick={sync}
      >
        <Icon name="sync" />
        {busy ? "Syncing…" : "Sync to Google"}
      </button>
      <span id="google-sync-status" className="google-sync-status">
        {lastText}
      </span>
    </div>
  );
}
