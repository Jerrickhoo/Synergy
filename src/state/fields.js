export const fieldKey = (state, id) =>
  `${state.role}:${state.page}:${state.onboardingStep}:${id}`;
export function readField(state, id, fallback) {
  const profile = state.profiles[state.role];
  const defaults = {
    story: profile.bio,
    "verify-email": state.onboarding.signup?.email || "",
    "confirm-offer": profile.offer,
    "confirm-need": profile.need,
    "confirm-industry": profile.industry || "",
    "confirm-stage": profile.stage || "",
    "confirm-team": profile.teamSize || "",
    "confirm-expertise": profile.expertise || "",
    "confirm-availability": profile.availability || "",
    "confirm-startups": profile.startups || "",
    "confirm-goals": profile.goals || "",
  };
  return state.fields[fieldKey(state, id)] ?? fallback ?? defaults[id] ?? "";
}
