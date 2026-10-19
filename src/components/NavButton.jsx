import { useApp } from "../state/AppContext.jsx";

export default function NavButton({ page, children }) {
  const { state, onAction } = useApp();
  const currentPage =
    state.page === "room-detail"
      ? "rooms"
      : state.page === "match-detail"
        ? "discover"
        : state.page;
  return (
    <button
      className={`nav-btn${currentPage === page ? " active" : ""}`}
      data-page={page}
      onClick={(event) => onAction({ page }, event)}
    >
      {children}
    </button>
  );
}
