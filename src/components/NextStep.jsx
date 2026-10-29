import { useApp } from "../state/AppContext.jsx";
export default function NextStep() {
  const { state, model, onAction } = useApp();
  if (!["room-detail", "review", "profile"].includes(state.page)) return null;
  if (state.page === "room-detail" && state.roomTab === "milestones")
    return null;
  const agreement = model.currentAgreement();
  if (
    state.page === "room-detail" &&
    model.activeRoom()?.status === "cancelled"
  )
    return null;
  const prompts = {
    "room-detail": {
      title: "Milestones",
      text:
        state.roomTab === "terms"
          ? "Both collaborators must accept the terms before starting."
          : "Review the agreed work and confirm completed milestones.",
      button:
        state.roomTab === "terms" ? "View milestones" : "Go to milestones",
      action: {
        action: "room-tab",
        tab: "milestones",
      },
      disabled: !agreement?.locked || !agreement?.partnerLocked,
    },
    review: {
      title: "Profile",
      text: "Keep your collaboration profile up to date",
      button: "View profile",
      action: {
        page: "profile",
      },
    },
    profile: {
      title: "Find collaborators",
      text: "Browse founders and mentors by skills and needs",
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
