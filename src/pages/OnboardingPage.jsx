import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import FormErrors from "../components/FormErrors.jsx";
import SignupPage from "./SignupPage.jsx";
import { mentorFormats } from "../data/mentor-formats.js";
import { mentorGuidelines } from "../data/mentor-guidelines.js";
import {
  capacityLimits,
  conflictRelations,
  responseDayOptions,
} from "../data/mentor-rules.js";
import {
  approvalCopy,
  mentorApplicationSteps,
} from "../data/mentor-onboarding.js";

function ConflictsStep({ profile }) {
  const [rows, setRows] = useState(() => profile.conflicts || []);
  const [none, setNone] = useState(Boolean(profile.noConflicts));
  return (
    <fieldset className="mentor-request-form">
      <legend>Disclose conflicts of interest</legend>
      <label>
        <input
          type="checkbox"
          name="noConflicts"
          checked={none}
          onChange={(event) => {
            setNone(event.target.checked);
            if (event.target.checked) setRows([]);
          }}
        />{" "}
        I have no conflicts
      </label>
      {rows.map((row, index) => (
        <fieldset className="mentor-request-form" key={index}>
          <legend>Conflict {index + 1}</legend>
          <label>
            Company
            <input
              name={`company-${index}`}
              defaultValue={row.company}
              maxLength={100}
              required
            />
          </label>
          <label>
            Relationship
            <select
              name={`relation-${index}`}
              defaultValue={row.relation || "advisor"}
            >
              {conflictRelations.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Industry (optional)
            <input
              name={`industry-${index}`}
              defaultValue={row.industry}
              maxLength={60}
            />
          </label>
        </fieldset>
      ))}
      {rows.length > 0 && (
        <button
          className="btn small"
          type="button"
          onClick={() => setRows(rows.slice(0, -1))}
        >
          Remove last conflict
        </button>
      )}
      {!none && rows.length < 20 && (
        <button
          className="btn"
          type="button"
          onClick={() => setRows([...rows, {}])}
        >
          Add a conflict
        </button>
      )}
    </fieldset>
  );
}

function ApplicationFields({ application, profile, config, vocabulary }) {
  switch (application.step) {
    case 0:
      return (
        <>
          <label htmlFor="verification-method">Verification method</label>
          <select
            id="verification-method"
            name="method"
            defaultValue={application.verification?.method || "linkedin"}
          >
            <option value="linkedin">LinkedIn profile</option>
            <option value="work-email">Work email</option>
            <option value="organization">Endorsing organization</option>
          </select>
          <label htmlFor="verification-evidence">Verification details</label>
          <textarea
            id="verification-evidence"
            name="evidence"
            maxLength={500}
            defaultValue={application.verification?.evidence}
            required
          />
          <p className="field-help">
            Moderators check your LinkedIn URL, work email, or organization and
            reference details.
          </p>
        </>
      );
    case 1:
      return (
        <fieldset className="mentor-request-form">
          <legend>Choose at least three expertise tags</legend>
          {vocabulary.map((topic) => (
            <label key={topic}>
              <input
                type="checkbox"
                name="topics"
                value={topic}
                defaultChecked={String(profile.topics || "")
                  .split(/,\s*/)
                  .includes(topic)}
              />{" "}
              {topic}
            </label>
          ))}
        </fieldset>
      );
    case 2:
      return (
        <>
          {Object.entries({
            maxMentees: "Mentees at once",
            monthlyHours: "Hours per month",
            maxOpenAsync: "Open quick asks and reviews",
          }).map(([id, label]) => (
            <label key={id}>
              {label}
              <input
                type="number"
                name={id}
                min={capacityLimits[id][0]}
                max={capacityLimits[id][1]}
                required
                defaultValue={profile.capacity[id]}
              />
            </label>
          ))}
          <label>
            Response time
            <select
              name="responseDays"
              defaultValue={profile.capacity.responseDays}
            >
              {responseDayOptions.map((day) => (
                <option value={day} key={day}>
                  {day} {day === 1 ? "day" : "days"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time zone
            <input
              name="timeZone"
              required
              defaultValue={
                profile.timeZone ||
                Intl.DateTimeFormat().resolvedOptions().timeZone
              }
            />
          </label>
        </>
      );
    case 3:
      return (
        <fieldset className="mentor-request-form">
          <legend>Choose the formats you offer</legend>
          {mentorFormats.map((format) => (
            <label key={format.id}>
              <input
                type="checkbox"
                name="formats"
                value={format.id}
                defaultChecked={profile.formats.some(
                  (option) => option.id === format.id,
                )}
              />{" "}
              {format.label} · {format.effort}
            </label>
          ))}
        </fieldset>
      );
    case 4:
      return <ConflictsStep profile={profile} />;
    case 5:
      return (
        <>
          <div>
            {mentorGuidelines.sections.map((section) => (
              <details key={section.title}>
                <summary>{section.title}</summary>
                <ul>
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
          <input
            type="hidden"
            name="version"
            value={config.guidelinesVersion}
          />
          <label>
            <input
              type="checkbox"
              name="agreed"
              defaultChecked={
                profile.guidelinesVersion === config.guidelinesVersion
              }
              required
            />{" "}
            I accept the mentor guidelines (version {config.guidelinesVersion})
          </label>
        </>
      );
    case 6:
      return (
        <label>
          Experience summary (optional)
          <textarea
            name="experience"
            maxLength={1500}
            defaultValue={profile.pastExperience}
          />
        </label>
      );
    default:
      return (
        <>
          <label>
            Startup stages (optional)
            <input
              name="stages"
              maxLength={250}
              defaultValue={profile.stages?.join(", ")}
            />
          </label>
          <label>
            Industries (optional)
            <input
              name="industries"
              maxLength={250}
              defaultValue={profile.industries?.join(", ")}
            />
          </label>
          <p className="field-help">Separate preferences with commas.</p>
        </>
      );
  }
}

function MentorApplication({ application }) {
  const { state, onAction } = useApp();
  const goHome = () => onAction({ page: "home" });
  const step = application?.step || 0;
  const status = application?.status;
  const config = state.mentorConfig;
  if (status !== "draft")
    return (
      <div className="page page-enter">
        <PageHeader
          title={
            !application
              ? "Mentor profile approved"
              : status === "pending"
                ? "Application under review"
                : "Mentor application needs changes"
          }
        />
        {application && (
          <p>{approvalCopy(application, config.approvalTargetBusinessDays)}</p>
        )}
        <div className="mentor-request-controls">
          {status === "rejected" && application.attempts < 2 && (
            <button
              className="btn primary"
              disabled={state.busy}
              onClick={(event) =>
                onAction({ action: "mentor-onboarding-save" }, event)
              }
            >
              Edit and resubmit
            </button>
          )}
          <button className="btn" onClick={goHome}>
            Go to Home
          </button>
        </div>
      </div>
    );
  return (
    <div className="page page-enter mentor-application">
      <PageHeader
        title="Mentor application"
        intro={`Step ${step + 1} of ${mentorApplicationSteps.length} · ${mentorApplicationSteps[step]}`}
      />
      <form
        className="card panel mentor-request-form"
        key={step}
        onSubmit={(event) => {
          const form = new FormData(event.currentTarget);
          const values = Object.fromEntries(form);
          values.step = step;
          if (step === 1) values.topics = form.getAll("topics");
          if (step === 3) values.formats = form.getAll("formats");
          if (step === 4)
            values.conflicts = [...form.keys()]
              .filter((key) => key.startsWith("company-"))
              .map((key) => {
                const index = key.slice("company-".length);
                return {
                  company: form.get(key),
                  relation: form.get(`relation-${index}`),
                  industry: form.get(`industry-${index}`),
                };
              });
          return onAction({ action: "mentor-onboarding-save", values }, event);
        }}
      >
        <FormErrors scope="mentor-onboarding-save" />
        <ApplicationFields
          application={application}
          profile={state.profiles.mentor}
          config={config}
          vocabulary={state.vocabulary || []}
        />
        <button className="btn primary" disabled={state.busy}>
          {state.busy
            ? "Saving…"
            : step === mentorApplicationSteps.length - 1
              ? "Submit for approval"
              : "Save and continue"}
        </button>
        <div className="mentor-request-controls">
          {step > 0 && (
            <button
              className="btn"
              type="button"
              disabled={state.busy}
              onClick={(event) =>
                onAction({ action: "mentor-onboarding-back" }, event)
              }
            >
              Previous step
            </button>
          )}
          <button className="btn" type="button" onClick={goHome}>
            Continue later
          </button>
        </div>
      </form>
    </div>
  );
}

export default function OnboardingPage() {
  const { state } = useApp();
  return state.authenticated && state.role === "mentor" ? (
    <MentorApplication application={state.mentorApplication} />
  ) : (
    <SignupPage />
  );
}
