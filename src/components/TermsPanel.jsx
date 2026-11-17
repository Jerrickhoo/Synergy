import { useState } from "react";
import { useDraft } from "../state/useDraft.js";
import FormErrors from "./FormErrors.jsx";
import SelectField from "./SelectField.jsx";
import { useApp } from "../state/AppContext.jsx";
import defaultTemplates from "../data/engagement-templates.json" with { type: "json" };

const baseFields = (mentorship) => [
  ["goal", "Shared goal", "input"],
  ["scope", "Scope and deliverables", "textarea"],
  ["timeline", "Timeline", "input"],
  ["commitment", "Commitment", "input"],
  [
    "compensation",
    mentorship ? "Mentoring arrangement" : "Exchange",
    "input",
    mentorship
      ? "Record whether guidance is voluntary or any agreed compensation."
      : "What each side gives and gets.",
  ],
];

export const templateFields = (room) =>
  room.template?.fields?.length
    ? room.template.fields
    : defaultTemplates[room.type]?.fields || [];

function ChangeRequest({ room, partnerName }) {
  const { state, onAction } = useApp();
  const [note, setNote] = useState("");
  const request = room.terms.reopenRequest;
  const closed = ["launched", "reviewed", "cancelled"].includes(room.status);
  if (closed || !room.terms.locked) return null;
  if (request) {
    const mine = request.byAccountId !== room.partnerAccountId;
    return (
      <div className="info-note change-request" role="status">
        {mine ? (
          <>
            <p>
              You asked to change the agreed terms. They stay in force, and no
              confirmations are lost, until {partnerName} agrees.
            </p>
            <button
              className="btn small"
              disabled={state.busy}
              onClick={() => onAction({ action: "decline-reopen" })}
            >
              Withdraw request
            </button>
          </>
        ) : (
          <>
            <p>
              <strong>{partnerName} asked to change the agreed terms.</strong>
              {request.note ? ` “${request.note}”` : ""}
            </p>
            <p>
              If you agree, the terms become an editable draft and both of you
              confirm milestones again under the new terms.
            </p>
            <div className="chip-row">
              <button
                className="btn small primary"
                disabled={state.busy}
                onClick={() => onAction({ action: "accept-reopen" })}
              >
                Agree to reopen terms
              </button>
              <button
                className="btn small"
                disabled={state.busy}
                onClick={() => onAction({ action: "decline-reopen" })}
              >
                Keep current terms
              </button>
            </div>
          </>
        )}
      </div>
    );
  }
  return (
    <details className="propose-change">
      <summary>Propose changes to these terms</summary>
      <div className="grid section-gap">
        <p className="muted">
          {partnerName} must agree before anything changes. Until then the
          current terms and confirmations stay in place.
        </p>
        <label htmlFor="reopen-note">What needs to change? (optional)</label>
        <textarea
          id="reopen-note"
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <button
          className="btn small"
          type="button"
          disabled={state.busy}
          onClick={() => onAction({ action: "reopen-terms", values: { note } })}
        >
          Send change request
        </button>
      </div>
    </details>
  );
}

export default function TermsPanel({ room, agreement, partner }) {
  const { state, model, onAction, onSubmit } = useApp();
  const { roomStatusLabel } = model;
  const partnerName = partner?.name || "your collaborator";
  const mentorship = room.type === "mentorship";
  const draft = useDraft(
    `${state.accountId}:terms:${room.id}`,
    agreement.draft,
    agreement.revision || 0,
  );
  const readOnly =
    agreement.locked ||
    ["launched", "reviewed", "cancelled"].includes(room.status);
  const fields = [
    ...baseFields(mentorship).map(([id, label, kind, help]) => ({
      id,
      label,
      kind,
      help,
      required: true,
    })),
    ...templateFields(room).map((item) => ({
      id: item.id,
      label: item.label,
      kind: item.type === "select" ? "select" : "input",
      inputType: item.type === "select" ? undefined : item.type,
      options: item.options,
      placeholder: item.placeholder,
      help: item.help,
      required: false,
    })),
  ];
  const value = (id) =>
    (readOnly ? agreement.draft[id] : draft.values[id]) || "";
  const update = (id, next) => draft.update({ ...draft.values, [id]: next });
  const agreed = agreement.locked && agreement.partnerLocked;
  return (
    <div className={`terms-layout${agreed ? " agreed" : ""}`}>
      <section className="card panel room-content terms-form-panel">
        <div className="panel-head">
          <div>
            <h2>{agreed ? "Agreement" : "Terms & expectations"}</h2>
            <p className="panel-subtitle">
              {agreed
                ? `Agreed by you and ${partnerName}. This is what both of you committed to.`
                : mentorship
                  ? "Agree on the startup challenge, guidance, preparation and time commitment before your sessions."
                  : "Agree on a clear goal, scope, timeline, and exchange before work begins."}
            </p>
          </div>
          <span className={"status " + (agreed ? "green" : "")}>
            {agreed
              ? "Agreed by both"
              : agreement.locked
                ? roomStatusLabel("terms", partnerName, agreement.confirmedByMe)
                : "Draft"}
          </span>
        </div>
        <ChangeRequest room={room} partnerName={partnerName} />
        <form
          id="terms-form"
          className="grid"
          onSubmit={(event) => onSubmit(event)}
        >
          <input type="hidden" name="revision" value={draft.version} />
          {draft.conflict && (
            <div className="connection-banner" role="alert">
              Your collaborator changed these terms. Your draft is preserved
              below. Review the latest saved terms before saving or locking.
              <details>
                <summary>Latest saved terms</summary>
                {fields.map((item) =>
                  agreement.draft[item.id] ? (
                    <p key={item.id}>
                      <strong>{item.label}:</strong> {agreement.draft[item.id]}
                    </p>
                  ) : null,
                )}
              </details>
              <button type="button" className="btn" onClick={draft.clear}>
                Use latest terms
              </button>
            </div>
          )}
          {draft.dirty && !draft.conflict && !readOnly && (
            <p className="muted" role="status">
              Draft kept in this tab. Save it to share with {partnerName}.
            </p>
          )}
          <FormErrors scope="terms-form" />
          <div className="terms-fields">
            {fields.map((item) => {
              const helpId = item.help ? `term-${item.id}-help` : undefined;
              const common = {
                id: `term-${item.id}`,
                name: item.id,
                disabled: readOnly,
                required: item.required,
                "aria-describedby": helpId,
              };
              return (
                <div
                  className={`field${item.kind === "textarea" ? " wide" : ""}`}
                  key={item.id}
                >
                  <label htmlFor={`term-${item.id}`}>
                    {item.label}
                    {!item.required && !readOnly && (
                      <span className="field-optional"> Optional</span>
                    )}
                  </label>
                  {item.kind === "select" ? (
                    <SelectField
                      {...common}
                      value={value(item.id)}
                      onChange={(event) => update(item.id, event.target.value)}
                    >
                      <option value="">Not decided yet</option>
                      {item.options.map(([optionValue, optionLabel]) => (
                        <option key={optionValue} value={optionValue}>
                          {optionLabel}
                        </option>
                      ))}
                    </SelectField>
                  ) : item.kind === "textarea" ? (
                    <textarea
                      {...common}
                      value={value(item.id)}
                      onChange={(event) => update(item.id, event.target.value)}
                    />
                  ) : (
                    <input
                      {...common}
                      type={item.inputType || "text"}
                      min={item.inputType === "number" ? 1 : undefined}
                      placeholder={readOnly ? undefined : item.placeholder}
                      value={value(item.id)}
                      onChange={(event) => update(item.id, event.target.value)}
                    />
                  )}
                  {item.help && (
                    <p className="field-help" id={helpId}>
                      {item.help}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="terms-actions">
            {room.status === "cancelled" ? (
              <span className="status">This collaboration is closed.</span>
            ) : !agreement.locked ? (
              <>
                <button
                  className="btn"
                  type="submit"
                  disabled={state.busy || draft.conflict}
                >
                  Save draft
                </button>
                <button
                  className="btn primary"
                  type="button"
                  disabled={state.busy || draft.conflict}
                  data-action="lock-terms"
                  onClick={(event) =>
                    onAction(
                      {
                        action: "lock-terms",
                      },
                      event,
                    )
                  }
                >
                  Send for {partnerName}’s approval
                </button>
              </>
            ) : agreement.partnerLocked ? null : !agreement.confirmedByMe ? (
              <button
                className="btn primary"
                type="button"
                disabled={state.busy}
                onClick={() => onAction({ action: "accept-terms" })}
              >
                Accept these terms
              </button>
            ) : (
              <span className="status">
                Waiting for {partnerName} to accept
              </span>
            )}
          </div>
        </form>
      </section>
      {!agreement.locked && (
        <aside className="card panel before-lock">
          <h2>{mentorship ? "Before you agree" : "Before you send"}</h2>
          <p className="panel-subtitle">
            Clear terms prevent the “we never agreed on that” problem.
          </p>
          <ul>
            <li>Agree on one clear outcome</li>
            <li>Define scope and deliverables</li>
            <li>Set a realistic timeline</li>
            <li>Confirm each person’s commitment</li>
            <li>
              {mentorship
                ? "Agree on the format, preparation and any compensation"
                : "Make the exchange explicit"}
            </li>
          </ul>
        </aside>
      )}
    </div>
  );
}
