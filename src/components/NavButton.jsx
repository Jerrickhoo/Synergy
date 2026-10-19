import { pageLabel } from "../data/filters.js";
import { useApp } from "../state/AppContext.jsx";

export default function NavButton({ page, children }) {
  const { state, onAction } = useApp();
  const currentPage = ["room-detail", "review"].includes(state.page)
    ? "rooms"
    : state.page === "match-detail"
      ? "discover"
      : state.page;
  return (
    <button
      className={`nav-btn${currentPage === page ? " active" : ""}`}
      data-page={page}
      aria-label={page === "rooms" ? "Rooms" : pageLabel(page)}
      title={pageLabel(page)}
      aria-current={currentPage === page ? "page" : undefined}
      onClick={(event) => onAction({ page }, event)}
    >
      {children}
    </button>
  );
}
