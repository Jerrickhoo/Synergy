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
};

export function parseRoute(hash) {
  try {
    const [raw, query] = (hash || "#/").replace(/^#\/?/, "").split("?");
    const path = raw.replace(/\/$/, "");
    if (path === "login") return { page: "login" };
    const simple = Object.entries(paths).find(([, value]) => value === path);
    if (simple) {
      const requestId = new URLSearchParams(query).get("request");
      return { page: simple[0], ...(requestId && { requestId }) };
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
  if (!state.authenticated && !["signup", "onboarding"].includes(state.page))
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
  if (route.page === "login") {
    state.authenticated = false;
    state.page = "home";
    return;
  }
  if (!state.authenticated && !["signup", "onboarding"].includes(route.page)) {
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
