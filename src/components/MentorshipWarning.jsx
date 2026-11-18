import { useApp } from "../state/AppContext.jsx";
import Overlay from "./Overlay.jsx";

export default function MentorshipWarning() {
  const {
    mentorshipWarning,
    dismissMentorshipWarning,
    confirmMentorshipWarning,
    state,
  } = useApp();
  if (!mentorshipWarning || !state.authenticated) return null;
  return (
    <Overlay
      id="mentorship-safety-warning"
      title="Check your message"
      onClose={dismissMentorshipWarning}
      initialFocusSelector="#revise-mentorship-message"
      footer={
        <>
          <button
            className="btn"
            id="revise-mentorship-message"
            onClick={dismissMentorshipWarning}
          >
            Edit message
          </button>
          <button
            className="btn"
            disabled={state.busy}
            onClick={confirmMentorshipWarning}
          >
            Send anyway
          </button>
        </>
      }
    >
      <p>{mentorshipWarning.message}</p>
    </Overlay>
  );
}
