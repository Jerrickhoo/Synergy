import { useApp } from "../state/AppContext.jsx";
import Overlay from "./Overlay.jsx";
import Icon from "./Icon.jsx";

function unsavedDraftStatus(accountId) {
  try {
    return Object.keys(sessionStorage).some((key) => {
      if (!key.startsWith(`synergy-draft:${accountId}:`)) return false;
      return JSON.parse(sessionStorage.getItem(key))?.dirty === true;
    });
  } catch {
    // Storage may be unavailable; keep the warning without asserting a draft exists.
    return null;
  }
}

export default function SignOutDialog() {
  const { state, signOutOpen, signOutError, onAction } = useApp();
  if (!state.authenticated || !signOutOpen) return null;
  const hasUnsavedDrafts = unsavedDraftStatus(state.accountId);
  const cancel = () => onAction({ action: "cancel-sign-out" });
  return (
    <Overlay
      id="sign-out-dialog"
      title="Sign out of Synergy?"
      titleIcon={
        <span className="sign-out-icon" aria-hidden="true">
          <Icon name="logout" />
        </span>
      }
      onClose={cancel}
      initialFocusSelector="#cancel-sign-out"
      busy={state.busy}
      footer={
        <>
          <button
            id="cancel-sign-out"
            className="btn"
            disabled={state.busy}
            onClick={cancel}
          >
            Keep working
          </button>
          <button
            className="btn primary"
            disabled={state.busy}
            onClick={() => onAction({ action: "sign-out" })}
          >
            {state.busy ? "Signing out…" : "Sign out"}
          </button>
        </>
      }
    >
      {hasUnsavedDrafts !== false && (
        <div className="sign-out-warning">
          <Icon name="warning" />
          <div>
            <strong>
              {hasUnsavedDrafts
                ? "You have unsaved drafts"
                : "Unsaved drafts will be lost"}
            </strong>
            <p>Signing out will discard the drafts in this tab.</p>
          </div>
        </div>
      )}
      <p className="sign-out-explanation">
        You’ll return to the sign-in screen.
      </p>
      <p className="sign-out-saved">
        Published profiles and shared work will stay saved.
      </p>
      {signOutError && (
        <p className="account-action-error" role="alert">
          {signOutError}
        </p>
      )}
    </Overlay>
  );
}
