import { useApp } from "../state/AppContext.jsx";
export default function CommunityRequests() {
  const { state, onSubmit } = useApp();
  return (
    <details className="card panel section-gap">
      <summary>Affiliation verification and community tags</summary>
      {!state.integrations?.moderation && (
        <p className="muted">
          A workspace owner must configure moderator access before pending
          requests can be reviewed.
        </p>
      )}
      <h3>Verify an affiliation</h3>
      <p>
        A moderator checks your organization or program evidence before awarding
        an affiliation badge. Email verification alone does not establish
        affiliation.
      </p>
      {state.affiliation && (
        <p role="status">
          {state.affiliation.organization}: {state.affiliation.status}
          {state.affiliation.note && ` · ${state.affiliation.note}`}
        </p>
      )}
      <form
        data-form="affiliation-request"
        className="grid"
        onSubmit={onSubmit}
      >
        <div className="field">
          <label htmlFor="affiliation-org">Organization or program</label>
          <input
            id="affiliation-org"
            name="organization"
            required
            maxLength={150}
          />
        </div>
        <div className="field">
          <label htmlFor="affiliation-evidence">Affiliation evidence</label>
          <textarea
            id="affiliation-evidence"
            name="evidence"
            required
            maxLength={3000}
            placeholder="Provide a public roster link or describe how the moderator can verify your affiliation."
          />
        </div>
        <button className="btn" disabled={state.busy}>
          Request affiliation verification
        </button>
      </form>
      <h3 className="section-gap">Propose a new tag</h3>
      <p>
        Approved tags: {(state.vocabulary || []).join(", ")}. New tags are
        reviewed before joining the shared vocabulary.
      </p>
      <form data-form="tag-proposal" className="grid" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="tag-label">Proposed tag</label>
          <input
            id="tag-label"
            name="label"
            minLength={3}
            maxLength={60}
            required
          />
        </div>
        <button className="btn" disabled={state.busy}>
          Propose tag
        </button>
      </form>
    </details>
  );
}
