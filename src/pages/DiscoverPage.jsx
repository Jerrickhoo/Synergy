import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import { filterPeople } from "../data/filters.js";
import MatchCard from "../components/MatchCard.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Icon from "../components/Icon.jsx";
export default function DiscoverPage() {
  const { state, model, onAction, onFilter, onTabKeyDown } = useApp();
  const { matches, browsePeople, rolePeople, savedMatches } = model;
  const available =
    state.matchTab === "browse"
      ? browsePeople()
      : state.matchTab === "saved"
        ? rolePeople()
        : matches();
  const list = filterPeople(
    state.matchTab === "saved"
      ? available.filter((person) => savedMatches().has(person.id))
      : available,
    state.matchFilters,
  );
  const emptyCopy =
    state.matchTab === "saved"
      ? "You haven’t saved anyone yet. Bookmark a match to keep it close."
      : "No matches fit those filters yet. Try a broader search.";
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
        <input
          className="search-input"
          id="match-search"
          type="search"
          value={state.matchFilters.search}
          placeholder="Search by name, skill, or industry"
          aria-label="Search matches"
          onChange={(event) => onFilter("search", event.target.value)}
        />
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
        <select
          className="filter-select"
          id="engagement-filter"
          aria-label="Filter by engagement type"
          value={state.matchFilters.engagement}
          onChange={(event) => onFilter("engagement", event.target.value)}
        >
          <option value="all">All engagement types</option>
          <option value="Beta Testing Exchange">Beta Testing Exchange</option>
          <option value="Co-Marketing Swap">Co-Marketing Swap</option>
          <option value="Mentorship">Mentorship</option>
        </select>
      </div>
      {"\n          "}
      <div className="grid discovery-layout">
        <section>
          <div className="panel-head">
            <div>
              <h2 id="match-count">
                {state.matchTab === "saved"
                  ? "Saved matches"
                  : state.matchTab === "browse"
                    ? "Browse all"
                    : "Suggested for you"}{" "}
                <span className="tag">{list.length}</span>
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
                <Icon name={state.matchTab === "saved" ? "profile" : "spark"} />
                <p>{emptyCopy}</p>
                <button
                  className="btn primary"
                  data-action={
                    state.matchTab === "saved" ? "match-tab" : "clear-filters"
                  }
                  {...(state.matchTab === "saved"
                    ? {
                        "data-tab": "suggested",
                      }
                    : {})}
                  onClick={(event) =>
                    onAction(
                      {
                        action:
                          state.matchTab === "saved"
                            ? "match-tab"
                            : "clear-filters",
                      },
                      event,
                    )
                  }
                >
                  {state.matchTab === "saved"
                    ? "Explore matches"
                    : "Clear filters"}
                </button>
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
              <span>Readiness and team capacity.</span>
            </li>
            <li>
              <strong>Goal Fit</strong>
              <span>How closely the desired outcomes align.</span>
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
