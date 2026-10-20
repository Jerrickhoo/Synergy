import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import { suggestTags } from "../data/collaboration.js";

export default function ProfileAssistant({ onApply }) {
  const { state, integrationRequest, notify } = useApp();
  const [story, setStory] = useState("");
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);
  const [clarification, setClarification] = useState("");
  const [suggestions, setSuggestions] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [answerHistory, setAnswerHistory] = useState([]);
  const [proposedTags, setProposedTags] = useState([]);
  const [submittedTags, setSubmittedTags] = useState([]);
  const ambiguousFunding =
    /funding|fundrais|capital|investor/i.test(story) &&
    !/advice|guidance|intro|pitch/i.test(story);
  async function generate() {
    setError("");
    setDraft(null);
    setApplied(false);
    try {
      if (story.trim().length < 20) {
        const message =
          "Add at least 20 characters about your work, skills and needs.";
        setError(message);
        notify(message, "error", "Tell us a little more");
        return;
      }
      if (ambiguousFunding && !clarification) {
        setError(
          "Choose whether you need fundraising advice or investor introductions before generating a draft.",
        );
        return;
      }
      if (questions.some((question) => !answers[question]?.trim())) {
        setError(
          "Answer each clarification question, or enter ‘unknown’ to leave that detail blank.",
        );
        return;
      }
      const history = [
        ...answerHistory,
        ...questions.map((question) => ({
          question,
          answer: answers[question].trim(),
        })),
      ];
      if (history.length > 12) {
        setError(
          "Start with revised notes that include your answers to continue.",
        );
        return;
      }
      const result = await integrationRequest("ai/profile", {
        role: state.role,
        story: `${story}${clarification ? `\nI need ${clarification}.` : ""}`,
        answers: history,
      });
      setDraft(result.draft);
      setAnswerHistory(history);
      setQuestions(result.clarifications || []);
      setAnswers({});
      setProposedTags(result.proposedTags || []);
      setSuggestions(
        result.suggestedTags || {
          offer: suggestTags(result.draft.offer, state.vocabulary),
          need: suggestTags(result.draft.need, state.vocabulary),
        },
      );
      notify(
        result.clarifications?.length
          ? "A few details need clarification. Review the questions below."
          : "Your draft is ready. Review the suggestions before saving.",
      );
    } catch (error) {
      setError(error.message);
    }
  }
  return (
    <details className="profile-assistant">
      <summary>Get help drafting your profile</summary>
      {state.integrations?.ai ? (
        <>
          <p className="muted">
            Describe your work, what you offer and the help you need. These
            notes are sent to OpenAI to draft suggestions. Review them before
            saving. Limit: five requests per day.
          </p>
          <label htmlFor="profile-notes">Your notes</label>
          <textarea
            id="profile-notes"
            value={story}
            maxLength={3900}
            onChange={(event) => {
              setStory(event.target.value);
              setDraft(null);
              setSuggestions(null);
              setQuestions([]);
              setAnswers({});
              setAnswerHistory([]);
              setProposedTags([]);
              setApplied(false);
              setClarification("");
            }}
            placeholder="We are a team of three building study tools. We can offer web development and need beta testers…"
          />
          <button
            className="btn"
            type="button"
            disabled={state.busy}
            onClick={generate}
          >
            {questions.length ? "Generate updated draft" : "Generate draft"}
          </button>
          {ambiguousFunding && (
            <div className="field">
              <label htmlFor="funding-clarification">
                What kind of fundraising help?
              </label>
              <select
                id="funding-clarification"
                value={clarification}
                onChange={(event) => {
                  setClarification(event.target.value);
                  setDraft(null);
                  setQuestions([]);
                  setAnswers({});
                  setAnswerHistory([]);
                  setProposedTags([]);
                }}
              >
                <option value="">Choose the help you mean</option>
                <option value="fundraising strategy and advice">
                  Strategy and advice
                </option>
                <option value="warm investor introductions">
                  Warm investor introductions
                </option>
                <option value="fundraising advice and investor introductions">
                  Both
                </option>
              </select>
            </div>
          )}
          {questions.length > 0 && (
            <div className="section-gap">
              <h3>Clarify your collaboration intent</h3>
              <p className="muted">
                Answer these questions before applying a draft. Enter “unknown”
                if you want to leave a detail blank. Each updated draft uses one
                daily request.
              </p>
              {questions.map((question, index) => (
                <div className="field" key={question}>
                  <label htmlFor={`ai-answer-${index}`}>{question}</label>
                  <textarea
                    id={`ai-answer-${index}`}
                    maxLength={1000}
                    value={answers[question] || ""}
                    onChange={(event) =>
                      setAnswers({ ...answers, [question]: event.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          )}
          {draft && (
            <div className="ai-draft">
              <h3>Review suggested details</h3>
              {suggestions && (
                <p>
                  Approved tag suggestions — offers:{" "}
                  {suggestions.offer.join(", ") || "none"}; needs:{" "}
                  {suggestions.need.join(", ") || "none"}. You can propose
                  missing tags below.
                </p>
              )}
              <dl>
                {Object.entries(draft).map(([key, value]) => (
                  <div key={key}>
                    <dt>
                      {{
                        bio: "About me",
                        offer: "What I offer",
                        need: "What I need",
                        teamSize: "Team size",
                        startups: "Startups I want to help",
                        pastExperience: "Past experience",
                      }[key] || key}
                    </dt>
                    <dd>{value || "Add this detail yourself"}</dd>
                  </div>
                ))}
              </dl>
              <button
                className="btn"
                type="button"
                disabled={state.busy || questions.length > 0}
                onClick={() => {
                  onApply({
                    ...draft,
                    offerTags: suggestions?.offer.join(", ") || "",
                    needTags: suggestions?.need.join(", ") || "",
                  });
                  setApplied(true);
                  notify(
                    "Suggestions added. Review your profile, then save your changes.",
                  );
                }}
              >
                Use these suggestions
              </button>
              {applied && (
                <p role="status">
                  Suggestions added below. Review the fields, then save your
                  profile.
                </p>
              )}
            </div>
          )}
          {draft && !questions.length && proposedTags.length > 0 && (
            <div className="section-gap">
              <h3>Suggested new community tags</h3>
              <p className="muted">
                These skills or needs do not have an approved tag yet. Review
                each suggestion and submit it for moderator approval. Your
                profile can already describe it in plain text.
              </p>
              {proposedTags.map((tag) => (
                <div className="section-gap" key={tag.label}>
                  <p>
                    <strong>{tag.label}</strong> ·{" "}
                    {tag.side === "offer" ? "Offer" : "Need"}
                  </p>
                  <p>{tag.reason}</p>
                  <button
                    type="button"
                    className="btn small"
                    disabled={state.busy || submittedTags.includes(tag.label)}
                    onClick={async () => {
                      try {
                        await integrationRequest("action", {
                          role: state.role,
                          form: "tag-proposal",
                          values: { label: tag.label },
                        });
                        setSubmittedTags((tags) => [...tags, tag.label]);
                        notify("Tag proposed for moderator review.");
                      } catch (error) {
                        setError(error.message);
                      }
                    }}
                  >
                    {submittedTags.includes(tag.label)
                      ? "Submitted for review"
                      : `Propose ${tag.label}`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="muted">
          AI assistance has not been enabled for this workspace yet. You can
          fill in the fields below.
        </p>
      )}
      {error && (
        <p className="integration-error" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
