import { useApp } from "../state/AppContext.jsx";
import { profileCompleteness } from "../data/selectors.js";
export default function ProfileStats() {
  const { state } = useApp();
  const history = state.trustHistoryByRole[state.role];
  const average = history.length
    ? (
        history.reduce((sum, item) => sum + item.rating, 0) / history.length
      ).toFixed(1)
    : "—";
  return (
    <div className="profile-stats">
      <div className="profile-stat">
        <strong>{average}</strong>
        <span>Average rating</span>
      </div>
      <div className="profile-stat">
        <strong>{history.length}</strong>
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
