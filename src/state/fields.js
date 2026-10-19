export const fieldKey = (state, id) =>
  `${state.role}:${state.page}:${state.onboardingStep}:${id}`;
export function readField(state, id, fallback) {
  const profile = state.profiles[state.role];
  const defaults = {
    story: profile.bio,
    "verify-email": state.onboarding.signup?.email || "maria@budgetbuddy.app",
    "confirm-offer": profile.offer,
    "confirm-need": profile.need,
    "confirm-industry": profile.industry || "Product",
    "confirm-stage": profile.stage || "Pre-seed",
    "confirm-team": profile.teamSize || "4",
    "confirm-expertise": profile.expertise || "Product strategy",
    "confirm-availability": profile.availability || "Monthly sessions",
    "confirm-startups": profile.startups || "Idea and pre-seed teams",
    "confirm-goals": profile.goals || "Find the right partners",
  };
  return state.fields[fieldKey(state, id)] ?? fallback ?? defaults[id] ?? "";
}
