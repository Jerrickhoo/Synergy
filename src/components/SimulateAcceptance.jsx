import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";

export default function SimulateAcceptance({ person }) {
  const { state, onAction } = useApp();
  const [failed, setFailed] = useState(false);
  if (!person.canSimulateAcceptance) return null;
  return (
    <div className="prototype-acceptance">
      <p className="field-help">
        Prototype only: simulate this fictional collaborator accepting your
        introduction.
      </p>
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
          Could not simulate acceptance. Refresh the introduction and try again.
        </p>
      )}
    </div>
  );
}
