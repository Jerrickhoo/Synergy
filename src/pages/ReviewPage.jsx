import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Icon from "../components/Icon.jsx";

export default function ReviewPage() {
  const { state, model, onSubmit, onRating, onAction } = useApp();
  const room = model.activeRoom();
  if (!["launched", "reviewed"].includes(room.status))
    return (
      <div className="page">
        <PageHeader
          title="Complete your collaboration first"
          intro="Reviews become available after every milestone is confirmed by both collaborators."
        />
        <button
          className="btn"
          onClick={() => onAction({ action: "open-room", id: room.id })}
        >
          Return to room
        </button>
      </div>
    );
  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="CLOSE THE LOOP"
        title="How did it go?"
        intro="Your feedback stays private until both collaborators submit their reviews."
      />
      <section className="card panel review-page">
        <h2>Share an honest reflection</h2>
        {room.review.me ? (
          <div className="confirmation-card">
            <Icon name="check" />
            Your review is saved.{" "}
            {room.review.partner
              ? "Both reviews are in."
              : "Waiting for your collaborator's review."}
          </div>
        ) : (
          <form
            id="review-form"
            className="grid section-gap"
            onSubmit={onSubmit}
          >
            <fieldset className="rating-field">
              <legend>Your rating</legend>
              <div
                className="star-rating"
                role="radiogroup"
                aria-label="Choose a rating"
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <label
                    key={rating}
                    className={state.rating >= rating ? "filled" : ""}
                  >
                    <input
                      type="radio"
                      name="rating"
                      value={rating}
                      required
                      aria-label={`${rating} stars`}
                      onChange={() => onRating(rating)}
                    />
                    <span aria-hidden="true">
                      <Icon name="star" />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="review-note">A note about working together</label>
              <textarea
                id="review-note"
                name="note"
                maxLength={3000}
                placeholder="What went well? What could be better?"
              />
            </div>
            <div className="field">
              <label htmlFor="match-useful">Was this a useful match?</label>
              <select id="match-useful" name="useful">
                <option value="">Prefer not to answer</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="goal-outcome">
                Did you achieve your shared goal?
              </label>
              <select id="goal-outcome" name="goalOutcome">
                <option value="">Prefer not to answer</option>
                <option value="achieved">Achieved</option>
                <option value="partial">Partly achieved</option>
                <option value="not-achieved">Not achieved</option>
              </select>
              <p className="muted">
                Optional feedback helps evaluate matching. Answers stay private
                until both reviews are submitted; moderators see aggregate
                matching outcomes.
              </p>
            </div>
            <button className="btn primary" type="submit" disabled={state.busy}>
              Submit private review
            </button>
          </form>
        )}
        {room.review.me && room.review.partner && (
          <div className="review-results section-gap">
            <h3>Your collaborator's feedback</h3>
            <p>{room.review.partnerRating}/5</p>
            <p>{room.review.partnerNote || "No written feedback."}</p>
            {room.review.partnerUseful && (
              <p>
                Useful match:{" "}
                {room.review.partnerUseful === "yes" ? "Yes" : "No"}
              </p>
            )}
            {room.review.partnerGoalOutcome && (
              <p>
                Shared goal:{" "}
                {
                  {
                    achieved: "Achieved",
                    partial: "Partly achieved",
                    "not-achieved": "Not achieved",
                  }[room.review.partnerGoalOutcome]
                }
              </p>
            )}
            <h3>Your feedback</h3>
            <p>
              {room.review.rating}/5 ·{" "}
              {room.review.note || "No written feedback."}
            </p>
            <p className="muted">
              This collaboration is now part of both profiles' history.
            </p>
          </div>
        )}
      </section>
      <button
        className="btn section-gap"
        onClick={() => onAction({ page: "rooms" })}
      >
        View your rooms
      </button>
    </div>
  );
}
