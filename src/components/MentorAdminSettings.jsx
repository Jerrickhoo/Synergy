import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import FormErrors from "./FormErrors.jsx";
import { formatDateTime } from "../data/dates.js";

const valueText = (value) =>
  Array.isArray(value) ? value.join(", ") : String(value);
const labelFor = (path) =>
  path
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[.]/g, " / ")
    .replace(/^[a-z]/, (letter) => letter.toUpperCase());

function Metrics({ gate }) {
  return (
    <section className="card panel section-gap">
      <h2>Mentorship launch metrics</h2>
      <p>
        {gate.consecutiveWeeks} of 4 consecutive weeks at target ·{" "}
        {gate.ready ? "Ready for v1.1 review" : "Gathering results"}
      </p>
      <dl className="impact-stats">
        {gate.current.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>
              {metric.value == null
                ? "Not enough data yet"
                : metric.denominator == null
                  ? metric.value
                  : `${Math.round(metric.value * 100)}%`}
            </dd>
            <dd>
              Target{" "}
              {metric.denominator == null
                ? metric.threshold
                : `${Math.round(metric.threshold * 100)}%`}
            </dd>
            {metric.denominator != null && (
              <dd>
                {metric.numerator} of {metric.denominator}
              </dd>
            )}
          </div>
        ))}
      </dl>
      {gate.weeks?.length > 0 && (
        <details>
          <summary>Weekly history</summary>
          <ul>
            {gate.weeks.map((week) => (
              <li key={week.week}>
                {week.week} · {week.met ? "Targets met" : "Targets missed"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export default function MentorAdminSettings() {
  const { state, onSubmit } = useApp();
  const data = state.moderation?.mentoring;
  const [path, setPath] = useState("freeReschedulesPerSide");
  if (!data) return null;
  const entry = data.entries.find((item) => item.path === path);
  return (
    <>
      <section className="card panel section-gap">
        <h2>Mentoring settings</h2>
        <form
          data-form="mentor-config"
          className="mentor-request-form"
          onSubmit={onSubmit}
        >
          <FormErrors scope="mentor-config" />
          <label htmlFor="mentor-setting-path">Setting</label>
          <select
            id="mentor-setting-path"
            name="path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
          >
            {data.entries.map(({ path: key }) => (
              <option value={key} key={key}>
                {labelFor(key)}
              </option>
            ))}
          </select>
          {entry && (
            <>
              <label htmlFor="mentor-setting-value">New value</label>
              <input
                key={`${path}:${valueText(entry.value)}`}
                id="mentor-setting-value"
                name="value"
                defaultValue={valueText(entry.value)}
                required
              />
              <button className="btn primary" disabled={state.busy}>
                Save mentoring setting
              </button>
            </>
          )}
        </form>
        <details className="section-gap">
          <summary>Mentoring change log</summary>
          {data.history.length ? (
            <ol>
              {data.history.map((item) => (
                <li key={item.id}>
                  {formatDateTime(item.at)} · {item.moderator} ·{" "}
                  {labelFor(item.path)} changed from {valueText(item.before)} to{" "}
                  {valueText(item.value)}
                </li>
              ))}
            </ol>
          ) : (
            <p>No changes recorded.</p>
          )}
        </details>
      </section>
      <Metrics gate={data.gate} />
    </>
  );
}
