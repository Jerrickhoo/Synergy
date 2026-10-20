const paths = {
  home: "",
  discover: "matches",
  waiting: "waiting",
  rooms: "rooms",
  profile: "profile",
  signup: "signup",
  onboarding: "onboarding",
  notifications: "updates",
  moderation: "moderation",
};

export function parseRoute(hash) {
  try {
    const path = (hash || "#/").replace(/^#\/?/, "").replace(/\/$/, "");
    if (path === "login") return { page: "login" };
    const simple = Object.entries(paths).find(([, value]) => value === path);
    if (simple) return { page: simple[0] };
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
    return `#/matches/${encodeURIComponent(state.activeMatch || "unavailable")}`;
  if (["room-detail", "review"].includes(state.page))
    return `#/rooms/${encodeURIComponent(state.activeRoomId || "unavailable")}${state.page === "review" ? "/review" : ""}`;
  if (state.page === "not-found") return state.routePath || "#/unavailable";
  return `#/${paths[state.page] ?? ""}`;
}

export function applyRoute(state, route) {
  state.routeTick += 1;
  state.moreOpen = false;
  state.demoOpen = false;
  state.notificationOpen = false;
  state.profileEditing = false;
  state.formErrors = null;
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
    route.page === "onboarding" && !state.onboarding.signup
      ? "signup"
      : route.page;
  if (route.page === "match-detail") state.activeMatch = route.id;
  if (["room-detail", "review"].includes(route.page)) {
    state.activeRoomId = route.id;
    state.roomTab = "terms";
  }
  state.routePath = route.path;
}
