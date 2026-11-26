// Google Calendar and Google Tasks, straight from the browser. The person
// signs in to Google in a pop-up (Google Identity Services) and grants
// access; the access token stays in this tab's memory and is never sent to
// Synergy's server. Each sync is idempotent: Synergy's own tasks and events
// carry the Synergy id, so a second sync updates them instead of adding
// copies, ticks off tasks that are done and removes upcoming events that no
// longer exist.
const scriptUrl = "https://accounts.google.com/gsi/client";
const api = "https://www.googleapis.com";
export const googleScopes = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks",
];
const taskListTitle = "Synergy";
const dayMs = 86400000;

let loading = null;
let token = null;

function loadScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  loading ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(
        new Error(
          "Couldn't reach Google. Check your connection and try again.",
        ),
      );
    };
    document.head.append(script);
  });
  return loading;
}

// Loads Google sign-in as soon as the person shows intent (hover or focus
// on the button), so the consent pop-up opens straight from their click and
// pop-up blockers let it through.
export const preloadGoogle = () => loadScript().catch(() => {});

export const googleConnected = () =>
  Boolean(token && token.expiresAt > Date.now());

// Opens Google's consent pop-up, or reuses a grant this browser already
// gave without showing it again.
export async function connectGoogle(clientId) {
  if (!clientId)
    throw new Error(
      "Google Calendar and Tasks aren't set up on this server yet.",
    );
  await loadScript();
  const oauth = window.google.accounts.oauth2;
  return new Promise((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: clientId,
      scope: googleScopes.join(" "),
      callback: (response) => {
        if (response.error)
          return reject(
            new Error(
              response.error === "access_denied"
                ? "Google access wasn't granted, so nothing was synced."
                : response.error_description ||
                    "Google didn't grant access. Try again.",
            ),
          );
        if (!oauth.hasGrantedAllScopes(response, ...googleScopes))
          return reject(
            new Error(
              "Allow both Google Calendar and Google Tasks to sync your work.",
            ),
          );
        token = {
          value: response.access_token,
          expiresAt:
            Date.now() + (Number(response.expires_in) || 3600) * 1000 - 60000,
        };
        resolve();
      },
      error_callback: (error) =>
        reject(
          new Error(
            error?.type === "popup_closed"
              ? "The Google window closed before access was granted."
              : "Couldn't open Google sign-in. Allow pop-ups for this site and try again.",
          ),
        ),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

export function disconnectGoogle() {
  if (token) window.google?.accounts?.oauth2?.revoke?.(token.value);
  token = null;
}

async function call(path, { method = "GET", body, query } = {}) {
  if (!googleConnected())
    throw new Error("Your Google sign-in expired. Sync again to reconnect.");
  const url = new URL(path, api);
  for (const [key, value] of Object.entries(query || {}))
    if (value !== undefined && value !== "")
      url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token.value}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401) {
    token = null;
    throw new Error("Your Google sign-in expired. Sync again to reconnect.");
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(
      detail?.error?.message
        ? `Google said: ${detail.error.message}`
        : `Google couldn't complete the sync (${response.status}).`,
    );
  }
  return response.status === 204 ? null : response.json();
}

async function pages(path, query) {
  const items = [];
  let pageToken;
  do {
    const page = await call(path, { query: { ...query, pageToken } });
    items.push(...(page?.items || []));
    pageToken = page?.nextPageToken;
  } while (pageToken);
  return items;
}

const nextDay = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) + dayMs);
  return date.toISOString().slice(0, 10);
};
const idLine = (id) => `synergy-id: ${id}`;
const idFrom = (notes = "") => notes.match(/synergy-id: (\S+)/)?.[1] || "";

async function synergyTaskList() {
  const lists = await pages("/tasks/v1/users/@me/lists", { maxResults: 100 });
  const found = lists.find((list) => list.title === taskListTitle);
  if (found) return found.id;
  const created = await call("/tasks/v1/users/@me/lists", {
    method: "POST",
    body: { title: taskListTitle },
  });
  return created.id;
}

// tasks: [{ id, title, due: "YYYY-MM-DD" | "", link }]
export async function syncGoogleTasks(tasks) {
  const list = await synergyTaskList();
  const path = `/tasks/v1/lists/${encodeURIComponent(list)}/tasks`;
  const existing = new Map();
  for (const item of await pages(path, {
    maxResults: 100,
    showCompleted: true,
    showHidden: true,
  })) {
    const id = idFrom(item.notes);
    if (id) existing.set(id, item);
  }
  const counts = { created: 0, updated: 0, completed: 0 };
  const open = new Set();
  for (const task of tasks) {
    open.add(task.id);
    const body = {
      title: task.title,
      notes: `${task.link ? `Open in Synergy: ${task.link}\n` : ""}${idLine(task.id)}`,
      status: "needsAction",
      due: task.due ? `${task.due}T00:00:00.000Z` : null,
    };
    const current = existing.get(task.id);
    if (!current) {
      if (!body.due) delete body.due;
      await call(path, { method: "POST", body });
      counts.created += 1;
    } else if (
      current.title !== body.title ||
      (current.due || "").slice(0, 10) !== (task.due || "") ||
      current.status !== "needsAction"
    ) {
      await call(`${path}/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        body,
      });
      counts.updated += 1;
    }
  }
  // A task that is no longer open in Synergy is ticked off in Google.
  for (const [id, item] of existing)
    if (!open.has(id) && item.status !== "completed") {
      await call(`${path}/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: { status: "completed" },
      });
      counts.completed += 1;
    }
  return counts;
}

// events: [{ id, title, date: "YYYY-MM-DD", start?: Date, minutes?, link }]
// Timed events (sessions and meetings) keep their time; due dates are
// all-day events that don't show you as busy.
export function googleEvent(event) {
  const description = `${event.link ? `Open in Synergy: ${event.link}\n` : ""}Added by Synergy.`;
  const extendedProperties = {
    private: { synergy: "1", synergyId: event.id },
  };
  if (event.start)
    return {
      summary: event.title,
      description,
      start: { dateTime: event.start.toISOString() },
      end: {
        dateTime: new Date(
          event.start.getTime() + (event.minutes || 60) * 60000,
        ).toISOString(),
      },
      extendedProperties,
    };
  return {
    summary: event.title,
    description,
    start: { date: event.date },
    end: { date: nextDay(event.date) },
    transparency: "transparent",
    extendedProperties,
  };
}

const sameEvent = (current, next) =>
  current.summary === next.summary &&
  (current.start?.dateTime
    ? Date.parse(current.start.dateTime) === Date.parse(next.start.dateTime)
    : current.start?.date === next.start.date) &&
  (current.end?.dateTime
    ? Date.parse(current.end.dateTime) === Date.parse(next.end.dateTime)
    : current.end?.date === next.end.date);

export async function syncGoogleCalendar(events, now = new Date()) {
  const path = "/calendar/v3/calendars/primary/events";
  const existing = new Map();
  for (const item of await pages(path, {
    privateExtendedProperty: "synergy=1",
    maxResults: 250,
    singleEvents: true,
  })) {
    const id = item.extendedProperties?.private?.synergyId;
    if (id && item.status !== "cancelled") existing.set(id, item);
  }
  const counts = { created: 0, updated: 0, removed: 0 };
  const wanted = new Set();
  for (const event of events) {
    wanted.add(event.id);
    const body = googleEvent(event);
    const current = existing.get(event.id);
    if (!current) {
      await call(path, { method: "POST", body });
      counts.created += 1;
    } else if (!sameEvent(current, body)) {
      await call(`${path}/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        body,
      });
      counts.updated += 1;
    }
  }
  // Upcoming events Synergy no longer has (finished, cancelled, moved to a
  // closed room) are removed; past ones stay as a record.
  const today = now.toISOString().slice(0, 10);
  for (const [id, item] of existing) {
    if (wanted.has(id)) continue;
    const when = item.start?.dateTime || item.start?.date || "";
    if (when.slice(0, 10) < today) continue;
    await call(`${path}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    counts.removed += 1;
  }
  return counts;
}
