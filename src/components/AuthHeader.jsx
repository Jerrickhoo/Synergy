import { useApp } from "../state/AppContext.jsx";
export default function AuthHeader() {
  const { onAction } = useApp();
  return (
    <header className="auth-header">
      {"\n        "}
      <div className="brand">
        <span className="brand-mark">sy</span>
        <span className="brand-name">synergy</span>
      </div>
      {"\n        "}
      <a
        className="auth-signin"
        href="#"
        data-action="back-to-sign-in"
        onClick={(event) =>
          onAction(
            {
              action: "back-to-sign-in",
            },
            event,
          )
        }
      >
        Already have an account? Sign in
      </a>
      {"\n      "}
    </header>
  );
}
