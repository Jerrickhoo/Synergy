import { useState } from "react";
import { approvalCopy } from "../data/mentor-onboarding.js";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "./PageHeader.jsx";
import { RequestCard } from "../pages/RequestsPage.jsx";
import { MenteeRow } from "../pages/MenteesPage.jsx";
import {
  activeRooms,
  profileFieldNames,
  profileKeys,
  scheduleInstant,
  scheduleLabel,
} from "../data/selectors.js";
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

// Sessions that start today and have not ended yet, so a session in progress
// stays on Home until it is over.
function todaysSessions(state, now = Date.now()) {
  const today = localDateKey(new Date(now));
  return activeRooms(state)
    .filter(isMentorRoom)
    .flatMap((room) =>
      mentorSessions(room)
        .filter((session) => !session.cancelledAt && !session.outcome)
        .map((schedule) => {
          const start = scheduleInstant(schedule).getTime();
          const end = start + (Number(schedule.durationMinutes) || 60) * 60000;
          return { room, schedule, start, end };
        }),
    )
    .filter(
      ({ start, end }) =>
        Number.isFinite(start) &&
        localDateKey(new Date(start)) === today &&
        end > now,
    )
    .sort((a, b) => a.start - b.start);
}

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

function ListingStatus({ usage, settings }) {
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
        {/* (Nov 22, round 2) Preview accounts never receive requests, so the
            primary action is the one they can actually do. */}
        <div className="mentor-request-controls">
          <button
            className="btn primary"
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
  const sessions = todaysSessions(state, now);
  const rooms = activeRooms(state).filter(isMentorRoom);
  const followups = Object.values(state.rooms)
    .filter((room) => isMentorRoom(room) && room.role === "mentor")
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
  const waiting = attendance.length + checkIns.length + followups.length;
  // The listing card covers pause and required guidelines once it shows.
  const listingCard =
    !state.mentorApplication &&
    !state.mentorSuspension &&
    state.mentorListing?.listed;
  return (
    <div className="page simple-home mentor-home page-enter">
      <PageHeader
        title={
          requests.length
            ? `${requests.length} ${requests.length === 1 ? "request" : "requests"} waiting`
            : `Welcome, ${state.accountName.split(" ")[0] || "mentor"}`
        }
        intro={
          expires
            ? `${expires} ${expires === 1 ? "expires" : "expire"} today`
            : requests.length
              ? "Reply to founders who match your expertise."
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
      {!state.mentorApplication && !state.mentorSuspension && (
        <ListingStatus usage={usage} settings={settings} />
      )}
      <div className="simple-home-grid section-gap">
        <section className="card panel">
          <h2>Today's sessions</h2>
          {sessions.length ? (
            sessions.map(({ room, schedule, start, end }) => {
              const live = start <= now && now < end;
              return (
                <div className="collaboration-row" key={schedule.id}>
                  <div>
                    <strong>{partner(room)?.name || "Startup"}</strong>
                    <p className="mentor-session-time">
                      {live ? (
                        <span className="mentor-live-badge">In progress</span>
                      ) : null}
                      {scheduleLabel(schedule)}
                    </p>
                    <p>
                      {room.mentorship.prep?.sharedAt
                        ? "Prep shared"
                        : "Prep not shared yet"}
                    </p>
                  </div>
                  <button
                    className={`btn small${live ? " primary" : ""}`}
                    onClick={() => open(room, "schedule")}
                  >
                    {live ? "Open session" : "View session"}
                  </button>
                </div>
              );
            })
          ) : (
            <p>No mentorship sessions today.</p>
          )}
          <button
            className="link-btn"
            onClick={() => onAction({ page: "calendar" })}
          >
            Open calendar
          </button>
        </section>
        <section className="card panel">
          <h2>Attendance and follow-ups</h2>
          {!waiting && <p>No attendance reports or follow-ups waiting.</p>}
          {checkIns.map((room) => (
            <div className="collaboration-row" key={`check-in-${room.id}`}>
              <div>
                <strong>{partner(room)?.name || "Startup"}</strong>
                <p>
                  Founder proposed a check-in time
                  {room.cycle.proposedTime.date
                    ? ` (${scheduleLabel(room.cycle.proposedTime)})`
                    : ""}
                  . Confirm it.
                </p>
              </div>
              <button
                className="btn small primary"
                onClick={() => open(room, "schedule")}
              >
                Confirm check-in time
              </button>
            </div>
          ))}
          {attendance.map((room) => (
            <div className="collaboration-row" key={room.id}>
              <p>{partner(room)?.name || "Startup"} · Attendance needed</p>
              <button
                className="btn small"
                onClick={() => open(room, "schedule")}
              >
                Report attendance
              </button>
            </div>
          ))}
          {followups.slice(0, 3).map(({ room, followup }) => (
            <div className="collaboration-row" key={room.id}>
              <div>
                <strong>{partner(room)?.name || "Startup"}</strong>
                <p>{followup.summary || "Shared a follow-up."}</p>
              </div>
              <button
                className="btn small"
                onClick={() => open(room, "overview")}
              >
                View follow-up
              </button>
            </div>
          ))}
        </section>
      </div>
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
      {rooms.length > 0 && (
        <section className="card panel section-gap">
          <h2>Active mentees</h2>
          {rooms.slice(0, 3).map((room) => (
            <MenteeRow key={room.id} room={room} partner={partner(room)} />
          ))}
          <button className="btn" onClick={() => onAction({ page: "mentees" })}>
            View mentees
          </button>
        </section>
      )}
    </div>
  );
}
