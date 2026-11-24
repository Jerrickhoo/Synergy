import { useApp } from "../state/AppContext.jsx";
import { verificationRequired } from "../data/collaboration.js";

// One line with the link inline. `repeatsButton` is for places where a
// disabled button above already says "Verify to send introductions", so only
// the link is added instead of the same words twice.
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
      Go to Verification
    </a>
  );
  return (
    <div className="verification-gate">
      {pending ? (
        <>
          <p>
            A moderator is checking your evidence. You can keep browsing and
            saving matches in the meantime.
          </p>
          <p>{link}</p>
        </>
      ) : (
        <p>
          {!repeatsButton && "Verify to send introductions. "}
          {link}
        </p>
      )}
      {state.affiliation?.status === "rejected" && (
        <p>Moderator note: {state.affiliation.note}</p>
      )}
    </div>
  );
}
