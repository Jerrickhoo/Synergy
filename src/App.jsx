import { useEffect, useRef, useState } from "react";
import { useApp } from "./state/AppContext.jsx";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import AuthHeader from "./components/AuthHeader.jsx";
import MobileMenu from "./components/MobileMenu.jsx";
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

const pages = {
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

export default function App() {
  const { state, onAction } = useApp();
  const mainRef = useRef(null);
  const seenPages = useRef(new Set());
  const [loading, setLoading] = useState(false);
  const authPage = ["signup", "onboarding"].includes(state.page);
  const Page = pages[state.page] || HomePage;

  useEffect(() => {
    if (!state.authenticated) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (
      ["discover", "room-detail"].includes(state.page) &&
      !seenPages.current.has(state.page)
    ) {
      setLoading(true);
      const timer = setTimeout(() => {
        seenPages.current.add(state.page);
        setLoading(false);
      }, 600);
      return () => clearTimeout(timer);
    }
    setLoading(false);
  }, [state.page, state.authenticated]);
  useEffect(() => {
    if (!loading && state.authenticated)
      mainRef.current
        ?.querySelector(".page-head h1, .auth-form-panel h1")
        ?.focus({ preventScroll: true });
  }, [state.page, loading, state.authenticated]);

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "Escape")
          onAction({ action: "close-notifications" }, event);
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
      {!state.authenticated ? (
        <Login />
      ) : (
        <>
          <div className={`app${authPage ? " onboarding" : ""}`} id="app-shell">
            <Sidebar />
            <main id="main-content" tabIndex={-1} ref={mainRef}>
              <AuthHeader />
              <Topbar />
              <div
                id="content"
                key={`${state.page}:${state.role}:${state.activeRoomId}`}
              >
                {loading ? (
                  <div className="page">
                    <div
                      className="skeleton-stack"
                      aria-label="Loading content"
                    >
                      <div className="skeleton" />
                      <div className="skeleton" />
                      <div className="skeleton" />
                    </div>
                  </div>
                ) : (
                  <Page />
                )}
              </div>
            </main>
          </div>
          <MobileMenu />
        </>
      )}
      <div id="toast-root" aria-live="polite">
        {state.toast && <div className="toast">{state.toast}</div>}
      </div>
    </div>
  );
}
