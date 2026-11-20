import { useRef, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Overlay from "./Overlay.jsx";
import SelectField from "./SelectField.jsx";

export default function ReportCollaborator({
  person,
  initialOpen = false,
  messageId,
  compact = false,
  quiet = false,
  onClose,
}) {
  const { state, onSubmit, onAction } = useApp();
  const [open, setOpen] = useState(initialOpen);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  if (!person) return null;
  const close = () => {
    if (submitting.current) return;
    setOpen(false);
    setSuccess(false);
    setError("");
    onClose?.();
  };
  return (
    <>
      {!initialOpen && (
        <button
          className={compact ? "link-btn" : quiet ? "btn" : "btn full"}
          onClick={() => {
            onAction({ action: "clear-form-errors", scope: "report-form" });
            setError("");
            setSuccess(false);
            setOpen(true);
          }}
        >
          {compact ? "Report" : "Report collaborator"}
        </button>
      )}
      {open && (
        <Overlay
          id="report-collaborator-dialog"
          title={`Report ${person.name}`}
          onClose={close}
          busy={state.busy}
          initialFocusSelector="#cancel-report"
          footer={
            success ? (
              <button className="btn primary" autoFocus onClick={close}>
                Done
              </button>
            ) : (
              <>
                <button
                  id="cancel-report"
                  className="btn"
                  disabled={state.busy}
                  onClick={close}
                >
                  Cancel
                </button>
                <button
                  className="btn primary"
                  form="collaborator-report-form"
                  type="submit"
                  disabled={state.busy}
                >
                  {state.busy ? "Submitting…" : "Submit report"}
                </button>
              </>
            )
          }
        >
          {success ? (
            <p role="status">
              Your report was saved for moderator review. Reporting does not
              block this collaborator.
            </p>
          ) : (
            <>
              <p>
                Report a concern about {person.name} privately to workspace
                moderators. Reporting and blocking are separate actions.
              </p>
              <form
                id="collaborator-report-form"
                data-form="report-form"
                className="grid"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (submitting.current) return;
                  submitting.current = true;
                  setError("");
                  try {
                    if (await onSubmit(event)) setSuccess(true);
                    else
                      setError(
                        "Your report was not submitted. Check the reason and try again.",
                      );
                  } finally {
                    submitting.current = false;
                  }
                }}
              >
                <input type="hidden" name="profileId" value={person.id} />
                {messageId && (
                  <input type="hidden" name="messageId" value={messageId} />
                )}
                <SelectField
                  id="report-reason"
                  name="reason"
                  label="Reason"
                  required
                  defaultValue=""
                  options={[
                    { value: "", label: "Choose a reason" },
                    {
                      value: "Harassment or abusive behavior",
                      label: "Harassment or abusive behavior",
                    },
                    {
                      value: "Ghosting or unresponsive",
                      label: "Stopped responding (ghosting)",
                    },
                    {
                      value: "Bad-faith engagement",
                      label: "Bad-faith engagement or broken commitments",
                    },
                    { value: "Spam or scam", label: "Spam or scam" },
                    {
                      value: "Misleading profile or impersonation",
                      label: "Misleading profile or impersonation",
                    },
                    { value: "Privacy concern", label: "Privacy concern" },
                    {
                      value: "Other safety concern",
                      label: "Other safety concern",
                    },
                  ]}
                />
                <div className="field">
                  <label htmlFor="report-details">Details (optional)</label>
                  <textarea
                    id="report-details"
                    name="details"
                    maxLength={3000}
                  />
                </div>
                {error && (
                  <p className="account-action-error" role="alert">
                    {error}
                  </p>
                )}
              </form>
            </>
          )}
        </Overlay>
      )}
    </>
  );
}
