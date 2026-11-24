import { useApp } from "../state/AppContext.jsx";
import Brand from "./Brand.jsx";
export default function AuthHeader() {
  const { state, onAction } = useApp();
  // Password and verification pages have their own way back.
  const signupPage = ["signup", "onboarding"].includes(state.page);
  return (
    <header className="auth-header">
      {"\n        "}
      <Brand compact />
      {"\n        "}
      {signupPage && (
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
      )}
      {"\n      "}
    </header>
  );
}
