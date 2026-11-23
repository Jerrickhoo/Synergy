import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";
import TagProposal from "./TagProposal.jsx";

export default function CommunityRequests() {
  const { state } = useApp();
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
          <TagProposal />
        </section>
      </div>
    </details>
  );
}
