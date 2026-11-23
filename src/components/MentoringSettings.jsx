import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import SelectField from "./SelectField.jsx";
import FormErrors from "./FormErrors.jsx";
import { mentorFormats } from "../data/mentor-formats.js";
import { mentorGuidelines } from "../data/mentor-guidelines.js";
import {
  capacityFieldLabels,
  capacityLimits,
  capacityUsageText,
  closedFormatsLine,
  conflictRelations,
  mentorConfig,
  ownUnavailableText,
  responseDayOptions,
  timeZoneOptions,
} from "../data/mentor-rules.js";
import { dayKeyIn, formatDate, nextDayKey } from "../data/dates.js";

const date = (value) => (value ? formatDate(value, { year: true }) : "");

function SubmitButton({ busy, primary = false, children, busyText }) {
  return (
    <button className={`btn${primary ? " primary" : ""}`} disabled={busy}>
      {busy && <span className="spinner" aria-hidden="true" />}
      {busy ? busyText : children}
    </button>
  );
}

// The "Mentoring" section of Settings (roadmap Phase 1): Pause Mode, capacity,
// formats, time zone, conflicts of interest and the guidelines agreement.
export default function MentoringSettings() {
  const { state, onSubmit } = useApp();
  const [working, setWorking] = useState("");
  const mentor = state.profiles.mentor;
  const usage = state.mentorUsage;
  const capacity = usage?.capacity || mentor.capacity;
  const offered = new Set((mentor.formats || []).map((item) => item.id));
  const guidelines = usage?.guidelines || { status: "required" };
  const submit = async (event) => {
    const form = event.currentTarget.dataset.form;
    setWorking(form);
    try {
      return await onSubmit(event);
    } finally {
      setWorking("");
    }
  };
  const busy = (form) => working === form;
  const locked = Boolean(working) || state.busy;
  const blocked = usage && !usage.available && usage.reason !== "paused";

  return (
    <section
      className="card panel settings-section mentoring-settings"
      aria-labelledby="mentoring-settings"
    >
      <h2 id="mentoring-settings">Mentoring</h2>
      <p>
        Set how much you can take on. Founders only see you as available while
        you have room.
      </p>
      {blocked && (
        <p className="mentoring-status" role="status">
          {ownUnavailableText(usage.reason)}
        </p>
      )}

      <div className="mentoring-group">
        <h3>Pause Mode</h3>
        {mentor.paused ? (
          <form data-form="set-mentor-pause" onSubmit={submit}>
            <p>
              Pause Mode is on
              {mentor.pausedUntil
                ? ` until ${date(`${mentor.pausedUntil}T12:00:00Z`)}`
                : ""}
              . Founders can't send you new requests. Your current mentees are
              not affected.
            </p>
            <SubmitButton
              busy={busy("set-mentor-pause")}
              busyText="Turning off…"
            >
              Turn off Pause Mode
            </SubmitButton>
          </form>
        ) : (
          <form
            data-form="set-mentor-pause"
            className="mentoring-inline"
            onSubmit={submit}
          >
            <p>
              Stop new requests. Your current mentees are not affected, and
              pending requests go back to founders with other mentors to ask.
            </p>
            <input type="hidden" name="paused" value="on" />
            <div className="field">
              <label htmlFor="paused-until">Resume on (optional)</label>
              {/* (Nov 22, round 2) The earliest resume day is tomorrow in
                  the mentor's time zone; the server checks it too. */}
              <input
                id="paused-until"
                name="pausedUntil"
                type="date"
                min={nextDayKey(dayKeyIn(Date.now(), mentor.timeZone))}
              />
            </div>
            <SubmitButton busy={busy("set-mentor-pause")} busyText="Pausing…">
              Pause new requests
            </SubmitButton>
            <FormErrors scope="set-mentor-pause" />
          </form>
        )}
      </div>

      <form
        className="mentoring-group"
        data-form="mentor-capacity"
        onSubmit={submit}
        key={JSON.stringify([capacity, [...offered], mentor.timeZone])}
      >
        <h3>Capacity</h3>
        {usage && (
          <p className="mentoring-usage" role="status">
            {capacityUsageText(usage, capacity)}
          </p>
        )}
        {usage && closedFormatsLine(usage) && (
          <p className="mentor-closed-line">{closedFormatsLine(usage)}</p>
        )}
        <div className="mentoring-fields">
          {["maxMentees", "monthlyHours", "maxOpenAsync"].map((key) => (
            <div className="field" key={key}>
              <label htmlFor={`capacity-${key}`}>
                {capacityFieldLabels[key]}
              </label>
              <input
                id={`capacity-${key}`}
                name={key}
                type="number"
                inputMode="numeric"
                min={capacityLimits[key][0]}
                max={capacityLimits[key][1]}
                step="1"
                required
                defaultValue={capacity[key]}
              />
            </div>
          ))}
          <SelectField
            id="capacity-response"
            name="responseDays"
            label={capacityFieldLabels.responseDays}
            defaultValue={String(capacity.responseDays)}
            options={responseDayOptions.map((days) => ({
              value: String(days),
              label: `${days} ${days === 1 ? "day" : "days"}`,
            }))}
          />
        </div>

        <fieldset className="mentoring-formats">
          <legend>Formats you offer</legend>
          <p className="field-help">
            Keep at least one selected. Set prices in Payouts after completing
            payout setup.
          </p>
          {mentorFormats.map((format) => (
            <label className="mentoring-format" key={format.id}>
              <input
                type="checkbox"
                name={`format-${format.id}`}
                defaultChecked={offered.has(format.id)}
              />
              <span>
                <strong>{format.label}</strong>
                <span className="mentoring-format-effort">{format.effort}</span>
                <span className="field-help">{format.summary}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <SelectField
          id="mentor-time-zone"
          name="timeZone"
          label="Time zone"
          defaultValue={mentor.timeZone}
          options={timeZoneOptions(mentor.timeZone)}
        />
        <FormErrors scope="mentor-capacity" />
        <SubmitButton busy={busy("mentor-capacity")} busyText="Saving…">
          Save mentoring settings
        </SubmitButton>
      </form>

      <div className="mentoring-group">
        <h3>Conflicts of interest</h3>
        <p>
          List companies you advise, work for, invest in or founded. Founders
          from those companies won't see you, and you'll be warned about
          requests from the same industry. Nobody else sees this list.
        </p>
        {mentor.conflicts?.length ? (
          <ul className="mentoring-conflicts">
            {mentor.conflicts.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>{item.company}</strong>
                  <span className="muted">
                    {
                      conflictRelations.find(
                        ([value]) => value === item.relation,
                      )?.[1]
                    }
                    {item.industry ? ` · ${item.industry}` : ""}
                  </span>
                </span>
                <form data-form="mentor-conflicts" onSubmit={submit}>
                  <input type="hidden" name="op" value="remove" />
                  <input type="hidden" name="id" value={item.id} />
                  <button className="link-btn" disabled={locked}>
                    Remove
                    <span className="visually-hidden"> {item.company}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : mentor.noConflicts ? (
          <p className="muted">You confirmed you have no conflicts.</p>
        ) : (
          <form data-form="mentor-conflicts" onSubmit={submit}>
            <input type="hidden" name="op" value="none" />
            <button className="btn" disabled={locked}>
              I have no conflicts
            </button>
          </form>
        )}
        <form
          className="mentoring-conflict-form"
          data-form="mentor-conflicts"
          onSubmit={async (event) => {
            const form = event.currentTarget;
            if (await submit(event)) form.reset();
          }}
        >
          <input type="hidden" name="op" value="add" />
          <div className="field">
            <label htmlFor="conflict-company">Company</label>
            <input
              id="conflict-company"
              name="company"
              required
              minLength={2}
              maxLength={100}
            />
          </div>
          <SelectField
            id="conflict-relation"
            name="relation"
            label="Your connection"
            defaultValue="advisor"
            options={conflictRelations.map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <div className="field">
            <label htmlFor="conflict-industry">Industry (optional)</label>
            <input id="conflict-industry" name="industry" maxLength={60} />
          </div>
          <FormErrors scope="mentor-conflicts" />
          <SubmitButton busy={busy("mentor-conflicts")} busyText="Adding…">
            Add conflict
          </SubmitButton>
        </form>
      </div>

      <div className="mentoring-group" id="mentor-guidelines">
        <h3>Mentor guidelines</h3>
        {guidelines.status === "accepted" ? (
          <p>
            You accepted version {mentor.guidelinesVersion} on{" "}
            {date(mentor.guidelinesAcceptedAt)}.
          </p>
        ) : (
          <p>
            {guidelines.status === "grace"
              ? `Accept by ${date(guidelines.graceUntil)} to keep receiving requests.`
              : "Accept these to start receiving requests."}
          </p>
        )}
        <details
          className="mentoring-guidelines"
          open={guidelines.status !== "accepted"}
        >
          <summary>
            Read the guidelines (version{" "}
            {state.mentorConfig?.guidelinesVersion || mentorGuidelines.version})
          </summary>
          {mentorGuidelines.sections.map((section) => (
            <div key={section.title}>
              <h4>{section.title}</h4>
              <ul>
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="muted">{mentorGuidelines.consequences}</p>
        </details>
        {guidelines.status !== "accepted" && (
          <form data-form="accept-guidelines" onSubmit={submit}>
            <input
              type="hidden"
              name="version"
              value={
                state.mentorConfig?.guidelinesVersion ||
                mentorConfig.guidelinesVersion
              }
            />
            <SubmitButton
              primary
              busy={busy("accept-guidelines")}
              busyText="Accepting…"
            >
              Accept guidelines
            </SubmitButton>
          </form>
        )}
      </div>
    </section>
  );
}
