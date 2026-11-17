import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import { analyzeDescription } from "../data/profile-assistant.js";
import { stageLabel } from "../data/profile-presentation.js";

const toggle = (list, value) =>
  list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];

// Turns a founder's own description into suggested profile details. Nothing is
// applied until the founder reviews and edits the suggestions (§4, §10).
export default function ProfileAssistant({ values, onApply }) {
  const { state, onSubmit } = useApp();
  const [text, setText] = useState(values.bio || "");
  const [result, setResult] = useState(null);
  const [needs, setNeeds] = useState([]);
  const [offers, setOffers] = useState([]);
  const [answers, setAnswers] = useState({});
  const [details, setDetails] = useState({});
  const [proposed, setProposed] = useState([]);
  const vocabulary = state.vocabulary || [];
  const analyze = () => {
    const next = analyzeDescription(text, vocabulary);
    setResult(next);
    setNeeds(next.needs);
    setOffers(next.offers);
    setAnswers({});
    setDetails({
      industry: next.industry,
      stage: next.stage,
      teamSize: next.teamSize,
      audienceSize: next.audienceSize,
    });
  };
  const apply = () => {
    const chosenNeeds = [
      ...new Set([...needs, ...Object.values(answers).filter(Boolean)]),
    ];
    const keep = (current, suggestion) =>
      String(current || "").trim() ? current : suggestion;
    onApply({
      bio: keep(values.bio, text.trim()),
      need: keep(values.need, result.needText || chosenNeeds.join(", ")),
      offer: keep(values.offer, result.offerText || offers.join(", ")),
      needTags: chosenNeeds.join(", "),
      offerTags: offers.join(", "),
      industry: keep(values.industry, details.industry),
      stage: keep(values.stage, details.stage),
      teamSize: keep(values.teamSize, details.teamSize),
      audienceSize: keep(values.audienceSize, details.audienceSize),
      goals: keep(values.goals, result.goals),
    });
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
        value={text}
        maxLength={2000}
        rows={4}
        placeholder="For example: We’re a 4-person team building a budgeting app for students, about 8 months in, and we’re looking for people to try it out and tell us what’s broken."
        onChange={(event) => setText(event.target.value)}
      />
      <button
        type="button"
        className="btn"
        disabled={!text.trim()}
        onClick={analyze}
      >
        Suggest profile details
      </button>
      {result && (
        <div
          className="assistant-result"
          role="region"
          aria-label="Suggestions"
        >
          <h3>Suggested from your description</h3>
          <p className="muted">
            Select or clear tags, answer any questions, then apply. You can
            still edit every field afterwards.
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
                    checked={answers[index] === option}
                    onChange={() => setAnswers({ ...answers, [index]: option })}
                  />{" "}
                  {option}
                </label>
              ))}
            </fieldset>
          ))}
          <dl className="assistant-details">
            {[
              ["industry", "Industry", details.industry],
              ["stage", "Stage", stageLabel(details.stage)],
              ["teamSize", "Team size", details.teamSize],
              ["audienceSize", "Audience size", details.audienceSize],
            ]
              .filter(([, , value]) => value)
              .map(([key, label, value]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {value}{" "}
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setDetails({ ...details, [key]: "" })}
                    >
                      Remove<span className="visually-hidden"> {label}</span>
                    </button>
                  </dd>
                </div>
              ))}
          </dl>
          {result.unmatched.length > 0 && (
            <div className="info-note">
              <p>
                Some of your wording does not match a standard tag yet. You can
                ask a moderator to add it. We match on your other tags until
                then.
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
            <button type="button" className="btn primary" onClick={apply}>
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
          <p className="muted">
            Applying fills empty fields only and sets your standard tags. It
            does not save your profile.
          </p>
        </div>
      )}
    </section>
  );
}
