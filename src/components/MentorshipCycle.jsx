import { useApp } from "../state/AppContext.jsx";
import { upcomingSessions, scheduleLabel } from "../data/selectors.js";
import FormErrors from "./FormErrors.jsx";

export default function MentorshipCycle({ room }) {
  const { state, onSubmit, onAction, downloadFile } = useApp();
  const cycle = room.cycle;
  if (!cycle) return null;
  const mine = cycle.reviews?.[state.accountId];
  const theirs = cycle.reviews?.[room.partnerAccountId];
  const next = upcomingSessions(state).find((item) => item.room.id === room.id);
  const closed = ["launched", "reviewed", "cancelled"].includes(room.status);
  return (
    <section
      className="card panel cycle-panel section-gap"
      aria-labelledby="cycle-heading"
    >
      <h2 id="cycle-heading">Mentorship cycle {cycle.number}</h2>
      <p>
        8-week check-in · due {new Date(cycle.dueAt).toLocaleDateString()} ·{" "}
        {next
          ? `Next session: ${scheduleLabel(next.schedule)}`
          : "Next session: not scheduled"}
      </p>
      <p className="muted">
        Cycle reviews stay private until both submit. To continue, both must
        choose Continue; if either chooses Finish, the mentorship completes
        after both respond. The final 14-day review is separate.
      </p>
      {!closed && !mine && (
        <form
          key={`${room.id}:${cycle.number}`}
          data-form="cycle-details"
          className="grid"
          onSubmit={onSubmit}
        >
          <FormErrors scope="cycle-details" />
          <label htmlFor="cycle-goals">Cycle goals</label>
          <textarea
            id="cycle-goals"
            name="goals"
            defaultValue={cycle.goals}
            required
            readOnly={cycle.phase === "review"}
            maxLength={3000}
          />
          <label htmlFor="cycle-summary">Check-in summary</label>
          <textarea
            id="cycle-summary"
            name="summary"
            defaultValue={cycle.summary}
            maxLength={3000}
          />
          <button className="btn" disabled={state.busy}>
            Save cycle details
          </button>
        </form>
      )}
      {(mine || closed) && (
        <>
          <h3>Goals</h3>
          <p>{cycle.goals || "Agree goals for this cycle."}</p>
          <h3>Check-in summary</h3>
          <p>{cycle.summary || "Not added yet."}</p>
        </>
      )}
      {!closed && cycle.phase === "review" && !mine && (
        <form
          data-form="cycle-review"
          className="grid section-gap"
          onSubmit={onSubmit}
        >
          <FormErrors scope="cycle-review" />
          <h3>Your private cycle review</h3>
          <label htmlFor="cycle-rating">Cycle rating (1–5)</label>
          <input
            id="cycle-rating"
            name="rating"
            type="number"
            min="1"
            max="5"
            required
          />
          <label htmlFor="cycle-note">Cycle review note</label>
          <textarea id="cycle-note" name="note" maxLength={3000} />
          <button
            className="btn primary"
            disabled={state.busy || !cycle.summary}
          >
            Submit private cycle review
          </button>
          {!cycle.summary && <p>Add a check-in summary first.</p>}
        </form>
      )}
      {mine && !theirs && (
        <p role="status">
          Your cycle review is saved. Waiting for your partner’s private review.
        </p>
      )}
      {mine && theirs && (
        <div className="section-gap">
          <h3>Cycle feedback</h3>
          <p>
            You: {mine.rating}/5 · {mine.note}
          </p>
          <p>
            Partner: {theirs.rating}/5 · {theirs.note}
          </p>
          {!closed && (
            <div className="chip-row">
              {["continue", "finish"].map((decision) => (
                <button
                  key={decision}
                  className="btn"
                  aria-pressed={cycle.decisions?.[state.accountId] === decision}
                  disabled={state.busy}
                  onClick={() =>
                    onAction({ action: "cycle-decision", values: { decision } })
                  }
                >
                  {decision === "continue" ? "Continue" : "Finish"}
                </button>
              ))}
            </div>
          )}
          {!closed && cycle.decisions?.[state.accountId] && (
            <p>Waiting for your partner’s decision.</p>
          )}
        </div>
      )}
      {(room.cycleHistory || []).map((previous) => (
        <details key={previous.number}>
          <summary>Cycle {previous.number} history</summary>
          <p>{previous.goals}</p>
          <p>{previous.summary}</p>
          {Object.values(previous.milestones || {}).map((item) => (
            <div key={item.title}>
              <strong>{item.title}</strong>
              <p>
                {item.schedule
                  ? `Session: ${scheduleLabel(item.schedule)}`
                  : ""}
              </p>
              {(item.evidenceItems || []).map((proof, index) => (
                <p key={index}>
                  {proof.file ? (
                    <button
                      className="link-btn"
                      onClick={() => downloadFile(proof.file)}
                    >
                      Download {proof.file.name}
                    </button>
                  ) : (
                    proof.label
                  )}
                </p>
              ))}
            </div>
          ))}
          {Object.entries(previous.reviews).map(([id, review]) => (
            <p key={id}>
              {id === state.accountId ? "You" : "Partner"}: {review.rating}/5 ·{" "}
              {review.note}
            </p>
          ))}
        </details>
      ))}
    </section>
  );
}
