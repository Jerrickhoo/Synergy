import SelectField from "../components/SelectField.jsx";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import EngagementSettings from "../components/EngagementSettings.jsx";
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
              {value}
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
  const { state, downloadFile } = useApp();
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
                {report.dueAt &&
                  ` · Due ${new Date(report.dueAt).toLocaleDateString()}`}
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
            <details className="moderation-entry" key={item.accountId}>
              <summary>
                {item.name} · {item.organization}
                {item.dueAt &&
                  ` · Due ${new Date(item.dueAt).toLocaleDateString()}`}
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
            <details className="moderation-entry" key={item.id}>
              <summary>
                {item.label} · Due {new Date(item.dueAt).toLocaleDateString()}
                {item.overdue ? " · Overdue" : ""}
              </summary>
              <Decision
                kind="tag"
                id={item.id}
                decisions={["approved", "rejected"]}
              />
            </details>
          ))}
        {!tags.some((t) => t.status === "pending") && <p>No pending tags.</p>}
      </section>
      <section className="card panel section-gap">
        <h2>Account access</h2>
        {accounts
          .filter(
            (a) =>
              a.id !== state.accountId &&
              !state.moderation.moderators.includes(a.email),
          )
          .map((account) => (
            <details className="moderation-entry" key={account.id}>
              <summary>
                {account.name} · {account.suspended ? "Suspended" : "Active"}
              </summary>
              <Decision
                kind="account"
                id={account.id}
                decisions={[account.suspended ? "restore" : "suspend"]}
              />
            </details>
          ))}
      </section>
      <details className="card panel section-gap">
        <summary>Decision history ({audit.length} latest)</summary>
        {audit.map((item) => (
          <p key={item.id}>
            {item.timestamp} · {item.moderator} · {item.kind}: {item.decision} ·{" "}
            {item.note}
          </p>
        ))}
      </details>
      <EngagementSettings />
    </div>
  );
}
