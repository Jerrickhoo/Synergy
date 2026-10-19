import Icon from "../components/Icon.jsx";
export default function AuthStory() {
  return (
    <section className="auth-story">
      <div className="login-story-kicker">Build better, together</div>
      <p className="auth-headline">The right people change everything.</p>
      <p>
        Find the partners, early users, and mentors who complement what you’re
        building—and turn a promising introduction into real progress.
      </p>
      <div className="login-quote">
        <p>
          “We went from ‘we should work together’ to a clear plan, 50 beta
          testers, and product feedback we could act on.”
        </p>
        <span>Maria Santos · Founder at BudgetBuddy</span>
      </div>
      <div className="login-proof">
        <span className="login-proof-icon">
          <Icon name="spark" />
        </span>
        <span>
          <strong>Thoughtful matches.</strong>
          {" Clear commitments. Work that moves forward."}
        </span>
      </div>
    </section>
  );
}
