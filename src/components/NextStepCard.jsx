import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";

// The large brand-coloured card for the one thing to do next. Home shows it
// for any next step; Matches shows the same card when verification is due.
export default function NextStepCard({ next, label = "Your next step" }) {
  const { onAction } = useApp();
  if (!next) return null;
  return (
    <section
      className={`home-next${next.verification ? " is-verification" : ""}`}
      aria-label={next.verification ? "Verification" : label}
    >
      <div className="home-next-copy">
        <p className="home-next-eyebrow">
          <Icon name={next.verification ? "shield" : "spark"} />
          {next.verification ? "Verification" : label}
        </p>
        <h2>{next.title}</h2>
        {next.detail && <p>{next.detail}</p>}
      </div>
      <button
        className="btn primary home-next-go"
        onClick={() => onAction(next.command)}
      >
        {next.label}
        <Icon name="arrow" />
      </button>
    </section>
  );
}
