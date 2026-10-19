import NextStep from "../components/NextStep.jsx";
import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Icon from "../components/Icon.jsx";
import { EmptyState } from "../components/DashboardUI.jsx";
export default function ReviewPage() {
  const { state, model, onSubmit, onRating, onAction } = useApp();
  const { activeRoom } = model;
  const room = activeRoom();
  if (!["launched", "reviewed"].includes(room.status))
    return (
      <div className="page">
        <PageHeader
          eyebrow="YOUR SHARED WORK"
          title="Complete your collaboration first"
          intro="Reviews become available after the room meets its launch requirements."
        />
        <EmptyState
          title="This collaboration is still in progress"
          action={() => onAction({ action: "open-room", id: room.id })}
          actionLabel="Return to room"
        >
          Confirm every milestone, add required evidence, and resolve disputes
          before launching.
        </EmptyState>
      </div>
    );
  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="CLOSE THE LOOP"
        title="How did it go?"
        intro="Try the local review workflow. This demo does not send reviews or update reputation."
      />
      <section className="card panel review-page">
        {"\n          "}
        {"\n          "}
        <h2>Share an honest reflection</h2>
        {"\n          "}
        <p className="panel-subtitle">
          Partner submission is simulated. There is no server-backed privacy or
          reputation service in this prototype.
        </p>
        {"\n          "}
        {room.review.me ? (
          <div className="confirmation-card">
            <Icon name="check" />
            {" Your review has been saved in this demo. "}
            {room.review.partner
              ? "Both reviews are in."
              : "Use Demo controls to simulate the partner’s submission."}
          </div>
        ) : (
          <form
            id="review-form"
            className="grid"
            onSubmit={(event) => onSubmit(event)}
          >
            <fieldset className="rating-field">
              <legend>Your rating</legend>
              <div
                className="star-rating"
                role="radiogroup"
                aria-label="Choose a rating"
              >
                {[1, 2, 3, 4, 5].map((rating, itemIndex) => (
                  <Fragment key={itemIndex}>
                    <label className={state.rating >= rating ? "filled" : ""}>
                      <input
                        type="radio"
                        name="rating"
                        defaultValue={rating}
                        required
                        aria-label={rating + " stars"}
                        onChange={(event) =>
                          onRating(Number(event.target.value))
                        }
                      />
                      <span aria-hidden="true">
                        <Icon name="star" />
                      </span>
                    </label>
                  </Fragment>
                ))}
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="review-note">A note about working together</label>
              <textarea
                id="review-note"
                name="note"
                placeholder="What went well? What would you share with another founder?"
                defaultValue=""
              />
            </div>
            <button className="btn primary" type="submit">
              Save demo review
            </button>
          </form>
        )}
        {"\n        "}
      </section>
      <NextStep />
    </div>
  );
}
