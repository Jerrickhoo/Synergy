import { useLayoutEffect, useRef } from "react";
import { useApp } from "./state/AppContext.jsx";
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
import Icon from "./components/Icon.jsx";
import SignOutDialog from "./components/SignOutDialog.jsx";

const pages = {
  calendar: CalendarPage,
  settings: SettingsPage,
  notifications: NotificationsPage,
  moderation: ModerationPage,
  home: HomePage,
  discover: DiscoverPage,
  rooms: RoomsPage,
  "room-detail": RoomDetailPage,
  waiting: WaitingPage,
  "match-detail": MatchDetailPage,
  review: ReviewPage,
  profile: ProfilePage,
  signup: SignupPage,
  onboarding: OnboardingPage,
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
  const { state, model, onAction, retryRestore, onInvalid, onFormInput } =
    useApp();
  const mainRef = useRef(null);
  const authPage = ["signup", "onboarding"].includes(state.page);
  const Page = pages[state.page];
  const unavailableRoom =
    ["room-detail", "review"].includes(state.page) && !model.activeRoom();
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
          <p role="status">Opening your saved workspace...</p>
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
        hidden={!state.authenticated || authPage}
        onClick={() => mainRef.current?.focus()}
      >
        Skip to content
      </button>
      {!state.authenticated && !authPage ? (
        <Login />
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
                {unavailableRoom ? (
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
      <Toast />
      {state.busy && (
        <div className="saving-indicator" role="status">
          <span className="spinner" aria-hidden="true" /> Please wait…
        </div>
      )}
    </div>
  );
}
