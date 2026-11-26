import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useApp } from "../state/AppContext.jsx";
import Icon from "./Icon.jsx";

// A guided tour on the real screens: everything but the highlighted part is
// dimmed and can't be clicked, a card beside it says what it is, and on
// "click" steps the highlighted control itself moves the tour on (Next does
// the same). End tour stops it at any point.
//
// target: what to highlight. phone: what to highlight instead when the
// sidebar is hidden behind the menu button. page: the page the step is on.
// click: the control to click on a click step. go: where that leads.
const founderSteps = [
  {
    target: '.sidebar .nav-btn[data-page="discover"]',
    phone: "#navigation-toggle",
    title: "Find your missing piece",
    text: "Matches lists the startups and mentors whose skills fill your gaps.",
    click: "Matches",
    go: "discover",
  },
  {
    page: "discover",
    target: "#discovery-list .match-card",
    fallback: ".discovery-controls",
    title: "See how well you fit",
    text: "Each card shows the two-way fit: what you get and what they get. View match opens the full breakdown, where you send a request.",
  },
  {
    page: "discover",
    target: ".discovery-controls .filters",
    title: "Search and filter",
    text: "Search by name or skill, or narrow the list by industry, type and price. Sort by fit or by trust rating.",
  },
  {
    target: '.sidebar .nav-btn[data-page="waiting"]',
    phone: "#navigation-toggle",
    title: "Requests",
    text: "Requests people send you and the ones you send live here.",
    click: "Requests",
    go: "waiting",
  },
  {
    page: "waiting",
    target: ".requests-board .tabs",
    title: "Incoming, outgoing and history",
    text: "Reply to incoming requests within 14 days. When someone accepts yours, a Deal Room opens.",
  },
  {
    target: '.sidebar .nav-btn[data-page="rooms"]',
    phone: "#navigation-toggle",
    title: "Deal Rooms",
    text: "Each accepted request opens a Deal Room: agree the terms, finish the milestones, track tasks, meet and chat.",
    click: "Rooms",
    go: "rooms",
  },
  {
    page: "home",
    target: ".home-planner",
    title: "Your calendar and tasks",
    text: "Due dates and meetings from every room land on your calendar, beside what's waiting on you.",
  },
  {
    target: ".topbar-tour",
    title: "Take the tour again",
    text: "This button replays the tour any time.",
  },
];
const mentorSteps = [
  {
    target: '.sidebar .nav-btn[data-page="requests"]',
    phone: "#navigation-toggle",
    title: "Founders ask for help",
    text: "Mentorship requests arrive in Requests with the founder's problem, what they tried and the outcome they want.",
    click: "Requests",
    go: "requests",
  },
  {
    page: "requests",
    target: ".page-head",
    title: "Reply within 14 days",
    text: "Accept, decline or suggest another mentor. A request nobody answers expires after 14 days.",
  },
  {
    target: '.sidebar .nav-btn[data-page="discover"]',
    phone: "#navigation-toggle",
    title: "Find startups to support",
    text: "Startups lists the founders whose needs fit your expertise.",
    click: "Startups",
    go: "discover",
  },
  {
    target: '.sidebar .nav-btn[data-page="mentees"]',
    phone: "#navigation-toggle",
    title: "Your mentees",
    text: "Accepting a request opens a mentorship room here for the goal, sessions, notes and follow-up.",
    click: "Mentees",
    go: "mentees",
  },
  {
    target: '.sidebar .nav-btn[data-page="calendar"]',
    phone: "#navigation-toggle",
    title: "Sessions on your calendar",
    text: "Every session you agree shows on your Calendar.",
    click: "Calendar",
    go: "calendar",
  },
  {
    target: ".topbar-tour",
    title: "Take the tour again",
    text: "This button replays the tour any time.",
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

const gap = 10;
const visible = (element) => {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};
// The step's element on this screen size, if it is showing.
function findTarget(step) {
  for (const selector of [step.target, step.fallback, step.phone]) {
    if (!selector) continue;
    const element = document.querySelector(selector);
    if (visible(element)) return { element, phone: selector === step.phone };
  }
  return null;
}

// Where the card goes: beside a narrow target (the sidebar), else below,
// else above, else in the corner over a target taller than the screen.
function cardPlace(hole, card) {
  const width = Math.min(360, window.innerWidth - 32);
  const height = card?.offsetHeight || 220;
  const maxTop = Math.max(16, window.innerHeight - height - 16);
  const clampLeft = (left) =>
    Math.max(16, Math.min(left, window.innerWidth - width - 16));
  if (!hole)
    return {
      width,
      left: (window.innerWidth - width) / 2,
      top: Math.max(16, (window.innerHeight - height) / 2),
    };
  if (hole.right + 16 + width <= window.innerWidth - 16 && hole.width < 320)
    return {
      width,
      left: hole.right + 16,
      top: Math.max(16, Math.min(hole.top, maxTop)),
    };
  if (hole.bottom + 16 + height <= window.innerHeight - 16)
    return { width, left: clampLeft(hole.left), top: hole.bottom + 16 };
  if (hole.top - 16 - height >= 16)
    return { width, left: clampLeft(hole.left), top: hole.top - 16 - height };
  return { width, left: window.innerWidth - width - 16, top: maxTop };
}

export default function QuickTour() {
  const { state, tourOpen } = useApp();
  if (!state.authenticated || !tourOpen) return null;
  return <Tour key={state.role} />;
}

function Tour() {
  const { state, onAction } = useApp();
  const steps = state.role === "mentor" ? mentorSteps : founderSteps;
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState(null);
  const [phone, setPhone] = useState(false);
  const [searching, setSearching] = useState(true);
  const [place, setPlace] = useState(null);
  const card = useRef(null);
  const next = useRef(null);
  const step = steps[index];
  const last = index === steps.length - 1;
  const end = useCallback(() => {
    markTourDone(state.accountId);
    onAction({ action: "close-tour" });
  }, [state.accountId, onAction]);
  const advance = () => {
    if (step.go) onAction({ page: step.go });
    if (last) end();
    else setIndex((value) => value + 1);
  };

  // Open the step's page, then wait (up to three seconds) for its element.
  useEffect(() => {
    if (step.page && state.page !== step.page) onAction({ page: step.page });
    setSearching(true);
    setHole(null);
    let frame = 0;
    const started = performance.now();
    const look = () => {
      const found = findTarget(step);
      if (found) {
        const rect = found.element.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight)
          found.element.scrollIntoView({
            block: rect.height > window.innerHeight - 160 ? "start" : "center",
          });
        setPhone(found.phone);
        setSearching(false);
        return;
      }
      if (performance.now() - started > 3000) {
        setSearching(false);
        return;
      }
      frame = requestAnimationFrame(look);
    };
    frame = requestAnimationFrame(look);
    return () => cancelAnimationFrame(frame);
    // The page is opened once per step, not on every page change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Follow the element while the page scrolls or resizes.
  useEffect(() => {
    if (searching) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const found = findTarget(step);
        if (!found) {
          setHole(null);
          return;
        }
        const rect = found.element.getBoundingClientRect();
        // A tall target scrolls under the sticky header; the highlight stops
        // at the header so the header stays dimmed.
        const header = found.element.closest(".topbar")
          ? 0
          : document.querySelector(".topbar")?.getBoundingClientRect().bottom ||
            0;
        setHole({
          top: Math.max(header, rect.top - gap),
          left: Math.max(0, rect.left - gap),
          right: Math.min(window.innerWidth, rect.right + gap),
          bottom: Math.min(window.innerHeight, rect.bottom + gap),
          width: rect.width + gap * 2,
          height: rect.height + gap * 2,
        });
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [searching, step]);

  // On a "click" step the highlighted control moves the tour on; its own
  // click opens the page.
  const clickable = Boolean(step.click && hole && !phone);
  useEffect(() => {
    if (!clickable) return;
    const element = findTarget(step)?.element;
    if (!element) return;
    const go = () => setTimeout(() => setIndex((value) => value + 1));
    element.addEventListener("click", go);
    return () => element.removeEventListener("click", go);
  }, [clickable, step]);

  useLayoutEffect(() => {
    setPlace(cardPlace(hole, card.current));
  }, [hole, index, searching]);
  // Escape ends the tour wherever focus is, even after a click step.
  useEffect(() => {
    const stop = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      end();
    };
    document.addEventListener("keydown", stop);
    return () => document.removeEventListener("keydown", stop);
  }, [end]);
  useEffect(() => {
    next.current?.focus({ preventScroll: true });
  }, [index]);

  // Tab stays within the card.
  const onKeyDown = (event) => {
    if (event.key !== "Tab" || !card.current) return;
    const items = [...card.current.querySelectorAll("button:not(:disabled)")];
    const first = items[0];
    const final = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      final.focus();
    } else if (!event.shiftKey && document.activeElement === final) {
      event.preventDefault();
      first.focus();
    }
  };

  const shade = (key, style) => (
    <div key={key} className="tour-shade" style={style} aria-hidden="true" />
  );
  const view = { width: window.innerWidth, height: window.innerHeight };
  const hint = step.click
    ? phone
      ? `Open the menu, then choose ${step.click}. Or select Next.`
      : `Click ${step.click} to open it, or select Next.`
    : "";
  const ringStyle = hole && {
    top: hole.top,
    left: hole.left,
    width: hole.right - hole.left,
    height: hole.bottom - hole.top,
  };
  return createPortal(
    <div className="tour" onKeyDown={onKeyDown}>
      {hole ? (
        <>
          {shade("top", {
            top: 0,
            left: 0,
            width: view.width,
            height: hole.top,
          })}
          {shade("bottom", {
            top: hole.bottom,
            left: 0,
            width: view.width,
            height: Math.max(0, view.height - hole.bottom),
          })}
          {shade("left", {
            top: hole.top,
            left: 0,
            width: hole.left,
            height: hole.bottom - hole.top,
          })}
          {shade("right", {
            top: hole.top,
            left: hole.right,
            width: Math.max(0, view.width - hole.right),
            height: hole.bottom - hole.top,
          })}
          <div className="tour-ring" aria-hidden="true" style={ringStyle} />
          {/* Only a "click" step leaves the highlighted control usable. */}
          {!clickable && (
            <div className="tour-shield" aria-hidden="true" style={ringStyle} />
          )}
        </>
      ) : (
        shade("all", {
          top: 0,
          left: 0,
          width: view.width,
          height: view.height,
        })
      )}
      <section
        ref={card}
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        style={place || { visibility: "hidden" }}
      >
        <p className="tour-count">
          <Icon name="compass" />
          Step {index + 1} of {steps.length}
        </p>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-text" aria-live="polite">
          {step.text}
        </p>
        {hint && (
          <p className="tour-hint">
            <Icon name="arrow" />
            {hint}
          </p>
        )}
        <div className="tour-actions">
          <button type="button" className="link-btn tour-end" onClick={end}>
            End tour
          </button>
          <span className="tour-nav">
            {index > 0 && (
              <button
                type="button"
                className="btn small"
                onClick={() => setIndex((value) => value - 1)}
              >
                Back
              </button>
            )}
            <button
              ref={next}
              type="button"
              className="btn primary small"
              onClick={advance}
            >
              {last ? "Finish" : "Next"}
            </button>
          </span>
        </div>
      </section>
    </div>,
    document.body,
  );
}
