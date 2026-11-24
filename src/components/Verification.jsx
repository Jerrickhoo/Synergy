import { useApp } from "../state/AppContext.jsx";
import FormErrors from "./FormErrors.jsx";
import Icon from "./Icon.jsx";
import { formatDate } from "../data/dates.js";

const statusCopy = {
  verified: [
    "Verified",
    "Your badge shows on your profile, match cards and Deal Rooms.",
  ],
  pending: [
    "Pending review",
    "A moderator is checking your evidence. You can keep browsing",
  ],
  rejected: [
    "Not approved",
    "Your last request was not approved. You can send new evidence.",
  ],
  none: [
    "Not verified yet",
    "Verified founders are easier to trust. A moderator checks your program or organization.",
  ],
};
// Mentors are verified when a moderator approves their application.
const mentorCopy = {
  ...statusCopy,
  verified: [
    "Verified mentor",
    "Founders see a Verified badge on your profile and match cards.",
  ],
  none: [
    "Not verified yet",
    "Verified mentors are easier for founders to trust. A moderator checks your LinkedIn profile, work email or endorsing organization.",
  ],
};

// Roster-based verification (§4, §8). A moderator checks program or
// organization evidence; it is independent of sign-in email verification.
export default function Verification() {
  const { state, onSubmit } = useApp();
  const mentor = state.role === "mentor";
  const approved = mentor ? state.mentorVerification : null;
  const status = approved ? "verified" : state.affiliation?.status || "none";
  const copy = mentor ? mentorCopy : statusCopy;
  const [title, detail] = copy[status] || copy.none;
  const organization = approved
    ? approved.label
    : state.affiliation?.organization;
  // Without moderators nobody can review a request, so none is offered.
  const reviewable = Boolean(state.integrations?.moderation);
  return (
    <section
      className="card panel profile-section verification-section section-gap"
      aria-labelledby="verification-heading"
      id="verification"
    >
      <h2 id="verification-heading">Verification</h2>
      <p className={`verification-status ${status}`}>
        {status === "verified" && <Icon name="check" />}
        <strong>{title}</strong>
        {organization ? ` · ${organization}` : ""}
      </p>
      <p className="muted">{detail}</p>
      {status !== "verified" && (
        <p className="muted">
          No business domain? Use an accelerator, university, founder community
          or a referral note that a moderator can check. This is separate from
          verifying your email.
        </p>
      )}
      {status === "pending" && state.affiliation?.dueAt && (
        <p>Decision due by {formatDate(state.affiliation.dueAt)}.</p>
      )}
      {state.affiliation?.note && status !== "pending" && (
        <p className="muted">Moderator note: {state.affiliation.note}</p>
      )}
      {!reviewable && status !== "verified" && (
        <p className="info-note">
          Verification requests are not available in this workspace yet because
          no moderator is set up to review them.{" "}
          {state.integrations?.requireVerification
            ? "Ask the workspace owner to add a moderator."
            : "You can still browse, match and request mentorship."}
        </p>
      )}
      {reviewable && status !== "verified" && status !== "pending" && (
        <form
          data-form="affiliation-request"
          className="grid"
          onSubmit={onSubmit}
        >
          <FormErrors scope="affiliation-request" />
          <div className="field">
            <label htmlFor="affiliation-org">
              Organization, program or referrer
            </label>
            <input
              id="affiliation-org"
              name="organization"
              required
              maxLength={150}
            />
          </div>
          <div className="field">
            <label htmlFor="affiliation-evidence">How can we confirm it?</label>
            <textarea
              id="affiliation-evidence"
              name="evidence"
              required
              maxLength={3000}
              placeholder="A public roster, cohort link or referral note, and how a moderator can check it."
            />
          </div>
          <button className="btn" disabled={state.busy}>
            Request verification
          </button>
        </form>
      )}
    </section>
  );
}
