import { useDraft } from "../state/useDraft.js";
import { Fragment, useRef } from "react";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Avatar from "../components/Avatar.jsx";
import FormErrors from "../components/FormErrors.jsx";
import { profileCompleteness, profileKeys } from "../data/selectors.js";
import ProfileStats from "../components/ProfileStats.jsx";
import EmailVerification from "../components/EmailVerification.jsx";
import ProfileAssistant from "../components/ProfileAssistant.jsx";
import ProfileOptions from "../components/ProfileOptions.jsx";
import CommunityRequests from "../components/CommunityRequests.jsx";

export default function ProfilePage() {
  const { state, model, onAction, onSubmit } = useApp();
  const formRef = useRef(null);
  const founder = state.role === "founder";
  const savedProfile = state.profiles[state.role];
  const draft = useDraft(`${state.accountId}:profile:${state.role}`, {
    ...savedProfile,
    name: state.accountName,
  });
  const profile = state.profileEditing ? draft.values : savedProfile;
  const completeness = profileCompleteness(savedProfile, state.role);
  const history = state.trustHistoryByRole[state.role];
  const fieldNames = {
    bio: "an introduction",
    offer: "what you offer",
    need: "what you need",
    industry: "your industry",
    stage: "your startup stage",
    teamSize: "your team size",
    expertise: "your expertise",
    availability: "your availability",
    startups: "the startups you want to help",
  };
  const missing = profileKeys(state.role).filter(
    (key) => !String(savedProfile[key] || "").trim(),
  );
  return (
    <div className="page simple-profile page-enter">
      <PageHeader
        title="Your profile"
        intro="Help others understand what you do and how you can work together."
      />
      <EmailVerification />
      <section className="card panel">
        <div className="profile-hero">
          <Avatar initials={model.roleInitials()} />
          <div>
            <h2>{model.roleName()}</h2>
            <p>{model.roleLabel()}</p>
          </div>
          <span className="tag profile-progress">{completeness}% complete</span>
        </div>
        {missing.length > 0 && (
          <div className="profile-completion-note">
            <strong>Complete your profile to appear in Matches</strong>
            <p>
              Still to add: {missing.map((key) => fieldNames[key]).join(", ")}.
            </p>
          </div>
        )}
        <div className="field account-role">
          <label htmlFor="account-role">I'm here as a</label>
          <select
            id="account-role"
            disabled={state.busy}
            value={state.role}
            onChange={(event) =>
              onAction({
                action: "choose-role",
                roleChoice: event.target.value,
              })
            }
          >
            <option value="founder">Startup founder</option>
            <option value="mentor">Mentor</option>
          </select>
        </div>
        {state.profileEditing ? (
          <form
            id="profile-form"
            ref={formRef}
            key={state.role}
            className="grid section-gap"
            onChange={(event) =>
              draft.update(
                Object.fromEntries(new FormData(event.currentTarget)),
              )
            }
            onSubmit={async (event) => {
              const success = await onSubmit(event);
              if (success) draft.clear();
            }}
          >
            <p className="muted">
              Start with your introduction, what you offer and what you need.
              Complete the required context below to appear in Matches. Optional
              preferences can wait.
            </p>
            {draft.dirty && (
              <p className="muted" role="status">
                Your draft is saved in this tab. Save your profile to publish
                changes.
              </p>
            )}
            <FormErrors scope="profile-form" />
            <ProfileAssistant
              onApply={(suggestion) => {
                for (const [key, value] of Object.entries(suggestion)) {
                  const field = formRef.current?.elements.namedItem(key);
                  if (field) field.value = value;
                }
                draft.update(Object.fromEntries(new FormData(formRef.current)));
              }}
            />
            <div className="field">
              <label htmlFor="profile-name">Your name</label>
              <input
                id="profile-name"
                name="name"
                autoComplete="name"
                required
                defaultValue={profile.name || state.accountName}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-bio">About me</label>
              <textarea
                id="profile-bio"
                name="bio"
                required
                placeholder="What are you building, and who does it help?"
                maxLength={2000}
                defaultValue={profile.bio}
              />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="profile-offer">What I offer</label>
                <textarea
                  id="profile-offer"
                  name="offer"
                  required
                  placeholder="For example: product design, access to 20 beta testers"
                  maxLength={2000}
                  defaultValue={profile.offer}
                />
              </div>
              <div className="field">
                <label htmlFor="profile-need">What I need</label>
                <textarea
                  id="profile-need"
                  name="need"
                  required
                  placeholder="For example: feedback on onboarding from student users"
                  maxLength={2000}
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
                    required
                    defaultValue={profile.industry}
                  />
                </div>
                <div className="field">
                  <label htmlFor="profile-stage">Stage</label>
                  <select
                    id="profile-stage"
                    name="stage"
                    required
                    defaultValue={profile.stage}
                  >
                    <option value="" disabled>
                      Choose a stage
                    </option>
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
                    required
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
                    required
                    defaultValue={profile.expertise}
                  />
                </div>
                <div className="field">
                  <label htmlFor="profile-availability">Availability</label>
                  <input
                    id="profile-availability"
                    name="availability"
                    required
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
                    required
                    defaultValue={profile.startups}
                  />
                </div>
              </div>
            )}

            <details className="optional-profile">
              <summary>Optional collaboration preferences and tags</summary>
              <ProfileOptions profile={profile} />
            </details>
            {!founder && (
              <div className="field full-width">
                <label htmlFor="profile-experience">Past experience</label>
                <textarea
                  id="profile-experience"
                  name="pastExperience"
                  maxLength={2000}
                  defaultValue={profile.pastExperience || ""}
                  placeholder="Previous roles, startups advised, projects and lessons you can share."
                />
                <p className="muted">
                  Optional. This appears on your mentor profile.
                </p>
              </div>
            )}
            <div className="profile-edit-actions">
              <button
                className="btn primary"
                type="submit"
                disabled={state.busy}
              >
                {state.busy && <span className="spinner" aria-hidden="true" />}
                {state.busy ? "Saving profile…" : "Save profile"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  draft.clear();
                  onAction({ action: "cancel-profile-edit" });
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-summary">
            <p className={profile.bio ? "" : "muted"}>
              {profile.bio ||
                "Your profile is a blank slate. Add a short introduction to get started."}
            </p>
            {profile.offer && (
              <div>
                <h3>What I offer</h3>
                <p>{profile.offer}</p>
              </div>
            )}
            {profile.need && (
              <div>
                <h3>What I need</h3>
                <p>{profile.need}</p>
              </div>
            )}
            {profile.goals && (
              <p>
                <strong>Goals:</strong> {profile.goals}
              </p>
            )}
            {!founder && profile.pastExperience && (
              <div>
                <h3>Past experience</h3>
                <p className="preserve-lines">{profile.pastExperience}</p>
              </div>
            )}
            {(profile.engagementPreference || profile.audienceSize) && (
              <p className="muted">
                {profile.engagementPreference ||
                  "Engagement preference not specified"}
                {profile.audienceSize && ` · Audience: ${profile.audienceSize}`}
              </p>
            )}
            {founder && profile.industry && (
              <p className="muted">
                {[
                  profile.industry,
                  profile.stage,
                  profile.teamSize && `Team of ${profile.teamSize}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {!founder && profile.expertise && (
              <p className="muted">
                {[profile.expertise, profile.availability, profile.startups]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <button
              className="btn primary"
              onClick={() => onAction({ action: "edit-profile" })}
            >
              {completeness ? "Edit profile" : "Set up your profile"}
            </button>
          </div>
        )}
      </section>
      <button
        className="btn section-gap"
        onClick={() => onAction({ page: "settings" })}
      >
        Account settings and privacy
      </button>
      <ProfileStats />
      <CommunityRequests />
      <button
        className="btn section-gap"
        onClick={() => onAction({ page: "notifications" })}
      >
        Updates and notification preferences
      </button>
      <details className="card panel profile-history">
        <summary>Collaboration history ({history.length})</summary>
        {history.length ? (
          history.map((item, index) => (
            <p key={index}>
              {item.type} with {item.partner} · {item.date} · {item.rating}/5
              {item.note && (
                <span className="review-feedback">{item.note}</span>
              )}
            </p>
          ))
        ) : (
          <p className="muted">No completed collaborations or reviews yet.</p>
        )}
      </details>
      <p className="local-workspace-note">
        Your profile and collaborations are saved on this workspace server.
      </p>
    </div>
  );
}
