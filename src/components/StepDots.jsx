import { Fragment } from "react";
import Icon from "./Icon.jsx";

// A room's steps as a row of circles joined by a line, so the steps still
// ahead can be counted at a glance: done steps are filled with a tick, the
// current one is ringed, and the ones ahead are hollow. `complete` fills
// every circle once the last step is finished too.
export default function StepDots({
  number,
  total,
  label,
  complete = false,
  name,
  className = "",
}) {
  const current = complete ? total : number - 1;
  return (
    <div
      className={`step-dots ${className}`.trim()}
      role="progressbar"
      aria-label={name}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={complete ? total : number}
      aria-valuetext={
        complete
          ? `All ${total} steps complete`
          : `Step ${number} of ${total}${label ? `: ${label}` : ""}`
      }
    >
      {Array.from({ length: total }, (_, index) => (
        <Fragment key={index}>
          {/* The line into a step fills once that step is reached. */}
          {index > 0 && (
            <span
              className={`step-link${index <= current ? " done" : ""}`}
              aria-hidden="true"
            />
          )}
          <span
            className={[
              "step-dot",
              index < current && "done",
              index === current && "current",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
          >
            {index < current && <Icon name="check" />}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
