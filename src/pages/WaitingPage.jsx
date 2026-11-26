import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import RequestsPage, { RequestsBoard } from "./RequestsPage.jsx";

// Requests: Incoming, Outgoing and History tabs, with search and filters.
// Mentors get their own Requests page.
export default function WaitingPage() {
  const { state, onAction } = useApp();
  if (state.role === "mentor") return <RequestsPage />;
  return (
    <div className="page page-enter requests-page">
      <PageHeader
        title="Requests"
        intro="Reply to the requests people send you, and follow the ones you sent."
      />
      <div className="page-stack">
        <RequestsBoard />
        <button
          className="btn primary requests-explore"
          onClick={() => onAction({ page: "discover" })}
        >
          Explore matches
        </button>
      </div>
    </div>
  );
}
