import { useApp } from "../state/AppContext.jsx";
import { useDraft } from "../state/useDraft.js";
import { priceLabel } from "../data/pricing.js";
import { mentorFormat } from "../data/mentor-formats.js";
import { unavailableText } from "../data/mentor-rules.js";
import {
  requestFields,
  requestSuggestions,
} from "../data/request-assistant.js";
import VerificationGate from "./VerificationGate.jsx";
import { verificationRequired } from "../data/collaboration.js";
import SelectField from "./SelectField.jsx";
import SimulateAcceptance from "./SimulateAcceptance.jsx";
import { mentoringTypes } from "../data/collaboration-types.js";
import { qualityLabel } from "../data/request-assistant.js";

export function MentorAlternatives({ alternatives, referralId }) {
  const { onAction } = useApp();
  if (!alternatives?.length) return null;
  return (
    <div className="mentoring-alternatives">
      <h3>
        {referralId ? "Suggested mentors" : "Other mentors taking requests"}
      </h3>
      <ul>
        {alternatives.map((mentor) => (
          <li key={mentor.id}>
            <span>
              <strong>{mentor.name}</strong> · {mentor.score}% match
            </span>
            <button
              className="btn small"
              aria-label={`${referralId ? "Ask" : "View match"}, ${mentor.name}`}
              onClick={() =>
                onAction({ action: "match-detail", id: mentor.id, referralId })
              }
            >
              {referralId ? "Ask" : "View match"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MentorRequestForm({ person, referral, alternatives }) {
  const { state, onAction } = useApp();
  const formats = (person.availableFormats || []).filter(
    (id) => id !== "office-hours",
  );
  // A half-written request survives a refresh in this tab. It is kept per
  // account, role and mentor, and cleared once the request is sent.
  const saved = useDraft(
    `${state.accountId}:mentor-request:${state.role}:${person.id}`,
    {
      problem: referral?.problem || "",
      tried: referral?.tried || "",
      question: referral?.question || "",
      desiredOutcome: referral?.desiredOutcome || "",
      category: referral?.category || "",
      format: formats.includes(referral?.format)
        ? referral.format
        : formats[0] || "",
      sharpenedFrom: null,
      linksText: referral?.links?.join("\n") || "",
    },
  );
  const { linksText, ...draft } = saved.values;
  if (!formats.includes(draft.format)) draft.format = formats[0] || "";
  // Only the kinds of mentoring this mentor covers can be asked for.
  const types = mentoringTypes(person.offer, person.sector);
  if (!types.includes(draft.category)) draft.category = types[0];
  // "product and marketing"
  const typeList = (
    types.length > 1
      ? `${types.slice(0, -1).join(", ")} and ${types.at(-1)}`
      : types[0]
  ).toLowerCase();
  const setDraft = (update) => {
    const next = typeof update === "function" ? update(saved.values) : update;
    saved.update({ ...saved.values, ...next });
  };
  const setLinksText = (value) => setDraft({ linksText: value });
  const links = linksText.split(/\s+/).filter(Boolean);
  const assistant = requestSuggestions({ ...draft, links }, formats);
  const pending = state.mentorRequests?.find(
    (entry) => entry.partnerId === person.id && entry.status === "pending",
  );
  const errors =
    state.formErrors?.scope === "send-request" && state.formErrors.fields;
  const actionError =
    state.mentorshipActionError?.id === person.id &&
    state.mentorshipActionError;
  const locked = verificationRequired(state);
  const change = (field, value) =>
    setDraft((old) => ({ ...old, [field]: value }));
  if (pending)
    return (
      <>
        <h2>Mentorship request sent</h2>
        <p>Waiting for {person.name} to reply.</p>
        <button
          className="btn"
          onClick={() =>
            onAction({
              action: "mentor-request-link",
              page: "waiting",
              requestId: pending.id,
            })
          }
        >
          View request
        </button>
        <SimulateAcceptance person={person} sent="mentorship request" />
      </>
    );
  if (!formats.length)
    return (
      <>
        <h2>Mentorship requests</h2>
        <p>
          {unavailableText(person.reason, person.name, {
            month: person.reasonMonth,
          }) || "This mentor is currently unavailable."}
        </p>
        <MentorAlternatives alternatives={alternatives} />
      </>
    );
  return (
    <>
      <h2>Request mentorship</h2>
      {referral && (
        <p>
          Review what you want to share with {person.name} before sending your
          request.
        </p>
      )}
      {actionError && (
        <div className="warning-note" role="status">
          {actionError.message}
        </div>
      )}
      <MentorAlternatives alternatives={actionError?.alternatives} />
      <form
        className="mentor-request-form"
        data-form="send-request"
        onSubmit={async (event) => {
          event.preventDefault();
          // Unverified: say so and offer Verification before checking fields.
          if (locked) {
            onAction({ action: "verification-prompt", reason: "send-request" });
            return;
          }
          // Spaces alone pass the browser's checks; name the fields instead.
          const short = Object.fromEntries(
            Object.keys(requestFields)
              .filter((key) => draft[key].trim().length < 20)
              .map((key) => [key, "Add at least 20 characters."]),
          );
          if (Object.keys(short).length) {
            onAction({
              action: "request-error",
              scope: "send-request",
              fields: short,
              message: "Review the highlighted details and try again.",
            });
            document
              .getElementById(`mentor-request-${Object.keys(short)[0]}`)
              ?.focus();
            return;
          }
          const sent = await onAction({
            action: "send-request",
            id: person.id,
            values: { ...draft, links, referralId: referral?.id },
          });
          if (sent) saved.clear();
        }}
      >
        <div className="field">
          <label htmlFor="mentor-request-category">
            What kind of mentoring do you need?
          </label>
          <SelectField
            id="mentor-request-category"
            name="category"
            value={draft.category}
            onChange={(event) => change("category", event.target.value)}
            required
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {type === "General" ? "General mentoring" : `${type} mentoring`}
              </option>
            ))}
          </SelectField>
          <p className="field-help">
            {types[0] === "General"
              ? `${person.name} hasn't listed focus areas, so this is general mentoring.`
              : `${person.name} mentors in ${typeList}.`}
          </p>
        </div>
        {Object.entries(requestFields).map(([key, label]) => (
          <div className="field" key={key}>
            <label htmlFor={`mentor-request-${key}`}>{label}</label>
            <textarea
              id={`mentor-request-${key}`}
              name={key}
              required
              minLength={20}
              maxLength={1000}
              data-validation-message="Add at least 20 characters."
              aria-invalid={Boolean(errors?.[key])}
              aria-describedby={`mentor-request-${key}-help`}
              value={draft[key]}
              onChange={(event) => change(key, event.target.value)}
            />
            <p
              id={`mentor-request-${key}-help`}
              className={
                errors?.[key] ? "field-help field-error" : "field-help"
              }
            >
              {errors?.[key] || "20 to 1,000 characters"}
            </p>
          </div>
        ))}
        <div className="field">
          <label htmlFor="mentor-request-outcome">
            Desired outcome (optional)
          </label>
          <textarea
            id="mentor-request-outcome"
            name="desiredOutcome"
            maxLength={1000}
            value={draft.desiredOutcome}
            aria-invalid={Boolean(errors?.desiredOutcome)}
            onChange={(event) => change("desiredOutcome", event.target.value)}
          />
          {errors?.desiredOutcome && (
            <p className="field-help">{errors.desiredOutcome}</p>
          )}
        </div>
        <div className="field">
          <label htmlFor="mentor-request-format">
            Which format do you prefer?
          </label>
          <SelectField
            id="mentor-request-format"
            name="format"
            value={draft.format}
            onChange={(event) => change("format", event.target.value)}
            required
          >
            {formats.map((id) => {
              const format = mentorFormat(id);
              return (
                <option key={id} value={id}>
                  {format.label} · {format.effort} ·{" "}
                  {priceLabel(
                    person.formats?.find((item) => item.id === id)?.price || 0,
                  )}
                </option>
              );
            })}
          </SelectField>
          {person.formats
            ?.filter(({ id }) => id !== "office-hours" && !formats.includes(id))
            .map(({ id }) => (
              <p key={id} className="field-help">
                {unavailableText(person.formatReasons?.[id], person.name, {
                  format: id,
                  month: person.formatReasonMonths?.[id],
                }) || `${mentorFormat(id).label} isn't open right now.`}
              </p>
            ))}
        </div>
        <div className="field">
          <label htmlFor="mentor-request-links">Links (optional)</label>
          <textarea
            id="mentor-request-links"
            name="links"
            rows={2}
            value={linksText}
            aria-describedby="mentor-request-links-help"
            aria-invalid={Boolean(errors?.links)}
            onChange={(event) => setLinksText(event.target.value)}
          />
          <p className="field-help" id="mentor-request-links-help">
            {errors?.links || "Add up to five links, one per line."}
          </p>
        </div>
        {/* Amber only when the request needs work (readiness plan P6). */}
        <section
          className={
            assistant.score < 60
              ? "mentoring-banner"
              : "mentoring-banner request-quality-good"
          }
          aria-label="Request assistant"
        >
          <div className="quality-head">
            <h3>Quality of Request</h3>
            <span className="quality-badge">
              {qualityLabel(assistant.score)}
              <span className="visually-hidden">
                , {assistant.score} out of 100
              </span>
            </span>
          </div>
          {assistant.reasons.length > 0 && (
            <ul>
              {assistant.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {assistant.rewrite && (
            <>
              <p>{assistant.rewrite}</p>
              <button
                type="button"
                className="btn small"
                onClick={() =>
                  setDraft((old) => ({
                    ...old,
                    question: assistant.rewrite.slice(0, 1000),
                    sharpenedFrom: old.sharpenedFrom || old.question,
                  }))
                }
              >
                Use suggested question
              </button>
            </>
          )}
          {assistant.format && assistant.format.id !== draft.format && (
            <button
              type="button"
              className="btn small"
              onClick={() => change("format", assistant.format.id)}
            >
              Choose {assistant.format.label}
            </button>
          )}
        </section>
        {locked && <VerificationGate />}
        <button className="btn primary full" disabled={state.busy}>
          {state.busy ? "Sending…" : "Send mentorship request"}
        </button>
        <details className="field-help">
          <summary>Only {person.name} sees this request</summary>
          <p>
            A referral shares mentor suggestions with you. You choose whether to
            send a new request. If this request is declined, expires or is
            returned, the mentor's copy of the answers is removed after{" "}
            {state.mentorConfig?.requestContentRetentionDays ?? 30} days.
          </p>
        </details>
      </form>
    </>
  );
}
