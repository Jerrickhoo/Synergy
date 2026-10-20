import { Fragment, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import { filterPeople } from "../data/filters.js";
import MatchCard from "../components/MatchCard.jsx";
import Icon from "../components/Icon.jsx";
import PageHeader from "../components/PageHeader.jsx";
export default function DiscoverPage() {
  const { state, model, onAction, onFilter, onTabKeyDown } = useApp();
  const advancedCount = [
    state.matchFilters.industry !== "all",
    state.matchFilters.score !== "0",
    state.matchFilters.engagement !== "all",
  ].filter(Boolean).length;
  const [filtersOpen, setFiltersOpen] = useState(advancedCount > 0);
  const hasFilters =
    advancedCount > 0 ||
    state.matchFilters.type !== "all" ||
    Boolean(state.matchFilters.search);
  const { matches, browsePeople, rolePeople, savedMatches } = model;
  const available =
    state.matchTab === "browse"
      ? browsePeople()
      : state.matchTab === "saved"
        ? rolePeople()
        : matches();
  const candidates =
    state.matchTab === "saved"
      ? available.filter((person) => savedMatches().has(person.id))
      : available;
  const list = filterPeople(candidates, state.matchFilters);
  const shortlistEmpty = state.matchTab === "saved" && !candidates.length;
  const emptyCopy = shortlistEmpty
    ? "You haven’t saved anyone yet. Bookmark a match to keep it close."
    : "No matches fit those filters yet. Try a broader search.";
  if (!model.allPeople().length)
    return (
      <div className="page page-enter">
        <PageHeader
          title="Matches"
          intro="Find startups and mentors to work with."
        />
        <section className="card clean-empty-state">
          <div className="empty-icon">
            <Icon name="search" />
          </div>
          <h2>No matches yet</h2>
          <p>
            Complete your profile, then invite a collaborator to create an
            account on this server. Their completed profile will appear here.
          </p>
          <button className="btn" onClick={() => onAction({ page: "profile" })}>
            View your profile
          </button>
        </section>
      </div>
    );
  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="GOOD FIT, NOT JUST GOOD TIMING"
        title="Matches"
        intro="Meet people whose offers, needs, and goals complement yours."
      />
      {"\n          "}
      <div className="tabs" role="tablist" aria-label="Match lists">
        {[
          ["suggested", "Suggested"],
          ["saved", "Saved"],
          ["browse", "Browse all"],
        ].map(([key, label], itemIndex) => (
          <Fragment key={itemIndex}>
            <button
              className={"tab " + (state.matchTab === key ? "active" : "")}
              role="tab"
              id={`match-tab-${key}`}
              aria-controls="match-results"
              aria-selected={state.matchTab === key}
              data-action="match-tab"
              data-tab={key}
              onClick={(event) =>
                onAction(
                  {
                    action: "match-tab",
                    tab: key,
                  },
                  event,
                )
              }
              onKeyDown={onTabKeyDown}
              tabIndex={state.matchTab === key ? 0 : -1}
            >
              {label}
              {key === "saved" ? (
                <span className="tag">
                  {
                    rolePeople().filter((person) =>
                      savedMatches().has(person.id),
                    ).length
                  }
                </span>
              ) : (
                ""
              )}
            </button>
          </Fragment>
        ))}
      </div>
      {"\n          "}
      <div className="filters">
        <div className="filter-search field">
          <label htmlFor="match-search">Search matches</label>
          <input
            className="search-input"
            id="match-search"
            type="search"
            value={state.matchFilters.search}
            placeholder="Search by name, skill, or industry"
            aria-label="Search matches"
            onChange={(event) => onFilter("search", event.target.value)}
          />
        </div>
        <div className="filter-type field">
          <label htmlFor="type-filter">Type</label>
          <select
            className="filter-select"
            id="type-filter"
            aria-label="Filter by type"
            value={state.matchFilters.type}
            onChange={(event) => onFilter("type", event.target.value)}
          >
            <option value="all">All types</option>
            <option value="Startup">Startups</option>
            <option value="Mentor">Mentors</option>
          </select>
        </div>
        <button
          className="btn filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls="advanced-filters"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          Filters
          {advancedCount > 0 && <span className="tag">{advancedCount}</span>}
          <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
        </button>
        {hasFilters && (
          <button
            className="link-btn filter-reset"
            onClick={() => onAction({ action: "clear-filters" })}
          >
            Clear filters
          </button>
        )}
        <div
          className="advanced-filters"
          id="advanced-filters"
          hidden={!filtersOpen}
        >
          <div className="field">
            <label htmlFor="industry-filter">Industry</label>
            <select
              className="filter-select"
              id="industry-filter"
              aria-label="Filter by industry"
              value={state.matchFilters.industry}
              onChange={(event) => onFilter("industry", event.target.value)}
            >
              <option value="all">All industries</option>
              <option value="Consumer">Consumer</option>
              <option value="EdTech">EdTech</option>
              <option value="Product">Product &amp; growth</option>
              <option value="Fundraising">Fundraising</option>
              <option value="FinTech">FinTech</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="score-filter">Minimum fit</label>
            <select
              className="filter-select"
              id="score-filter"
              aria-label="Filter by score"
              value={state.matchFilters.score}
              onChange={(event) => onFilter("score", event.target.value)}
            >
              <option value="0">Any score</option>
              <option value="80">80% and above</option>
              <option value="85">85% and above</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="engagement-filter">Engagement</label>
            <select
              className="filter-select"
              id="engagement-filter"
              aria-label="Filter by engagement type"
              value={state.matchFilters.engagement}
              onChange={(event) => onFilter("engagement", event.target.value)}
            >
              <option value="all">All engagement types</option>
              <option value="Beta Testing Exchange">
                Beta Testing Exchange
              </option>
              <option value="Co-Marketing Swap">Co-Marketing Swap</option>
              <option value="Mentorship">Mentorship</option>
            </select>
          </div>
        </div>
      </div>
      {"\n          "}
      <div className="grid discovery-layout">
        <section
          id="match-results"
          role="tabpanel"
          aria-labelledby={`match-tab-${state.matchTab}`}
        >
          <div className="panel-head">
            <div>
              <h2 id="match-count">
                {state.matchTab === "saved"
                  ? "Saved matches"
                  : state.matchTab === "browse"
                    ? "Browse all"
                    : "Suggested for you"}{" "}
                <span
                  className="tag"
                  role="status"
                  aria-live="polite"
                  aria-label={`${list.length} matches found`}
                >
                  {list.length}
                </span>
              </h2>
              <p className="panel-subtitle">
                The why behind every introduction.
              </p>
            </div>
          </div>
          <div className="match-list" id="discovery-list">
            {list.length ? (
              list.map((person, itemIndex) => (
                <Fragment key={itemIndex}>
                  <MatchCard person={person} large={true} />
                </Fragment>
              ))
            ) : (
              <section className="empty-state">
                <div className="empty-icon">
                  <Icon name={shortlistEmpty ? "star" : "search"} />
                </div>
                <h3>
                  {shortlistEmpty
                    ? "Keep your shortlist here"
                    : "No matches found"}
                </h3>
                <p>{emptyCopy}</p>
                <button
                  className="btn primary"
                  hidden={!shortlistEmpty}
                  onClick={() => {
                    onAction({ action: "clear-filters" });
                    onAction({ action: "match-tab", tab: "suggested" });
                  }}
                >
                  Explore matches
                </button>
                {hasFilters && !shortlistEmpty && (
                  <button
                    className="btn"
                    onClick={() => onAction({ action: "clear-filters" })}
                  >
                    Clear filters
                  </button>
                )}
              </section>
            )}
          </div>
        </section>
        {"\n            "}
        <aside className="card panel score-guide">
          <h2>How the score works</h2>
          <p className="panel-subtitle">
            Five signals summarize where a collaboration may fit.
          </p>
          <ul>
            <li>
              <strong>Need Fit</strong>
              <span>How each side’s needs and offers complement.</span>
            </li>
            <li>
              <strong>Expertise Fit</strong>
              <span>For mentor matches only.</span>
            </li>
            <li>
              <strong>Industry Fit</strong>
              <span>Relevant context and shared users.</span>
            </li>
            <li>
              <strong>Stage / Size Fit</strong>
              <span>
                Stage and team size, or audience size for co-marketing, when
                provided.
              </span>
            </li>
            <li>
              <strong>Goal Fit</strong>
              <span>
                Stated goals and engagement preferences; profile context when
                goals are missing.
              </span>
            </li>
          </ul>
          <p className="score-guide-note">
            Scores are directional—not decisions made for you.
          </p>
        </aside>
        {"\n          "}
      </div>
      {"\n        "}
    </div>
  );
}
