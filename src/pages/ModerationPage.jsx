import { useState } from "react";
import { PaymentModeration } from "../components/Payments.jsx";
import { resolvedOutcomes } from "../data/mentor-room.js";
import { mentorFormat } from "../data/mentor-formats.js";
import { conflictRelations } from "../data/mentor-rules.js";
import { mentorVerificationLabels } from "../data/mentor-onboarding.js";
import SelectField from "../components/SelectField.jsx";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import MentorAdminSettings from "../components/MentorAdminSettings.jsx";
import EngagementSettings from "../components/EngagementSettings.jsx";
import { formatDate, formatDateTime } from "../data/dates.js";
// (Nov 22, round 3) Decisions read as actions, never as stored values.
const decisionLabels = {
  approved: "Approve",
  rejected: "Reject",
  verified: "Verify",
  assigned: "Assign",
  escalated: "Escalate",
  resolved: "Resolve",
  dismissed: "Dismiss",
  restore: "Restore access",
  suspend: "Suspend",
};
function Decision({ kind, id, decisions, report = false }) {
  const { state, onSubmit } = useApp();
  const prefix = `${kind}-${id}`;
  return (
    <form
      data-form="moderation"
      className="grid section-gap"
      onSubmit={onSubmit}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <div className="field">
        <label htmlFor={`${prefix}-decision`}>Decision</label>
        <SelectField id={`${prefix}-decision`} name="decision">
          {decisions.map((value) => (
            <option key={value} value={value}>
              {decisionLabels[value] || value}
            </option>
          ))}
        </SelectField>
      </div>
      {report && (
        <>
          <div className="field">
            <label htmlFor={`${prefix}-assignee`}>Assign to moderator</label>
            <SelectField id={`${prefix}-assignee`} name="assignee">
              {state.moderation.moderators.map((email) => (
                <option key={email}>{email}</option>
              ))}
            </SelectField>
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-remedy`}>Resolution action</label>
            <SelectField id={`${prefix}-remedy`} name="remedy">
              <option value="none">Record decision only</option>
              <option value="confirm-milestone">
                Dispute: confirm the milestone as done
              </option>
              <option value="resolve-disputes">
                Dispute: reopen the milestone; both reconfirm
              </option>
              <option value="close-without-penalty">
                Close the collaboration without penalty to either side
              </option>
              <option value="close">Close unfinished collaboration</option>
            </SelectField>
          </div>
        </>
      )}
      <div className="field">
        <label htmlFor={`${prefix}-note`}>Reason / resolution</label>
        <textarea id={`${prefix}-note`} name="note" required maxLength={3000} />
      </div>
      <button className="btn" disabled={state.busy}>
        Save decision
      </button>
    </form>
  );
}
export default function ModerationPage() {
  const { state, downloadFile, onAction } = useApp();
  if (!state.isAdmin || !state.moderation)
    return (
      <div className="page">
        <PageHeader
          title="Moderator access required"
          intro="This page is available to verified workspace moderators."
        />
      </div>
    );
  const { reports, tags, affiliations, accounts, audit } = state.moderation;
  const managedAccounts = accounts.filter(
    (a) =>
      a.id !== state.accountId &&
      !state.moderation.moderators.includes(a.email),
  );
  return (
    <div className="page page-enter">
      <PageHeader
        title="Moderation"
        intro="Review reports, affiliation evidence and shared vocabulary changes. Every decision is recorded."
      />
      <section className="card panel">
        <h2>
          Reports (
          {
            reports.filter((r) => !["resolved", "dismissed"].includes(r.status))
              .length
          }{" "}
          open)
        </h2>
        {reports.length ? (
          reports.map((report) => (
            <details className="moderation-entry" key={report.id}>
              <summary>
                {report.kind === "dispute" ? "Dispute · " : ""}
                {report.status} · {report.reason.slice(0, 100)}
                {report.dueAt && ` · Due ${formatDate(report.dueAt)}`}
                {report.overdue ? " · Overdue" : ""}
              </summary>
              <p>{report.reason}</p>
              {report.details && (
                <p className="preserve-lines">{report.details}</p>
              )}
              <p className="muted">
                Reporter: {report.reporterName || report.reporterProfileId} ·
                Reported:{" "}
                {report.reportedName ||
                  report.reportedProfileId ||
                  "See room context"}
              </p>
              <p>Assigned to {report.assignee || "unassigned"}</p>
              {report.resolution && <p>Decision: {report.resolution}</p>}
              {report.context && (
                <>
                  <h3>{report.context.type}</h3>
                  <p>{report.context.goal}</p>
                  {report.context.milestones.map((item) => (
                    <p key={item.title}>
                      {item.title} ·{" "}
                      {item.disputed ? "Disputed" : "No open dispute"} ·{" "}
                      {item.attachment || "No evidence"}
                      {item.file && (
                        <button
                          className="link-btn"
                          onClick={() => downloadFile(item.file)}
                        >
                          Download {item.file.name}
                        </button>
                      )}
                    </p>
                  ))}
                  <details>
                    <summary>Recent room conversation</summary>
                    {report.context.messages.map((message, index) => (
                      <p key={index}>
                        {message.name}: {message.text}
                      </p>
                    ))}
                  </details>
                </>
              )}
              <Decision
                kind="report"
                id={report.id}
                report
                decisions={["assigned", "escalated", "resolved", "dismissed"]}
              />
            </details>
          ))
        ) : (
          <p>No reports.</p>
        )}
      </section>
      <section className="card panel section-gap">
        <h2>Affiliation requests</h2>
        {affiliations.length ? (
          affiliations.map((item) => (
            <details
              className="moderation-entry"
              key={item.accountId}
              // Opening a request tells the founder a moderator has seen it.
              onToggle={(event) => {
                if (event.currentTarget.open && !item.seenAt)
                  onAction({ action: "affiliation-seen", id: item.accountId });
              }}
            >
              <summary>
                {item.name} · {item.organization}
                {item.dueAt && ` · Due ${formatDate(item.dueAt)}`}
                {item.overdue ? " · Overdue" : ""}
              </summary>
              <p>{item.evidence}</p>
              <Decision
                kind="affiliation"
                id={item.accountId}
                decisions={["verified", "rejected"]}
              />
            </details>
          ))
        ) : (
          <p>No pending requests.</p>
        )}
      </section>
      <section className="card panel section-gap">
        <h2>Tag proposals</h2>
        {tags
          .filter((t) => t.status === "pending")
          .map((item) => (
            // (Nov 22, round 3) A pending tag shows its decision form at
            // once: there is nothing more to read before deciding.
            <article className="moderation-entry" key={item.id}>
              <h3>{item.label}</h3>
              <p className="muted">
                Due {formatDate(item.dueAt)}
                {item.overdue ? " · Overdue" : ""}
              </p>
              <Decision
                kind="tag"
                id={item.id}
                decisions={["approved", "rejected"]}
              />
            </article>
          ))}
        {!tags.some((t) => t.status === "pending") && <p>No pending tags.</p>}
      </section>
      {/* Waiting applications sit with the other queues, above the long
          account list, so a moderator sees them without scrolling. */}
      <MentorApprovals approvals={state.moderation.mentorApprovals || []} />
      <details className="card panel section-gap">
        <summary>Account access ({managedAccounts.length} accounts)</summary>
        {managedAccounts.map((account) => (
          <details className="moderation-entry" key={account.id}>
            <summary>
              {account.name} · {account.suspended ? "Suspended" : "Active"}
            </summary>
            {account.mentor && <MentorSuspension account={account} />}
            <Decision
              kind="account"
              id={account.id}
              decisions={[account.suspended ? "restore" : "suspend"]}
            />
          </details>
        ))}
      </details>
      <details className="card panel section-gap">
        <summary>Decision history ({audit.length} latest)</summary>
        {audit.map((item) => (
          <p key={item.id}>
            {item.timestamp} · {item.moderator} · {item.kind}: {item.decision} ·{" "}
            {item.note}
          </p>
        ))}
      </details>
      <MentorshipModeration />
      <MentorAdminSettings />
      <PaymentModeration />
      <EngagementSettings />
    </div>
  );
}

function SessionDisputeDecision({ dispute }) {
  const { onAction, state } = useApp();
  const [outcome, setOutcome] = useState("held");
  return (
    <article className="moderation-entry">
      <h3>
        {dispute.mentor} and {dispute.founder}
      </h3>
      <p>{formatDateTime(dispute.startsAt)}</p>
      <p>
        Mentor reported {dispute.attendance.mentor || "nothing"} · Founder
        reported {dispute.attendance.founder || "nothing"}
      </p>
      <form
        className="mentor-request-form"
        onSubmit={(event) =>
          onAction(
            {
              action: "resolve-session-dispute",
              values: {
                accountId: dispute.accountId,
                roomId: dispute.roomId,
                scheduleIndex: dispute.index,
                scheduleId: dispute.scheduleId,
                outcome,
              },
            },
            event,
          )
        }
      >
        <label>
          Session outcome
          <SelectField
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          >
            {resolvedOutcomes.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </SelectField>
        </label>
        <button className="btn" disabled={state.busy}>
          Resolve session dispute
        </button>
      </form>
    </article>
  );
}

function SessionDisputes({ disputes }) {
  return (
    <section className="card panel section-gap">
      <h2>Session disputes</h2>
      {disputes.length ? (
        disputes.map((dispute) => (
          <SessionDisputeDecision
            key={`${dispute.roomId}:${dispute.scheduleId}`}
            dispute={dispute}
          />
        ))
      ) : (
        <p>No open session disputes.</p>
      )}
    </section>
  );
}

// The application beside its evidence: what the mentor offers, how much they
// can take on and what they disclosed.
function ApplicationSummary({ application }) {
  const profile = application.profile || {};
  const capacity = profile.capacity;
  const rows = [
    [
      "Verification",
      `${mentorVerificationLabels[application.verification?.method]?.replace(" checked", "") || application.verification?.method}: ${application.verification?.evidence || ""}`,
    ],
    ["Expertise", profile.topics],
    [
      "Formats",
      (profile.formats || [])
        .map((id) => mentorFormat(id)?.label || id)
        .join(", "),
    ],
    [
      "Capacity",
      capacity
        ? `${capacity.maxMentees} mentees at once · ${capacity.monthlyHours} h a month · ${capacity.maxOpenAsync} open quick asks and reviews · replies within ${capacity.responseDays} ${capacity.responseDays === 1 ? "day" : "days"}${profile.timeZone ? ` · ${profile.timeZone.replaceAll("_", " ")}` : ""}`
        : "",
    ],
    ["Experience", profile.pastExperience],
    ["Introduction", profile.bio],
    [
      "Preferences",
      [
        profile.stages?.length && `Stages: ${profile.stages.join(", ")}`,
        profile.industries?.length &&
          `Industries: ${profile.industries.join(", ")}`,
      ]
        .filter(Boolean)
        .join(" · "),
    ],
    [
      "Conflicts",
      profile.conflicts?.length
        ? profile.conflicts
            .map(
              (item) =>
                `${item.company} (${conflictRelations.find(([id]) => id === item.relation)?.[1] || item.relation}${item.industry ? `, ${item.industry}` : ""})`,
            )
            .join("; ")
        : profile.noConflicts
          ? "None declared"
          : "",
    ],
  ];
  return (
    <dl className="mentor-request-answers application-summary">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className="preserve-lines">{value || "Not provided"}</dd>
        </div>
      ))}
    </dl>
  );
}

function MentorApprovals({ approvals }) {
  const { onAction, state } = useApp();
  return (
    <section className="card panel section-gap" aria-label="Mentor approvals">
      <h2>Mentor approvals ({approvals.length} waiting)</h2>
      {approvals.length === 0 && <p>No mentor applications waiting.</p>}
      {approvals.map((application) => (
        <details className="moderation-entry" key={application.accountId}>
          <summary>
            {application.name} · {application.waitHours} hours waiting
            {application.overdue ? " · Past target" : ""}
          </summary>
          {application.overdue && (
            <p className="warning-note">
              This application is past the approval target.
            </p>
          )}
          <ApplicationSummary application={application} />
          <form
            className="mentor-request-form"
            onSubmit={(event) => {
              const values = Object.fromEntries(
                new FormData(event.currentTarget),
              );
              return onAction(
                {
                  action:
                    event.nativeEvent.submitter?.value || "approve-mentor",
                  id: application.accountId,
                  values,
                },
                event,
              );
            }}
          >
            <label htmlFor={`approval-reason-${application.accountId}`}>
              Reason for rejection, if rejecting
            </label>
            <textarea
              id={`approval-reason-${application.accountId}`}
              name="reason"
              maxLength={500}
            />
            <div className="mentor-request-controls">
              <button
                className="btn primary"
                type="submit"
                value="approve-mentor"
                disabled={state.busy}
              >
                Approve mentor
              </button>
              <button
                className="btn"
                type="submit"
                value="reject-mentor"
                disabled={state.busy}
              >
                Reject application
              </button>
            </div>
          </form>
        </details>
      ))}
    </section>
  );
}

function MentorSafetyQueue({ queue, filter }) {
  const { state, onAction } = useApp();
  if (!queue) return null;
  return (
    <section className="card panel section-gap" aria-label="Mentorship safety">
      <h2>Mentorship safety</h2>
      {["all", "safety"].includes(filter) && (
        <>
          <h3>Reported patterns</h3>
          {!queue.flags.length && (
            <p>No accounts reached the message flag limit.</p>
          )}
          {queue.flags.map((row) => (
            <p key={row.id}>
              {row.name} · {row.count} flags · {row.categories.join(", ")}
            </p>
          ))}
        </>
      )}
      {["all", "ratings"].includes(filter) && (
        <>
          <h3>Rating flags</h3>
          {!queue.ratings.length && <p>No rating patterns need review.</p>}
          {queue.ratings.map((row) => (
            <p key={`${row.id}:${row.role}`}>
              {row.name} · {row.reason}
            </p>
          ))}
        </>
      )}
      {["all", "limits"].includes(filter) && (
        <>
          <h3>Active attendance limits</h3>
          {!queue.limits.length && <p>No active attendance limits.</p>}
          {queue.limits.map((row) => (
            <div key={`${row.id}:${row.role}`} className="collaboration-row">
              <p>
                {row.name} · {row.role} · until {formatDate(row.until)}
              </p>
              <button
                className="btn"
                disabled={state.busy}
                onClick={(event) =>
                  onAction(
                    {
                      action: "lift-limit",
                      id: row.id,
                      values: { role: row.role },
                    },
                    event,
                  )
                }
              >
                Lift limit
              </button>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function MentorSuspension({ account }) {
  const { state, onAction } = useApp();
  return account.mentorSuspension ? (
    <button
      className="btn"
      disabled={state.busy}
      onClick={(event) =>
        onAction({ action: "reinstate-mentor", id: account.id }, event)
      }
    >
      Reinstate mentor
    </button>
  ) : (
    <form
      className="mentor-request-form section-gap"
      onSubmit={(event) =>
        onAction(
          {
            action: "suspend-mentor",
            id: account.id,
            values: Object.fromEntries(new FormData(event.currentTarget)),
          },
          event,
        )
      }
    >
      <label htmlFor={`suspension-reason-${account.id}`}>
        Mentor suspension reason
      </label>
      <textarea
        name="reason"
        id={`suspension-reason-${account.id}`}
        required
        maxLength={500}
      />
      <label htmlFor={`suspension-end-${account.id}`}>
        End date (optional)
      </label>
      <input type="date" id={`suspension-end-${account.id}`} name="until" />
      <button className="btn danger" disabled={state.busy}>
        Suspend mentor
      </button>
    </form>
  );
}

function MentorshipModeration() {
  const { state } = useApp();
  const [filter, setFilter] = useState("all");
  return (
    <section className="section-gap" aria-label="Mentorship moderation">
      <div className="card panel">
        <h2>Mentorship queue</h2>
        <label htmlFor="mentorship-queue-filter">Filter by</label>
        <SelectField
          id="mentorship-queue-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          {[
            ["all", "All mentorship items"],
            ["sessions", "Session disputes"],
            ["safety", "Safety flags"],
            ["ratings", "Rating flags"],
            ["limits", "Active limits"],
          ].map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>
      {["all", "sessions"].includes(filter) && (
        <SessionDisputes disputes={state.moderation.sessionDisputes || []} />
      )}
      {["all", "safety", "ratings", "limits"].includes(filter) && (
        <MentorSafetyQueue
          queue={state.moderation.mentorSafety}
          filter={filter}
        />
      )}
    </section>
  );
}
