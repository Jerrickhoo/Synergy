import { useId, useLayoutEffect, useRef } from "react";
import Brand from "./Brand.jsx";
import Toast from "./Toast.jsx";

// The sign-in card on the sign-in artwork, shared by signup and the password
// pages so the signed-out screens read as one flow. Errors float over the
// top of the card (see .login-form-wrap #toast-root).
export default function AuthCard({ title, intro, children, footer }) {
  const headingId = useId();
  const heading = useRef(null);
  // Outside the workspace shell, so the card moves focus itself, as the shell
  // does for its pages; a new title (e.g. "Check your email") is a new view.
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <main className="login-screen" aria-labelledby={headingId}>
      <img
        className="login-artwork"
        src="/brand/login-connections.svg"
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      <div className="login-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <Brand compact />
          </div>
          <h1
            className="login-heading"
            id={headingId}
            tabIndex="-1"
            ref={heading}
          >
            {title}
          </h1>
          {intro && <p className="login-subheading">{intro}</p>}
          <Toast />
          {children}
          {footer && <p className="login-join">{footer}</p>}
        </div>
      </div>
    </main>
  );
}
