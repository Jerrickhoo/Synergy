import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import RequestsPage, { SentMentorRequests } from "./RequestsPage.jsx";
import Introductions from "../components/Introductions.jsx";

// Requests: what others sent you (incoming) and what you sent (outgoing),
// including mentorship requests. Mentors get their own Requests page.
export default function WaitingPage() {
  const { state, onAction } = useApp();
  if (state.role === "mentor") return <RequestsPage />;
  const mentorRequests = state.mentorRequests || [];
  return (
    <div className="page page-enter requests-page">
      <PageHeader
        title="Requests"
        intro="Reply to the requests people send you, and follow the ones you sent."
      />
      <div className="page-stack">
        <Introductions
          outgoingExtra={mentorRequests.length ? <SentMentorRequests /> : null}
          outgoingExtraCount={mentorRequests.length}
        />
        <p className="introductions-record-link">
          See every date and what each status means in{" "}
          <button
            className="link-btn"
            onClick={() => onAction({ page: "activity" })}
          >
            Activity
          </button>
          .
        </p>
        <button
          className="btn page-stack-action"
          onClick={() => onAction({ page: "discover" })}
        >
          Explore matches
        </button>
      </div>
    </div>
  );
}
