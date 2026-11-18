import { pageLabel } from "../data/filters.js";
import { useApp } from "../state/AppContext.jsx";

export default function NavButton({ page, children }) {
  const { state, onAction } = useApp();
  const currentPage = ["room-detail", "review"].includes(state.page)
    ? state.role === "mentor"
      ? "mentees"
      : "rooms"
    : state.page === "match-detail"
      ? "discover"
      : state.page;
  return (
    <button
      className={`nav-btn${currentPage === page ? " active" : ""}`}
      data-page={page}
      aria-label={pageLabel(page, state.role)}
      title={pageLabel(page, state.role)}
      aria-current={currentPage === page ? "page" : undefined}
      onClick={(event) => onAction({ page }, event)}
    >
      {children}
    </button>
  );
}
