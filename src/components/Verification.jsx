import { useApp } from "../state/AppContext.jsx";
import FormErrors from "./FormErrors.jsx";
import Icon from "./Icon.jsx";
import { formatDate } from "../data/dates.js";
import { pendingVerificationText } from "../data/home.js";

const statusCopy = {
  verified: [
    "Verified",
    "Your badge shows on your profile, match cards and Deal Rooms.",
  ],
  pending: ["Pending review", ""],
  rejected: [
    "Not approved",
    "Your last request was not approved. Send new evidence below.",
  ],
  expired: [
    "Request expired",
    "No moderator reviewed your last request in time. Send it again below.",
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

const dayMs = 86400000;
// "Verification request will expire in 3 days." An unreviewed request
// expires on its due date (the server closes it then).
function expiryLine(dueAt, now = Date.now()) {
  const left = Date.parse(dueAt) - now;
  if (!(left > 0)) return "Verification request will expire today.";
  const days = Math.ceil(left / dayMs);
  return `Verification request will expire in ${days} ${days === 1 ? "day" : "days"}.`;
}

// Where the request stands: sent, opened by a moderator, approved.
function RequestProgress({ affiliation, verified }) {
  const steps = [
    { label: "Request sent", at: affiliation.requestedAt, done: true },
    {
      label: "Seen by a moderator",
      at: affiliation.seenAt || affiliation.reviewedAt,
      done: Boolean(affiliation.seenAt) || verified,
    },
    { label: "Approved", at: affiliation.reviewedAt, done: verified },
  ];
  const current = steps.findIndex((step) => !step.done);
  return (
    <ol className="verification-steps" aria-label="Request progress">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={
            step.done ? "is-done" : index === current ? "is-current" : ""
          }
          aria-current={index === current ? "step" : undefined}
        >
          <span className="verification-step-dot" aria-hidden="true">
            {step.done ? <Icon name="check" /> : index + 1}
          </span>
          <span className="verification-step-copy">
            <strong>{step.label}</strong>
            <span>
              {step.done
                ? step.at
                  ? formatDate(step.at)
                  : "Done"
                : index === current
                  ? "Waiting"
                  : "Not yet"}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

// Roster-based verification (§4, §8). A moderator checks program or
// organization evidence; it is independent of sign-in email verification.
export default function Verification() {
  const { state, onSubmit, onAction } = useApp();
  const mentor = state.role === "mentor";
  const approved = mentor ? state.mentorVerification : null;
  const affiliation = state.affiliation;
  const status = approved ? "verified" : affiliation?.status || "none";
  const copy = mentor ? mentorCopy : statusCopy;
  const [title, baseDetail] = copy[status] || copy.none;
  // While pending, the line says whether a moderator has opened it yet.
  const detail =
    status === "pending" ? pendingVerificationText(state) : baseDetail;
  const organization = approved ? approved.label : affiliation?.organization;
  // Without moderators nobody can review a request, so none is offered.
  const reviewable = Boolean(state.integrations?.moderation);
  const verified = status === "verified";
  // The tracker follows a request through review; a mentor verified by
  // their application has no request to follow.
  const tracked =
    ["pending", "verified"].includes(status) &&
    !approved &&
    affiliation?.requestedAt;
  return (
    // The brand colour until verified, then a plain card.
    <section
      className={`card panel profile-section verification-section section-gap ${verified ? "is-verified" : "is-unverified"}`}
      aria-labelledby="verification-heading"
      id="verification"
    >
      <div className="verification-head">
        <h2 id="verification-heading">Verification</h2>
        <p className={`verification-status ${status}`}>
          {verified && <Icon name="check" />}
          {title}
        </p>
      </div>
      <p className="verification-detail">{detail}</p>
      {organization && ["pending", "verified"].includes(status) && (
        <p className="verification-org">
          {verified ? "Verified through" : "Vouched for by"}{" "}
          <strong>{organization}</strong>
        </p>
      )}
      {tracked && (
        <RequestProgress affiliation={affiliation} verified={verified} />
      )}
      {status === "pending" && affiliation?.dueAt && (
        <p className="verification-expiry">{expiryLine(affiliation.dueAt)}</p>
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
            <button className="btn verification-go" disabled={state.busy}>
              Request verification
            </button>
          </div>
        </form>
      )}
      {/* TEMPORARY demo shortcut, shown only when the server allows it:
          a disclaimer, with the button in the card's lower right. */}
      {status === "pending" &&
        !mentor &&
        state.integrations?.simulateVerification && (
          <div className="verification-footer">
            <p>
              <strong>Prototype only:</strong> skip the moderator and approve
              this request now. No one reviews the evidence.
            </p>
            <button
              type="button"
              className="btn verification-go"
              disabled={state.busy}
              onClick={(event) =>
                onAction({ action: "simulate-verification" }, event)
              }
            >
              {state.busy ? "Approving…" : "Simulate approval"}
            </button>
          </div>
        )}
    </section>
  );
}
