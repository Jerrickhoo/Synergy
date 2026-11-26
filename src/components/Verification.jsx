import { useApp } from "../state/AppContext.jsx";
import FormErrors from "./FormErrors.jsx";
import Icon from "./Icon.jsx";
import PrototypeShortcut from "./PrototypeShortcut.jsx";
import { formatDate } from "../data/dates.js";

const statusCopy = {
  verified: [
    "Verified",
    "Your badge shows on your profile, match cards and Deal Rooms.",
  ],
  pending: [
    "Pending review",
    "A moderator is checking your evidence. You can keep browsing matches in the meantime.",
  ],
  rejected: [
    "Not approved",
    "Your last request was not approved. Send new evidence below.",
  ],
  none: [
    "Not verified yet",
    "Tell us who can confirm you’re a founder, and a moderator will check it within three working days.",
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
    "Tell us who can confirm your experience, and a moderator will check it within three working days.",
  ],
};

// Roster-based verification (§4, §8). A moderator checks program or
// organization evidence; it is independent of sign-in email verification.
export default function Verification() {
  const { state, onSubmit, onAction } = useApp();
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
    // Until verified, the card takes the warm accent so it stands out from
    // the profile cards around it.
    <section
      className={`card panel profile-section verification-section section-gap ${status === "verified" ? "is-verified" : "is-unverified"}`}
      aria-labelledby="verification-heading"
      id="verification"
    >
      <div className="verification-head">
        <h2 id="verification-heading">
          <Icon name="shield" />
          Verification
        </h2>
        <p className={`verification-status ${status}`}>
          {status === "verified" && <Icon name="check" />}
          <strong>{title}</strong>
          {organization ? ` · ${organization}` : ""}
        </p>
      </div>
      <p className="verification-detail">{detail}</p>
      {status === "pending" && state.affiliation?.dueAt && (
        <p>Decision due by {formatDate(state.affiliation.dueAt)}.</p>
      )}
      {/* TEMPORARY demo shortcut, shown only when the server allows it. */}
      {status === "pending" &&
        !mentor &&
        state.integrations?.simulateVerification && (
          <PrototypeShortcut note="skip the moderator and approve this request now.">
            <button
              type="button"
              className="btn small"
              disabled={state.busy}
              onClick={(event) =>
                onAction({ action: "simulate-verification" }, event)
              }
            >
              {state.busy ? "Approving…" : "Simulate approval"}
            </button>
          </PrototypeShortcut>
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
          className="verification-form"
          onSubmit={onSubmit}
        >
          <FormErrors scope="affiliation-request" />
          <div className="field">
            <label htmlFor="affiliation-org">Who can vouch for you?</label>
            <p className="field-hint" id="affiliation-org-hint">
              {mentor
                ? "Your employer, an organization that endorses you or the person who referred you."
                : "An accelerator, university program, founder community or the person who referred you."}
            </p>
            <input
              id="affiliation-org"
              name="organization"
              required
              maxLength={150}
              aria-describedby="affiliation-org-hint"
              placeholder="Program, organization or person"
            />
          </div>
          <div className="field">
            <label htmlFor="affiliation-evidence">
              How can a moderator check it?
            </label>
            <p className="field-hint" id="affiliation-evidence-hint">
              A link to a roster or cohort page that lists you, or your
              referrer’s contact details.
            </p>
            <textarea
              id="affiliation-evidence"
              name="evidence"
              required
              maxLength={3000}
              aria-describedby="affiliation-evidence-hint"
            />
          </div>
          <div className="verification-actions">
            <button className="btn primary" disabled={state.busy}>
              Request verification
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
