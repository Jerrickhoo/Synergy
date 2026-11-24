import { useApp } from "../state/AppContext.jsx";
import MentorImpact from "./MentorImpact.jsx";
import { scoreLabel } from "../data/profile-presentation.js";

// A partner's written review, quoted because the partner said it.
function ReviewQuote({ label, item }) {
  return (
    <figure className="profile-review">
      <figcaption>
        {label} · {scoreLabel(item.rating)}
        <span className="visually-hidden"> out of 5</span>
      </figcaption>
      <blockquote>
        <p className="preserve-lines">“{item.note.trim()}”</p>
      </blockquote>
      <p className="profile-review-source">
        {item.partner} · {item.type}
      </p>
    </figure>
  );
}

export default function CollaborationRecord() {
  const { state } = useApp();
  const history = state.trustHistoryByRole[state.role];
  const rated = history.filter((item) => Number.isFinite(item.rating));
  // The server's average counts each partner once; the local fallback
  // averages the released ratings it has.
  const average = state.trustSummary
    ? state.trustSummary.averageRating
    : rated.length
      ? rated.reduce((sum, item) => sum + item.rating, 0) / rated.length
      : null;
  const reviewers = state.trustSummary
    ? state.trustSummary.distinctReviewers || 0
    : rated.length;
  const completed = state.trustSummary?.completed ?? history.length;
  // Highest and lowest written reviews; one quote when they are the same.
  const written = rated
    .filter((item) => item.note?.trim())
    .sort((a, b) => b.rating - a.rating);
  const highest = written[0];
  const lowest =
    written.length > 1 && written.at(-1).rating < highest.rating
      ? written.at(-1)
      : null;
  const scored = Number.isFinite(average);
  return (
    <section
      className="card panel profile-section profile-record"
      aria-labelledby="profile-record-heading"
    >
      <h2 id="profile-record-heading">Collaboration record</h2>
      <div className="profile-record-stats">
        <div className="profile-score">
          <strong className="profile-score-value">
            {scored ? scoreLabel(average) : "—"}
            {scored && <span className="visually-hidden"> out of 5</span>}
          </strong>
          <span>
            {scored
              ? `Average from ${reviewers} review${reviewers === 1 ? "" : "s"}`
              : "No ratings yet"}
          </span>
        </div>
        <div className="profile-score">
          <strong className="profile-score-value">{completed}</strong>
          <span>Completed collaboration{completed === 1 ? "" : "s"}</span>
        </div>
      </div>
      {highest && (
        <div className="profile-reviews">
          <ReviewQuote
            label={lowest ? "Highest rated" : "Top review"}
            item={highest}
          />
          {lowest && <ReviewQuote label="Lowest rated" item={lowest} />}
        </div>
      )}
      {/* Mentors keep their mentoring impact here; a founder's own track
          record is left out as it repeated what mentors see on requests. */}
      {state.role === "mentor" && (
        <MentorImpact
          trust={state.trustSummary?.mentorship}
          privateView
          embedded
        />
      )}
    </section>
  );
}
