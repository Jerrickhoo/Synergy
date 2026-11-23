import InviteCollaborator from "../components/InviteCollaborator.jsx";
import { useState, useEffect } from "react";
import { useApp } from "../state/AppContext.jsx";
import {
  activeFilterCount,
  defaultMatchFilters,
  emptyStateKind,
  filterPeople,
  hasActiveFilters,
  validMaxPrice,
  validMinimumFit,
} from "../data/filters.js";
import MatchCard from "../components/MatchCard.jsx";
import Icon from "../components/Icon.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Overlay from "../components/Overlay.jsx";
import ScoreGuide from "../components/ScoreGuide.jsx";
import SelectField from "../components/SelectField.jsx";
import { profileKeys, profileFieldNames } from "../data/selectors.js";
import { closestProfiles, needLabel, uncoveredNeeds } from "../data/home.js";

// One opt-in that adds a match-suggestion Update when a profile offering the
// founder's first need appears. Preferences live in Settings.
function MatchAlert({ need }) {
  const { state, onAction, onSubmit } = useApp();
  const [sending, setSending] = useState(false);
  const on = (state.matchAlerts || []).some(
    (alert) => alert.need.toLowerCase() === need.toLowerCase(),
  );
  const submit = async (enabled) => {
    const form = document.createElement("form");
    form.dataset.form = "match-alert";
    for (const [name, value] of Object.entries({ need, enabled })) {
      const input = document.createElement("input");
      input.name = name;
      input.value = value;
      form.append(input);
    }
    setSending(true);
    await onSubmit({ preventDefault() {}, currentTarget: form });
    setSending(false);
  };
  return on ? (
    <p className="match-alert-on" role="status">
      <Icon name="check" /> You’ll get an Update when someone offers {need}.{" "}
      <button
        className="link-btn"
        onClick={() => onAction({ page: "settings" })}
      >
        Notification preferences
      </button>
    </p>
  ) : (
    <button
      className="btn"
      disabled={state.busy}
      aria-busy={sending}
      onClick={() => submit("on")}
    >
      {sending && <span className="spinner" aria-hidden="true" />}
      Get notified when someone offers {need}
    </button>
  );
}
export default function DiscoverPage() {
  const { state, model, onAction, onFilter, onTabKeyDown } = useApp();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("");
  useEffect(() => {
    setPage(1);
  }, [state.matchTab, JSON.stringify(state.matchFilters), sort]);
  const advancedCount = activeFilterCount(state.matchFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(state.matchFilters);
  const [fitInputInvalid, setFitInputInvalid] = useState(false);
  const fitValid = validMinimumFit(draftFilters.score) && !fitInputInvalid;
  const [priceInputInvalid, setPriceInputInvalid] = useState(false);
  const priceValid = validMaxPrice(draftFilters.maxPrice) && !priceInputInvalid;
  const draftValid = fitValid && priceValid;
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
  const hasFilters = hasActiveFilters(state.matchFilters);
  const { suggestedMatches, browsePeople, rolePeople, savedMatches } = model;
  const savedCount = rolePeople().filter((person) =>
    savedMatches().has(person.id),
  ).length;
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
  // Paging is at the bottom of the list, so bring the new page's first cards
  // into view instead of leaving the reader at its end.
  const goToPage = (next) => {
    setPage(next);
    const top = document.getElementById("discovery-list");
    if (!top || top.getBoundingClientRect().top >= 0) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    top.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  };
  const industries = [
    ...new Set(
      rolePeople()
        .map((person) => person.sector)
        .filter(Boolean),
    ),
  ].sort();
  const emptyKind = emptyStateKind({
    tab: state.matchTab,
    filters: state.matchFilters,
    candidates,
    list,
  });
  const shortlistEmpty = emptyKind === "shortlist";
  const suggestionsEmpty = emptyKind === "suggestions";
  const closest = suggestionsEmpty ? closestProfiles(state) : [];
  // The first stated need no suggestion covers gets the match-alert opt-in.
  const [gap] = missing.length ? [] : uncoveredNeeds(state);
  const need = gap && needLabel(gap);
  const showGap =
    need &&
    !suggestionsEmpty &&
    state.matchTab === "suggested" &&
    !hasFilters &&
    list.length > 0;
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
          intro={
            state.role === "mentor"
              ? "Find startups that need your expertise."
              : "Find startups and mentors to work with."
          }
        />
        {profilePrompt}
        <section className="card clean-empty-state">
          <h2>No matches yet</h2>
          <p>
            {missing.length
              ? "Complete your profile to appear in Matches, then invite a collaborator. Completed profiles appear here."
              : "Your profile is live. No other completed profiles are available yet. Invite a collaborator, and they will appear here once their profile is complete."}
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
        intro={
          state.role === "mentor"
            ? "Startups ranked by how well their needs fit your expertise."
            : "Ranked by two-way fit: what you get and what they get."
        }
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
              {key === "saved" && savedCount > 0 && (
                <span className="tag">{savedCount}</span>
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
              placeholder="Search by name, skill, goal or industry"
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
              setFitInputInvalid(false);
              setPriceInputInvalid(false);
              setFiltersOpen(true);
            }}
          >
            <Icon name="filter" />
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
                    onClick={() => {
                      setFitInputInvalid(false);
                      setPriceInputInvalid(false);
                      // Reset keeps the search; it clears the dialog only.
                      setDraftFilters({
                        ...defaultMatchFilters,
                        search: draftFilters.search,
                      });
                    }}
                  >
                    Reset filters
                  </button>
                  <button
                    className="btn primary"
                    disabled={!draftValid}
                    onClick={() => {
                      if (!draftValid) return;
                      for (const key of [
                        "type",
                        "industry",
                        "score",
                        "engagement",
                        "availableNow",
                        "freeOnly",
                        "maxPrice",
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
                {state.role === "founder" && (
                  <>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(draftFilters.freeOnly)}
                        onChange={(e) =>
                          updateDraft("freeOnly", e.target.checked)
                        }
                      />
                      Free only
                    </label>
                    <div className="field">
                      <label htmlFor="max-price-filter">
                        Maximum price in PHP
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        id="max-price-filter"
                        aria-invalid={!priceValid}
                        aria-describedby="max-price-filter-help max-price-filter-error"
                        value={draftFilters.maxPrice || ""}
                        onInput={(event) =>
                          setPriceInputInvalid(
                            event.currentTarget.validity.badInput,
                          )
                        }
                        onChange={(event) => {
                          setPriceInputInvalid(event.target.validity.badInput);
                          updateDraft("maxPrice", event.target.value);
                        }}
                      />
                      <p id="max-price-filter-help" className="field-help">
                        Leave empty for any price.
                      </p>
                      <p
                        id="max-price-filter-error"
                        className="field-error"
                        role={!priceValid ? "alert" : undefined}
                      >
                        {!priceValid
                          ? "Enter a price of 0 or more, or leave it empty."
                          : ""}
                      </p>
                    </div>
                  </>
                )}
                {state.role === "founder" && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={Boolean(draftFilters.availableNow)}
                      onChange={(event) =>
                        updateDraft("availableNow", event.target.checked)
                      }
                    />
                    Available now
                    <span className="field-help">
                      Only mentors who can take a request today
                    </span>
                  </label>
                )}
                <div className="field">
                  <label htmlFor="type-filter">Type</label>
                  <SelectField
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
                  </SelectField>
                </div>
                <div className="field">
                  <label htmlFor="industry-filter">Industry</label>
                  <SelectField
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
                  </SelectField>
                </div>
                <div className="field">
                  <label htmlFor="score-filter">Minimum fit (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    id="score-filter"
                    aria-label="Minimum fit (%)"
                    aria-invalid={!fitValid}
                    aria-describedby="score-filter-help score-filter-error"
                    value={draftFilters.score}
                    onInput={(event) =>
                      setFitInputInvalid(event.currentTarget.validity.badInput)
                    }
                    onChange={(event) => {
                      setFitInputInvalid(event.target.validity.badInput);
                      updateDraft("score", event.target.value);
                    }}
                  />
                  <p id="score-filter-help" className="field-help">
                    Includes matches at or above this percentage. Leave empty
                    for any fit.
                  </p>
                  <p
                    id="score-filter-error"
                    className="field-error"
                    role={!fitValid ? "alert" : undefined}
                  >
                    {!fitValid ? "Enter a whole percentage from 0 to 100." : ""}
                  </p>
                </div>
                <div className="field">
                  <label htmlFor="engagement-filter">Engagement</label>
                  <SelectField
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
                    <option value="Skill Swap">Skill Swap</option>
                    <option value="Mentorship">Mentorship</option>
                  </SelectField>
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
            </div>
            <div className="field discovery-sort">
              <SelectField
                id="match-sort"
                label="Sort by"
                value={sort || (state.matchTab === "browse" ? "name" : "fit")}
                onChange={(event) => setSort(event.target.value)}
                options={[
                  { value: "fit", label: "Highest fit" },
                  { value: "name", label: "Name" },
                  { value: "experience", label: "Completed collaborations" },
                ]}
              />
            </div>
          </div>
          <div
            className="match-list"
            id="discovery-list"
            key={`${state.matchTab}:${currentPage}`}
          >
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
                {suggestionsEmpty && need && <MatchAlert need={need} />}
              </section>
            )}
            {showGap && (
              <section className="match-gap" aria-label="Needs without a match">
                <p>No suggestion covers {need} yet.</p>
                <MatchAlert need={need} />
              </section>
            )}
            {suggestionsEmpty && closest.length > 0 && (
              <section
                className="closest-profiles"
                aria-labelledby="closest-profiles-title"
              >
                <h3 id="closest-profiles-title">Closest profiles so far</h3>
                {closest.map((person) => (
                  <MatchCard key={person.id} person={person} large={true} />
                ))}
              </section>
            )}
          </div>
          {pageCount > 1 && (
            <nav className="pagination" aria-label="Match result pages">
              <button
                className="btn"
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                Previous
              </button>
              <span role="status">
                Page {currentPage} of {pageCount}
              </span>
              <button
                className="btn"
                disabled={currentPage >= pageCount}
                onClick={() => goToPage(currentPage + 1)}
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
              <ScoreGuide role={state.role} />
            </Overlay>
          )}
        </aside>
        {"\n          "}
      </div>
      {"\n        "}
    </div>
  );
}
