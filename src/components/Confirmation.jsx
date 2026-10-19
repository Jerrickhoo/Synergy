import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";
export default function Confirmation() {
  const { state, onAction } = useApp();
  if (!state.confirmation) return null;
  return (
    <div className="confirmation-card" role="status">
      <Icon name="check" />
      <span>{state.confirmation}</span>
      <button
        className="link-btn"
        onClick={(event) =>
          onAction(
            {
              action: "dismiss-confirmation",
            },
            event,
          )
        }
        aria-label="Dismiss confirmation"
      >
        Dismiss
      </button>
    </div>
  );
}
