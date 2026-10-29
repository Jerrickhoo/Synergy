import InviteCollaborator from "../components/InviteCollaborator.jsx";
import { useState, useEffect } from "react";
import { useApp } from "../state/AppContext.jsx";
import { filterPeople } from "../data/filters.js";
import MatchCard from "../components/MatchCard.jsx";
import Icon from "../components/Icon.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Overlay from "../components/Overlay.jsx";
import { profileKeys, profileFieldNames } from "../data/selectors.js";
export default function DiscoverPage() {
  const { state, model, onAction, onFilter, onTabKeyDown } = useApp();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("");
  useEffect(() => {
    setPage(1);
  }, [state.matchTab, JSON.stringify(state.matchFilters), sort]);
  const advancedCount = [
    state.matchFilters.type !== "all",
    state.matchFilters.industry !== "all",
    state.matchFilters.score !== "0",
    state.matchFilters.engagement !== "all",
  ].filter(Boolean).length;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(state.matchFilters);
  const [guideOpen, setGuideOpen] = useState(false);
  const missing = profileKeys(state.role).filter(
    (key) => !String(state.profiles[state.role][key] || "").trim(),
  );
  const profilePrompt = missing.length > 0 && (
    <section className="discovery-start" aria-label="Complete your profile">
      <span className="discovery-start-icon">
        <Icon name="people" />
      </span>
      <div>
        <strong>Add a little more to your profile</strong>
        <p>
          Still to add:{" "}
          {missing.map((key) => profileFieldNames[key]).join(", ")}. This helps
          people find you.
        </p>
      </div>
      <button
        className="btn small"
        onClick={() => onAction({ action: "edit-profile" })}
      >
        Edit profile
      </button>
    </section>
  );
  const updateDraft = (key, value) =>
    setDraftFilters((current) => ({ ...current, [key]: value }));
  const hasFilters =
    advancedCount > 0 ||
    state.matchFilters.type !== "all" ||
    Boolean(state.matchFilters.search);
  const { suggestedMatches, browsePeople, rolePeople, savedMatches } = model;
  const available =
    state.matchTab === "browse"
      ? browsePeople()
      : state.matchTab === "saved"
        ? rolePeople()
        : suggestedMatches();
  const candidates =
    state.matchTab === "saved"
      ? available.filter((person) => savedMatches().has(person.id))
      : available;
  const list = filterPeople(candidates, state.matchFilters).sort((a, b) =>
    (sort || (state.matchTab === "browse" ? "name" : "fit")) === "name"
      ? a.name.localeCompare(b.name)
      : sort === "experience"
        ? (b.trust?.completed || 0) - (a.trust?.completed || 0) ||
          b.score - a.score
        : b.score - a.score || a.name.localeCompare(b.name),
  );
  const pageCount = Math.max(1, Math.ceil(list.length / 12));
  const currentPage = Math.min(page, pageCount);
  const visibleList = list.slice((currentPage - 1) * 12, currentPage * 12);
  const industries = [
    ...new Set(
      rolePeople()
        .map((person) => person.sector)
        .filter(Boolean),
    ),
  ].sort();
  const shortlistEmpty = state.matchTab === "saved" && !candidates.length;
  const suggestionsEmpty =
    state.matchTab === "suggested" && !hasFilters && !list.length;
  const emptyCopy = shortlistEmpty
    ? "You haven’t saved anyone yet. Bookmark a match to keep it close."
    : suggestionsEmpty
      ? "There are no suggestions with enough profile fit yet. Browse the directory to explore more people, or add detail to your profile."
      : "No matches fit those filters yet. Try a broader search.";
  if (!model.allPeople().length)
    return (
      <div className="page discovery-page page-enter">
        <PageHeader
          title="Matches"
          intro="Find startups and mentors to work with."
        />
        {profilePrompt}
        <section className="card clean-empty-state">
          <h2>No matches yet</h2>
          <p>
            Complete your profile and invite a collaborator. Completed profiles
            will appear here.
          </p>
          <InviteCollaborator />
          <button className="btn" onClick={() => onAction({ page: "profile" })}>
            View your profile
          </button>
        </section>
      </div>
    );
  return (
    <div className="page discovery-page page-enter">
      <PageHeader
        title="Matches"
        intro="Find the right people to build something together."
      />
      {profilePrompt}
      <div className="discovery-controls">
        <div className="tabs" role="tablist" aria-label="Match lists">
          {[
            ["suggested", "Suggested"],
            ["saved", "Saved"],
            ["browse", "Browse all"],
          ].map(([key, label]) => (
            <button
              className={"tab " + (state.matchTab === key ? "active" : "")}
              key={key}
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
          ))}
        </div>
        {"\n          "}
        <div className="filters">
          <div className="filter-search field">
            <label className="visually-hidden" htmlFor="match-search">
              Search matches
            </label>
            <Icon name="search" />
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
          <button
            className="btn filter-toggle"
            aria-expanded={filtersOpen}
            aria-haspopup="dialog"
            aria-controls="advanced-filters"
            onClick={() => {
              setDraftFilters({ ...state.matchFilters });
              setFiltersOpen(true);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 17h16" />
              <circle cx="9" cy="7" r="3" fill="white" />
              <circle cx="15" cy="17" r="3" fill="white" />
            </svg>
            Filters
            {advancedCount > 0 && <span className="tag">{advancedCount}</span>}
          </button>
          {hasFilters && (
            <button
              className="link-btn filter-reset"
              onClick={() => onAction({ action: "clear-filters" })}
            >
              Clear filters
            </button>
          )}
          {filtersOpen && (
            <Overlay
              id="advanced-filters"
              title="Filter matches"
              onClose={() => setFiltersOpen(false)}
              footer={
                <>
                  <button
                    className="link-btn"
                    onClick={() =>
                      setDraftFilters({
                        ...draftFilters,
                        type: "all",
                        industry: "all",
                        score: "0",
                        engagement: "all",
                      })
                    }
                  >
                    Reset filters
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => {
                      for (const key of [
                        "type",
                        "industry",
                        "score",
                        "engagement",
                      ])
                        onFilter(key, draftFilters[key]);
                      setFiltersOpen(false);
                    }}
                  >
                    Show matches
                  </button>
                </>
              }
            >
              <p className="overlay-intro">
                Narrow your search to the people you want to work with.
              </p>
              <div className="overlay-filters">
                <div className="field">
                  <label htmlFor="type-filter">Type</label>
                  <select
                    className="filter-select"
                    id="type-filter"
                    aria-label="Filter by type"
                    value={draftFilters.type}
                    onChange={(event) =>
                      updateDraft("type", event.target.value)
                    }
                  >
                    <option value="all">All types</option>
                    <option value="Startup">Startups</option>
                    <option value="Mentor">Mentors</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="industry-filter">Industry</label>
                  <select
                    className="filter-select"
                    id="industry-filter"
                    aria-label="Filter by industry"
                    value={draftFilters.industry}
                    onChange={(event) =>
                      updateDraft("industry", event.target.value)
                    }
                  >
                    <option value="all">All industries</option>
                    {industries.map((industry) => (
                      <option key={industry} value={industry}>
                        {industry}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="score-filter">Minimum fit</label>
                  <select
                    className="filter-select"
                    id="score-filter"
                    aria-label="Filter by score"
                    value={draftFilters.score}
                    onChange={(event) =>
                      updateDraft("score", event.target.value)
                    }
                  >
                    <option value="0">Any score</option>
                    <option value="30">30% and above</option>
                    <option value="50">50% and above</option>
                    <option value="70">70% and above</option>
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
                    value={draftFilters.engagement}
                    onChange={(event) =>
                      updateDraft("engagement", event.target.value)
                    }
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
            </Overlay>
          )}
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
                {state.matchTab === "suggested"
                  ? "People whose skills and goals connect with yours."
                  : state.matchTab === "saved"
                    ? "Your shortlist, ready when you are."
                    : "Explore the community and find your next collaborator."}
              </p>
            </div>
            <div className="field discovery-sort">
              <label htmlFor="match-sort">Sort by</label>
              <select
                id="match-sort"
                aria-label="Sort by"
                value={sort || (state.matchTab === "browse" ? "name" : "fit")}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="fit">Highest fit</option>
                <option value="name">Name</option>
                <option value="experience">Completed collaborations</option>
              </select>
            </div>
          </div>
          <div className="match-list" id="discovery-list">
            {list.length ? (
              visibleList.map((person) => (
                <MatchCard key={person.id} person={person} large={true} />
              ))
            ) : (
              <section className="empty-state">
                <h3>
                  {shortlistEmpty
                    ? "Keep your shortlist here"
                    : suggestionsEmpty
                      ? "No suggestions yet"
                      : "No matches found"}
                </h3>
                <p>{emptyCopy}</p>
                {suggestionsEmpty && (
                  <button
                    className="btn primary"
                    onClick={() =>
                      onAction({ action: "match-tab", tab: "browse" })
                    }
                  >
                    Browse all profiles
                  </button>
                )}
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
          {pageCount > 1 && (
            <nav className="pagination" aria-label="Match result pages">
              <button
                className="btn"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <span role="status">
                Page {currentPage} of {pageCount}
              </span>
              <button
                className="btn"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </section>
        {"\n            "}
        <aside className="score-guide">
          <button
            className="link-btn score-help"
            aria-haspopup="dialog"
            aria-expanded={guideOpen}
            aria-controls="score-guide-dialog"
            onClick={() => setGuideOpen(true)}
          >
            <Icon name="info" /> How the score works
          </button>
          {guideOpen && (
            <Overlay
              id="score-guide-dialog"
              title="How the score works"
              onClose={() => setGuideOpen(false)}
            >
              <p className="panel-subtitle">
                Profile signals summarize where a collaboration may fit.
              </p>
              <ul>
                <li>
                  <strong>Need Fit</strong>
                  <span>
                    Both directions of need/offer coverage for exchanges;
                    founder needs for mentorship.
                  </span>
                </li>
                {state.role === "mentor" && (
                  <li>
                    <strong>Expertise Fit</strong>
                    <span>Founder needs compared with mentor expertise.</span>
                  </li>
                )}
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
                    Stated goals and engagement preferences. Missing inputs earn
                    no positive fit.
                  </span>
                </li>
              </ul>
              <p className="score-guide-note">
                Scores summarize profile signals. They are not a validated
                probability of success.
              </p>
            </Overlay>
          )}
        </aside>
        {"\n          "}
      </div>
      {"\n        "}
    </div>
  );
}
