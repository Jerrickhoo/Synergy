import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Overlay from "./Overlay.jsx";

// Declining is final for that request, so it is confirmed first and can
// carry a short, optional reason for the sender.
export default function DeclineIntroduction({
  person,
  className = "btn full",
}) {
  const { state, onAction } = useApp();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <>
      <button
        className={className}
        disabled={state.busy}
        onClick={() => setOpen(true)}
      >
        Decline
        <span className="visually-hidden"> {person.name}’s request</span>
      </button>
      {open && (
        <Overlay
          id={`decline-${person.id}`}
          title={`Decline ${person.name}’s request?`}
          onClose={() => setOpen(false)}
          busy={state.busy}
          initialFocusSelector={`#decline-reason-${CSS.escape(person.id)}`}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={state.busy}
                onClick={async () => {
                  if (
                    await onAction({
                      action: "decline-interest",
                      id: person.id,
                      values: { reason },
                    })
                  )
                    setOpen(false);
                }}
              >
                Decline request
              </button>
            </>
          }
        >
          <p>
            {person.name} will be told you declined. Declining does not affect
            anyone’s trust record.
          </p>
          <div className="field">
            <label htmlFor={`decline-reason-${person.id}`}>
              Reason for {person.name} (optional)
            </label>
            <textarea
              id={`decline-reason-${person.id}`}
              maxLength={280}
              value={reason}
              placeholder="For example: we are not taking on new partners this month"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </Overlay>
      )}
    </>
  );
}
