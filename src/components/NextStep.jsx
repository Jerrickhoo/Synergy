import { useApp } from "../state/AppContext.jsx";
export default function NextStep() {
  const { state, model, onAction } = useApp();
  if (!["room-detail", "review", "profile"].includes(state.page)) return null;
  if (state.page === "room-detail" && state.roomTab === "milestones")
    return null;
  const agreement = model.currentAgreement();
  const prompts = {
    "room-detail": {
      title: "Move the collaboration forward",
      text:
        state.roomTab === "terms"
          ? "Once terms are clear, agree on the work"
          : "Keep the shared work moving",
      button:
        state.roomTab === "terms" ? "View milestones" : "Go to milestones",
      action: {
        action: "room-tab",
        tab: "milestones",
      },
      disabled: !agreement?.locked || !agreement?.partnerLocked,
    },
    review: {
      title: "Your next chapter",
      text: "Keep your collaboration profile up to date",
      button: "View profile",
      action: {
        page: "profile",
      },
    },
    profile: {
      title: "Meet your next collaborator",
      text: "Meet the people who can help with your next move",
      button: "Explore matches",
      action: {
        page: "discover",
      },
    },
  };
  const prompt = prompts[state.page];
  return (
    <section className="next-step-card">
      <div>
        <div className="next-step-kicker">NEXT STEP</div>
        <h2>{prompt.title}</h2>
        <p>{prompt.text}</p>
      </div>
      <button
        className="btn primary"
        disabled={prompt.disabled}
        onClick={(event) => onAction(prompt.action, event)}
      >
        {prompt.button}
      </button>
    </section>
  );
}
