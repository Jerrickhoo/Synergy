import NextStep from "../components/NextStep.jsx";
import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Icon from "../components/Icon.jsx";
export default function ReviewPage() {
  const { state, model, onSubmit, onRating } = useApp();
  const { activeRoom } = model;
  const room = activeRoom();
  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="CLOSE THE LOOP"
        title="How did it go?"
        intro="A private reflection helps future partners make informed connections."
      />
      <section className="card panel review-page">
        {"\n          "}
        <div className="onboard-illustration">
          <Icon name="spark" />
        </div>
        {"\n          "}
        <h2>Share an honest reflection</h2>
        {"\n          "}
        <p className="panel-subtitle">
          Your rating stays hidden until your partner submits theirs too.
        </p>
        {"\n          "}
        {room.review.me ? (
          <div className="confirmation-card">
            <Icon name="check" />
            {" Your review has been sent privately. "}
            {room.review.partner
              ? "Both reviews are in."
              : "It will stay hidden until your partner submits theirs too."}
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
              Send private review
            </button>
          </form>
        )}
        {"\n        "}
      </section>
      <NextStep />
    </div>
  );
}
