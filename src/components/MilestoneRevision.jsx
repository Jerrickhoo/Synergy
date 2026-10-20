import { useApp } from "../state/AppContext.jsx";

export default function MilestoneRevision({ id, item, closed }) {
  const { state, onSubmit } = useApp();
  const proposal = item.proposal;
  const mine = proposal?.proposedBy === state.accountId;
  return (
    <>
      {proposal && (
        <div className="revision-proposal section-gap" role="status">
          <h4>Proposed milestone revision</h4>
          <p>
            <strong>{proposal.title}</strong>
          </p>
          <p>{proposal.description}</p>
          <p className="muted">
            The current scope stays in place until both collaborators agree.
            Accepting clears this milestone’s confirmations and preserves its
            evidence.
          </p>
          {!closed && (
            <form
              data-form="milestone-decision"
              data-id={id}
              onSubmit={onSubmit}
            >
              <input type="hidden" name="proposalId" value={proposal.id} />
              <label htmlFor={`decision-${id}`}>Revision decision</label>
              <select name="decision" id={`decision-${id}`}>
                {mine ? (
                  <option value="withdraw">Withdraw my proposal</option>
                ) : (
                  <>
                    <option value="accept">
                      Accept revised title and scope
                    </option>
                    <option value="reject">Reject proposal</option>
                  </>
                )}
              </select>
              <button className="btn small" disabled={state.busy}>
                Save revision decision
              </button>
            </form>
          )}
        </div>
      )}
      {!closed && !proposal && (
        <details className="section-gap">
          <summary>Propose title or scope revision</summary>
          <form
            key={item.revision || 0}
            data-form="milestone-proposal"
            data-id={id}
            onSubmit={onSubmit}
            className="grid section-gap"
          >
            <input type="hidden" name="revision" value={item.revision || 0} />
            <label htmlFor={`revision-title-${id}`}>Milestone title</label>
            <input
              id={`revision-title-${id}`}
              name="title"
              required
              maxLength={120}
              defaultValue={item.title}
            />
            <label htmlFor={`revision-scope-${id}`}>Milestone scope</label>
            <textarea
              id={`revision-scope-${id}`}
              name="description"
              required
              maxLength={2000}
              defaultValue={item.description}
            />
            <button className="btn small" disabled={state.busy}>
              Send revision for approval
            </button>
          </form>
        </details>
      )}
      {item.revisions?.length > 0 && (
        <details className="section-gap">
          <summary>Revision history ({item.revisions.length})</summary>
          {item.revisions.map((revision) => (
            <div key={revision.id} className="section-gap">
              <p>
                {revision.decision} · {revision.decidedAt.slice(0, 10)}
              </p>
              <p>
                Previous: {revision.previousTitle} —{" "}
                {revision.previousDescription}
              </p>
              <p>
                Proposed: {revision.title} — {revision.description}
              </p>
            </div>
          ))}
        </details>
      )}
    </>
  );
}
