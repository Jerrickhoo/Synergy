import { useApp } from "../state/AppContext.jsx";
import Avatar from "./Avatar.jsx";
import Tags from "./Tags.jsx";

export function SectionHeader({
  title,
  subtitle,
  action,
  actionLabel = "View all",
}) {
  return (
    <div className="panel-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="panel-subtitle">{subtitle}</p>}
      </div>
      {action && (
        <button className="link-btn section-link" onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
export function EmptyState({ title, children, action, actionLabel }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && (
        <button className="btn" onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
export function MetricCard({ label, value, description, action }) {
  return (
    <button className="metric-card" onClick={action}>
      <span className="metric-copy">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        <span className="stat-foot">{description}</span>
      </span>
    </button>
  );
}
export function WelcomeBanner() {
  const { state, model, onAction } = useApp();
  return (
    <section className="welcome-banner">
      <div className="welcome-copy">
        <h1 tabIndex={-1}>Welcome back, {model.roleName().split(" ")[0]} </h1>
        <p>
          {state.role === "founder"
            ? "View matches, introductions and collaboration activity."
            : "Your experience makes a difference. Connect with founders ready for their next move."}
        </p>
        <div className="welcome-actions">
          <button
            className="btn primary"
            onClick={() =>
              onAction({ page: "discover", matchTab: "suggested" })
            }
          >
            {state.role === "founder" ? "Explore matches" : "Meet startups"}
          </button>
          <button
            className="btn"
            onClick={() =>
              state.role === "founder"
                ? onAction({ action: "header-search", query: "Mentor" })
                : onAction({ page: "profile" })
            }
          >
            {state.role === "founder" ? "Find mentors" : "Edit profile"}
          </button>
        </div>
      </div>
      <p className="workspace-motto">
        Different strengths.
        <br />
        <strong>Bigger possibilities.</strong>
      </p>
    </section>
  );
}
export function RecommendationCard({ person, compact = false }) {
  const { state, onAction } = useApp();
  const interested = state.interestByRole[state.role].has(person.id);
  if (compact)
    return (
      <article className="recommendation-row">
        <Avatar
          image={person.image}
          name={person.name}
          identity={person.accountId || person.id}
          color={person.color}
        />
        <div className="recommendation-copy">
          <h3>{person.name}</h3>
          <p>{person.sector}</p>
          <Tags values={person.offer.slice(0, 2)} />
        </div>
        <button
          className="btn small"
          aria-label={`View match with ${person.name}`}
          onClick={() => onAction({ action: "match-detail", id: person.id })}
        >
          View
        </button>
      </article>
    );
  return (
    <article className="featured-row">
      <Avatar
        image={person.image}
        name={person.name}
        identity={person.accountId || person.id}
        color={person.color}
      />
      <div className="featured-copy">
        <h3>{person.name}</h3>
        <span className="featured-sector">{person.sector}</span>
        <p className="featured-description">{person.summary}</p>
        <div className="featured-offer">
          <span className="match-chip-label">THEY OFFER</span>
          <Tags values={person.offer} />
        </div>
      </div>
      <div className="featured-next">
        <span className="fit-score">
          {person.score}% <span>demo fit</span>
        </span>
        <div className="featured-actions">
          <button
            className="btn small"
            onClick={() => onAction({ action: "match-detail", id: person.id })}
          >
            View match
          </button>
          <button
            className="link-btn"
            disabled={interested}
            onClick={() => onAction({ action: "interest", id: person.id })}
          >
            {interested ? "Interest sent" : "Express interest"}
          </button>
        </div>
      </div>
    </article>
  );
}
