import { useApp } from "../state/AppContext.jsx";
import FormErrors from "./FormErrors.jsx";

const tagStatus = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Not added",
};

// The moderated "propose a tag" path, shared by Profile (Standard tags) and
// the mentor application's Expertise step (Nov 22, round 2). A moderator
// approves a proposal before it joins the shared vocabulary.
export default function TagProposal({
  id = "tag-label",
  label = "Proposed tag",
}) {
  const { state, onSubmit } = useApp();
  const mine = state.myTagProposals || [];
  return (
    <>
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
      <form
        data-form="tag-proposal"
        className="grid"
        onSubmit={async (event) => {
          const form = event.currentTarget;
          if (await onSubmit(event)) form.reset();
        }}
      >
        <FormErrors scope="tag-proposal" />
        <div className="field">
          <label htmlFor={id}>{label}</label>
          <input id={id} name="label" minLength={3} maxLength={60} required />
        </div>
        <button className="btn" disabled={state.busy}>
          {state.busy && <span className="spinner" aria-hidden="true" />}
          Propose tag
        </button>
      </form>
    </>
  );
}
