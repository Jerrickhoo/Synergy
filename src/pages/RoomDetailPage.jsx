import NextStep from "../components/NextStep.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import MilestonesPanel from "../components/MilestonesPanel.jsx";
import TaskBoard from "../components/TaskBoard.jsx";
import SchedulePanel from "../components/SchedulePanel.jsx";
import TermsPanel from "../components/TermsPanel.jsx";
import { Fragment, useLayoutEffect, useRef } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Icon from "../components/Icon.jsx";
import { terminalStatuses } from "../data/collaboration.js";
export default function RoomDetailPage() {
  const { state, model, onAction, onSubmit, onTabKeyDown } = useApp();
  const {
    allPeople,
    roleName,
    roleInitials,
    currentAgreement,
    activeRoom,
    roomStatusLabel,
  } = model;
  const room = activeRoom();
  const agreement = currentAgreement();
  const partner = allPeople().find((person) => person.id === room.partnerId);
  const stage =
    {
      matched: 0,
      terms: 1,
      "in-progress": 2,
      launched: 3,
      reviewed: 4,
    }[room.status] || 0;
  const milestones = Object.entries(room.milestones);
  const labels = [
    "Matched",
    "Terms agreed",
    "In progress",
    "Launched",
    "Reviewed",
  ];
  const tab = state.roomTab;
  const tabsRef = useRef(null);
  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) return;
    const reveal = () => {
      const selected = tabs.querySelector('[aria-selected="true"]');
      if (!selected) return;
      const item = selected.getBoundingClientRect(),
        bounds = tabs.getBoundingClientRect();
      if (item.right > bounds.right)
        tabs.scrollLeft += item.right - bounds.right;
      else if (item.left < bounds.left)
        tabs.scrollLeft += item.left - bounds.left;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(tabs);
    return () => observer.disconnect();
  }, [tab, room.id]);
  let panel = "";
  if (tab === "tasks") panel = <TaskBoard room={room} partner={partner} />;
  if (tab === "schedule" && room.type === "mentorship")
    panel = <SchedulePanel room={room} partner={partner} />;
  if (tab === "terms")
    panel = (
      <TermsPanel
        room={room}
        agreement={agreement}
        partner={partner}
        milestones={milestones}
      />
    );
  if (tab === "milestones")
    panel = (
      <MilestonesPanel
        room={room}
        agreement={agreement}
        partner={partner}
        milestones={milestones}
      />
    );
  if (tab === "chat")
    panel = (
      <ChatPanel
        room={room}
        agreement={agreement}
        partner={partner}
        milestones={milestones}
      />
    );
  const roomTitle =
    room.type === "mentorship" ? "Mentorship Engagement" : room.engagementType;
  return (
    <div className="page page-enter">
      <PageHeader
        title={roomTitle}
        intro="Plan your work, share progress, and move this collaboration forward."
        actions={
          <>
            <button
              className="btn"
              data-page="rooms"
              onClick={(event) =>
                onAction(
                  {
                    page: "rooms",
                  },
                  event,
                )
              }
            >
              ← All deal rooms
            </button>
            <button
              className="link-btn"
              onClick={() => onAction({ action: "report" })}
            >
              Report a concern
            </button>
          </>
        }
      />
      {"\n          "}
      <section className="room-banner">
        <div className="room-partners">
          <Avatar
            initials={roleInitials()}
            color={state.role === "founder" ? "" : "blue"}
          />
          <strong>{roleName()}</strong>
          <span className="room-arrow">
            <Icon name="arrow" />
          </span>
          <Avatar
            initials={partner?.initials || "?"}
            image={partner?.image}
            name={partner?.name}
            color={partner?.color || ""}
          />
          <strong>{partner?.name || room.partnerId}</strong>
        </div>
        <span
          className={
            "status " +
            (["launched", "reviewed"].includes(room.status) ? "green" : "")
          }
        >
          {roomStatusLabel(
            room.status,
            partner?.name || room.partnerId,
            agreement.confirmedByMe,
          )}
        </span>
      </section>
      {room.status === "cancelled" && (
        <section className="card panel section-gap">
          <h2>Collaboration closed</h2>
          <p>{room.closeReason}</p>
          <p className="muted">
            The agreement, evidence and conversation remain available. You can
            start a new introduction from Matches.
          </p>
        </section>
      )}
      {"\n          "}
      {room.status !== "cancelled" && (
        <div className="stage-line" aria-label="Deal room progress">
          {labels.map((label, index) => (
            <Fragment key={index}>
              <div
                aria-current={index === stage ? "step" : undefined}
                className={
                  "stage " +
                  (index < stage ? "done" : "") +
                  " " +
                  (index === stage ? "current" : "")
                }
              >
                <span className="stage-dot">
                  {index < stage ? <Icon name="check" /> : ""}
                </span>
                <span>{label}</span>
              </div>
            </Fragment>
          ))}
        </div>
      )}
      {"\n          "}
      <div
        className="tabs room-tabs"
        ref={tabsRef}
        role="tablist"
        aria-label="Deal room sections"
      >
        {[
          ["terms", "Terms"],
          ["milestones", "Milestones"],
          ["tasks", "Task board"],
          ...(room.type === "mentorship" ? [["schedule", "Schedule"]] : []),
          ["chat", "Chat"],
        ].map(([key, label], itemIndex) => (
          <Fragment key={itemIndex}>
            <button
              className={"tab " + (tab === key ? "active" : "")}
              role="tab"
              id={`room-tab-${key}`}
              aria-controls="room-tab-panel"
              aria-selected={tab === key}
              data-action="room-tab"
              data-tab={key}
              onClick={(event) =>
                onAction(
                  {
                    action: "room-tab",
                    tab: key,
                  },
                  event,
                )
              }
              onKeyDown={onTabKeyDown}
              tabIndex={tab === key ? 0 : -1}
            >
              {label}
            </button>
          </Fragment>
        ))}
      </div>
      {"\n          "}
      <div
        id="room-tab-panel"
        role="tabpanel"
        aria-labelledby={`room-tab-${tab}`}
      >
        {panel}
      </div>
      {"\n        "}
      <NextStep />
      {!terminalStatuses.includes(room.status) && (
        <details className="card panel section-gap">
          <summary>Close this collaboration</summary>
          <p>
            Either collaborator can close an unfinished room. Its history is
            retained and your partner is notified.
          </p>
          <form data-form="close-room" className="grid" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="close-reason">Reason for closing</label>
              <textarea
                id="close-reason"
                name="reason"
                required
                maxLength={3000}
              />
            </div>
            <button className="btn" disabled={state.busy}>
              Close collaboration
            </button>
          </form>
        </details>
      )}
      {state.reportOpen && (
        <section className="card panel section-gap">
          <h2>Report a concern</h2>
          <p className="muted">
            Describe the issue. A workspace moderator can review the report and
            resolve a dispute or close the room.
          </p>
          <form
            id="report-form"
            className="grid section-gap"
            onSubmit={onSubmit}
          >
            <div className="field">
              <label htmlFor="report-reason">What happened?</label>
              <textarea
                id="report-reason"
                name="reason"
                required
                maxLength={3000}
              />
            </div>
            <button className="btn primary" type="submit" disabled={state.busy}>
              Submit report
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
