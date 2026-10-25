import { useApp } from "../state/AppContext.jsx";
export default function BlockCollaborator({ person }) {
  const { state, integrationRequest, onAction } = useApp();
  return (
    <details className="section-gap">
      <summary>Block this collaborator</summary>
      <p>
        Block {person.name} from discovery and further chat. Pending
        introductions are withdrawn and unfinished rooms between you will close.
        Shared history remains available.
      </p>
      <button
        className="btn danger"
        disabled={state.busy}
        onClick={async () => {
          try {
            await integrationRequest("account/block", {
              accountId: person.accountId,
              blocked: true,
            });
            await onAction({ page: "settings" });
          } catch {
            /* Request feedback is shown by the provider. */
          }
        }}
      >
        Block and close unfinished rooms
      </button>
    </details>
  );
}
