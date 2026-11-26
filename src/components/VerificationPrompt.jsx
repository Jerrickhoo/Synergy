import { useApp } from "../state/AppContext.jsx";
import Overlay from "./Overlay.jsx";
import Icon from "./Icon.jsx";

// What the person just tried to do, mid-sentence.
const attempts = {
  "match-detail": "view match profiles",
  save: "save matches",
  interest: "send requests",
  "accept-interest": "accept requests",
  "send-request": "send mentorship requests",
  "book-office-hours": "book Office Hours",
  connect: "connect with people",
};

// Shown when an unverified account tries something that needs
// verification: it says why and leads to Verification.
export default function VerificationPrompt() {
  const { state, verificationPrompt, onAction } = useApp();
  if (!state.authenticated || !verificationPrompt) return null;
  const pending = state.verification === "pending";
  const attempt = attempts[verificationPrompt] || attempts.connect;
  const close = () => onAction({ action: "close-verification-prompt" });
  return (
    <Overlay
      id="verification-prompt"
      title={
        pending ? "Your verification is being checked" : "Verify your account"
      }
      titleIcon={
        <span className="verification-prompt-icon" aria-hidden="true">
          <Icon name="shield" />
        </span>
      }
      onClose={close}
      initialFocusSelector="#verification-prompt-go"
      footer={
        <>
          <button className="btn" onClick={close}>
            Not now
          </button>
          <button
            id="verification-prompt-go"
            className="btn primary"
            onClick={() => {
              close();
              onAction({ action: "open-verification" });
            }}
          >
            {pending ? "View verification" : "Go to Verification"}
            <Icon name="arrow" />
          </button>
        </>
      }
    >
      <p className="verification-prompt-lead">
        Verify your account now to use Synergy to its full potential.
      </p>
      <p>
        {pending
          ? `A moderator is checking your evidence. Once you're verified, you can ${attempt}.`
          : `You need a verified account to ${attempt}. A moderator checks an accelerator, university, community or referral note.`}
      </p>
      {state.affiliation?.status === "rejected" && state.affiliation.note && (
        <p className="verification-prompt-note">
          Moderator note: {state.affiliation.note}
        </p>
      )}
    </Overlay>
  );
}
