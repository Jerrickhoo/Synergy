import { useApp } from "../state/AppContext.jsx";
export default function MobileMenu() {
  const { state, onAction } = useApp();
  return (
    <div
      className="mobile-more-sheet"
      id="mobile-more-sheet"
      hidden={!state.moreOpen || !state.authenticated}
      aria-label="More pages"
    >
      {"\n    "}
      <button
        data-page="waiting"
        onClick={(event) =>
          onAction(
            {
              page: "waiting",
            },
            event,
          )
        }
      >
        Waiting for response
      </button>
      {"\n    "}
      <button
        data-page="discover"
        data-match-tab="saved"
        onClick={(event) =>
          onAction(
            {
              page: "discover",
              matchTab: "saved",
            },
            event,
          )
        }
      >
        Saved matches
      </button>
      {"\n    "}
      <button
        data-action="profile-tab"
        data-tab="trust"
        onClick={(event) =>
          onAction(
            {
              action: "profile-tab",
              tab: "trust",
            },
            event,
          )
        }
      >
        Trust history
      </button>
      {"\n    "}
      <button
        data-action="sign-out"
        onClick={(event) =>
          onAction(
            {
              action: "sign-out",
            },
            event,
          )
        }
      >
        Sign out
      </button>
      {"\n  "}
    </div>
  );
}
