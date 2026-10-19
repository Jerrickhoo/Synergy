import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import Icon from "../components/Icon.jsx";
export default function MilestonesPanel({
  room,
  agreement,
  partner,
  milestones,
}) {
  const { state, model, onAction, onSubmit } = useApp();
  const { currentAgreement, statusText } = model;
  return (
    <section className="card panel room-content">
      <div className="panel-head">
        <div>
          <h2>Milestones</h2>
          <p className="panel-subtitle">
            Progress is shared: both partners confirm each step.
          </p>
        </div>
        <span className="status">
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
              {state.role === "mentor" && id === "session" ? (
                item.schedule ? (
                  <span className="evidence-chip">{item.schedule}</span>
                ) : (
                  <form
                    className="schedule-form"
                    data-form="schedule"
                    onSubmit={(event) => onSubmit(event)}
                  >
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
                  <input
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
                <span className="status">
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
            Mark your collaboration as launched and share a private review.
          </p>
        </div>
        <button
          className="btn primary"
          data-action="launch-room"
          {...(currentAgreement().locked && currentAgreement().partnerLocked
            ? {}
            : {
                disabled: true,
              })}
          onClick={(event) =>
            onAction(
              {
                action: "launch-room",
              },
              event,
            )
          }
        >
          Mark as launched
        </button>
      </div>
    </section>
  );
}
