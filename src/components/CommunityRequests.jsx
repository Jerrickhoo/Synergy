import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";
import FormErrors from "./FormErrors.jsx";

const tagStatus = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Not added",
};

export default function CommunityRequests() {
  const { state, onSubmit } = useApp();
  const mine = state.myTagProposals || [];
  return (
    <details
      className="card community-accordion section-gap"
      open={mine.some((tag) => tag.status === "pending") || undefined}
    >
      <summary className="interactive-surface">
        <span>Standard tags</span>
        <Icon name="chevron" />
      </summary>
      <div className="community-accordion-body">
        <section aria-labelledby="community-tags-heading">
          <h3 id="community-tags-heading">Propose a new tag</h3>
          <p>
            Approved tags: {(state.vocabulary || []).join(", ")}. If none fits,
            propose one. A moderator reviews it before it joins the shared list,
            and you are told the outcome.
          </p>
          {mine.length > 0 && (
            <ul className="tag-proposals" aria-label="Your proposed tags">
              {mine.map((tag) => (
                <li key={tag.id}>
                  <strong>{tag.label}</strong>
                  <span
                    className={`status ${tag.status === "approved" ? "green" : ""}`}
                  >
                    {tagStatus[tag.status] || tag.status}
                  </span>
                  {tag.note && tag.status !== "pending" && (
                    <span className="muted">{tag.note}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form data-form="tag-proposal" className="grid" onSubmit={onSubmit}>
            <FormErrors scope="tag-proposal" />
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
        </section>
      </div>
    </details>
  );
}
