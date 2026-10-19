import NextStep from "../components/NextStep.jsx";
import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Tags from "../components/Tags.jsx";
import PageHeader from "../components/PageHeader.jsx";
import RatingStars from "../components/RatingStars.jsx";
export default function ProfilePage() {
  const { state, model, onAction, onSubmit, onTabKeyDown } = useApp();
  const { roleName, roleInitials } = model;
  const founder = state.role === "founder";
  const profile = state.profiles[state.role];
  const history = state.trustHistoryByRole[state.role];
  const offer = profile.offer
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const need = profile.need
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const fields = founder
    ? [
        profile.bio,
        profile.offer,
        profile.need,
        profile.industry,
        profile.stage,
        profile.teamSize,
      ]
    : [
        profile.bio,
        profile.offer,
        profile.need,
        profile.expertise,
        profile.availability,
      ];
  const completeness = Math.round(
    (fields.filter((value) => String(value || "").trim()).length /
      fields.length) *
      100,
  );
  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="YOUR STORY, YOUR TERMS"
        title="Profile"
        intro="Your story and trust history help the right people feel confident reaching out."
      />
      {"\n          "}
      <div
        className="tabs profile-tabs"
        role="tablist"
        aria-label="Profile sections"
      >
        <button
          className={"tab " + (state.profileTab === "about" ? "active" : "")}
          role="tab"
          aria-selected={state.profileTab === "about"}
          data-action="profile-tab"
          data-tab="about"
          onClick={(event) =>
            onAction(
              {
                action: "profile-tab",
                tab: "about",
              },
              event,
            )
          }
          onKeyDown={onTabKeyDown}
          tabIndex={state.profileTab === "about" ? 0 : -1}
        >
          About
        </button>
        <button
          className={"tab " + (state.profileTab === "trust" ? "active" : "")}
          role="tab"
          aria-selected={state.profileTab === "trust"}
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
          onKeyDown={onTabKeyDown}
          tabIndex={state.profileTab === "trust" ? 0 : -1}
        >
          Trust history
        </button>
      </div>
      {"\n          "}
      {state.profileTab === "trust" ? (
        <section className="grid profile-grid">
          <article className="card panel">
            <div className="profile-hero">
              <Avatar initials={roleInitials()} color={founder ? "" : "blue"} />
              <div>
                <div className="eyebrow">VERIFIED MEMBER · SINCE 2025</div>
                <h2>{roleName()}</h2>
                <p>
                  {founder
                    ? `Founder at BudgetBuddy · ${profile.industry} · ${profile.stage}`
                    : `Product mentor · ${profile.expertise}`}
                </p>
              </div>
            </div>
            <div className="profile-stats">
              <div className="profile-stat">
                <strong>
                  {"4.9 "}
                  <RatingStars rating={5} />
                </strong>
                <span>Average rating</span>
              </div>
              <div className="profile-stat">
                <strong>{history.length}</strong>
                <span>Completed deals</span>
              </div>
              <div className="profile-stat">
                <strong>100%</strong>
                <span>Follow-through</span>
              </div>
            </div>
          </article>
          <section className="card panel">
            <h2>Recent collaborations</h2>
            <p className="panel-subtitle">
              Reviews stay private until both partners submit.
            </p>
            {history.map((item, itemIndex) => (
              <Fragment key={itemIndex}>
                <div className="history-row">
                  <div>
                    <div className="history-title">{item.title}</div>
                    <div className="history-meta">
                      {"with "}
                      {item.partner}
                      {" · Completed "}
                      {item.date}
                    </div>
                  </div>
                  <RatingStars rating={item.rating} />
                </div>
              </Fragment>
            ))}
          </section>
        </section>
      ) : (
        <div className="grid profile-grid">
          <section className="card panel">
            <div className="profile-hero">
              <Avatar initials={roleInitials()} color={founder ? "" : "blue"} />
              <div>
                <div className="eyebrow">VERIFIED MEMBER</div>
                <h2>{roleName()}</h2>
                <p>
                  {founder
                    ? `Founder · ${profile.industry} · ${profile.stage} · Team of ${profile.teamSize}`
                    : `Product mentor · ${profile.expertise} · ${profile.availability} · ${profile.startups}`}
                </p>
              </div>
            </div>
            <div className="profile-stats">
              <div className="profile-stat">
                <strong>4.9</strong>
                <span>Average rating</span>
              </div>
              <div className="profile-stat">
                <strong>{history.length}</strong>
                <span>Completed deals</span>
              </div>
              <div className="profile-stat">
                <strong>100%</strong>
                <span>Follow-through</span>
              </div>
            </div>
            {state.profileEditing ? (
              <form
                id="profile-form"
                className="grid section-gap"
                onSubmit={(event) => onSubmit(event)}
              >
                <div className="field">
                  <label htmlFor="profile-bio">About me</label>
                  <textarea
                    id="profile-bio"
                    name="bio"
                    defaultValue={profile.bio}
                  />
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="profile-offer">What I offer</label>
                    <textarea
                      id="profile-offer"
                      name="offer"
                      defaultValue={profile.offer}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="profile-need">What I need</label>
                    <textarea
                      id="profile-need"
                      name="need"
                      defaultValue={profile.need}
                    />
                  </div>
                </div>
                {founder ? (
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="profile-industry">Industry</label>
                      <input
                        id="profile-industry"
                        name="industry"
                        defaultValue={profile.industry}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="profile-stage">Stage</label>
                      <select
                        id="profile-stage"
                        name="stage"
                        defaultValue={profile.stage}
                      >
                        {["idea", "pre-seed", "seed", "growth"].map(
                          (value, itemIndex) => (
                            <Fragment key={itemIndex}>
                              <option value={value}>{value}</option>
                            </Fragment>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="profile-size">Team size</label>
                      <input
                        id="profile-size"
                        name="teamSize"
                        type="number"
                        min="1"
                        defaultValue={profile.teamSize}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="profile-expertise">Expertise areas</label>
                      <input
                        id="profile-expertise"
                        name="expertise"
                        defaultValue={profile.expertise}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="profile-availability">Availability</label>
                      <input
                        id="profile-availability"
                        name="availability"
                        defaultValue={profile.availability}
                      />
                    </div>
                    <div className="field full-width">
                      <label htmlFor="profile-startups">
                        Startups I want to help
                      </label>
                      <input
                        id="profile-startups"
                        name="startups"
                        defaultValue={profile.startups}
                      />
                    </div>
                  </div>
                )}
                <div className="profile-edit-actions">
                  <button className="btn primary" type="submit">
                    Save profile
                  </button>
                  <button
                    className="btn"
                    type="button"
                    data-action="cancel-profile-edit"
                    onClick={(event) =>
                      onAction(
                        {
                          action: "cancel-profile-edit",
                        },
                        event,
                      )
                    }
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-summary">
                <p>{profile.bio}</p>
                <div className="history-row">
                  <span>
                    {founder
                      ? "Industry · Stage · Team"
                      : "Expertise · Availability · Startups I want to help"}
                  </span>
                  <strong>
                    {founder
                      ? `${profile.industry} · ${profile.stage} · ${profile.teamSize}`
                      : `${profile.expertise} · ${profile.availability} · ${profile.startups}`}
                  </strong>
                </div>
                <button
                  className="btn primary"
                  type="button"
                  data-action="edit-profile"
                  onClick={(event) =>
                    onAction(
                      {
                        action: "edit-profile",
                      },
                      event,
                    )
                  }
                >
                  Edit profile
                </button>
              </div>
            )}
          </section>
          <div className="profile-sidebar">
            <aside className="card panel profile-preview">
              <h2>How others see you</h2>
              <div className="profile-top">
                <Avatar
                  initials={roleInitials()}
                  color={founder ? "" : "blue"}
                />
                <div>
                  <strong>{roleName()}</strong>
                  <div className="verified">Verified member</div>
                </div>
              </div>
              <p>{profile.bio}</p>
              <div className="profile-preview-label">OFFER</div>
              <Tags values={offer.slice(0, 3)} color="green" />
              <div className="profile-preview-label">LOOKING FOR</div>
              <Tags values={need.slice(0, 3)} />
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: completeness + "%",
                  }}
                />
              </div>
              <p className="profile-completeness">
                {completeness}% profile complete
              </p>
            </aside>
            <aside className="card panel profile-tip">
              <div className="tip-kicker">PROFILE TIP</div>
              <h2>Show the right fit</h2>
              <p>
                Specific offers and goals help potential partners picture how
                you’ll work together.
              </p>
              <button
                className="link-btn"
                type="button"
                data-action="edit-profile"
                onClick={(event) =>
                  onAction(
                    {
                      action: "edit-profile",
                    },
                    event,
                  )
                }
              >
                Edit your profile →
              </button>
            </aside>
          </div>
        </div>
      )}
      {"\n        "}
      <NextStep />
    </div>
  );
}
