import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import MentorImpact from "../components/MentorImpact.jsx";
import { formatHours } from "../data/mentor-rules.js";

export default function ImpactPage() {
  const { state, onAction } = useApp();
  if (state.role !== "mentor")
    return (
      <div className="page">
        <PageHeader
          title="Impact"
          intro="Switch to your mentor profile to view your impact."
        />
      </div>
    );
  const trust = state.trustSummary?.mentorship;
  const certificate = state.page === "impact-certificate";
  if (certificate) {
    const approvedAt = state.profiles.mentor.mentorApprovedAt;
    const volunteerMinutes = trust?.volunteerMinutes ?? trust?.minutes ?? 0;
    const date = (time) =>
      new Date(time).toLocaleDateString(undefined, { dateStyle: "long" });
    return (
      <div className="page page-enter mentor-certificate">
        <PageHeader
          title="Volunteer mentorship certificate"
          actions={
            <button className="btn print-action" onClick={() => window.print()}>
              Print certificate
            </button>
          }
        />
        <section className="card panel">
          <h2>{state.accountName}</h2>
          <p>Synergy volunteer mentoring</p>
          <p>
            {approvedAt
              ? `${date(approvedAt)} to ${date(Date.now())}`
              : `Through ${date(Date.now())}`}
          </p>
          <dl className="impact-stats">
            <div>
              <dt>Sessions held</dt>
              <dd>{trust?.sessions.value || 0}</dd>
            </div>
            <div>
              <dt>Founders helped</dt>
              <dd>{trust?.founders.value || 0}</dd>
            </div>
            <div>
              <dt>Volunteer hours</dt>
              <dd>{formatHours(volunteerMinutes)}</dd>
            </div>
            <div>
              <dt>Paid hours</dt>
              <dd>{formatHours(trust?.paidMinutes || 0)}</dd>
            </div>
          </dl>
        </section>
      </div>
    );
  }
  return (
    <div className="page page-enter">
      <PageHeader
        title="Impact"
        actions={
          <button
            className="btn"
            onClick={() => onAction({ page: "impact-certificate" })}
          >
            View volunteer certificate
          </button>
        }
      />
      <MentorImpact trust={trust} privateView />
    </div>
  );
}
