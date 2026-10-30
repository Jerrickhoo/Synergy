import { useApp } from "../state/AppContext.jsx";
import { profileCompleteness } from "../data/selectors.js";
export default function ProfileStats() {
  const { state } = useApp();
  const completeness = profileCompleteness(
    state.profiles[state.role],
    state.role,
  );
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
        <strong>{average}</strong>
        <span>
          {average === "—"
            ? "No partner ratings yet"
            : "Rating from distinct partners"}
        </span>
      </div>
      <div className="profile-stat">
        <strong>{state.trustSummary?.completed ?? history.length}</strong>
        <span>Collaborations</span>
      </div>
      <div className="profile-stat">
        <div
          className="profile-completion-ring"
          role="progressbar"
          aria-label="Profile complete"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completeness}
          style={{ "--completion": completeness }}
        >
          <strong aria-hidden="true">{completeness}%</strong>
        </div>
        <span aria-hidden="true">Profile complete</span>
      </div>
    </div>
  );
}
