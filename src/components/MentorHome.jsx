import { useState } from "react";
import { approvalCopy } from "../data/mentor-onboarding.js";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "./PageHeader.jsx";
import { RequestCard } from "../pages/RequestsPage.jsx";
import {
  activeRooms,
  profileFieldNames,
  profileKeys,
  roomNextAction,
} from "../data/selectors.js";
import { terminalStatuses } from "../data/collaboration.js";
import {
  attendanceOpen,
  followupEngagement,
  isMentorRoom,
  mentorSessions,
} from "../data/mentor-room.js";
import {
  availabilityLine,
  closedFormatsLine,
  formatHours,
  formatList,
  ownUnavailableText,
} from "../data/mentor-rules.js";
import { mentorFormat } from "../data/mentor-formats.js";
import { formatDate } from "../data/dates.js";
import { localDateKey } from "../data/planning.js";
import HomeMetrics from "./HomeMetrics.jsx";
import { collaboratorSlots } from "../data/home-planner.js";
import { HomeCalendar, HomeCollaborations, HomeTasks } from "./HomePlanner.jsx";
import HomeTopMatches from "./HomeTopMatches.jsx";
import NextStepCard from "./NextStepCard.jsx";
import { mentorNextStep, mentorStepRank } from "../data/mentor-home.js";

// (Nov 22, round 2) The heading names the state founders actually see: live,
// paused (with the resume date), waiting on the guidelines or an attendance
// limit, or listed but full. Approval and suspension have their own banners.
function listingHeading(usage) {
  if (usage?.paused)
    return usage.pausedUntil
      ? `Paused until ${formatDate(usage.pausedUntil)}`
      : "Paused";
  if (usage?.reason === "guidelines") return "Not taking requests yet";
  if (usage?.reason === "no-show-limit") return "New requests are on hold";
  if (usage && !usage.available) return "In Matches, closed to new requests";
  return "You're live in Matches";
}

function ResumeRequests() {
  const { state, onSubmit } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <form
      data-form="set-mentor-pause"
      onSubmit={async (event) => {
        setBusy(true);
        try {
          await onSubmit(event);
        } finally {
          setBusy(false);
        }
      }}
    >
      <button className="btn primary" disabled={busy || state.busy}>
        {busy && <span className="spinner" aria-hidden="true" />}
        {busy ? "Resuming…" : "Resume requests"}
      </button>
    </form>
  );
}

function ListingStatus({ usage, settings, profileStep = false }) {
  const { state, onAction } = useApp();
  const listing = state.mentorListing;
  const profile = state.profiles.mentor;
  const viewProfile = () => onAction({ page: "profile" });
  if (state.integrations?.guest)
    return (
      <section className="card panel mentor-live" aria-labelledby="live-title">
        <h2 id="live-title">This is a preview mentor account</h2>
        <p>
          Real founders can't find or request preview accounts. Here is how
          mentoring works once you join for real:
        </p>
        <ol>
          <li>Founders find you in Matches by your expertise and formats.</li>
          <li>
            Their requests arrive in Requests, where you accept, decline or
            refer them.
          </li>
          <li>Accepted requests open a mentorship room under Mentees.</li>
        </ol>
        {/* The next-step card or Startups you can help holds the main
            action, so browsing here stays secondary. */}
        <div className="mentor-request-controls">
          <button
            className="btn"
            onClick={() => onAction({ page: "discover" })}
          >
            Browse startups
          </button>
          <button
            className="btn"
            onClick={() => onAction({ page: "requests" })}
          >
            Open Requests
          </button>
        </div>
      </section>
    );
  if (listing?.listed) {
    const formats = (usage?.offeredFormats || []).map(
      (id) => mentorFormat(id)?.label || id,
    );
    const closed = !usage?.paused && closedFormatsLine(usage);
    const note = usage?.paused
      ? "New requests are off. Your current mentees can still work with you."
      : ["guidelines", "no-show-limit"].includes(usage?.reason)
        ? ownUnavailableText(usage.reason)
        : "";
    return (
      <section className="card panel mentor-live" aria-labelledby="live-title">
        <h2 id="live-title">{listingHeading(usage)}</h2>
        {note && <p>{note}</p>}
        <dl className="mentor-live-facts">
          <div>
            <dt>Founders see</dt>
            <dd>{usage ? availabilityLine(usage) : "Not set yet"}</dd>
          </div>
          <div>
            <dt>Formats you offer</dt>
            <dd>{formatList(formats) || "None yet"}</dd>
          </div>
        </dl>
        {closed && <p className="mentor-closed-line">{closed}</p>}
        <div className="mentor-request-controls">
          {usage?.paused && <ResumeRequests />}
          {usage?.reason === "guidelines" && !usage.paused && (
            <button className="btn primary" onClick={settings}>
              Read and accept guidelines
            </button>
          )}
          <button className="btn" onClick={viewProfile}>
            View your profile
          </button>
          <button className="link-btn" onClick={settings}>
            {usage?.paused ? "Change resume date" : "Change availability"}
          </button>
        </div>
      </section>
    );
  }
  if (listing?.hidden)
    return (
      <div className="mentoring-banner" role="status">
        <p>Your profile is hidden, so founders can't find you in Matches.</p>
        <button className="btn small" onClick={settings}>
          Change visibility
        </button>
      </div>
    );
  // The next-step card already lists what is missing and opens the editor.
  if (profileStep) return null;
  const missing = profileKeys("mentor").filter(
    (key) => !String(profile[key] || "").trim(),
  );
  return (
    <section className="card panel mentor-live" aria-labelledby="live-title">
      <h2 id="live-title">Finish your profile to appear in Matches</h2>
      {missing.length > 0 && (
        <p>
          Still to add:{" "}
          {missing.map((key) => profileFieldNames[key]).join(", ")}.
        </p>
      )}
      <div className="mentor-request-controls">
        <button
          className="btn primary"
          onClick={() => onAction({ action: "edit-profile" })}
        >
          Set up your profile
        </button>
      </div>
    </section>
  );
}

export default function MentorHome() {
  const { state, model, onAction, onSubmit } = useApp();
  const requests = state.mentorRequests || [];
  const today = localDateKey(new Date());
  const expires = requests.filter(
    (request) => localDateKey(new Date(request.expiresAt)) === today,
  ).length;
  const now = Date.now();
  const rooms = activeRooms(state).filter(isMentorRoom);
  // A follow-up stays on Home until its mentorship is finished.
  const followups = Object.values(state.rooms)
    .filter(
      (room) =>
        isMentorRoom(room) &&
        room.role === "mentor" &&
        !terminalStatuses.includes(room.status),
    )
    .map((room) => ({ room, followup: followupEngagement(room)?.followup }))
    .filter(({ followup }) => followup?.submittedAt)
    .sort((a, b) =>
      b.followup.submittedAt.localeCompare(a.followup.submittedAt),
    );
  const attendance = rooms.filter((room) =>
    mentorSessions(room).some((session) =>
      attendanceOpen(
        session,
        "mentor",
        now,
        state.mentorConfig?.attendanceAutoConfirmHours,
      ),
    ),
  );
  // A founder's proposed advisory time waits for the mentor's confirmation;
  // a time the mentor suggested waits for the founder instead.
  const checkIns = rooms.filter(
    (room) =>
      room.role === "mentor" &&
      room.cycle?.phase === "active" &&
      room.cycle.proposedTime &&
      room.cycle.proposedTime.proposedBy !== "mentor" &&
      !room.cycle.confirmedAt,
  );
  const usage = state.mentorUsage;
  const partner = (room) =>
    model.allPeople().find((person) => person.id === room.partnerId);
  const open = (room, tab) =>
    onAction({ action: "open-room", id: room.id, tab });
  const settings = () => onAction({ page: "settings" });
  const guidelines = usage?.guidelines;
  const banner =
    guidelines?.status === "grace"
      ? `Accept the mentor guidelines by ${formatDate(guidelines.graceUntil)} to keep receiving requests.`
      : ownUnavailableText("guidelines");
  const capacity = usage && [
    [
      "Session slots in use",
      usage.activeMentees,
      usage.capacity.maxMentees,
      "",
    ],
    [
      "Quick-ask and review slots in use",
      usage.openAsync,
      usage.capacity.maxOpenAsync,
      "",
    ],
    [
      "Hours this month",
      (usage.minutesUsed ?? usage.minutesCommitted) / 60,
      usage.capacity.monthlyHours,
      usage.minutesReserved > 0
        ? `${formatHours(usage.minutesReserved)} reserved by open Office Hours`
        : "",
    ],
  ];
  // The listing card covers pause and required guidelines once it shows. A
  // preview account shows its explainer instead, so it keeps the banners.
  const listingCard =
    !state.mentorApplication &&
    !state.mentorSuspension &&
    !state.integrations?.guest &&
    state.mentorListing?.listed;
  // Mentees waiting on the mentor come first, most urgent step first, so the
  // next step is never below the fold after a request is accepted.
  const mentees = rooms
    .map((room) => ({
      room,
      next: roomNextAction(room, partner(room)?.name),
    }))
    .sort((a, b) => mentorStepRank(a.next) - mentorStepRank(b.next));
  const nameOf = (room) => partner(room)?.name || "Startup";
  const slots = collaboratorSlots(rooms);
  // Attendance, check-in times and follow-ups join the task list.
  const mentorTasks = [
    ...checkIns.map((room) => ({
      id: `${room.id}:check-in`,
      title: "Confirm the proposed check-in time",
      who: nameOf(room),
      due: room.cycle.proposedTime?.date || "",
      room,
      tab: "schedule",
    })),
    ...attendance.map((room) => ({
      id: `${room.id}:attendance`,
      title: "Report attendance",
      who: nameOf(room),
      due: "",
      room,
      tab: "schedule",
    })),
    ...followups.slice(0, 3).map(({ room }) => ({
      id: `${room.id}:follow-up`,
      title: "Read the follow-up",
      who: nameOf(room),
      due: "",
      room,
      tab: "overview",
    })),
  ];
  const yourTurn = mentees.filter(({ next }) => next.mine);
  // One priority from the mentor's actual state. With nothing specific to
  // do, Startups you can help leads instead (as founder Home's matches do).
  const next = mentorNextStep(state, model);
  const quiet = !requests.length && !rooms.length;
  return (
    <div className="page simple-home mentor-home page-enter">
      <PageHeader
        title={
          requests.length
            ? `${requests.length} ${requests.length === 1 ? "request" : "requests"} waiting`
            : yourTurn.length
              ? `${yourTurn.length} ${yourTurn.length === 1 ? "mentee needs" : "mentees need"} you`
              : `Welcome, ${state.accountName.split(" ")[0] || "mentor"}`
        }
        intro={
          expires
            ? `${expires} ${expires === 1 ? "expires" : "expire"} today`
            : requests.length
              ? "Reply to founders who match your expertise."
              : yourTurn.length
                ? undefined
                : "No new mentorship requests."
        }
      />
      {state.mentorSuspension && (
        <section className="mentoring-banner" aria-label="Mentor suspension">
          <p>
            Your mentor profile is suspended. {state.mentorSuspension.reason}
          </p>
          {state.mentorSuspension.until && (
            <p>Ends {formatDate(state.mentorSuspension.until)}.</p>
          )}
          {state.mentorSuspension.appealedAt ? (
            <p>Your appeal is with moderation.</p>
          ) : (
            <details>
              <summary>Appeal suspension</summary>
              <form
                data-form="report-form"
                className="mentor-request-form"
                onSubmit={onSubmit}
              >
                <input type="hidden" name="appeal" value="mentor-suspension" />
                <input
                  type="hidden"
                  name="reason"
                  value="Mentor suspension appeal"
                />
                <label htmlFor="mentor-appeal-details">
                  Why should the decision be reviewed?
                </label>
                <textarea
                  name="details"
                  id="mentor-appeal-details"
                  maxLength={3000}
                  required
                />
                <button className="btn" disabled={state.busy}>
                  Submit appeal
                </button>
              </form>
            </details>
          )}
        </section>
      )}
      {state.mentorApplication && (
        <div className="mentoring-banner" role="status">
          <p>
            {approvalCopy(
              state.mentorApplication,
              state.mentorConfig.approvalTargetBusinessDays,
            )}
          </p>
          <button
            className="btn small"
            onClick={() => onAction({ page: "onboarding" })}
          >
            {state.mentorApplication.status === "draft"
              ? "Continue application"
              : "View application"}
          </button>
        </div>
      )}
      {!state.mentorApplication &&
        guidelines &&
        guidelines.status !== "accepted" &&
        !(listingCard && guidelines.status === "required") && (
          <div className="mentoring-banner" role="status">
            <p>{banner}</p>
            <button className="btn small" onClick={settings}>
              Read and accept
            </button>
          </div>
        )}
      {usage?.paused && !listingCard && (
        <div className="mentoring-banner" role="status">
          <p>
            Pause Mode is on
            {usage.pausedUntil ? ` until ${formatDate(usage.pausedUntil)}` : ""}
            . Your current mentees can still work with you.
          </p>
          <button className="btn small" onClick={settings}>
            Change in Settings
          </button>
        </div>
      )}
      {next && !next.generic && <NextStepCard next={next} />}
      {quiet && <HomeTopMatches lead={Boolean(next?.generic)} />}
      {requests.length > 0 && (
        <section className="mentor-requests-list" aria-label="Top requests">
          {requests.slice(0, 2).map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
          <button
            className="btn"
            onClick={() => onAction({ page: "requests" })}
          >
            View all requests
          </button>
        </section>
      )}
      {rooms.length > 0 && (
        <div className="home-planner section-gap">
          <HomeCalendar rooms={rooms} nameOf={nameOf} slots={slots} />
          <HomeTasks
            rooms={rooms}
            nameOf={nameOf}
            slots={slots}
            extra={mentorTasks}
          />
        </div>
      )}
      <div
        className={`home-overview section-gap${mentees.length ? " paired" : ""}`}
      >
        <HomeMetrics />
        {mentees.length > 0 && (
          <HomeCollaborations
            rooms={mentees.map(({ room }) => room)}
            nameOf={nameOf}
            slots={slots}
            title="Active mentees"
          />
        )}
      </div>
      {!state.mentorApplication && !state.mentorSuspension && (
        <ListingStatus
          usage={usage}
          settings={settings}
          profileStep={Boolean(next?.profile)}
        />
      )}
      {capacity && (
        <section className="card panel section-gap">
          <h2>Mentoring capacity</h2>
          <dl className="impact-stats">
            {capacity.map(([label, value, limit, detail]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {Number(value.toFixed(2))} of {limit}
                  {label === "Hours this month" ? " h" : ""}
                  <meter
                    min={0}
                    max={limit}
                    value={Math.min(value, limit)}
                    aria-label={label}
                  />
                </dd>
                {detail && <dd className="impact-detail">{detail}</dd>}
              </div>
            ))}
          </dl>
          {!state.mentorListing?.listed && closedFormatsLine(usage) && (
            <p className="mentor-closed-line">{closedFormatsLine(usage)}</p>
          )}
          <button className="btn" onClick={settings}>
            Edit mentoring settings
          </button>
        </section>
      )}
    </div>
  );
}
