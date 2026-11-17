import { useApp } from "../state/AppContext.jsx";
import FormErrors from "./FormErrors.jsx";
import Icon from "./Icon.jsx";

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

// Roster-based verification (§4, §8). Email delivery is not part of this
// prototype, so a moderator checks program or organization evidence instead.
export default function Verification() {
  const { state, onSubmit } = useApp();
  const status = state.affiliation?.status || "none";
  const [title, detail] = statusCopy[status] || statusCopy.none;
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
        {state.affiliation?.organization
          ? ` · ${state.affiliation.organization}`
          : ""}
      </p>
      <p className="muted">{detail}</p>
      <p className="muted">
        No business domain? Use an accelerator, university, founder community or
        a referral note that a moderator can check. Email delivery is not
        available; this checks affiliation only.
      </p>
      {status === "pending" && state.affiliation?.dueAt && (
        <p>
          Decision due by{" "}
          {new Date(state.affiliation.dueAt).toLocaleDateString()}.
        </p>
      )}
      {state.affiliation?.note && status !== "pending" && (
        <p className="muted">Moderator note: {state.affiliation.note}</p>
      )}
      {!state.integrations?.moderation && (
        <p className="muted">
          A workspace owner must configure moderator access before requests can
          be reviewed.
        </p>
      )}
      {status !== "verified" && status !== "pending" && (
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
