import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Icon from "../components/Icon.jsx";
import FormErrors from "./FormErrors.jsx";
import Overlay from "./Overlay.jsx";
import SelectField from "./SelectField.jsx";
import MilestoneRevision from "./MilestoneRevision.jsx";
import { templateFields } from "./TermsPanel.jsx";
import {
  launchBlockers,
  milestoneDate,
  scheduleLabel,
} from "../data/selectors.js";
import { formatDate } from "../data/dates.js";

function blockedReason(room, agreement, id, item) {
  if (!agreement.locked || !agreement.partnerLocked)
    return "Available once both of you accept the terms.";
  if (item.disputed) return "Resolve the dispute first.";
  if (room.cycle && !room.cycle.goals?.trim())
    return "Add goals for this cycle first.";
  if (item.proposal) return "Decide on the proposed change first.";
  if (room.type === "mentorship" && id === "session" && !item.schedule)
    return "Schedule the session first.";
  if (item.evidence && !item.attachment)
    return "Attach proof to mark this done.";
  return "";
}

function DisputeDialog({ id, item, onClose }) {
  const { state, onAction } = useApp();
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState("");
  return (
    <Overlay
      id={`dispute-dialog-${id}`}
      title={`Flag a dispute on “${item.title}”`}
      onClose={onClose}
      busy={state.busy}
      initialFocusSelector={`#dispute-reason-${id}`}
      footer={
        <>
          <button className="btn" disabled={state.busy} onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={state.busy || !reason.trim()}
            onClick={async () => {
              if (
                await onAction({
                  action: "dispute",
                  id,
                  values: { reason, outcome },
                })
              )
                onClose();
            }}
          >
            Flag dispute
          </button>
        </>
      }
    >
      <p>
        Use this when you disagree that the work was done. Your collaborator
        sees your reason. If you cannot settle it together, either of you can
        send it to a moderator.
      </p>
      <form className="grid" onSubmit={(event) => event.preventDefault()}>
        <FormErrors scope={`dispute-${id}`} />
        <div className="field">
          <label htmlFor={`dispute-reason-${id}`}>What is disputed?</label>
          <textarea
            id={`dispute-reason-${id}`}
            name="reason"
            required
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`dispute-outcome-${id}`}>
            What outcome would settle it? (optional)
          </label>
          <textarea
            id={`dispute-outcome-${id}`}
            name="outcome"
            maxLength={1000}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          />
        </div>
      </form>
    </Overlay>
  );
}

function OrderDialog({ title, earlier, onConfirm, onClose }) {
  const { state } = useApp();
  return (
    <Overlay
      id="milestone-order-dialog"
      title="Earlier milestones are not done yet"
      onClose={onClose}
      busy={state.busy}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Go back
          </button>
          <button
            className="btn primary"
            disabled={state.busy}
            onClick={onConfirm}
          >
            Mark as done anyway
          </button>
        </>
      }
    >
      <p>
        “{earlier}” comes before “{title}” and has not been marked done. Work
        can overlap, so you can continue. This is noted in the room history.
      </p>
    </Overlay>
  );
}

function EvidenceForms({ id, item }) {
  const { state, onSubmit, onUpload } = useApp();
  const [uploadError, setUploadError] = useState("");
  const confirmed = item.me || item.partner;
  return (
    <div className="evidence-options">
      {confirmed && (
        <p className="warning-note">
          Adding proof clears both confirmations so you can both review it.
        </p>
      )}
      <form
        className="inline-evidence"
        data-id={id}
        onSubmit={async (event) => {
          setUploadError("");
          const result = await onUpload(event);
          if (result !== true && result) setUploadError(result);
        }}
      >
        <label htmlFor={`file-${id}`}>Proof file (up to 5 MB)</label>
        <input
          id={`file-${id}`}
          name="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
          required
          aria-describedby={`file-${id}-help${uploadError ? ` file-${id}-error` : ""}`}
          aria-invalid={uploadError ? "true" : undefined}
          onChange={() => setUploadError("")}
        />
        <p className="muted" id={`file-${id}-help`}>
          PDF, images or text. Only you and your collaborator can download it.
        </p>
        {uploadError && (
          <p className="inline-error" id={`file-${id}-error`} role="alert">
            {uploadError}
          </p>
        )}
        <button
          className="btn small primary"
          type="submit"
          disabled={state.busy}
        >
          Upload file
        </button>
      </form>
      <form
        className="inline-evidence"
        data-form="evidence"
        data-id={id}
        onSubmit={(event) => onSubmit(event)}
      >
        <FormErrors scope={`evidence-${id}`} />
        <label htmlFor={`evidence-${id}`}>Or add a link or description</label>
        <input
          id={`evidence-${id}`}
          name="attachment"
          placeholder="Link or short description"
          required
        />
        <button
          className="btn small primary"
          type="submit"
          disabled={state.busy}
        >
          Add proof
        </button>
      </form>
    </div>
  );
}

function Milestone({ room, agreement, partnerName, id, item, index, current }) {
  const { state, onAction, onSubmit, downloadFile } = useApp();
  const [disputing, setDisputing] = useState(false);
  const [ordering, setOrdering] = useState(null);
  const [sendingBack, setSendingBack] = useState(false);
  const closed =
    ["launched", "reviewed", "cancelled"].includes(room.status) ||
    (room.cycle?.phase === "review" &&
      Object.keys(room.cycle.reviews || {}).length > 0);
  const entries = Object.entries(room.milestones);
  const blocked = blockedReason(room, agreement, id, item);
  const both = item.me && item.partner;
  const status = both
    ? "Confirmed by both"
    : item.me
      ? `You marked it done · waiting for ${partnerName}`
      : item.partner
        ? `${partnerName} marked it done · your confirmation is needed`
        : "Not started";
  const owner =
    item.ownerAccountId === "both"
      ? "Both of you"
      : item.ownerAccountId === state.accountId
        ? "You"
        : item.ownerAccountId === room.partnerAccountId
          ? partnerName
          : "";
  const proof = item.evidenceItems?.length
    ? item.evidenceItems
    : item.attachment
      ? [{ label: item.attachment, file: item.file }]
      : [];
  const earlier = entries
    .slice(0, index)
    .find(([, other]) => !other.me && !(other.me && other.partner));
  const confirm = () =>
    onAction({ action: "confirm-milestone", id }).then(() => setOrdering(null));
  const mine = item.dispute?.byAccountId === state.accountId;
  return (
    <li
      className={`milestone${current ? " current" : ""}${both ? " done" : ""}`}
      id={`milestone-${id}`}
      aria-current={current ? "step" : undefined}
    >
      <span className={"milestone-check " + (both ? "confirmed" : "")}>
        {both ? <Icon name="check" /> : ""}
      </span>
      <div className="milestone-main">
        <h3 className="milestone-title">
          {item.title}
          {item.evidence && <span className="proof-label">Proof needed</span>}
          {current && <span className="next-label">Next</span>}
        </h3>
        <p className="milestone-note">{item.description}</p>
        <p className="milestone-status">
          <span>{status}</span>
          {owner && <span>Owner: {owner}</span>}
          {item.dueDate && <span>Due {milestoneDate(item.dueDate)}</span>}
          {item.disputed && (
            <span className="status dispute-chip">Disputed</span>
          )}
        </p>
        {item.disputed && (
          <div className="dispute-box" role="status">
            <p>
              <strong>
                {mine
                  ? "You flagged a dispute"
                  : `${partnerName} flagged a dispute`}
                :
              </strong>{" "}
              {item.dispute?.reason || "No reason was recorded."}
            </p>
            {item.dispute?.outcome && (
              <p>Wanted outcome: {item.dispute.outcome}</p>
            )}
            {item.dispute?.escalatedAt && (
              <p className="muted">
                With a moderator since {formatDate(item.dispute.escalatedAt)}.
                They aim to decide within 3 business days.
                {item.dispute.dueAt && (
                  <>
                    {" "}
                    Decision due by {formatDate(item.dispute.dueAt)}
                    {Date.now() > Date.parse(item.dispute.dueAt)
                      ? " · Overdue"
                      : ""}
                    .
                  </>
                )}
              </p>
            )}
            {!closed && (
              <div className="chip-row">
                {mine ? (
                  <button
                    className="btn small"
                    disabled={state.busy}
                    onClick={() => onAction({ action: "withdraw-dispute", id })}
                  >
                    Withdraw dispute
                  </button>
                ) : (
                  <button
                    className="btn small"
                    disabled={state.busy || item.resolvedByMe}
                    onClick={() => onAction({ action: "resolve-dispute", id })}
                  >
                    {item.resolvedByMe
                      ? `Waiting for ${partnerName}`
                      : "Agree it is resolved"}
                  </button>
                )}
                {!item.dispute?.escalatedAt && (
                  <button
                    className="btn small"
                    disabled={state.busy}
                    onClick={() => onAction({ action: "escalate-dispute", id })}
                  >
                    Send to a moderator
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <MilestoneRevision
          id={id}
          item={item}
          closed={closed}
          part="proposal"
        />
        {room.type === "mentorship" && id === "session" && (
          <div className="chip-row">
            {(item.schedules || (item.schedule ? [item.schedule] : [])).map(
              (schedule) => (
                <span className="evidence-chip" key={schedule.date}>
                  {scheduleLabel(schedule)}
                </span>
              ),
            )}
            {!closed && (
              <button
                className="btn small"
                type="button"
                disabled={state.busy}
                onClick={() =>
                  onAction({ action: "room-tab", tab: "schedule" })
                }
              >
                {item.schedule ? "Reschedule" : "Schedule session"}
              </button>
            )}
          </div>
        )}
        {proof.length > 0 && (
          <ul className="proof-list" aria-label={`Proof for ${item.title}`}>
            {proof.map((entry, proofIndex) => (
              <li key={proofIndex}>
                {entry.file ? (
                  <button
                    className="evidence-chip file-download"
                    onClick={() => downloadFile(entry.file)}
                  >
                    Download {entry.file.name} (
                    {Math.ceil(entry.file.size / 1024)} KB)
                  </button>
                ) : /^https?:\/\//.test(entry.label) ? (
                  <a
                    className="evidence-chip"
                    href={entry.label}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {entry.label}
                  </a>
                ) : (
                  <span className="evidence-chip">{entry.label}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {item.evidenceOpen && !closed && <EvidenceForms id={id} item={item} />}
        {sendingBack && (
          <form
            className="grid send-back"
            data-form="send-back"
            data-id={id}
            onSubmit={async (event) => {
              if (await onSubmit(event)) setSendingBack(false);
            }}
          >
            <FormErrors scope="send-back" />
            <label htmlFor={`send-back-${id}`}>What is still missing?</label>
            <textarea
              id={`send-back-${id}`}
              name="note"
              required
              maxLength={1000}
            />
            <p className="muted">
              This clears {partnerName}’s confirmation and posts your note in
              Chat. It is not a dispute.
            </p>
            <div className="chip-row">
              <button className="btn small primary" disabled={state.busy}>
                Send back
              </button>
              <button
                className="btn small"
                type="button"
                onClick={() => setSendingBack(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {!closed && !item.me && blocked && (
          <p className="blocked-reason" id={`blocked-${id}`}>
            {blocked}
          </p>
        )}
      </div>
      <div className="milestone-actions">
        {!item.me ? (
          <button
            className={`btn small${!blocked && !closed ? " primary" : ""}`}
            data-action="confirm-milestone"
            disabled={state.busy || closed || Boolean(blocked)}
            aria-describedby={blocked ? `blocked-${id}` : undefined}
            onClick={() =>
              earlier ? setOrdering(earlier[1].title) : confirm()
            }
          >
            Mark as done
            <span className="visually-hidden">: {item.title}</span>
          </button>
        ) : (
          <span className={`status ${item.partner ? "green" : ""}`}>
            {item.partner ? "Confirmed" : `Waiting for ${partnerName}`}
          </span>
        )}
        {item.evidence && !closed && (
          <button
            className="btn small"
            data-action="evidence-toggle"
            data-id={id}
            aria-expanded={Boolean(item.evidenceOpen)}
            onClick={() => onAction({ action: "evidence-toggle", id })}
          >
            {proof.length ? "Add more proof" : "Attach proof"}
          </button>
        )}
        {!closed && (
          <details
            className="milestone-more"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary>
              More<span className="visually-hidden"> for {item.title}</span>
            </summary>
            <div className="milestone-more-menu">
              {item.partner && !item.me && (
                <button
                  className="link-btn"
                  onClick={() => setSendingBack(true)}
                >
                  Not done yet
                </button>
              )}
              <form
                data-form="milestone-date"
                data-id={id}
                onSubmit={onSubmit}
                className="schedule-form"
              >
                <label htmlFor={`due-${id}`}>Due date</label>
                <input
                  id={`due-${id}`}
                  type="date"
                  name="dueDate"
                  defaultValue={item.dueDate || ""}
                />
                <SelectField
                  id={`owner-${id}`}
                  name="owner"
                  label="Owner"
                  defaultValue={
                    item.ownerAccountId === "both"
                      ? "both"
                      : item.ownerAccountId === state.accountId
                        ? "me"
                        : item.ownerAccountId === room.partnerAccountId
                          ? "partner"
                          : ""
                  }
                  options={[
                    { value: "", label: "Not assigned" },
                    { value: "me", label: "Me" },
                    { value: "partner", label: partnerName },
                    { value: "both", label: "Both of us" },
                  ]}
                />
                <button className="btn small" disabled={state.busy}>
                  Save date and owner
                </button>
                <p className="muted">
                  Changing the date asks both of you to confirm again.
                </p>
              </form>
              <MilestoneRevision
                id={id}
                item={item}
                closed={closed}
                part="form"
              />
              {!item.disputed && agreement.partnerLocked && (
                <button
                  className="link-btn dispute-link"
                  data-action="dispute"
                  data-id={id}
                  onClick={() => setDisputing(true)}
                >
                  Flag a dispute
                </button>
              )}
            </div>
          </details>
        )}
      </div>
      {disputing && (
        <DisputeDialog
          id={id}
          item={item}
          onClose={() => setDisputing(false)}
        />
      )}
      {ordering && (
        <OrderDialog
          title={item.title}
          earlier={ordering}
          onConfirm={confirm}
          onClose={() => setOrdering(null)}
        />
      )}
    </li>
  );
}

export default function MilestonesPanel({ room, agreement, partner }) {
  const { state, onAction } = useApp();
  const partnerName = partner?.name || "your collaborator";
  const blockers = launchBlockers(room);
  const launched = ["launched", "reviewed", "cancelled"].includes(room.status);
  const entries = Object.entries(room.milestones);
  const currentId = entries.find(([, item]) => !(item.me && item.partner))?.[0];
  const confirmedCount = entries.filter(
    ([, item]) => item.me && item.partner,
  ).length;
  const agreedValues = templateFields(room)
    .map((field) => [
      field.label,
      field.type === "select"
        ? field.options.find(
            ([value]) => value === agreement.draft[field.id],
          )?.[1]
        : field.type === "date" && agreement.draft[field.id]
          ? milestoneDate(agreement.draft[field.id])
          : agreement.draft[field.id],
    ])
    .filter(([, value]) => value);
  return (
    <section className="card panel room-content">
      <div className="panel-head">
        <div>
          <h2>Milestones</h2>
          <p className="panel-subtitle">
            A milestone counts when both of you mark it done.
          </p>
          {agreedValues.length > 0 && (
            <p className="agreed-values">
              Agreed:{" "}
              {agreedValues
                .map(([label, value]) => `${label} ${value}`)
                .join(" · ")}
            </p>
          )}
        </div>
        <span
          className={`status ${confirmedCount === entries.length ? "green" : "gray"}`}
        >
          {confirmedCount} of {entries.length} confirmed by both
        </span>
      </div>
      <p className="muted">
        {room.terms.draft.format === "ongoing"
          ? "Each cycle ends with a check-in summary and private reviews. Then choose Continue or Finish together."
          : "Completion happens automatically when both of you confirm the final milestone. You then have 14 days to review."}
      </p>
      <ol className="milestone-list">
        {entries.map(([id, item], index) => (
          <Milestone
            key={id}
            room={room}
            agreement={agreement}
            partnerName={partnerName}
            id={id}
            item={item}
            index={index}
            current={!launched && id === currentId}
          />
        ))}
      </ol>
      {
        <div className="milestone-launch">
          <div>
            <h3>
              {room.status === "cancelled"
                ? "No more work can be confirmed"
                : launched
                  ? room.type === "mentorship"
                    ? "Mentorship completed"
                    : "Collaboration launched"
                  : room.type === "mentorship"
                    ? "Completing the mentorship"
                    : "Launching"}
            </h3>
            {!launched && blockers.length > 0 && (
              <>
                <p className="panel-subtitle">Still needed before launch:</p>
                <ul className="launch-blockers" id="launch-blockers">
                  {blockers.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </>
            )}
            {launched && room.status !== "cancelled" && (
              <button
                className="link-btn"
                onClick={() => onAction({ page: "review" })}
              >
                {room.status === "reviewed"
                  ? "Read reviews"
                  : "View your review"}
              </button>
            )}
          </div>
        </div>
      }
    </section>
  );
}
