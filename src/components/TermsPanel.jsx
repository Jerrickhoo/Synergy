import { useDraft } from "../state/useDraft.js";
import FormErrors from "./FormErrors.jsx";
import { useApp } from "../state/AppContext.jsx";
export default function TermsPanel({ room, agreement, partner, milestones }) {
  const { state, model, onAction, onSubmit } = useApp();
  const { roomStatusLabel } = model;
  const draft = useDraft(
    `${state.accountId}:terms:${room.id}`,
    agreement.draft,
    agreement.revision || 0,
  );
  const readOnly =
    agreement.locked ||
    ["launched", "reviewed", "cancelled"].includes(room.status);
  return (
    <div className="terms-layout">
      <section className="card panel room-content terms-form-panel">
        <div className="panel-head">
          <div>
            <h2>Terms &amp; expectations</h2>
            <p className="panel-subtitle">
              {room.type === "mentorship"
                ? "Agree on the startup challenge, guidance, preparation and time commitment before your sessions."
                : "Agree on a clear goal, scope, timeline, and exchange before work begins."}
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
          className="grid"
          onSubmit={(event) => onSubmit(event)}
        >
          {"\n            "}
          <input type="hidden" name="revision" value={draft.version} />
          {draft.conflict && (
            <div className="connection-banner" role="alert">
              Your collaborator changed these terms. Your draft is preserved
              below. Review the latest saved terms before saving or locking.
              <details>
                <summary>Latest saved terms</summary>
                {Object.entries(agreement.draft).map(([key, value]) => (
                  <p key={key}>
                    <strong>{key}:</strong> {value}
                  </p>
                ))}
              </details>
              <button type="button" className="btn" onClick={draft.clear}>
                Use latest terms
              </button>
            </div>
          )}
          {draft.dirty && !draft.conflict && (
            <p className="muted" role="status">
              Draft saved in this tab. Save to share with your collaborator.
            </p>
          )}
          <FormErrors scope="terms-form" />
          <div className="field">
            <label htmlFor="term-goal">Shared goal</label>
            <input
              id="term-goal"
              name="goal"
              onChange={(event) =>
                draft.update({ ...draft.values, goal: event.target.value })
              }
              value={readOnly ? agreement.draft.goal : draft.values.goal || ""}
              {...(readOnly
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
              onChange={(event) =>
                draft.update({ ...draft.values, scope: event.target.value })
              }
              {...(readOnly
                ? {
                    disabled: true,
                  }
                : {})}
              required
              value={
                readOnly ? agreement.draft.scope : draft.values.scope || ""
              }
            />
          </div>
          {"\n            "}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="term-timeline">Timeline</label>
              <input
                id="term-timeline"
                name="timeline"
                onChange={(event) =>
                  draft.update({
                    ...draft.values,
                    timeline: event.target.value,
                  })
                }
                value={
                  readOnly
                    ? agreement.draft.timeline
                    : draft.values.timeline || ""
                }
                {...(readOnly
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
                onChange={(event) =>
                  draft.update({
                    ...draft.values,
                    commitment: event.target.value,
                  })
                }
                value={
                  readOnly
                    ? agreement.draft.commitment
                    : draft.values.commitment || ""
                }
                {...(readOnly
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
            <label htmlFor="term-compensation">
              {room.type === "mentorship"
                ? "Mentoring arrangement"
                : "Exchange"}
            </label>
            {room.type === "mentorship" && (
              <p className="field-help" id="mentoring-arrangement-help">
                Record whether guidance is voluntary or any agreed compensation.
              </p>
            )}
            <input
              id="term-compensation"
              aria-describedby={
                room.type === "mentorship"
                  ? "mentoring-arrangement-help"
                  : undefined
              }
              name="compensation"
              onChange={(event) =>
                draft.update({
                  ...draft.values,
                  compensation: event.target.value,
                })
              }
              value={
                readOnly
                  ? agreement.draft.compensation
                  : draft.values.compensation || ""
              }
              {...(readOnly
                ? {
                    disabled: true,
                  }
                : {})}
              required
            />
          </div>
          {"\n            "}
          <div className="terms-actions">
            {agreement.locked &&
              !["launched", "reviewed", "cancelled"].includes(room.status) && (
                <button
                  className="btn"
                  type="button"
                  disabled={state.busy}
                  onClick={() => onAction({ action: "reopen-terms" })}
                >
                  Request changes / reopen terms
                </button>
              )}
            {room.status === "cancelled" ? (
              <span className="status">This collaboration is closed.</span>
            ) : !agreement.locked ? (
              <>
                <button
                  className="btn"
                  type="submit"
                  disabled={state.busy || draft.conflict}
                >
                  Save draft
                </button>
                <button
                  className="btn primary"
                  type="button"
                  disabled={state.busy || draft.conflict}
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
                  {room.type === "mentorship"
                    ? "Confirm mentoring agreement"
                    : "Lock terms & start"}
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
        <h2>
          {room.type === "mentorship" ? "Before you agree" : "Before you lock"}
        </h2>
        <p className="panel-subtitle">
          A shared understanding makes it easier to move forward.
        </p>
        <ul>
          <li>Agree on one clear outcome</li>
          <li>Define scope and deliverables</li>
          <li>Set a realistic timeline</li>
          <li>Confirm each person’s commitment</li>
          <li>
            {room.type === "mentorship"
              ? "Agree on preparation and any compensation"
              : "Make the exchange explicit"}
          </li>
        </ul>
      </aside>
    </div>
  );
}
