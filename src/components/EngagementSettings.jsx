import { useApp } from "../state/AppContext.jsx";
import { factorNames, weightCount } from "../data/matching.js";

export default function EngagementSettings() {
  const { state, onSubmit } = useApp();
  const config = state.matchingConfig;
  const report = state.moderation.matchingReport;
  return (
    <>
      <section className="card panel section-gap">
        <h2>Reusable engagement templates</h2>
        <p className="muted">
          Edit the starting checklist for each room type. New rooms receive a
          copy of the current version; existing agreements keep their checklist.
        </p>
        {Object.values(state.engagementTemplates)
          .filter((template) => template.id !== "mentorship")
          .map((template) => (
            <details className="moderation-entry" key={template.id}>
              <summary>
                {template.name} · Version {template.version}
              </summary>
              <form
                key={template.version}
                data-form="engagement-template"
                className="grid section-gap"
                onSubmit={onSubmit}
              >
                <input type="hidden" name="type" value={template.id} />
                <input type="hidden" name="version" value={template.version} />
                <label htmlFor={`template-${template.id}`}>Template name</label>
                <input
                  id={`template-${template.id}`}
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={template.name}
                />
                {template.milestones.map((item, index) => (
                  <fieldset className="template-milestone" key={item.id}>
                    <legend>Milestone {index + 1}</legend>
                    <label htmlFor={`${template.id}-${item.id}-title`}>
                      Title
                    </label>
                    <input
                      id={`${template.id}-${item.id}-title`}
                      name={`title-${item.id}`}
                      required
                      maxLength={120}
                      defaultValue={item.title}
                    />
                    <label htmlFor={`${template.id}-${item.id}-scope`}>
                      Scope
                    </label>
                    <textarea
                      id={`${template.id}-${item.id}-scope`}
                      name={`description-${item.id}`}
                      required
                      maxLength={2000}
                      defaultValue={item.description}
                    />
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name={`evidence-${item.id}`}
                        defaultChecked={item.evidence}
                      />{" "}
                      Require evidence
                    </label>
                  </fieldset>
                ))}
                <button className="btn" disabled={state.busy}>
                  Save template
                </button>
              </form>
            </details>
          ))}
      </section>
      <section className="card panel section-gap">
        <h2>Matching evaluation</h2>
        <p>
          Weights are provisional. These observations describe accepted
          collaborations, including repeat engagements. They do not establish
          that scores cause success.
        </p>
        <p className="muted">
          {report.totalRooms} distinct rooms; {report.unscoredRooms} older rooms
          without a score snapshot. Active rooms remain separate from completed
          and closed rooms. Feedback counts include only mutually submitted
          reviews.
        </p>
        {report.cohorts.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Match factor breakdown"
          >
            <table className="outcome-table">
              <caption>
                Outcomes by scoring version, room type and average initial
                profile fit
              </caption>
              <thead>
                <tr>
                  {[
                    "Version",
                    "Type",
                    "Fit",
                    "Rooms",
                    "Active",
                    "Completed",
                    "Closed",
                    "Both reviewed",
                    "Useful answers",
                    "Goals achieved",
                  ].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.cohorts.map((row) => (
                  <tr
                    key={`${row.algorithm}-${row.version}-${row.type}-${row.band}`}
                  >
                    <td>
                      {row.version}
                      <small className="muted"> {row.algorithm}</small>
                    </td>
                    <td>{row.type}</td>
                    <td>{row.band}</td>
                    <td>{row.rooms}</td>
                    <td>{row.active}</td>
                    <td>{row.completed}</td>
                    <td>{row.closed}</td>
                    <td>{row.reviewed}</td>
                    <td>
                      {row.useful}/{row.usefulnessResponses}
                    </td>
                    <td>
                      {row.goalsAchieved}/{row.goalResponses}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            No scored collaboration outcomes yet. New rooms will capture their
            initial scores and weight version.
          </p>
        )}
        <details className="section-gap">
          <summary>Edit matching weights · Version {config.version}</summary>
          <p className="muted">
            Use real outcomes to guide experiments. Each role must total 100%.
            Changes create a new scoring version.
          </p>
          <form
            data-form="matching-config"
            onSubmit={onSubmit}
            key={config.version}
            className="grid section-gap"
          >
            <input type="hidden" name="version" value={config.version} />
            {["founder", "mentor"].map((kind) => (
              <fieldset key={kind}>
                <legend>
                  {kind === "mentor" ? "Mentorship" : "Founder collaboration"}
                </legend>
                {factorNames.slice(0, weightCount[kind]).map((name, i) => (
                  <div className="field" key={name}>
                    <label htmlFor={`weight-${kind}-${i}`}>{name} (%)</label>
                    <input
                      id={`weight-${kind}-${i}`}
                      name={`${kind}-${i}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      required
                      readOnly={kind === "founder" && i === 1}
                      defaultValue={Number((config[kind][i] * 100).toFixed(1))}
                    />
                  </div>
                ))}
              </fieldset>
            ))}
            <button className="btn" disabled={state.busy}>
              Save matching weights
            </button>
          </form>
        </details>
      </section>
    </>
  );
}
