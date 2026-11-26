import MentorshipRoom from "../components/MentorshipRoom.jsx";
import { isMentorRoom } from "../data/mentor-room.js";
import ReportCollaborator from "../components/ReportCollaborator.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import MilestonesPanel from "../components/MilestonesPanel.jsx";
import TaskBoard from "../components/TaskBoard.jsx";
import MentorshipCycle from "../components/MentorshipCycle.jsx";
import SchedulePanel from "../components/SchedulePanel.jsx";
import MeetingsPanel from "../components/MeetingsPanel.jsx";
import TermsPanel from "../components/TermsPanel.jsx";
import CloseRoomDialog from "../components/CloseRoomDialog.jsx";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Icon from "../components/Icon.jsx";
import {
  terminalStatuses,
  accountVerified,
  personVerified,
} from "../data/collaboration.js";
import {
  milestoneDate,
  roomNextAction,
  upcomingSessions,
  scheduleLabel,
} from "../data/selectors.js";

function NowBar({ room, partnerName }) {
  const { state, onAction } = useApp();
  const next = roomNextAction(room, partnerName);
  if (room.status === "cancelled") return null;
  const done = Object.values(room.milestones).filter(
    (item) => item.me && item.partner,
  ).length;
  const total = Object.keys(room.milestones).length;
  const go = () => {
    if (next.review) return onAction({ page: "review" });
    onAction({ action: "room-tab", tab: next.tab || "milestones" });
    if (next.milestoneId)
      requestAnimationFrame(() =>
        document
          .getElementById(`milestone-${next.milestoneId}`)
          ?.scrollIntoView({ block: "center" }),
      );
  };
  return (
    <section
      className={`now-bar${next.mine ? " mine" : ""}`}
      aria-label="What happens next"
    >
      <div className="now-copy">
        <span className="section-eyebrow">
          {next.done ? "Status" : next.mine ? "Your turn" : "Their turn"}
        </span>
        <strong>{next.text}</strong>
        {(next.detail || next.due) && (
          <span className="now-detail">
            {next.detail}
            {next.due ? ` Due ${milestoneDate(next.due)}.` : ""}
          </span>
        )}
        <span className="now-progress">
          {room.status === "reviewed"
            ? "All stages complete"
            : `${done} of ${total} milestones confirmed by both`}
        </span>
      </div>
      <div className="now-actions">
        {next.mine &&
          !next.done &&
          !(next.ready && state.roomTab === "milestones") && (
            <button className="btn primary" disabled={state.busy} onClick={go}>
              {next.action || "Open"}
            </button>
          )}
        {next.done && next.review && (
          <button className="btn" onClick={go}>
            Read reviews
          </button>
        )}
        {!next.mine && !next.done && room.status !== "launched" && (
          <button
            className="btn"
            disabled={state.busy}
            onClick={() => onAction({ action: "nudge-partner" })}
          >
            Send a nudge
          </button>
        )}
      </div>
    </section>
  );
}

export default function RoomDetailPage() {
  const { model } = useApp();
  const room = model.activeRoom();
  return isMentorRoom(room) ? (
    <MentorshipRoom key={room.id} room={room} />
  ) : (
    <ExchangeRoom />
  );
}

function ExchangeRoom() {
  const { state, model, onAction, onTabKeyDown } = useApp();
  const { allPeople, roleName, currentAgreement, activeRoom, roomStatusLabel } =
    model;
  const room = activeRoom();
  const [closing, setClosing] = useState(false);
  const mentoring = room.type === "mentorship";
  const agreement = currentAgreement();
  const partner = allPeople().find((person) => person.id === room.partnerId);
  const partnerName = partner?.name || "your collaborator";
  const stage =
    {
      matched: 0,
      terms: 1,
      "in-progress": 2,
      launched: 3,
      reviewed: 4,
    }[room.status] || 0;
  const milestones = Object.entries(room.milestones);
  // "Terms agreed" is only true once both have accepted (D3).
  const labels = [
    "Matched",
    stage >= 2 ? "Terms agreed" : "Agreeing terms",
    "In progress",
    mentoring ? "Completed" : "Launched",
    "Reviewed",
  ];
  const termsNote =
    room.status === "terms"
      ? `${agreement.confirmedByMe ? 1 : 0} of 2 accepted`
      : "";
  const tab = state.roomTab === "tasks" ? "milestones" : state.roomTab;
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
  if (tab === "schedule")
    panel =
      room.type === "mentorship" ? (
        <SchedulePanel room={room} partner={partner} />
      ) : (
        <MeetingsPanel room={room} partner={partner} />
      );
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
      <>
        {room.cycle && <MentorshipCycle room={room} />}
        <MilestonesPanel
          room={room}
          agreement={agreement}
          partner={partner}
          milestones={milestones}
        />
        <details
          className="card panel section-gap"
          open={state.roomTab === "tasks" || undefined}
        >
          <summary>Task board · optional room tool</summary>
          <TaskBoard room={room} partner={partner} />
        </details>
      </>
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
    room.type === "mentorship" ? "Mentorship room" : room.engagementType;
  const prototypePartner = Boolean(partner?.prototypePartner);
  return (
    <div className="page room-detail-page page-enter">
      <PageHeader
        title={roomTitle}
        intro={`With ${partnerName}${room.terms.draft.goal ? ` · ${room.terms.draft.goal}` : ""}`}
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
              <Icon name="back" /> All rooms
            </button>
            <details className="room-more">
              <summary className="btn">More</summary>
              <div className="room-more-menu">
                <button
                  className="link-btn"
                  onClick={() => onAction({ action: "report" })}
                >
                  Report a concern
                </button>
                {!terminalStatuses.includes(room.status) && (
                  <button className="link-btn" onClick={() => setClosing(true)}>
                    Close this collaboration
                  </button>
                )}
              </div>
            </details>
          </>
        }
      />
      {prototypePartner && (
        <p className="prototype-note">
          Prototype only: {partnerName} is a fictional collaborator. They
          respond automatically after your actions so you can try every stage.
        </p>
      )}
      <section className="room-banner">
        <div className="room-partners">
          <Avatar
            identity={state.accountId}
            verified={accountVerified(state)}
            image={state.profiles[state.role].image}
            name={roleName()}
            color={state.role === "founder" ? "" : "blue"}
          />
          <strong>{roleName()}</strong>
          <span className="room-arrow">
            <Icon name="arrow" />
          </span>
          <Avatar
            identity={partner?.accountId || room.partnerId}
            verified={personVerified(partner)}
            image={partner?.image}
            name={partner?.name}
            color={partner?.color || ""}
          />
          <strong>{partnerName}</strong>
          {partner?.affiliation && (
            <span className="badge-verified">
              <Icon name="check" /> Verified
            </span>
          )}
        </div>
        <span
          className={
            "status " +
            (["launched", "reviewed"].includes(room.status) ? "green" : "")
          }
        >
          {roomStatusLabel(
            room.status,
            partnerName,
            agreement.confirmedByMe,
            room.type,
          )}
        </span>
      </section>
      {room.status === "cancelled" && (
        <section className="card panel section-gap">
          <h2>Collaboration closed</h2>
          <p>{room.closeReason}</p>
          <p className="muted">
            The agreement, evidence and conversation remain available. You can
            start a new request from Matches.
          </p>
        </section>
      )}
      {room.status !== "cancelled" && (
        <>
          <p className="stage-compact" aria-hidden="true">
            Stage {stage + 1} of 5: {labels[stage]}
            {termsNote ? ` · ${termsNote}` : ""}
          </p>
          <ol
            className="stage-line"
            aria-label={
              mentoring ? "Mentorship progress" : "Deal Room progress"
            }
          >
            {labels.map((label, index) => (
              <li
                key={index}
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
                <span>
                  {label}
                  {index === 1 && termsNote && (
                    <small className="stage-note">{termsNote}</small>
                  )}
                  <span className="visually-hidden">
                    {index < stage
                      ? ", complete"
                      : index === stage
                        ? ", current stage"
                        : ", not started"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      <NowBar room={room} partnerName={partnerName} />
      {room.cycle && (
        <p className="cycle-status">
          Cycle {room.cycle.number} · Next session:{" "}
          {upcomingSessions(state).find((item) => item.room.id === room.id)
            ? scheduleLabel(
                upcomingSessions(state).find((item) => item.room.id === room.id)
                  .schedule,
              )
            : "not scheduled"}
        </p>
      )}
      {/* The Milestones tab has this room's calendar, so there is no link
          out to the full calendar here. */}
      <div
        className="tabs room-tabs"
        ref={tabsRef}
        role="tablist"
        aria-label={mentoring ? "Mentorship sections" : "Deal Room sections"}
      >
        {[
          ["terms", room.terms.partnerLocked ? "Agreement" : "Terms"],
          ["milestones", "Milestones"],
          // Exchange collaborations plan meetings; a mentorship schedules
          // its sessions.
          ["schedule", room.type === "mentorship" ? "Schedule" : "Meetings"],
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
      {mentoring && tab === "terms" && (
        <section
          className="card panel mentorship-brief section-gap"
          aria-labelledby="mentoring-goal"
        >
          <div>
            <p className="section-eyebrow">
              {agreement.partnerLocked ? "Agreed focus" : "Proposed focus"}
            </p>
            <h2 id="mentoring-goal">
              {agreement.draft.goal || "Define your mentoring goal"}
            </h2>
            <p>
              {agreement.draft.scope ||
                "Choose one startup challenge and describe what useful guidance would achieve."}
            </p>
            <span className="muted">
              {agreement.partnerLocked
                ? "Confirmed by both collaborators"
                : "Draft · both collaborators must agree before work begins"}
            </span>
          </div>
          <div>
            <h3>
              {state.role === "mentor"
                ? "Prepare your guidance"
                : "Prepare your questions"}
            </h3>
            <p>
              {state.role === "mentor"
                ? "Review the startup’s context and questions in Chat. Use the shared task board for preparation and follow-up owners."
                : "Share the challenge, useful links and questions in Chat. Record preparation and next steps on the shared task board."}
            </p>
            <button
              className="link-btn"
              onClick={() => onAction({ action: "room-tab", tab: "tasks" })}
            >
              View shared actions <Icon name="arrow" />
            </button>
          </div>
        </section>
      )}
      <div
        id="room-tab-panel"
        role="tabpanel"
        aria-labelledby={`room-tab-${tab}`}
      >
        {panel}
      </div>
      {closing && (
        <CloseRoomDialog
          partnerName={partnerName}
          onClose={() => setClosing(false)}
        />
      )}
      {state.reportOpen && (
        <ReportCollaborator
          person={partner}
          initialOpen
          onClose={() => onAction({ action: "report" })}
        />
      )}
    </div>
  );
}
