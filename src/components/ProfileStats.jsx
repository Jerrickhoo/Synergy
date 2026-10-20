import { useApp } from "../state/AppContext.jsx";
import { profileCompleteness } from "../data/selectors.js";
export default function ProfileStats() {
  const { state } = useApp();
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
        <span>Rating from distinct partners</span>
      </div>
      <div className="profile-stat">
        <strong>{state.trustSummary?.completed ?? history.length}</strong>
        <span>Collaborations</span>
      </div>
      <div className="profile-stat">
        <strong>
          {profileCompleteness(state.profiles[state.role], state.role)}%
        </strong>
        <span>Profile complete</span>
      </div>
    </div>
  );
}
