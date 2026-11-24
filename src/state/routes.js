import { roomNextAction } from "../data/selectors.js";
const paths = {
  home: "",
  discover: "matches",
  waiting: "waiting",
  requests: "requests",
  mentees: "mentees",
  impact: "impact",
  "impact-certificate": "impact/certificate",
  rooms: "rooms",
  calendar: "calendar",
  profile: "profile",
  signup: "signup",
  onboarding: "onboarding",
  settings: "settings",
  notifications: "updates",
  moderation: "moderation",
  "forgot-password": "forgot-password",
  "reset-password": "reset-password",
  "verify-email": "verify-email",
};
// Pages someone can open while signed out. Emailed links land on the last two.
const linkPages = ["reset-password", "verify-email"];
export const signedOutPages = [
  "signup",
  "onboarding",
  "forgot-password",
  ...linkPages,
];

export function parseRoute(hash) {
  try {
    const [raw, query] = (hash || "#/").replace(/^#\/?/, "").split("?");
    const path = raw.replace(/\/$/, "");
    if (path === "login") return { page: "login" };
    const simple = Object.entries(paths).find(([, value]) => value === path);
    if (simple) {
      const params = new URLSearchParams(query);
      const requestId = params.get("request");
      const token = linkPages.includes(simple[0]) && params.get("token");
      return {
        page: simple[0],
        ...(requestId && { requestId }),
        ...(token && { token }),
      };
    }
    const match = path.match(/^(matches|rooms)\/([^/]+)(\/review)?$/);
    if (match && !(match[1] === "matches" && match[3]))
      return {
        page:
          match[1] === "matches"
            ? "match-detail"
            : match[3]
              ? "review"
              : "room-detail",
        id: decodeURIComponent(match[2]),
        ...(query && {
          referralId: new URLSearchParams(query).get("referral"),
          tab: new URLSearchParams(query).get("tab"),
        }),
      };
  } catch {
    /* Malformed encoded identifiers are invalid routes. */
  }
  return { page: "not-found", path: hash };
}

export function routeHash(state) {
  if (!state.authenticated && !signedOutPages.includes(state.page))
    return "#/login";
  if (state.page === "match-detail")
    return `#/matches/${encodeURIComponent(state.activeMatch || "unavailable")}${state.mentorReferralId ? `?referral=${encodeURIComponent(state.mentorReferralId)}` : ""}`;
  if (["room-detail", "review"].includes(state.page))
    return `#/rooms/${encodeURIComponent(state.activeRoomId || "unavailable")}${state.page === "review" ? "/review" : ""}`;
  if (state.page === "not-found") return state.routePath || "#/unavailable";
  const request =
    ["waiting", "requests"].includes(state.page) && state.activeMentorRequest;
  return `#/${paths[state.page] ?? ""}${request ? `?request=${encodeURIComponent(request)}` : ""}`;
}

export function applyRoute(state, route) {
  state.routeTick += 1;
  state.moreOpen = false;
  state.demoOpen = false;
  state.notificationOpen = false;
  state.profileEditing = false;
  state.formErrors = null;
  state.mentorshipActionError = null;
  state.mentorReferralId = route.referralId || null;
  state.activeMentorRequest = route.requestId || null;
  // An emailed link's token stays in state only; the address drops it.
  state.linkToken = linkPages.includes(route.page) ? route.token || null : null;
  if (route.page === "login") {
    state.authenticated = false;
    state.page = "home";
    return;
  }
  if (!state.authenticated && !signedOutPages.includes(route.page)) {
    state.page = "home";
    return;
  }
  state.page =
    route.page === "onboarding" &&
    !state.onboarding.signup &&
    !state.authenticated
      ? "signup"
      : route.page;
  if (route.page === "match-detail") state.activeMatch = route.id;
  if (["room-detail", "review"].includes(route.page)) {
    state.activeRoomId = route.id;
    const room = state.rooms?.[route.id];
    state.roomTab =
      (room?.role === state.role && (route.tab || roomNextAction(room).tab)) ||
      "terms";
  }
  state.routePath = route.path;
}
