import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";

export default function ProfileAssistant({ onApply }) {
  const { state, integrationRequest } = useApp();
  const [story, setStory] = useState("");
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);
  async function generate() {
    setError("");
    setDraft(null);
    setApplied(false);
    try {
      if (story.trim().length < 20)
        throw new Error(
          "Add at least 20 characters about your work, skills and needs.",
        );
      const result = await integrationRequest("ai/profile", {
        role: state.role,
        story,
      });
      setDraft(result.draft);
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
            maxLength={4000}
            onChange={(event) => setStory(event.target.value)}
            placeholder="We are a team of three building study tools. We can offer web development and need beta testers…"
          />
          <button
            className="btn"
            type="button"
            disabled={state.busy}
            onClick={generate}
          >
            Generate draft
          </button>
          {draft && (
            <div className="ai-draft">
              <h3>Review suggested details</h3>
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
                      }[key] || key}
                    </dt>
                    <dd>{value || "Add this detail yourself"}</dd>
                  </div>
                ))}
              </dl>
              <button
                className="btn"
                type="button"
                disabled={state.busy}
                onClick={() => {
                  onApply(draft);
                  setApplied(true);
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
