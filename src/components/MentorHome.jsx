import { approvalCopy } from "../data/mentor-onboarding.js";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "./PageHeader.jsx";
import { RequestCard } from "../pages/RequestsPage.jsx";
import { MenteeRow } from "../pages/MenteesPage.jsx";
import {
  profileCompleteness,
  activeRooms,
  scheduleLabel,
  upcomingSessions,
} from "../data/selectors.js";
import {
  attendanceOpen,
  followupEngagement,
  isMentorRoom,
  mentorSessions,
} from "../data/mentor-room.js";
import { ownUnavailableText } from "../data/mentor-rules.js";
import { localDateKey } from "../data/planning.js";

export default function MentorHome() {
  const { state, model, onAction, onSubmit } = useApp();
  const requests = state.mentorRequests || [];
  const today = localDateKey(new Date());
  const expires = requests.filter(
    (request) => localDateKey(new Date(request.expiresAt)) === today,
  ).length;
  const sessions = upcomingSessions(state).filter(
    ({ schedule }) => localDateKey(new Date(schedule.startsAt)) === today,
  );
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
        Date.now(),
        state.mentorConfig?.attendanceAutoConfirmHours,
      ),
    ),
  );
  const usage = state.mentorUsage;
  const partner = (room) =>
    model.allPeople().find((person) => person.id === room.partnerId);
  const open = (room, tab) =>
    onAction({ action: "open-room", id: room.id, tab });
  const settings = () => onAction({ page: "settings" });
  const guidelines = usage?.guidelines;
  const until =
    guidelines?.graceUntil &&
    new Date(guidelines.graceUntil).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  const banner =
    guidelines?.status === "grace"
      ? `Accept the mentor guidelines by ${until} to keep receiving requests.`
      : ownUnavailableText("guidelines");
  const capacity = usage && [
    ["Mentee slots", usage.activeMentees, usage.capacity.maxMentees],
    [
      "Quick asks and document reviews",
      usage.openAsync,
      usage.capacity.maxOpenAsync,
    ],
    [
      "Hours this month",
      usage.minutesCommitted / 60,
      usage.capacity.monthlyHours,
    ],
  ];
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
      {!state.mentorApplication &&
        !state.mentorSuspension &&
        profileCompleteness(state.profiles.mentor, "mentor") < 100 && (
          <button
            className="btn primary"
            onClick={() => onAction({ action: "edit-profile" })}
          >
            Set up your profile
          </button>
        )}
      {state.mentorSuspension && (
        <section className="mentoring-banner" aria-label="Mentor suspension">
          <p>
            Your mentor profile is suspended. {state.mentorSuspension.reason}
          </p>
          {state.mentorSuspension.until && (
            <p>
              Ends {new Date(state.mentorSuspension.until).toLocaleDateString()}
              .
            </p>
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
        guidelines.status !== "accepted" && (
          <div className="mentoring-banner" role="status">
            <p>{banner}</p>
            <button className="btn small" onClick={settings}>
              Read and accept
            </button>
          </div>
        )}
      {usage?.paused && (
        <div className="mentoring-banner" role="status">
          <p>
            Pause Mode is on
            {usage.pausedUntil ? ` until ${usage.pausedUntil}` : ""}. Your
            current mentees can still work with you.
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
      <div className="simple-home-grid section-gap">
        <section className="card panel">
          <h2>Today's sessions</h2>
          {sessions.length ? (
            sessions.map(({ room, schedule }) => (
              <div className="collaboration-row" key={schedule.id}>
                <div>
                  <strong>{partner(room)?.name || "Startup"}</strong>
                  <p>{scheduleLabel(schedule)}</p>
                  <p>
                    {room.mentorship.prep?.sharedAt
                      ? "Prep shared"
                      : "Prep not shared yet"}
                  </p>
                </div>
                <button
                  className="btn small"
                  onClick={() => open(room, "schedule")}
                >
                  View session
                </button>
              </div>
            ))
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
          {!attendance.length && !followups.length && (
            <p>No attendance reports or follow-ups waiting.</p>
          )}
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
            {capacity.map(([label, value, limit]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {Number(value.toFixed(1))} of {limit}
                  <meter
                    min={0}
                    max={limit}
                    value={Math.min(value, limit)}
                    aria-label={label}
                  />
                </dd>
              </div>
            ))}
          </dl>
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
