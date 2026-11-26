import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Overlay from "./Overlay.jsx";
import Icon from "./Icon.jsx";

// How a deal moves through Synergy, one step per screen. The stepper at the
// top doubles as the map of the whole flow.
const founderSteps = [
  {
    short: "Match",
    icon: "search",
    title: "Find your missing piece",
    text: "Matches lists startups and mentors whose skills fill your gaps. The ring shows how well each one fits; open a match to see why.",
    where: "Matches",
  },
  {
    short: "Request",
    icon: "inbox",
    title: "Send a request",
    text: "On a match, choose how you'd work together (a beta testing exchange, a co-marketing swap or a skill swap) and add a short note. They have 14 days to reply.",
    where: "Requests",
  },
  {
    short: "Deal Room",
    icon: "rooms",
    title: "A Deal Room opens",
    text: "When they accept, a Deal Room opens in Rooms. It's your shared space for this deal: terms, milestones, tasks, meetings and chat.",
    where: "Rooms",
  },
  {
    short: "Terms",
    icon: "handshake",
    title: "Agree the terms",
    text: "Write the goal, scope, timeline and what each side gives. Work starts once you both accept the same terms.",
    where: "Deal Room · Terms",
  },
  {
    short: "Milestones",
    icon: "check",
    title: "Finish the milestones",
    text: "Mark each milestone done, attach proof when it asks for it, and your partner confirms it. Due dates show on your Home calendar and in Your tasks.",
    where: "Deal Room · Milestones",
  },
  {
    short: "Review",
    icon: "star",
    title: "Launch and review",
    text: "Once both of you confirm every milestone, the deal launches. Leave a private review within 14 days. Activity keeps a dated record of every step.",
    where: "Activity",
  },
];
const mentorSteps = [
  {
    short: "Requests",
    icon: "inbox",
    title: "Founders ask for help",
    text: "Founders send mentorship requests with their problem, what they tried and the outcome they want. Requests lists them, best fit first.",
    where: "Requests",
  },
  {
    short: "Reply",
    icon: "clock",
    title: "Reply within 14 days",
    text: "Accept, decline or suggest another mentor. A request nobody answers expires after 14 days.",
    where: "Requests",
  },
  {
    short: "Room",
    icon: "people",
    title: "A mentorship room opens",
    text: "Accepting opens a room in Mentees for the goal, sessions, notes and follow-up.",
    where: "Mentees",
  },
  {
    short: "Sessions",
    icon: "calendar",
    title: "Agree the goal and meet",
    text: "Confirm the founder's goal and hold the session. Sessions show on your Calendar.",
    where: "Calendar",
  },
  {
    short: "Follow-up",
    icon: "check",
    title: "Share your follow-up",
    text: "Log the action items and send your follow-up so the founder knows what to do next.",
    where: "Mentorship room",
  },
  {
    short: "Review",
    icon: "star",
    title: "Close and review",
    text: "When the mentorship is done, both of you leave a private review. Activity keeps a dated record of every step.",
    where: "Activity",
  },
];

const tourKey = (accountId) => `synergy-tour:${accountId}`;
export function tourDone(accountId) {
  try {
    return localStorage.getItem(tourKey(accountId)) === "done";
  } catch {
    return false;
  }
}
export function markTourDone(accountId) {
  try {
    localStorage.setItem(tourKey(accountId), "done");
  } catch {
    // Private browsing: the invitation shows again next visit.
  }
}

export default function QuickTour() {
  const { state, tourOpen, onAction } = useApp();
  const [step, setStep] = useState(0);
  if (!state.authenticated || !tourOpen) return null;
  const mentor = state.role === "mentor";
  const steps = mentor ? mentorSteps : founderSteps;
  const current = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;
  const close = () => {
    markTourDone(state.accountId);
    setStep(0);
    onAction({ action: "close-tour" });
  };
  return (
    <Overlay
      id="quick-tour"
      title={
        mentor
          ? "Quick tour: how mentoring works"
          : "Quick tour: how a deal works"
      }
      titleIcon={
        <span className="quick-tour-icon" aria-hidden="true">
          <Icon name="compass" />
        </span>
      }
      onClose={close}
      initialFocusSelector="#quick-tour-next"
      footer={
        <>
          <button className="link-btn quick-tour-skip" onClick={close}>
            {last ? "Close" : "Skip tour"}
          </button>
          <span className="quick-tour-nav">
            <button
              className="btn"
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
            >
              <Icon name="back" />
              Back
            </button>
            <button
              id="quick-tour-next"
              className="btn primary"
              onClick={() => {
                if (!last) return setStep((value) => value + 1);
                close();
                onAction({ page: mentor ? "requests" : "discover" });
              }}
            >
              {last ? (mentor ? "Open Requests" : "Explore matches") : "Next"}
              <Icon name="arrow" />
            </button>
          </span>
        </>
      }
    >
      <ol className="quick-tour-steps" aria-label="Steps in this tour">
        {steps.map((item, index) => (
          <li
            key={item.short}
            className={
              index === step ? "is-current" : index < step ? "is-done" : ""
            }
            aria-current={index === step ? "step" : undefined}
          >
            <button
              className="quick-tour-step"
              onClick={() => setStep(index)}
              aria-label={`Step ${index + 1}: ${item.title}`}
            >
              <span className="quick-tour-dot" aria-hidden="true">
                {index < step ? <Icon name="check" /> : index + 1}
              </span>
              <span className="quick-tour-short" aria-hidden="true">
                {item.short}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="quick-tour-body" aria-live="polite">
        <span className="quick-tour-art" aria-hidden="true">
          <Icon name={current.icon} />
        </span>
        <p className="quick-tour-count">
          Step {step + 1} of {steps.length}
        </p>
        <h3>{current.title}</h3>
        <p>{current.text}</p>
        <p className="quick-tour-where">
          <Icon name="arrow" />
          Where: <strong>{current.where}</strong>
        </p>
      </div>
    </Overlay>
  );
}
