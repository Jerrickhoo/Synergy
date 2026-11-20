import Icon from "./Icon.jsx";

// Small samples are shown as counts so one event cannot look like a pattern.
export default function TrustSummary({ person, detailed = false }) {
  const trust = person.trust;
  if (!trust)
    return (
      <p className="muted">
        Collaboration history is unavailable for this profile.
      </p>
    );
  const fresh = !trust.completed && !trust.cancelled;
  const reviews = trust.distinctReviewers || 0;
  return (
    <section
      className="trust-summary section-gap"
      aria-label={`Trust history for ${person.name}`}
    >
      <div className="tag-row">
        {person.affiliation ? (
          <span className="badge-verified">
            <Icon name="check" /> Verified: {person.affiliation.organization}
          </span>
        ) : (
          detailed && <span className="muted">Not verified yet</span>
        )}
      </div>
      {detailed && fresh ? (
        // One line for a newcomer instead of a badge, a heading, a zero count
        // and empty history.
        <p>
          {person.kind === "Mentor"
            ? "New mentor · no completed sessions yet"
            : "New to Synergy · no completed collaborations yet"}
        </p>
      ) : (
        <p>
          {trust.completed} completed ·{" "}
          {trust.averageRating === null
            ? "No ratings yet"
            : `${trust.averageRating}/5 from ${reviews} review${reviews === 1 ? "" : "s"}${reviews < 3 ? " (small sample)" : ""}`}
        </p>
      )}
      {detailed && !fresh && (
        <>
          <p className="muted">
            {!trust.closed
              ? "No finished collaborations yet"
              : trust.closed < 3
                ? `${trust.completed} of ${trust.closed} finished collaboration${trust.closed === 1 ? "" : "s"} completed`
                : `${trust.followThrough}% of ${trust.closed} finished collaborations completed`}
            {trust.cancelled ? ` · ${trust.cancelled} closed early` : ""}
            {trust.stalled ? ` · ${trust.stalled} quiet for 14+ days` : ""}
          </p>
          <p className="muted">
            Collaborations closed by mutual agreement, or because the other
            person stopped responding, do not count against this record.
            Repeat-partner reviews count once.
          </p>
          {trust.ratingPattern && (
            <p className="muted">{trust.ratingPattern}</p>
          )}
          <details>
            <summary>
              Completed collaboration history ({trust.history.length})
            </summary>
            {trust.history.length ? (
              trust.history.map((item) => (
                <p key={item.id}>
                  {item.type} · {item.date || "Date unavailable"} ·{" "}
                  {item.rating === null || item.rating === undefined
                    ? item.status === "launched"
                      ? "Reviews pending"
                      : "No rating"
                    : `${item.rating}/5`}
                </p>
              ))
            ) : (
              <p>No completed collaborations yet.</p>
            )}
          </details>
        </>
      )}
    </section>
  );
}
