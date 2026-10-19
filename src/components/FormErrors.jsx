import { useEffect, useRef } from "react";
import { useApp } from "../state/AppContext.jsx";

export default function FormErrors({ scope }) {
  const { state } = useApp();
  const ref = useRef(null);
  const errors =
    state.formErrors?.scope === scope ? state.formErrors.fields : null;
  useEffect(() => {
    const container = ref.current?.closest("form, .onboarding-card");
    if (!container) return;
    const fields = [...container.querySelectorAll("input, select, textarea")];
    fields.forEach((input) => {
      const key =
        input.name ||
        input.id.replace(/^confirm-/, "").replace("team", "teamSize");
      if (errors?.[key]) {
        input.setAttribute("aria-invalid", "true");
        input.setAttribute("aria-describedby", `${scope}-errors`);
      } else {
        input.removeAttribute("aria-invalid");
        if (input.getAttribute("aria-describedby") === `${scope}-errors`)
          input.removeAttribute("aria-describedby");
      }
    });
    if (errors)
      fields
        .find((input) => input.getAttribute("aria-invalid") === "true")
        ?.focus();
  }, [errors, scope]);
  return (
    <div ref={ref} hidden={!errors}>
      {errors && (
        <div id={`${scope}-errors`} className="form-errors" role="alert">
          <strong>Please check these details</strong>
          <ul>
            {Object.entries(errors).map(([key, value]) => (
              <li key={key}>{value}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
