import FormErrors from "./FormErrors.jsx";
import { useApp } from "../state/AppContext.jsx";
export default function TermsPanel({ room, agreement, partner, milestones }) {
  const { state, model, onAction, onSubmit } = useApp();
  const { roomStatusLabel } = model;
  return (
    <div className="terms-layout">
      <section className="card panel room-content terms-form-panel">
        <div className="panel-head">
          <div>
            <h2>Terms &amp; expectations</h2>
            <p className="panel-subtitle">
              Agree on a clear goal, scope, timeline, and exchange before work
              begins.
            </p>
          </div>
          <span
            className={"status " + (agreement.partnerLocked ? "green" : "")}
          >
            {agreement.partnerLocked
              ? "Confirmed by both"
              : agreement.locked
                ? roomStatusLabel(
                    "terms",
                    partner?.name || room.partnerId,
                    agreement.confirmedByMe,
                  )
                : "Draft"}
          </span>
        </div>
        {"\n          "}
        <form
          id="terms-form"
          key={JSON.stringify(agreement.draft) + agreement.locked}
          className="grid"
          onSubmit={(event) => onSubmit(event)}
        >
          {"\n            "}
          <FormErrors scope="terms-form" />
          <div className="field">
            <label htmlFor="term-goal">Shared goal</label>
            <input
              id="term-goal"
              name="goal"
              defaultValue={agreement.draft.goal}
              {...(agreement.locked
                ? {
                    disabled: true,
                  }
                : {})}
              required
            />
          </div>
          {"\n            "}
          <div className="field">
            <label htmlFor="term-scope">Scope and deliverables</label>
            <textarea
              id="term-scope"
              name="scope"
              {...(agreement.locked
                ? {
                    disabled: true,
                  }
                : {})}
              required
              defaultValue={agreement.draft.scope}
            />
          </div>
          {"\n            "}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="term-timeline">Timeline</label>
              <input
                id="term-timeline"
                name="timeline"
                defaultValue={agreement.draft.timeline}
                {...(agreement.locked
                  ? {
                      disabled: true,
                    }
                  : {})}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="term-commitment">Commitment</label>
              <input
                id="term-commitment"
                name="commitment"
                defaultValue={agreement.draft.commitment}
                {...(agreement.locked
                  ? {
                      disabled: true,
                    }
                  : {})}
                required
              />
            </div>
          </div>
          {"\n            "}
          <div className="field">
            <label htmlFor="term-compensation">Exchange</label>
            <input
              id="term-compensation"
              name="compensation"
              defaultValue={agreement.draft.compensation}
              {...(agreement.locked
                ? {
                    disabled: true,
                  }
                : {})}
              required
            />
          </div>
          {"\n            "}
          <div className="terms-actions">
            {!agreement.locked ? (
              <>
                <button className="btn" type="submit">
                  Save draft
                </button>
                <button
                  className="btn primary"
                  type="button"
                  data-action="lock-terms"
                  onClick={(event) =>
                    onAction(
                      {
                        action: "lock-terms",
                      },
                      event,
                    )
                  }
                >
                  Lock terms &amp; start
                </button>
              </>
            ) : agreement.partnerLocked ? (
              <span className="status green">
                Both sides have locked these terms
              </span>
            ) : !agreement.confirmedByMe ? (
              <button
                className="btn primary"
                type="button"
                disabled={state.busy}
                onClick={() => onAction({ action: "accept-terms" })}
              >
                Accept shared terms
              </button>
            ) : (
              <span className="status">
                {"Waiting for "}
                {partner?.name || "your partner"}
                {" to confirm"}
              </span>
            )}
          </div>
          {"\n          "}
        </form>
      </section>
      <aside className="card panel before-lock">
        <h2>Before you lock</h2>
        <p className="panel-subtitle">
          A shared understanding makes it easier to move forward.
        </p>
        <ul>
          <li>Agree on one clear outcome</li>
          <li>Define scope and deliverables</li>
          <li>Set a realistic timeline</li>
          <li>Confirm each person’s commitment</li>
          <li>Make the exchange explicit</li>
        </ul>
      </aside>
    </div>
  );
}
