export default function TrustSummary({ person, detailed = false }) {
  const trust = person.trust;
  if (!trust) return null;
  return (
    <section
      className="trust-summary section-gap"
      aria-label={`Trust history for ${person.name}`}
    >
      <div className="tag-row">
        <span className="tag">
          {person.emailVerified ? "Email verified" : "Email unverified"}
        </span>
        {person.affiliation && (
          <span className="tag green">
            Affiliation verified: {person.affiliation.organization}
          </span>
        )}
      </div>
      <p>
        {trust.completed} completed ·{" "}
        {trust.averageRating === null
          ? "No ratings yet"
          : `${trust.averageRating}/5 from ${trust.distinctReviewers} distinct collaborators`}
      </p>
      {detailed && (
        <>
          <p className="muted">
            {trust.followThrough === null
              ? "No closed engagements yet"
              : `${trust.followThrough}% of closed engagements completed`}{" "}
            · {trust.cancelled} closed early · {trust.stalled} quiet for 14+
            days
          </p>
          <p className="muted">
            Repeat-partner reviews count once in the average. Email verification
            confirms mailbox access; affiliation is checked separately by a
            moderator.
          </p>
          {trust.ratingPattern && (
            <p className="muted">{trust.ratingPattern}</p>
          )}
          <details>
            <summary>
              Completed engagement history ({trust.history.length})
            </summary>
            {trust.history.length ? (
              trust.history.map((item) => (
                <p key={item.id}>
                  {item.type} · {item.date || "Date unavailable"} ·{" "}
                  {item.rating === null
                    ? "Reviews pending"
                    : `${item.rating}/5`}
                </p>
              ))
            ) : (
              <p>No completed engagements yet.</p>
            )}
          </details>
        </>
      )}
    </section>
  );
}
