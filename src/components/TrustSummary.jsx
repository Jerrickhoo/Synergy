export default function TrustSummary({ person, detailed = false }) {
  const trust = person.trust;
  if (!trust)
    return (
      <p className="muted">
        Collaboration history is unavailable for this profile.
      </p>
    );
  return (
    <section
      className="trust-summary section-gap"
      aria-label={`Trust history for ${person.name}`}
    >
      <div className="tag-row">
        {person.affiliation && (
          <span className="tag green">
            Affiliation verified: {person.affiliation.organization}
          </span>
        )}
      </div>
      {detailed && !trust.completed && !trust.cancelled && (
        <h3>A new collaboration profile</h3>
      )}
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
            Repeat-partner reviews count once in the average. Affiliation is
            reviewed separately.
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
