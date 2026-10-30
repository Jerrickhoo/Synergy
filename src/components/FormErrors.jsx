import { useEffect, useRef } from "react";
import { useApp } from "../state/AppContext.jsx";
import { fieldName } from "../state/feedback.js";

export default function FormErrors({ scope }) {
  const { state } = useApp();
  const ref = useRef(null);
  const lastFocusId = useRef(null);
  const errors =
    state.formErrors?.scope === scope ? state.formErrors.fields : null;
  useEffect(() => {
    const container = ref.current?.closest("form, .onboarding-card");
    if (!container) return;
    const fields = [...container.querySelectorAll("input, select, textarea")];
    fields.forEach((input) => {
      const key = fieldName(input);
      const visible = input.dataset.selectTrigger
        ? document.getElementById(input.dataset.selectTrigger)
        : input;
      const descriptions = (visible.getAttribute("aria-describedby") || "")
        .split(" ")
        .filter((id) => id && !id.startsWith(`${scope}-error-`));
      if (errors?.[key]) {
        visible.setAttribute("aria-invalid", "true");
        descriptions.push(`${scope}-error-${key}`);
      } else {
        visible.removeAttribute("aria-invalid");
      }
      if (descriptions.length)
        visible.setAttribute("aria-describedby", descriptions.join(" "));
      else visible.removeAttribute("aria-describedby");
    });
  }, [errors, scope]);
  useEffect(() => {
    if (errors && state.toastId !== lastFocusId.current)
      ref.current
        ?.closest("form, .onboarding-card")
        ?.querySelector('[aria-invalid="true"]')
        ?.focus();
    lastFocusId.current = state.toastId;
  }, [errors, scope, state.toastId]);
  return (
    <div ref={ref} hidden={!errors} data-error-scope={scope}>
      {errors && (
        <div id={`${scope}-errors`} className="form-errors">
          <strong>Please check these details</strong>
          <ul>
            {Object.entries(errors).map(([key, value]) => (
              <li key={key} id={`${scope}-error-${key}`}>
                {value}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
