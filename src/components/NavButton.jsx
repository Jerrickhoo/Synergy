import { pageLabel } from "../data/filters.js";
import { useApp } from "../state/AppContext.jsx";

// `count` is the number waiting for the person there. It joins the name, so
// it is read out even when only the icon and its badge show.
export default function NavButton({ page, count = 0, children }) {
  const { state, onAction } = useApp();
  const currentPage = ["room-detail", "review"].includes(state.page)
    ? state.role === "mentor"
      ? "mentees"
      : "rooms"
    : state.page === "match-detail"
      ? "discover"
      : state.page;
  const label = pageLabel(page, state.role);
  return (
    <button
      className={`nav-btn${currentPage === page ? " active" : ""}`}
      data-page={page}
      aria-label={count ? `${label}, ${count} waiting for you` : label}
      title={label}
      aria-current={currentPage === page ? "page" : undefined}
      onClick={(event) => onAction({ page }, event)}
    >
      {children}
    </button>
  );
}
