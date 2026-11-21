import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import { analyzeDescription, replaceable } from "../data/profile-assistant.js";
import { stageLabel } from "../data/profile-presentation.js";

const toggle = (list, value) =>
  list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];

const fieldLabels = {
  startupName: "Startup name",
  bio: "About me",
  need: "What I need",
  offer: "What I offer",
  industry: "Industry",
  stage: "Stage",
  teamSize: "Team size",
  audienceSize: "Audience size",
  goals: "Collaboration goals",
  needTags: "Need tags",
  offerTags: "Offer tags",
};
const shown = (key, value) =>
  key === "stage" ? stageLabel(value) || value : value;

// Turns a founder's own description into suggested profile details. Each
// suggested field is listed against the current value; only checked fields
// are written to the draft, and nothing is saved until Save profile (§4, §10).
// `text` and `note` live in ProfilePage so they survive the form remount that
// follows Apply.
export default function ProfileAssistant({
  values,
  onApply,
  text,
  onTextChange,
  note,
}) {
  const { state, onAction, onSubmit } = useApp();
  const [result, setResult] = useState(null);
  const [needs, setNeeds] = useState([]);
  const [offers, setOffers] = useState([]);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState({});
  const [proposed, setProposed] = useState([]);
  const textRef = useRef(null);
  const vocabulary = state.vocabulary || [];
  useEffect(() => {
    if (!state.assistantFocus) return;
    textRef.current?.scrollIntoView({ block: "center" });
    textRef.current?.focus({ preventScroll: true });
    onAction({ action: "assistant-focused" });
  }, [state.assistantFocus]);
  const analyze = () => {
    const next = analyzeDescription(text, vocabulary);
    setResult(next);
    setNeeds(next.needs);
    setOffers(next.offers);
    setAnswers({});
    setChecked({});
  };
  const chosenNeeds = [
    ...new Set([...needs, ...Object.values(answers).filter(Boolean)]),
  ];
  const suggestions = result
    ? [
        ["startupName", result.startupName],
        ["bio", text.trim()],
        ["need", result.needText || chosenNeeds.join(", ")],
        ["offer", result.offerText || offers.join(", ")],
        ["industry", result.industry],
        ["stage", result.stage],
        ["teamSize", result.teamSize],
        ["audienceSize", result.audienceSize],
        ["goals", result.goals],
        ["needTags", chosenNeeds.join(", ")],
        ["offerTags", offers.join(", ")],
      ]
        .filter(([, value]) => String(value || "").trim())
        .filter(
          ([key, value]) =>
            String(values[key] || "").trim() !== String(value).trim(),
        )
        .map(([key, value]) => ({
          key,
          value,
          label: fieldLabels[key],
          current: String(values[key] || "").trim(),
          selected: checked[key] ?? replaceable(key, values[key]),
        }))
    : [];
  const selected = suggestions.filter((item) => item.selected);
  const apply = () => {
    onApply(
      Object.fromEntries(selected.map((item) => [item.key, item.value])),
      `Updated: ${selected.map((item) => item.label).join(", ")}. Select Save profile to keep these changes.`,
    );
    setResult(null);
  };
  const chips = (list, setList, label) => (
    <div className="field">
      <span className="tag-picker-label">{label}</span>
      <div className="tag-choices" role="group" aria-label={label}>
        {vocabulary.map((tag) => (
          <button
            key={tag}
            type="button"
            className="tag-choice"
            aria-pressed={list.includes(tag)}
            onClick={() => setList(toggle(list, tag))}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <section
      className="card profile-assistant"
      aria-labelledby="assistant-title"
    >
      <h2 id="assistant-title">Describe your startup in your own words</h2>
      <p className="muted">
        Say what you are building, what you have, and what would help most. We
        suggest offers, needs, standard tags and details for you to check. The
        text stays in your browser, and nothing is saved until you review it and
        select Save profile.
      </p>
      <label className="visually-hidden" htmlFor="assistant-text">
        Your description
      </label>
      <textarea
        id="assistant-text"
        ref={textRef}
        value={text}
        maxLength={2000}
        rows={4}
        placeholder="For example: We’re a seed-stage team of 6 building scheduling software for restaurants. We need help with pricing strategy. We can offer intros to restaurant operators."
        onChange={(event) => onTextChange(event.target.value)}
      />
      <button
        type="button"
        className="btn"
        disabled={!text.trim()}
        onClick={analyze}
      >
        Suggest profile details
      </button>
      {note && !result && (
        <p className="assistant-applied" role="status">
          {note}
        </p>
      )}
      {result && (
        <div
          className="assistant-result"
          role="region"
          aria-label="Suggestions"
        >
          <h3>Suggested from your description</h3>
          <p className="muted">
            Adjust the tags and answer any questions, then choose which fields
            to update. You can still edit every field afterwards.
          </p>
          {chips(needs, setNeeds, "You’re looking for")}
          {chips(offers, setOffers, "You can offer")}
          {result.questions.map((question, index) => (
            <fieldset className="assistant-question" key={question.question}>
              <legend>{question.question}</legend>
              {question.options.map((option) => (
                <label className="checkbox-label" key={option}>
                  <input
                    type="radio"
                    name={`assistant-question-${index}`}
                    form="assistant-choices"
                    checked={answers[index] === option}
                    onChange={() => setAnswers({ ...answers, [index]: option })}
                  />{" "}
                  {option}
                </label>
              ))}
            </fieldset>
          ))}
          {suggestions.length ? (
            <fieldset className="assistant-review">
              <legend>Fields to update</legend>
              {suggestions.map((item) => (
                <label className="assistant-review-row" key={item.key}>
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(event) =>
                      setChecked({
                        ...checked,
                        [item.key]: event.target.checked,
                      })
                    }
                  />
                  <span className="assistant-review-copy">
                    <strong>{item.label}</strong>
                    <span className="assistant-review-change">
                      <span className="muted">
                        {item.current ? shown(item.key, item.current) : "Empty"}
                      </span>
                      <span aria-hidden="true"> → </span>
                      <span className="visually-hidden"> becomes </span>
                      <span>{shown(item.key, item.value)}</span>
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="muted">Your profile already matches these details.</p>
          )}
          {result.unmatched.length > 0 && (
            <div className="info-note">
              <p>
                Some of your wording does not match a standard tag yet. It stays
                in What I need, and you can ask a moderator to add it as a tag.
              </p>
              {result.unmatched.map((phrase) => (
                <p key={phrase}>
                  “{phrase}”{" "}
                  {proposed.includes(phrase) ? (
                    <span className="muted">Sent for review</span>
                  ) : (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={async () => {
                        const form = document.createElement("form");
                        form.dataset.form = "tag-proposal";
                        const input = document.createElement("input");
                        input.name = "label";
                        input.value = phrase.slice(0, 60);
                        form.append(input);
                        if (
                          await onSubmit({
                            preventDefault() {},
                            currentTarget: form,
                          })
                        )
                          setProposed([...proposed, phrase]);
                      }}
                    >
                      Propose as a new tag
                    </button>
                  )}
                </p>
              ))}
            </div>
          )}
          <div className="chip-row">
            <button
              type="button"
              className="btn primary"
              disabled={!selected.length}
              onClick={apply}
            >
              Apply suggestions
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setResult(null)}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
