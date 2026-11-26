import { useApp } from "../state/AppContext.jsx";
import { verificationRequired } from "../data/collaboration.js";
import Icon from "./Icon.jsx";

// A tinted notice with the link inline, so an unverified founder sees why
// saving and requests ask them to verify first. `repeatsButton` is for
// places where a button above already asks them to verify, so only the link
// is added instead of the same words twice.
export default function VerificationGate({ repeatsButton = false }) {
  const { state, onAction } = useApp();
  if (!verificationRequired(state)) return null;
  const pending = state.verification === "pending";
  const link = (
    <a
      href="#/profile"
      onClick={(event) => {
        event.preventDefault();
        onAction({ action: "open-verification" });
      }}
    >
      Go to Verification <Icon name="arrow" />
    </a>
  );
  const note = state.affiliation?.status === "rejected" && (
    <p>Moderator note: {state.affiliation.note}</p>
  );
  if (repeatsButton && !pending)
    return (
      <div className="verification-gate">
        <p>{link}</p>
        {note}
      </div>
    );
  return (
    <div className="verification-gate verification-notice" role="note">
      <Icon name="shield" />
      <div>
        {pending ? (
          <p>
            A moderator is checking your evidence. You can keep browsing matches
            in the meantime.
          </p>
        ) : (
          <p>
            <strong>
              Verify your account now to use Synergy to its full potential.
            </strong>{" "}
            {link}
          </p>
        )}
        {pending && <p>{link}</p>}
        {note}
      </div>
    </div>
  );
}
