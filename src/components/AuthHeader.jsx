import { useApp } from "../state/AppContext.jsx";
import Brand from "./Brand.jsx";
export default function AuthHeader() {
  const { onAction } = useApp();
  return (
    <header className="auth-header">
      {"\n        "}
      <Brand compact />
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
