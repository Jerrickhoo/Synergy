import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Introductions from "../components/Introductions.jsx";

export default function WaitingPage() {
  const { state, onAction } = useApp();
  const mentor = state.role === "mentor";
  const waiting = state.incomingByRole[state.role].size;
  return (
    <div className="page page-enter">
      <PageHeader
        title={mentor ? "Requests" : "Introductions"}
        intro={
          mentor
            ? waiting
              ? `${waiting} ${waiting === 1 ? "founder is" : "founders are"} waiting for your reply. Accept the requests that fit your expertise, or decline with a reason.`
              : "Founders' requests for your guidance appear here, with how well each fits your expertise."
            : "Respond to invitations and follow the introductions you've sent."
        }
      />
      <Introductions />
      <button
        className="btn section-gap"
        onClick={() => onAction({ page: "discover" })}
      >
        {mentor ? "Browse startups" : "Explore matches"}
      </button>
    </div>
  );
}
