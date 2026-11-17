import { useApp } from "../state/AppContext.jsx";
import { verificationRequired } from "../data/collaboration.js";

export default function VerificationGate() {
  const { state, onAction } = useApp();
  if (!verificationRequired(state)) return null;
  return (
    <div className="verification-gate">
      <p>
        {state.verification === "pending"
          ? "A moderator is checking your evidence. You can keep browsing"
          : "Verify to send introductions"}
      </p>
      {state.affiliation?.status === "rejected" && (
        <p>Moderator note: {state.affiliation.note}</p>
      )}
      <a
        href="#/profile"
        onClick={(event) => {
          event.preventDefault();
          onAction({ action: "open-verification" });
        }}
      >
        Go to Verification
      </a>
    </div>
  );
}
