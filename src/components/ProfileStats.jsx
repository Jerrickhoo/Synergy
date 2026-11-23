import { useApp } from "../state/AppContext.jsx";
import { profileCompleteness } from "../data/selectors.js";
// Optional details are listed separately so 100% never implies they are done.
const optionalDetails = (profile, role) =>
  [
    ["goals", "Collaboration goals"],
    ["engagementPreference", "Engagement preference"],
    role === "founder" && ["audienceSize", "Audience size"],
  ]
    .filter(Boolean)
    .filter(([key]) => !String(profile[key] || "").trim())
    .map(([, label]) => label);

export default function ProfileStats() {
  const { state } = useApp();
  const profile = state.profiles[state.role];
  const completeness = profileCompleteness(profile, state.role);
  const optional = optionalDetails(profile, state.role);
  const history = state.trustHistoryByRole[state.role];
  const average = state.trustSummary
    ? (state.trustSummary.averageRating ?? "—")
    : history.length
      ? (
          history.reduce((sum, item) => sum + item.rating, 0) / history.length
        ).toFixed(1)
      : "—";
  return (
    <div className="profile-stats">
      <div className="profile-stat">
        <strong>{average === "—" ? "—" : `${average}/5`}</strong>
        <span>
          {average === "—"
            ? "No partner ratings yet"
            : `Average from ${state.trustSummary?.distinctReviewers || 1} review${(state.trustSummary?.distinctReviewers || 1) === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="profile-stat">
        <strong>{state.trustSummary?.completed ?? history.length}</strong>
        <span>Completed collaborations</span>
      </div>
      <div className="profile-stat">
        <div
          className="profile-completion-ring"
          role="progressbar"
          aria-label="Required profile details"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completeness}
          style={{ "--completion": completeness }}
        >
          <strong aria-hidden="true">{completeness}%</strong>
        </div>
        <span className="profile-stat-copy">
          <span aria-hidden="true">Required details</span>
          {optional.length > 0 && (
            <span className="profile-optional-left">
              Optional, not added: {optional.join(", ")}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
