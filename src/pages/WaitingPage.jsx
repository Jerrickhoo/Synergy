import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Introductions from "../components/Introductions.jsx";

export default function WaitingPage() {
  const { onAction } = useApp();
  return (
    <div className="page page-enter">
      <PageHeader
        title="Introductions"
        intro="Respond to invitations and follow the introductions you've sent."
      />
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
