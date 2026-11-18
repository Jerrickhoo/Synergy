import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import RequestsPage, { SentMentorRequests } from "./RequestsPage.jsx";
import Introductions from "../components/Introductions.jsx";

export default function WaitingPage() {
  const { state, onAction } = useApp();
  const mentor = state.role === "mentor";
  if (mentor) return <RequestsPage />;
  return (
    <div className="page page-enter">
      <PageHeader
        title="Introductions"
        intro="Respond to invitations and follow the introductions you have sent."
      />
      <SentMentorRequests />
      <Introductions />
      <button
        className="btn section-gap"
        onClick={() => onAction({ page: "discover" })}
      >
        Explore matches
      </button>
    </div>
  );
}
