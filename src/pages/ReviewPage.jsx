import { isMentorRoom } from "../data/mentor-room.js";
import { useState } from "react";
import SelectField from "../components/SelectField.jsx";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Icon from "../components/Icon.jsx";
import { reviewDeadline } from "../data/collaboration.js";

const goalLabel = {
  achieved: "Achieved",
  partial: "Partly achieved",
  "not-achieved": "Not achieved",
};
const longDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

export default function ReviewPage() {
  const { state, model, onSubmit, onRating, onAction } = useApp();
  const [ratingMissing, setRatingMissing] = useState(false);
  const room = model.activeRoom();
  const partner = model
    .allPeople()
    .find((person) => person.id === room.partnerId);
  const partnerName = partner?.name || "your collaborator";
  if (isMentorRoom(room))
    return <MentorshipReview room={room} partnerName={partnerName} />;
  if (!["launched", "reviewed"].includes(room.status))
    return (
      <div className="page">
        <PageHeader
          title="Complete your collaboration first"
          intro="Reviews open after every milestone is confirmed by both collaborators and the collaboration is launched."
        />
        <button
          className="btn"
          onClick={() => onAction({ action: "open-room", id: room.id })}
        >
          Return to the Deal Room
        </button>
      </div>
    );
  const released =
    room.status === "reviewed" &&
    ((room.review.me && room.review.partner) || room.review.windowClosed);
  const deadline = reviewDeadline(room);
  return (
    <div className="page page-enter">
      <PageHeader
        title={released ? "Your reviews are in" : "How did it go?"}
        intro={
          released
            ? `${room.engagementType} with ${partnerName}. Both reviews are now part of your collaboration history.`
            : `${room.engagementType} with ${partnerName}${room.terms.draft.goal ? `: ${room.terms.draft.goal}` : ""}.`
        }
      />
      {released && (
        <section className="card panel review-results">
          <h2>{partnerName}’s feedback</h2>
          {room.review.partner ? (
            <>
              <p className="review-rating">{room.review.partnerRating}/5</p>
              <p>{room.review.partnerNote || "No written feedback."}</p>
              {room.review.partnerUseful && (
                <p>
                  Useful match:{" "}
                  {room.review.partnerUseful === "yes" ? "Yes" : "No"}
                </p>
              )}
              {room.review.partnerGoalOutcome && (
                <p>Shared goal: {goalLabel[room.review.partnerGoalOutcome]}</p>
              )}
            </>
          ) : (
            <p>
              {partnerName} did not submit a review before the window closed.
            </p>
          )}
          <h3>Your feedback</h3>
          <p>
            {room.review.me
              ? `${room.review.rating}/5 · ${room.review.note || "No written feedback."}`
              : "You did not submit a review before the window closed."}
          </p>
        </section>
      )}
      {room.status === "launched" &&
        !room.review.me &&
        !room.review.partner &&
        room.launchedAt &&
        Date.now() - Date.parse(room.launchedAt) < 86400000 && (
          <section className="card panel section-gap">
            <p>
              Completed too soon? Either participant can undo within 24 hours,
              before either review is submitted.
            </p>
            <button
              className="btn"
              disabled={state.busy}
              onClick={() => onAction({ action: "undo-launch" })}
            >
              Undo completion
            </button>
          </section>
        )}
      {!released && (
        <section className="card panel review-page">
          <h2>Share an honest reflection</h2>
          <p className="muted">
            {partnerName} cannot see your review until both of you submit, or
            until the review window closes
            {deadline ? ` on ${longDate(deadline)}` : ""}. Your rating appears
            in {partnerName}’s public history after that. Your note and answers
            are shared only with {partnerName}.
          </p>
          <p className="review-status">
            <span>
              You: {room.review.me ? "Submitted" : "Not submitted yet"}
            </span>
            <span>
              {partnerName}:{" "}
              {room.review.partner ? "Submitted" : "Not submitted yet"}
            </span>
          </p>
          {room.review.me ? (
            <div className="confirmation-card">
              <Icon name="check" />
              Your review is saved. Feedback is released when {partnerName}{" "}
              submits theirs
              {deadline ? `, or on ${longDate(deadline)}` : ""}.
            </div>
          ) : (
            <form
              id="review-form"
              className="grid section-gap"
              noValidate
              onSubmit={(event) => {
                if (!state.rating) {
                  event.preventDefault();
                  setRatingMissing(true);
                  document.querySelector(".star-rating input")?.focus();
                  return;
                }
                onSubmit(event);
              }}
            >
              <fieldset
                className="rating-field"
                aria-describedby={ratingMissing ? "rating-error" : undefined}
              >
                <legend>Your rating</legend>
                <div
                  className="star-rating"
                  role="radiogroup"
                  aria-label="Choose a rating"
                  aria-invalid={ratingMissing ? "true" : undefined}
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
                        aria-label={`${rating} stars`}
                        onChange={() => {
                          setRatingMissing(false);
                          onRating(rating);
                        }}
                      />
                      <span aria-hidden="true">
                        <Icon name="star" />
                      </span>
                    </label>
                  ))}
                </div>
                {ratingMissing && (
                  <p className="inline-error" id="rating-error" role="alert">
                    Choose a rating from 1 to 5 stars.
                  </p>
                )}
              </fieldset>
              <div className="field">
                <label htmlFor="review-note">
                  A note about working together
                </label>
                <textarea
                  id="review-note"
                  name="note"
                  maxLength={3000}
                  placeholder="What went well? What could be better?"
                />
              </div>
              <div className="field">
                <label htmlFor="match-useful">Was this a useful match?</label>
                <SelectField id="match-useful" name="useful">
                  <option value="">Prefer not to answer</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </SelectField>
              </div>
              <div className="field">
                <label htmlFor="goal-outcome">
                  Did you achieve your shared goal?
                </label>
                <SelectField id="goal-outcome" name="goalOutcome">
                  <option value="">Prefer not to answer</option>
                  <option value="achieved">Achieved</option>
                  <option value="partial">Partly achieved</option>
                  <option value="not-achieved">Not achieved</option>
                </SelectField>
                <p className="muted">
                  Optional. These answers help improve matching; moderators see
                  only totals.
                </p>
              </div>
              <button
                className="btn primary"
                type="submit"
                disabled={state.busy}
              >
                Submit private review
              </button>
            </form>
          )}
        </section>
      )}
      <div className="chip-row section-gap">
        <button
          className="btn"
          onClick={() =>
            onAction({ action: "open-room", id: room.id, tab: "milestones" })
          }
        >
          Back to the Deal Room
        </button>
        <button className="btn" onClick={() => onAction({ page: "rooms" })}>
          All Deal Rooms
        </button>
      </div>
    </div>
  );
}

function MentorshipReview({ room, partnerName }) {
  const { state, onSubmit, onAction } = useApp();
  const review = room.review;
  const released = review.windowClosed || (review.me && review.partner);
  const categories =
    room.role === "founder"
      ? [
          ["usefulness", "Usefulness"],
          ["clarity", "Clarity"],
          ["responsiveness", "Responsiveness"],
          ...(room.payment?.amount
            ? [["valueForMoney", "Value for money"]]
            : []),
        ]
      : [
          ["preparedness", "Preparedness"],
          ["followThrough", "Follow-through"],
        ];
  const open = Boolean(room.mentorship.reviewOpenedAt);
  return (
    <div className="page page-enter">
      <PageHeader
        title={released ? "Mentorship feedback" : "Private mentorship review"}
        intro={`With ${partnerName}`}
        actions={
          <button
            className="btn"
            onClick={() => onAction({ action: "open-room", id: room.id })}
          >
            Back to mentorship room
          </button>
        }
      />
      {!open && (
        <p>
          The review opens once the response is delivered or the session is
          held.
        </p>
      )}
      {open &&
        !review.me &&
        !review.windowClosed &&
        room.status !== "cancelled" && (
          <form
            id="review-form"
            className="card panel mentor-request-form"
            onSubmit={onSubmit}
          >
            <p>
              Your feedback stays private until both people submit or the review
              window closes.
            </p>
            {categories.map(([id, label]) => (
              <label key={id}>
                {label}
                <select name={id} required defaultValue="">
                  <option value="" disabled>
                    Choose a rating
                  </option>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <option key={rating}>{rating}</option>
                  ))}
                </select>
              </label>
            ))}
            <label htmlFor="mentor-review-note">
              Private feedback (optional)
            </label>
            <textarea id="mentor-review-note" name="note" maxLength={3000} />
            {room.role === "founder" && (
              <>
                <label htmlFor="mentor-testimonial">
                  Testimonial (optional)
                </label>
                <textarea
                  name="testimonial"
                  id="mentor-testimonial"
                  maxLength={500}
                />
                <label>
                  <input type="checkbox" name="testimonialPublic" /> Let the
                  mentor share this testimonial publicly
                </label>
              </>
            )}
            <button className="btn primary" disabled={state.busy}>
              Submit private review
            </button>
          </form>
        )}
      {review.me && !released && (
        <p role="status">Your private review is saved.</p>
      )}
      {released && (
        <section className="card panel">
          <h2>Your feedback</h2>
          <p>
            {review.me
              ? `${Number(review.rating).toFixed(1)}/5 · ${review.note || "No written feedback."}`
              : "No review submitted."}
          </p>
          <h2>Feedback from {partnerName}</h2>
          <p>
            {review.partner
              ? `${Number(review.partnerRating).toFixed(1)}/5 · ${review.partnerNote || "No written feedback."}`
              : "No review submitted."}
          </p>
          {room.role === "mentor" && review.partnerTestimonial && (
            <>
              <blockquote>{review.partnerTestimonial}</blockquote>
              {review.partnerTestimonialPublic && (
                <button
                  className="btn"
                  disabled={state.busy}
                  onClick={(event) =>
                    onAction(
                      {
                        action: "set-testimonial-public",
                        values: { public: !review.testimonialAccepted },
                      },
                      event,
                    )
                  }
                >
                  {review.testimonialAccepted
                    ? "Hide testimonial"
                    : "Publish testimonial"}
                </button>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
