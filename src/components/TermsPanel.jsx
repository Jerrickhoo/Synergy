import { useEffect, useRef, useState } from "react";
import { useDraft } from "../state/useDraft.js";
import FormErrors from "./FormErrors.jsx";
import SelectField from "./SelectField.jsx";
import Icon from "./Icon.jsx";
import WorkspaceCalendar from "./WorkspaceCalendar.jsx";
import { useApp } from "../state/AppContext.jsx";
import { dateFromKey, localDateKey } from "../data/planning.js";
import {
  commitmentChoices,
  dayLabel,
  timelineDates,
  timelineText,
} from "../data/terms.js";
import defaultTemplates from "../data/engagement-templates.json" with { type: "json" };

// A term as people read it: dates as a range, a choice by its label.
const shownValue = (item, raw) =>
  item.kind === "daterange"
    ? timelineText(raw)
    : item.kind === "select"
      ? item.options.find(([option]) => option === raw)?.[1] || raw
      : raw;

// Like a booking site: one calendar opens from the Starts → Ends field. The
// first day chosen starts the range and the next one ends it; an earlier
// day, or any day once both are set, starts a new range.
function TimelineField({ value, onChange, helpId }) {
  const { start, end, written } = timelineDates(value);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState("");
  const [month, setMonth] = useState(() =>
    start ? dateFromKey(start) : new Date(),
  );
  const wrapper = useRef(null);
  const trigger = useRef(null);
  const today = localDateKey(new Date());
  const pickingEnd = Boolean(start && !end);
  const close = () => {
    setOpen(false);
    setHover("");
    trigger.current?.focus();
  };
  const choose = (key) => {
    if (pickingEnd && key >= start) {
      onChange(`${start} to ${key}`);
      close();
    } else onChange(`${key} to `);
  };
  // A click anywhere else closes the calendar, as a menu would.
  useEffect(() => {
    if (!open) return undefined;
    const away = (event) => {
      if (!wrapper.current?.contains(event.target)) {
        setOpen(false);
        setHover("");
      }
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  return (
    <div
      className="field wide timeline-field"
      ref={wrapper}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <label id="term-timeline-label" htmlFor="term-timeline">
        Timeline
      </label>
      <button
        ref={trigger}
        type="button"
        id="term-timeline"
        className="date-range-trigger"
        aria-labelledby="term-timeline-label term-timeline"
        aria-describedby={written ? helpId : undefined}
        aria-expanded={open}
        aria-controls="term-timeline-picker"
        onClick={() => {
          if (!open && start) setMonth(dateFromKey(start));
          setOpen(!open);
        }}
      >
        <span className="date-range-part">
          <span className="date-range-caption">Starts</span>
          <span className={`date-range-value${start ? "" : " is-empty"}`}>
            {start ? dayLabel(start) : "Add a date"}
          </span>
        </span>
        <span className="date-range-arrow" aria-hidden="true">
          →
        </span>
        <span className="date-range-part">
          <span className="date-range-caption">Ends</span>
          <span className={`date-range-value${end ? "" : " is-empty"}`}>
            {end ? dayLabel(end) : "Add a date"}
          </span>
        </span>
        <Icon name="calendar" />
      </button>
      {open && (
        <div
          className="date-range-popover"
          id="term-timeline-picker"
          role="group"
          aria-label="Timeline dates"
          onMouseLeave={() => setHover("")}
        >
          <p className="date-range-step" aria-live="polite">
            {pickingEnd
              ? `Starts ${dayLabel(start)}. Now choose the end date.`
              : "Choose the start date."}
          </p>
          <WorkspaceCalendar
            variant="picker"
            month={month}
            onMonthChange={setMonth}
            selected={end || start}
            onSelect={choose}
            onDayHover={setHover}
            minDate={start && start < today ? start : today}
            range={{
              start,
              end: end || (pickingEnd && hover >= start ? hover : ""),
            }}
          />
          <div className="date-range-actions">
            {(start || end) && (
              <button
                type="button"
                className="link-btn"
                onClick={() => onChange("")}
              >
                Clear dates
              </button>
            )}
            <button type="button" className="btn small" onClick={close}>
              Done
            </button>
          </div>
        </div>
      )}
      {/* A failed submit marks the Starts → Ends field. */}
      <input
        type="hidden"
        name="timeline"
        value={value}
        data-select-trigger="term-timeline"
      />
      {written && (
        <p className="field-help" id={helpId}>
          Written before as “{written}”. Choose the dates to replace it.
        </p>
      )}
    </div>
  );
}

const baseFields = (mentorship) => [
  ["goal", "Shared goal", "input"],
  ["scope", "Scope and deliverables", "textarea"],
  ["timeline", "Timeline", "daterange"],
  ["commitment", "Commitment", "commitment"],
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

const termPlaceholders = (room) =>
  defaultTemplates[room.type]?.termPlaceholders || {};

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
      // Examples for the shared terms, per collaboration type.
      placeholder: termPlaceholders(room)[id],
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
  // One term's control: dates for the timeline, a choice for the
  // commitment, and the template's own fields.
  const renderField = (item) => {
    if (item.kind === "daterange")
      return (
        <TimelineField
          key={item.id}
          value={value(item.id)}
          helpId={`term-${item.id}-help`}
          onChange={(next) => update(item.id, next)}
        />
      );
    if (item.kind === "commitment") {
      const current = value(item.id);
      const choices =
        commitmentChoices.includes(current) || !current
          ? commitmentChoices
          : [...commitmentChoices, current];
      return (
        <div className="field" key={item.id}>
          <label htmlFor={`term-${item.id}`}>{item.label}</label>
          <SelectField
            id={`term-${item.id}`}
            name={item.id}
            required
            value={current}
            onChange={(event) => update(item.id, event.target.value)}
          >
            <option value="" disabled>
              Choose how much time
            </option>
            {choices.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </SelectField>
        </div>
      );
    }

    const helpId = item.help ? `term-${item.id}-help` : undefined;
    const common = {
      id: `term-${item.id}`,
      name: item.id,
      required: item.required,
      "aria-describedby": helpId,
    };
    return (
      <div
        className={`field${item.kind === "textarea" ? " wide" : ""}`}
        key={item.id}
      >
        <label htmlFor={`term-${item.id}`}>{item.label}</label>
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
            placeholder={item.placeholder}
            value={value(item.id)}
            onChange={(event) => update(item.id, event.target.value)}
          />
        ) : (
          <input
            {...common}
            type={item.inputType || "text"}
            min={item.inputType === "number" ? 1 : undefined}
            placeholder={item.placeholder}
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
  };

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
                      <strong>{item.label}:</strong>{" "}
                      {shownValue(item, agreement.draft[item.id])}
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
          {readOnly ? (
            // Agreed and sent terms read as text, so nothing is cut off and
            // nothing looks editable.
            <dl className="terms-fields terms-agreed">
              {fields
                .filter((item) => item.required || value(item.id))
                .map((item) => {
                  const shown = shownValue(item, value(item.id));
                  return (
                    <div
                      className={`field${item.kind === "textarea" ? " wide" : ""}`}
                      key={item.id}
                    >
                      <dt id={`term-${item.id}-label`}>{item.label}</dt>
                      <dd
                        id={`term-${item.id}`}
                        className="preserve-lines"
                        aria-labelledby={`term-${item.id}-label`}
                      >
                        {shown || "Not set"}
                      </dd>
                    </div>
                  );
                })}
            </dl>
          ) : (
            <>
              <div className="terms-fields">
                {fields.filter((item) => item.required).map(renderField)}
              </div>
              {/* Optional, type-specific terms fold away until wanted. */}
              {fields.some((item) => !item.required) && (
                <details
                  className="terms-more"
                  open={fields.some((item) => !item.required && value(item.id))}
                >
                  <summary>More details (optional)</summary>
                  <div className="terms-fields">
                    {fields.filter((item) => !item.required).map(renderField)}
                  </div>
                </details>
              )}
            </>
          )}
          <div className="terms-actions">
            {room.status === "cancelled" ? (
              <span className="status">This collaboration is closed.</span>
            ) : !agreement.locked ? (
              <>
                {/* A draft may be partial, so this save skips the required
                    checks; sending for approval still needs every term. */}
                <button
                  className="btn"
                  type="submit"
                  formNoValidate
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
