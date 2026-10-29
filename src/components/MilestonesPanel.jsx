import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import Icon from "../components/Icon.jsx";
import FormErrors from "./FormErrors.jsx";
import MilestoneRevision from "./MilestoneRevision.jsx";
import { launchBlockers, scheduleLabel } from "../data/selectors.js";
export default function MilestonesPanel({
  room,
  agreement,
  partner,
  milestones,
}) {
  const { state, model, onAction, onSubmit, onUpload, downloadFile } = useApp();
  const { currentAgreement, statusText } = model;
  const blockers = launchBlockers(room);
  const launched = ["launched", "reviewed", "cancelled"].includes(room.status);
  return (
    <section className="card panel room-content">
      <div className="panel-head">
        <div>
          <h2>Milestones</h2>
          <p className="panel-subtitle">
            Progress is shared: both partners confirm each step.
          </p>
          {room.template?.name && (
            <p className="muted">
              Template: {room.template.name} · Version {room.template.version}
            </p>
          )}
        </div>
        <span
          className={`status ${milestones.every(([, item]) => item.me && item.partner) ? "green" : "gray"}`}
        >
          {
            Object.values(room.milestones).filter(
              (item) => item.me && item.partner,
            ).length
          }
          {` of ${milestones.length} confirmed`}
        </span>
      </div>
      {"\n          "}
      {milestones.map(([id, item], itemIndex) => (
        <Fragment key={itemIndex}>
          <div className="milestone">
            <span
              className={
                "milestone-check " +
                (item.me && item.partner ? "confirmed" : "")
              }
            >
              {item.me && item.partner ? <Icon name="check" /> : ""}
            </span>
            <div>
              <div className="milestone-title">
                {item.title}
                {item.evidence ? " *" : ""}
              </div>
              <div className="milestone-note">{item.description}</div>
              <MilestoneRevision id={id} item={item} closed={launched} />
              <div className="milestone-note">
                {statusText(id)}
                {item.disputed ? (
                  <span className="status dispute-chip">Disputed</span>
                ) : (
                  ""
                )}
              </div>
              {item.dueDate && (
                <p className="milestone-note">Due {item.dueDate} (UTC)</p>
              )}
              {!launched && (
                <details className="milestone-date-editor">
                  <summary>
                    {item.dueDate ? "Change due date" : "Set due date"}
                  </summary>
                  <form
                    data-form="milestone-date"
                    data-id={id}
                    onSubmit={onSubmit}
                    className="schedule-form"
                  >
                    <label htmlFor={`due-${id}`}>Due date (UTC)</label>
                    <input
                      id={`due-${id}`}
                      type="date"
                      name="dueDate"
                      defaultValue={item.dueDate || ""}
                    />
                    <button className="btn small" disabled={state.busy}>
                      Save due date
                    </button>
                  </form>
                </details>
              )}
              {room.type === "mentorship" && id === "session" ? (
                <>
                  {(
                    item.schedules || (item.schedule ? [item.schedule] : [])
                  ).map((schedule) => (
                    <span className="evidence-chip" key={schedule.date}>
                      {scheduleLabel(schedule)}
                    </span>
                  ))}
                  {!launched && (
                    <button
                      className="btn small section-gap"
                      type="button"
                      disabled={state.busy}
                      onClick={() =>
                        onAction({ action: "room-tab", tab: "schedule" })
                      }
                    >
                      {item.schedule
                        ? "Reschedule session"
                        : "Schedule session"}
                    </button>
                  )}
                </>
              ) : (
                ""
              )}
              {item.attachment ? (
                item.file ? (
                  <button
                    className="evidence-chip file-download"
                    onClick={() => downloadFile(item.file)}
                  >
                    Download {item.file.name} (
                    {Math.ceil(item.file.size / 1024)} KB)
                  </button>
                ) : (
                  <span className="evidence-chip">{item.attachment}</span>
                )
              ) : (
                ""
              )}
              {item.evidenceOpen ? (
                <div className="evidence-options">
                  <form
                    className="inline-evidence"
                    data-id={id}
                    onSubmit={onUpload}
                  >
                    <label htmlFor={`file-${id}`}>
                      Evidence file (up to 5 MB)
                    </label>
                    <input
                      id={`file-${id}`}
                      name="file"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                      required
                    />
                    <p className="muted">
                      PDF, images or text. Only you and your collaborator can
                      download it.
                    </p>
                    <button
                      className="btn small primary"
                      type="submit"
                      disabled={state.busy || launched}
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
                    <label htmlFor={`evidence-${id}`}>
                      Or add an evidence description or link
                    </label>
                    <input
                      id={`evidence-${id}`}
                      name="attachment"
                      placeholder="Description or link"
                      required
                    />
                    <button
                      className="btn small primary"
                      type="submit"
                      disabled={state.busy || launched}
                    >
                      Attach
                    </button>
                  </form>
                </div>
              ) : (
                ""
              )}
              {item.disputed ? (
                <button
                  className="link-btn dispute-link"
                  disabled={state.busy || launched || item.resolvedByMe}
                  onClick={() => onAction({ action: "resolve-dispute", id })}
                >
                  {item.resolvedByMe
                    ? "Waiting for partner to resolve"
                    : "Agree to resolve dispute"}
                </button>
              ) : (
                <button
                  className="link-btn dispute-link"
                  disabled={state.busy || launched}
                  data-action="dispute"
                  data-id={id}
                  {...(item.disputed
                    ? {
                        disabled: true,
                      }
                    : {})}
                  onClick={(event) =>
                    onAction(
                      {
                        action: "dispute",
                        id: id,
                      },
                      event,
                    )
                  }
                >
                  Flag a dispute
                </button>
              )}
            </div>
            <div className="milestone-actions">
              {item.evidence ? (
                <button
                  className="btn small"
                  data-action="evidence-toggle"
                  disabled={launched}
                  data-id={id}
                  onClick={(event) =>
                    onAction(
                      {
                        action: "evidence-toggle",
                        id: id,
                      },
                      event,
                    )
                  }
                >
                  {item.attachment ? "Replace evidence" : "Attach evidence"}
                </button>
              ) : (
                ""
              )}
              {!item.me ? (
                <button
                  className="btn small"
                  data-action="confirm-milestone"
                  disabled={
                    state.busy ||
                    launched ||
                    item.disputed ||
                    Boolean(item.proposal) ||
                    !agreement.partnerLocked
                  }
                  data-id={id}
                  {...(item.evidence && !item.attachment
                    ? {
                        disabled: true,
                        title: "Attach evidence first",
                      }
                    : {})}
                  onClick={(event) =>
                    onAction(
                      {
                        action: "confirm-milestone",
                        id: id,
                      },
                      event,
                    )
                  }
                >
                  Confirm yours
                </button>
              ) : (
                <span
                  className={`status ${item.disputed ? "dispute-chip" : item.partner ? "green" : ""}`}
                >
                  {item.partner ? "Confirmed" : "Waiting"}
                </span>
              )}
            </div>
          </div>
        </Fragment>
      ))}
      {"\n          "}
      <div className="milestone-launch">
        <div>
          <h3>Ready to launch?</h3>
          <p className="panel-subtitle">
            Complete every milestone together before launching.
          </p>
          {!launched && blockers.length > 0 && (
            <ul className="launch-blockers" id="launch-blockers">
              {blockers.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {launched && room.status !== "cancelled" && (
            <button
              className="link-btn"
              onClick={() => onAction({ page: "review" })}
            >
              View your review
            </button>
          )}
        </div>
        <button
          className="btn primary"
          data-action="launch-room"
          disabled={launched || blockers.length > 0}
          aria-describedby={
            !launched && blockers.length ? "launch-blockers" : undefined
          }
          onClick={(event) =>
            onAction(
              {
                action: "launch-room",
              },
              event,
            )
          }
        >
          {room.status === "cancelled"
            ? "Collaboration closed"
            : launched
              ? "Collaboration launched"
              : "Mark as launched"}
        </button>
      </div>
    </section>
  );
}
