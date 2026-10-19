import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import Icon from "../components/Icon.jsx";
import FormErrors from "./FormErrors.jsx";
import { launchBlockers, scheduleLabel } from "../data/selectors.js";
export default function MilestonesPanel({
  room,
  agreement,
  partner,
  milestones,
}) {
  const { state, model, onAction, onSubmit } = useApp();
  const { currentAgreement, statusText } = model;
  const blockers = launchBlockers(room);
  const launched = ["launched", "reviewed"].includes(room.status);
  return (
    <section className="card panel room-content">
      <div className="panel-head">
        <div>
          <h2>Milestones</h2>
          <p className="panel-subtitle">
            Progress is shared: both partners confirm each step.
          </p>
        </div>
        <span
          className={`status ${milestones.every(([, item]) => item.me && item.partner) ? "green" : "gray"}`}
        >
          {
            Object.values(room.milestones).filter(
              (item) => item.me && item.partner,
            ).length
          }
          {" of 5 confirmed"}
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
              <div className="milestone-note">
                {statusText(id)}
                {item.disputed ? (
                  <span className="status dispute-chip">Disputed</span>
                ) : (
                  ""
                )}
              </div>
              {room.type === "mentorship" && id === "session" ? (
                item.schedule ? (
                  <span className="evidence-chip">
                    {scheduleLabel(item.schedule)}
                  </span>
                ) : (
                  <form
                    className="schedule-form"
                    data-form="schedule"
                    onSubmit={(event) => onSubmit(event)}
                  >
                    <FormErrors scope="schedule" />
                    <label htmlFor="session-date">Schedule session</label>
                    <input id="session-date" type="date" name="date" required />
                    <input
                      type="time"
                      name="time"
                      aria-label="Session time"
                      required
                    />
                    <button className="btn small" type="submit">
                      Save time
                    </button>
                  </form>
                )
              ) : (
                ""
              )}
              {item.attachment ? (
                <span className="evidence-chip">{item.attachment}</span>
              ) : (
                ""
              )}
              {item.evidenceOpen ? (
                <form
                  className="inline-evidence"
                  data-form="evidence"
                  data-id={id}
                  onSubmit={(event) => onSubmit(event)}
                >
                  <FormErrors scope={`evidence-${id}`} />
                  <label htmlFor={`evidence-${id}`}>
                    Evidence description or link (no file upload)
                  </label>
                  <input
                    id={`evidence-${id}`}
                    name="attachment"
                    placeholder="File name or link"
                    required
                  />
                  <button className="btn small primary" type="submit">
                    Attach
                  </button>
                </form>
              ) : (
                ""
              )}
              <button
                className="link-btn dispute-link"
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
            </div>
            <div className="milestone-actions">
              {item.evidence ? (
                <button
                  className="btn small"
                  data-action="evidence-toggle"
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
          {launched && (
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
          {launched ? "Collaboration launched" : "Mark as launched"}
        </button>
      </div>
    </section>
  );
}
