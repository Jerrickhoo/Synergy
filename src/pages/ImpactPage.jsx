import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import MentorImpact from "../components/MentorImpact.jsx";
import { formatHours } from "../data/mentor-rules.js";
import { isMentorRoom } from "../data/mentor-room.js";

// A one-time research question. It waits on Impact until answered, then
// goes away; it is not a setting.
function MentoringSurvey() {
  const { state, onSubmit } = useApp();
  if (state.mentorshipSurvey) return null;
  return (
    <section className="card panel section-gap">
      <h2>One question about payments</h2>
      <form
        data-form="mentorship-survey"
        className="mentor-request-form survey-form"
        onSubmit={onSubmit}
      >
        <fieldset>
          <legend>
            Would you charge for any format if Synergy handled payments?
          </legend>
          <label>
            <input type="radio" name="wouldCharge" value="yes" required /> Yes
          </label>
          <label>
            <input type="radio" name="wouldCharge" value="no" required /> No
          </label>
        </fieldset>
        <button className="btn" disabled={state.busy}>
          Save answer
        </button>
      </form>
    </section>
  );
}

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
  // The certificate waits for something to certify: a held session or
  // logged mentoring time.
  const certifiable =
    (trust?.sessions?.value || 0) > 0 ||
    (trust?.volunteerMinutes ?? trust?.minutes ?? 0) > 0;
  // The work that starts the count: waiting requests, then mentees, then
  // finding a startup to help.
  const requests = state.mentorRequests?.length || 0;
  const mentees = Object.values(state.rooms).some(
    (room) =>
      room.role === "mentor" &&
      isMentorRoom(room) &&
      !["cancelled", "reviewed", "launched"].includes(room.status),
  );
  const nextStep = requests
    ? [
        "requests",
        requests === 1
          ? "Answer your waiting request"
          : `Answer your ${requests} waiting requests`,
      ]
    : mentees
      ? ["mentees", "Go to your mentees"]
      : ["discover", "Browse startups"];
  return (
    <div className="page page-enter">
      <PageHeader
        title="Impact"
        intro={certifiable ? "What your mentoring has added up to so far." : ""}
        actions={
          certifiable && (
            <button
              className="btn"
              onClick={() => onAction({ page: "impact-certificate" })}
            >
              View volunteer certificate
            </button>
          )
        }
      />
      <MentorImpact trust={trust} privateView />
      {/* Before the first session, point at the work that starts the count. */}
      {!certifiable && (
        <button
          className="btn primary section-gap"
          onClick={() => onAction({ page: nextStep[0] })}
        >
          {nextStep[1]}
        </button>
      )}
      <MentoringSurvey />
    </div>
  );
}
