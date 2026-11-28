import { useEffect, useLayoutEffect, useRef } from "react";
import { CheckoutPanel } from "./components/Payments.jsx";
import { useApp } from "./state/AppContext.jsx";
import { signedOutPages } from "./state/routes.js";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import AuthHeader from "./components/AuthHeader.jsx";
import MobileMenu from "./components/MobileMenu.jsx";
import PageHeader from "./components/PageHeader.jsx";
import HomePage from "./pages/HomePage.jsx";
import DiscoverPage from "./pages/DiscoverPage.jsx";
import RoomsPage from "./pages/RoomsPage.jsx";
import RoomDetailPage from "./pages/RoomDetailPage.jsx";
import ImpactPage from "./pages/ImpactPage.jsx";
import MenteesPage from "./pages/MenteesPage.jsx";
import WaitingPage from "./pages/WaitingPage.jsx";
import MatchDetailPage from "./pages/MatchDetailPage.jsx";
import ReviewPage from "./pages/ReviewPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import OnboardingPage from "./pages/OnboardingPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import Toast from "./components/Toast.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import ModerationPage from "./pages/ModerationPage.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import ActivityPage from "./pages/ActivityPage.jsx";
import Icon from "./components/Icon.jsx";
import MentorshipWarning from "./components/MentorshipWarning.jsx";
import SignOutDialog from "./components/SignOutDialog.jsx";
import VerificationPrompt from "./components/VerificationPrompt.jsx";
import QuickTour from "./components/QuickTour.jsx";
import FirstRunChoice from "./components/FirstRunChoice.jsx";
import OtherRoleNotice from "./components/OtherRoleNotice.jsx";
import CheckInboxPage from "./pages/CheckInboxPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.jsx";
import { awaitingVerification as isAwaitingVerification } from "./state/verification.js";

const pages = {
  activity: ActivityPage,
  calendar: CalendarPage,
  settings: SettingsPage,
  notifications: NotificationsPage,
  moderation: ModerationPage,
  home: HomePage,
  discover: DiscoverPage,
  rooms: RoomsPage,
  "room-detail": RoomDetailPage,
  waiting: WaitingPage,
  // A founder's requests and a mentor's share one page; WaitingPage picks.
  requests: WaitingPage,
  mentees: MenteesPage,
  impact: ImpactPage,
  "impact-certificate": ImpactPage,
  "match-detail": MatchDetailPage,
  review: ReviewPage,
  profile: ProfilePage,
  signup: SignupPage,
  onboarding: OnboardingPage,
  "forgot-password": ForgotPasswordPage,
  "reset-password": ResetPasswordPage,
  "verify-email": VerifyEmailPage,
};
function Unavailable({ room = false }) {
  const { onAction } = useApp();
  return (
    <div className="page">
      <PageHeader
        title={room ? "Room unavailable" : "Page unavailable"}
        intro={
          room
            ? "This room is not available in your workspace. You can find your current collaborations in Rooms."
            : "This address does not match a Synergy page."
        }
      />
      <button
        className="btn primary"
        onClick={() => onAction({ page: room ? "rooms" : "home" })}
      >
        {room ? "View your rooms" : "Back to Home"}
      </button>
    </div>
  );
}
export default function App() {
  const {
    state,
    model,
    onAction,
    retryRestore,
    workspaceConnection,
    retryConnection,
    onInvalid,
    onFormInput,
    notify,
  } = useApp();
  const mainRef = useRef(null);
  // A new account waits on "Check your inbox" until its email is verified.
  const awaitingVerification = isAwaitingVerification(state);
  // A card on the sign-in artwork with its own toast: signup when signed out,
  // the password and verification pages either way (signed in they lead back
  // to Home), and "Check your inbox" while the email is unverified.
  const CardScreen =
    (!state.authenticated && state.page === "signup") ||
    ["forgot-password", "reset-password", "verify-email"].includes(state.page)
      ? pages[state.page]
      : awaitingVerification
        ? CheckInboxPage
        : null;
  // The link was opened elsewhere and the workspace just opened here.
  const wasAwaiting = useRef(false);
  useEffect(() => {
    if (
      wasAwaiting.current &&
      state.emailVerified &&
      state.page !== "verify-email"
    )
      notify("Your email is verified. Welcome to Synergy.");
    wasAwaiting.current = Boolean(awaitingVerification);
  }, [awaitingVerification, state.emailVerified, state.page, notify]);
  const authPage =
    !CardScreen &&
    (state.page === "signup" ||
      (signedOutPages.includes(state.page) && !state.authenticated));
  const Page = pages[state.page];
  const unavailableRoom =
    ["room-detail", "review"].includes(state.page) && !model.activeRoom();
  // A room this account holds under its other role, e.g. after another tab
  // switched the account's role.
  const otherRoleRoom =
    unavailableRoom &&
    state.rooms[state.activeRoomId]?.role !== state.role &&
    state.rooms[state.activeRoomId]?.role;
  // Move route focus before the browser can accept input. A passive effect can
  // steal focus from a just-opened form in WebKit and lose the user's typing.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    mainRef.current?.querySelector("h1")?.focus({ preventScroll: true });
  }, [
    state.page,
    state.role,
    state.activeRoomId,
    state.activeMatch,
    state.authenticated,
    state.restoring,
    state.firstRunChoice,
  ]);
  if (state.restoring)
    return (
      <main className="session-loading" aria-label="Saved workspace">
        {state.connectionError ? (
          <>
            <p role="alert">{state.connectionError}</p>
            <button className="btn primary" onClick={retryRestore}>
              Retry opening workspace
            </button>
          </>
        ) : (
          <div className="session-skeleton">
            <p className="visually-hidden" role="status">
              Opening your saved workspace…
            </p>
            <span className="skeleton session-skeleton-sidebar" />
            <div className="session-skeleton-main" aria-hidden="true">
              <span className="skeleton" style={{ width: "40%", height: 32 }} />
              <span className="skeleton" style={{ width: "60%", height: 16 }} />
              <span className="skeleton" style={{ height: 112 }} />
              <div className="session-skeleton-row">
                <span className="skeleton" style={{ height: 88 }} />
                <span className="skeleton" style={{ height: 88 }} />
                <span className="skeleton" style={{ height: 88 }} />
              </div>
            </div>
          </div>
        )}
      </main>
    );

  if (!state.authenticated && workspaceConnection !== "ready")
    return (
      <main className="session-loading" aria-label="Workspace connection">
        {workspaceConnection === "unavailable" ? (
          <>
            <p role="alert">The workspace is unavailable.</p>
            <button className="btn primary" onClick={retryConnection}>
              Retry connection
            </button>
          </>
        ) : (
          <p role="status">Connecting to Synergy…</p>
        )}
      </main>
    );

  return (
    <div
      onInvalidCapture={onInvalid}
      onInputCapture={onFormInput}
      onKeyDown={(event) => {
        if (event.key === "Escape") onAction({ action: "close-overlays" });
      }}
      onClick={(event) => {
        if (
          state.notificationOpen &&
          !event.target.closest("#notification-toggle, #notification-panel")
        )
          onAction({ action: "close-notifications" });
      }}
    >
      <button
        className="skip-link"
        hidden={!state.authenticated || authPage || Boolean(CardScreen)}
        onClick={() => mainRef.current?.focus()}
      >
        Skip to content
      </button>
      {CardScreen ? (
        // A new emailed link (opened while the page is showing) starts over.
        <CardScreen key={`${state.page}:${state.linkToken || ""}`} />
      ) : !state.authenticated && !authPage ? (
        <Login />
      ) : state.firstRunChoice && state.role === "founder" ? (
        <main id="main-content" tabIndex={-1} ref={mainRef}>
          <FirstRunChoice />
        </main>
      ) : (
        <>
          <div
            className={`app${authPage ? " onboarding" : ""}`}
            id="app-shell"
            inert={state.moreOpen}
          >
            {!authPage && <Sidebar />}
            <main id="main-content" tabIndex={-1} ref={mainRef}>
              {authPage ? <AuthHeader /> : <Topbar />}
              {!authPage && state.paymentCheckoutData && <CheckoutPanel />}
              {state.connectionError && (
                <div
                  className="connection-banner workspace-connection"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <Icon name="alert" />
                  <div>
                    <strong>Connection interrupted</strong>
                    <p>{state.connectionError}</p>
                  </div>
                </div>
              )}
              <div
                id="content"
                key={`${state.page}:${state.role}:${state.activeRoomId}`}
              >
                {otherRoleRoom ? (
                  <OtherRoleNotice role={otherRoleRoom} />
                ) : unavailableRoom ? (
                  <Unavailable room />
                ) : Page ? (
                  <Page />
                ) : (
                  <Unavailable />
                )}
              </div>
            </main>
          </div>
          {!authPage && <MobileMenu />}
        </>
      )}
      <SignOutDialog />
      <VerificationPrompt />
      <QuickTour />
      <MentorshipWarning />
      {(state.authenticated || authPage) && !CardScreen && <Toast />}
      {state.busy && (
        <div className="saving-indicator" role="status">
          <span className="spinner" aria-hidden="true" /> Please wait…
        </div>
      )}
    </div>
  );
}
