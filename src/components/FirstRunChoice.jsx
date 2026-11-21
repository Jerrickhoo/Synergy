import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Brand from "./Brand.jsx";

// Prototype only: a new founder preview account chooses between their own
// startup and the sample one before entering the workspace.
export default function FirstRunChoice() {
  const { state, onAction } = useApp();
  const [choosing, setChoosing] = useState("");
  const choose = async (start, event) => {
    if (choosing) return;
    setChoosing(start);
    const done = await onAction(
      { action: "first-run-choice", values: { start } },
      event,
    );
    setChoosing("");
    if (!done) return;
    onAction(
      start === "blank" ? { action: "start-profile-setup" } : { page: "home" },
    );
  };
  return (
    <div className="first-run">
      <header className="first-run-header">
        <Brand compact />
        <button
          className="link-btn"
          disabled={state.busy}
          onClick={(event) => onAction({ action: "request-sign-out" }, event)}
        >
          Sign out
        </button>
      </header>
      <section
        className="first-run-body page-enter"
        aria-labelledby="first-run-title"
      >
        <h1 id="first-run-title" tabIndex="-1">
          How do you want to start?
        </h1>
        <p className="intro">
          Your preview account is ready. Sign in again with the same email and
          password to come back to it.
        </p>
        <div className="first-run-options">
          <article className="card first-run-option">
            <h2>Set up my startup</h2>
            <p>
              Start with a blank profile. Describe your startup in your own
              words and we suggest the details for you to check.
            </p>
            <button
              className="btn primary"
              disabled={state.busy}
              aria-busy={choosing === "blank"}
              onClick={(event) => choose("blank", event)}
            >
              {choosing === "blank" && (
                <span className="spinner" aria-hidden="true" />
              )}
              Set up my startup
            </button>
          </article>
          <article className="card first-run-option">
            <h2>Explore with a sample startup</h2>
            <p>
              Use Maria Santos’s student budgeting app to try Matches,
              mentorship requests and rooms. You can edit or replace it later.
            </p>
            <button
              className="btn"
              disabled={state.busy}
              aria-busy={choosing === "sample"}
              onClick={(event) => choose("sample", event)}
            >
              {choosing === "sample" && (
                <span className="spinner" aria-hidden="true" />
              )}
              Explore with a sample startup
            </button>
          </article>
        </div>
      </section>
    </div>
  );
}
