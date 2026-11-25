import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import FormErrors from "../components/FormErrors.jsx";
import PrototypeShortcut from "../components/PrototypeShortcut.jsx";
import SignupPage from "./SignupPage.jsx";
import { mentorFormats } from "../data/mentor-formats.js";
import { mentorGuidelines } from "../data/mentor-guidelines.js";
import SelectField from "../components/SelectField.jsx";
import LimitedTextarea from "../components/LimitedTextarea.jsx";
import TagProposal from "../components/TagProposal.jsx";
import {
  capacityFieldLabels,
  capacityLimits,
  conflictRelations,
  responseDayOptions,
  timeZoneOptions,
} from "../data/mentor-rules.js";
import {
  approvalCopy,
  bioLimit,
  experienceLimit,
  finalRejection,
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
            <SelectField
              name={`relation-${index}`}
              defaultValue={row.relation || "advisor"}
            >
              {conflictRelations.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </SelectField>
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
          <SelectField
            id="verification-method"
            name="method"
            defaultValue={application.verification?.method || "linkedin"}
          >
            <option value="linkedin">LinkedIn profile</option>
            <option value="work-email">Work email</option>
            <option value="organization">Endorsing organization</option>
          </SelectField>
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
          {["maxMentees", "monthlyHours", "maxOpenAsync"].map((id) => (
            <div className="field" key={id}>
              <label htmlFor={`application-${id}`}>
                {capacityFieldLabels[id]}
              </label>
              <input
                id={`application-${id}`}
                type="number"
                inputMode="numeric"
                name={id}
                min={capacityLimits[id][0]}
                max={capacityLimits[id][1]}
                step="1"
                required
                defaultValue={profile.capacity[id]}
              />
              <p className="field-help">
                {capacityLimits[id][0]} to {capacityLimits[id][1]}
              </p>
            </div>
          ))}
          <SelectField
            id="application-responseDays"
            name="responseDays"
            label={capacityFieldLabels.responseDays}
            defaultValue={String(profile.capacity.responseDays)}
            options={responseDayOptions.map((day) => ({
              value: String(day),
              label: `${day} ${day === 1 ? "day" : "days"}`,
            }))}
          />
          {/* The same list Settings uses, so a zone is always valid. */}
          <SelectField
            id="application-timeZone"
            name="timeZone"
            label={capacityFieldLabels.timeZone}
            defaultValue={
              profile.timeZone ||
              Intl.DateTimeFormat().resolvedOptions().timeZone
            }
            options={timeZoneOptions(profile.timeZone)}
          />
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
        <>
          <LimitedTextarea
            id="application-experience"
            name="experience"
            label="Experience summary (optional)"
            limit={experienceLimit}
            defaultValue={profile.pastExperience}
            help="Roles, startups and projects that shape your advice. It appears as Past experience on your profile."
          />
          <LimitedTextarea
            id="application-bio"
            name="bio"
            label="Short introduction"
            limit={bioLimit}
            defaultValue={profile.bio}
            required
            placeholder="In two or three sentences: who you help and what founders leave a session with."
            help="Founders read this first on your profile, and you need it to send introductions."
          />
        </>
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
  const closed = finalRejection(application);
  if (status !== "draft")
    return (
      <div className="page page-enter">
        <PageHeader
          title={
            !application
              ? "Mentor profile approved"
              : status === "pending"
                ? "Application under review"
                : closed
                  ? "Mentor application not approved"
                  : "Mentor application needs changes"
          }
        />
        {application && (
          <p>{approvalCopy(application, config.approvalTargetBusinessDays)}</p>
        )}
        {/* TEMPORARY demo shortcut, shown only when the server allows it. */}
        {status === "pending" && state.integrations?.simulateVerification && (
          <PrototypeShortcut note="skip the moderator and approve this application now.">
            <button
              type="button"
              className="btn small"
              disabled={state.busy}
              onClick={(event) =>
                onAction({ action: "simulate-mentor-approval" }, event)
              }
            >
              {state.busy ? "Approving…" : "Simulate approval"}
            </button>
          </PrototypeShortcut>
        )}
        <div className="mentor-request-controls">
          {closed && (
            <button
              className="btn primary"
              onClick={() => onAction({ action: "open-profile-switch" })}
            >
              Switch profiles in Settings
            </button>
          )}
          {status === "rejected" && !closed && (
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
      {/* (Nov 22, round 2) A missing topic goes through the moderated
          proposal path; approved tags join this list. */}
      {step === 1 && (
        <section
          className="card panel section-gap"
          aria-labelledby="expertise-proposal"
        >
          <h2 id="expertise-proposal">Missing a topic?</h2>
          <p>
            Propose a tag, for example customer retention. A moderator reviews
            it, and once approved it appears in this list for every mentor.
          </p>
          <TagProposal id="application-tag" label="Topic to propose" />
        </section>
      )}
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
