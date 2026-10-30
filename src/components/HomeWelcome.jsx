import { useApp } from "../state/AppContext.jsx";
import { homeNextStep } from "../data/home.js";
import PageHeader from "./PageHeader.jsx";
import Icon from "./Icon.jsx";

export default function HomeWelcome() {
  const { state, onAction } = useApp();
  const next = homeNextStep(state);
  return (
    <div className="home-welcome">
      <PageHeader
        title={
          state.accountName
            ? `Welcome, ${state.accountName.split(" ")[0]}`
            : "Welcome to Synergy"
        }
        intro={
          state.role === "mentor"
            ? "Your mentoring workspace"
            : "Your collaboration workspace"
        }
      />
      <section className="home-header-next" aria-label="Your next step">
        <span className="section-eyebrow">Next up</span>
        <h2>{next.title}</h2>
        <p>{next.detail}</p>
        <button className="btn primary" onClick={() => onAction(next.command)}>
          {next.label}
          <Icon name="arrow" />
        </button>
      </section>
    </div>
  );
}
