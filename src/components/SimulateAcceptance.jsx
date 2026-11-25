import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import PrototypeShortcut from "./PrototypeShortcut.jsx";

// `sent` names what the founder sent: an introduction to a startup or a
// mentorship request to a mentor. Either way, acceptance opens the room.
export default function SimulateAcceptance({ person, sent = "introduction" }) {
  const { state, onAction } = useApp();
  const [failed, setFailed] = useState(false);
  if (!person.canSimulateAcceptance) return null;
  return (
    <PrototypeShortcut
      note={`${person.name} is fictional. Simulate them accepting your ${sent}.`}
    >
      <button
        className="btn small"
        aria-label={`Simulate acceptance from ${person.name}`}
        disabled={state.busy}
        onClick={async () => {
          setFailed(false);
          if (
            !(await onAction({ action: "simulate-acceptance", id: person.id }))
          )
            setFailed(true);
        }}
      >
        {state.busy ? "Connecting…" : "Simulate acceptance"}
      </button>
      {failed && (
        <p className="field-error" role="alert">
          Could not simulate acceptance. Refresh the {sent} and try again.
        </p>
      )}
    </PrototypeShortcut>
  );
}
