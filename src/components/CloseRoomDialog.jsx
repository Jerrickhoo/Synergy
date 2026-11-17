import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Overlay from "./Overlay.jsx";
import SelectField from "./SelectField.jsx";
import FormErrors from "./FormErrors.jsx";
import { closeCategories } from "../data/collaboration.js";

// Closing is final, so the founder states why. Who closed and why decides
// whose follow-through record it affects (D6).
export default function CloseRoomDialog({ partnerName, onClose }) {
  const { state, onSubmit } = useApp();
  const [category, setCategory] = useState("");
  const consequence = {
    mutual: "Neither record is affected.",
    unresponsive: `This counts against ${partnerName}'s follow-through, not yours. Use it only if they have not replied after a nudge.`,
    "not-relevant": "Neither record is affected.",
    other: "This counts as closed early on both records.",
  }[category];
  return (
    <Overlay
      id="close-room-dialog"
      title="Close this collaboration?"
      onClose={onClose}
      busy={state.busy}
      initialFocusSelector="#close-category"
      footer={
        <>
          <button className="btn" disabled={state.busy} onClick={onClose}>
            Keep it open
          </button>
          <button
            className="btn danger"
            type="submit"
            form="close-room-form"
            disabled={state.busy || !category}
          >
            Close collaboration
          </button>
        </>
      }
    >
      <p>
        {partnerName} will be notified. The agreement, evidence and chat stay
        available, but no more work can be confirmed.
      </p>
      <form
        id="close-room-form"
        data-form="close-room"
        className="grid"
        onSubmit={async (event) => {
          if (await onSubmit(event)) onClose();
        }}
      >
        <FormErrors scope="close-room" />
        <SelectField
          id="close-category"
          name="category"
          label="Why are you closing it?"
          value={category}
          required
          onChange={(event) => setCategory(event.target.value)}
          options={[
            { value: "", label: "Choose a reason" },
            ...Object.entries(closeCategories).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        {consequence && <p className="info-note">{consequence}</p>}
        <div className="field">
          <label htmlFor="close-reason">
            Details{category === "other" ? "" : " (optional)"}
          </label>
          <textarea
            id="close-reason"
            name="reason"
            maxLength={3000}
            required={category === "other"}
          />
        </div>
      </form>
    </Overlay>
  );
}
