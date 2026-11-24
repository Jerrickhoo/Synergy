import { useApp } from "../state/AppContext.jsx";

// The way out of the password and verification pages: sign in when signed
// out, Home when signed in.
export default function AccountBackLink() {
  const { state, onAction } = useApp();
  return (
    <button
      type="button"
      className="link-btn"
      onClick={(event) =>
        onAction(
          state.authenticated
            ? { page: "home" }
            : { action: "back-to-sign-in" },
          event,
        )
      }
    >
      {state.authenticated ? "Back to Home" : "Back to sign in"}
    </button>
  );
}
