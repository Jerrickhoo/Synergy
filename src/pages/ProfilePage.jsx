import { useDraft } from "../state/useDraft.js";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Avatar from "../components/Avatar.jsx";
import Tags from "../components/Tags.jsx";
import FormErrors from "../components/FormErrors.jsx";
import {
  profileCompleteness,
  profileKeys,
  profileFieldNames,
} from "../data/selectors.js";
import {
  profileTags,
  stageLabel,
  preferenceLabel,
} from "../data/profile-presentation.js";
import ProfileStats from "../components/ProfileStats.jsx";
import ProfileOptions from "../components/ProfileOptions.jsx";
import CommunityRequests from "../components/CommunityRequests.jsx";
import Icon from "../components/Icon.jsx";

export default function ProfilePage() {
  const { state } = useApp();
  return <ProfileContent key={`${state.accountId}:${state.role}`} />;
}
function ProfileField({ id, label, value, multiline = false, hint, ...props }) {
  const Input = multiline ? "textarea" : "input";
  return (
    <div className="field">
      <label htmlFor={`profile-${id}`}>{label}</label>
      <Input
        id={`profile-${id}`}
        defaultValue={value || ""}
        aria-describedby={hint ? `profile-${id}-help` : undefined}
        {...props}
      />
      {hint && (
        <p className="field-help" id={`profile-${id}-help`}>
          {hint}
        </p>
      )}
    </div>
  );
}
function ProfileSection({ title, children, className = "" }) {
  return (
    <section className={`card panel profile-section ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function TextValue({ value, empty = "Not added yet." }) {
  return (
    <p className={`preserve-lines ${value ? "" : "muted"}`}>{value || empty}</p>
  );
}
function TagValue({ value, empty }) {
  const values = profileTags(value);
  return values.length ? (
    <Tags values={values} color="green" />
  ) : (
    <p className="muted">{empty || "Not added yet."}</p>
  );
}
function ProfileContent() {
  const { state, model, onAction, onSubmit } = useApp();
  const founder = state.role === "founder";
  const savedProfile = state.profiles[state.role];
  const draft = useDraft(`${state.accountId}:profile:${state.role}`, {
    ...savedProfile,
    name: state.accountName,
  });
  const profile = state.profileEditing ? draft.values : savedProfile;
  const completeness = profileCompleteness(savedProfile, state.role);
  const history = state.trustHistoryByRole[state.role];
  const missing = profileKeys(state.role).filter(
    (key) => !String(savedProfile[key] || "").trim(),
  );
  return (
    <div className="page simple-profile profile-page page-enter">
      <PageHeader
        title="Your profile"
        intro={
          state.profileEditing
            ? "Edit your public profile. Save when you’re ready to share your changes."
            : founder
              ? "Show what you’re building and the help that would move it forward."
              : "Share your expertise, experience and the startups you want to support."
        }
      />
      <section className="card identity-panel own-identity-panel">
        <div className="identity-heading">
          <Avatar
            image={savedProfile.image}
            name={model.roleName()}
            initials={model.roleInitials()}
            size={64}
          />
          <div className="own-identity-copy">
            <span className="section-eyebrow">{model.roleLabel()}</span>
            <h2>{model.roleName()}</h2>
            <p>
              {founder
                ? [
                    savedProfile.industry,
                    stageLabel(savedProfile.stage),
                    savedProfile.teamSize && `Team of ${savedProfile.teamSize}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Your startup story starts here"
                : savedProfile.expertise || "Add the expertise you can share"}
            </p>
          </div>
          {!state.profileEditing && (
            <button
              className="btn primary"
              onClick={() => onAction({ action: "edit-profile" })}
            >
              {completeness ? "Edit profile" : "Set up your profile"}
            </button>
          )}
        </div>
        <div className="profile-identity-footer">
          <div className="profile-completion">
            <span>{completeness}% complete</span>
            <span className="profile-completion-track" aria-hidden="true">
              <i style={{ width: `${completeness}%` }} />
            </span>
          </div>
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
        </div>
        {missing.length > 0 && (
          <div className="profile-completion-note">
            <strong>Complete your profile to appear in Matches</strong>
            <p>
              Still to add:{" "}
              {missing.map((key) => profileFieldNames[key]).join(", ")}.
            </p>
          </div>
        )}
      </section>
      {state.profileEditing ? (
        <form
          id="profile-form"
          key={state.role}
          className="profile-edit-form"
          onChange={(event) =>
            draft.update(Object.fromEntries(new FormData(event.currentTarget)))
          }
          onSubmit={async (event) => {
            const success = await onSubmit(event);
            if (success) draft.clear();
          }}
        >
          <div className="profile-edit-intro">
            <h2>{founder ? "Your startup profile" : "Your mentor profile"}</h2>
            <p>
              Complete the required fields to appear in Matches. Fields marked
              optional can wait.
            </p>
            {draft.dirty && (
              <p className="draft-note" role="status">
                Your draft is saved in this tab. Save your profile to publish
                changes.
              </p>
            )}
            <FormErrors scope="profile-form" />
          </div>
          <fieldset className="card panel profile-fieldset">
            <legend>About you</legend>
            <ProfileField
              id="name"
              label="Your name"
              name="name"
              value={profile.name || state.accountName}
              autoComplete="name"
              required
            />
            <ProfileField
              id="bio"
              label="About me"
              name="bio"
              value={profile.bio}
              multiline
              required
              maxLength={2000}
              placeholder={
                founder
                  ? "What are you building, and who does it help?"
                  : "What experience and perspective can you share with founders?"
              }
              hint={
                founder
                  ? "Introduce your startup, who it serves and what you’re working on."
                  : "Introduce your background and the kinds of challenges you help founders solve."
              }
            />
          </fieldset>
          <fieldset className="card panel profile-fieldset">
            <legend>{founder ? "Startup context" : "Mentorship focus"}</legend>
            <div className="form-grid">
              {founder ? (
                <>
                  <ProfileField
                    id="industry"
                    label="Industry"
                    name="industry"
                    required
                    value={profile.industry}
                  />
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
                      {["idea", "pre-seed", "seed", "growth"].map((value) => (
                        <option key={value} value={value}>
                          {stageLabel(value)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ProfileField
                    id="size"
                    label="Team size"
                    name="teamSize"
                    required
                    type="number"
                    min="1"
                    value={profile.teamSize}
                  />
                </>
              ) : (
                <>
                  <ProfileField
                    id="expertise"
                    label="Expertise areas"
                    name="expertise"
                    required
                    value={profile.expertise}
                    hint="For example: product strategy, fundraising or technical development."
                  />
                  <ProfileField
                    id="availability"
                    label="Availability"
                    name="availability"
                    required
                    value={profile.availability}
                    hint="Describe a cadence you can offer. Agree on exact times together."
                  />
                  <ProfileField
                    id="startups"
                    label="Startups I want to help"
                    name="startups"
                    required
                    value={profile.startups}
                    hint="Include relevant industries and startup stages."
                  />
                </>
              )}
            </div>
          </fieldset>
          <fieldset className="card panel profile-fieldset">
            <legend>
              {founder ? "Offers and requested help" : "Support you can offer"}
            </legend>
            <div className="form-grid">
              <ProfileField
                id="offer"
                label="What I offer"
                name="offer"
                value={profile.offer}
                multiline
                required
                maxLength={2000}
                hint={
                  founder
                    ? "Skills, feedback or resources you can exchange."
                    : "The practical guidance you can provide during a mentorship."
                }
              />
              <ProfileField
                id="need"
                label="What I need"
                name="need"
                value={profile.need}
                multiline
                required
                maxLength={2000}
                hint={
                  founder
                    ? "Be specific about the help your startup needs now."
                    : "What you need from founders, such as a project brief or focused questions."
                }
              />
            </div>
          </fieldset>
          {!founder && (
            <fieldset className="card panel profile-fieldset">
              <legend>Relevant experience</legend>
              <ProfileField
                id="experience"
                label="Past experience"
                name="pastExperience"
                value={profile.pastExperience}
                multiline
                maxLength={2000}
                placeholder="Previous roles, startups advised, projects and lessons you can share."
                hint="Optional. This appears on your mentor profile."
              />
            </fieldset>
          )}
          <details className="card panel optional-profile">
            <summary>Optional collaboration preferences and tags</summary>
            <p className="muted">
              Add goals and preferences to help others understand a potential
              collaboration.
            </p>
            <ProfileOptions profile={profile} founder={founder} />
          </details>
          <div className="profile-edit-actions">
            <button className="btn primary" type="submit" disabled={state.busy}>
              {state.busy && <span className="spinner" aria-hidden="true" />}
              {state.busy ? "Saving profile…" : "Save profile"}
            </button>
            <button
              className="btn"
              type="button"
              disabled={state.busy}
              onClick={() => {
                draft.clear();
                onAction({ action: "cancel-profile-edit" });
              }}
            >
              Cancel
            </button>
            <span className="muted">
              Changes appear on your profile after saving.
            </span>
          </div>
        </form>
      ) : (
        <>
          <div className="profile-view-grid">
            <div className="profile-main-column">
              {!founder && (
                <ProfileSection title="Expertise and support">
                  <TagValue
                    value={profile.expertise}
                    empty="Add your areas of expertise to help founders find you."
                  />
                  <div className="profile-section-block">
                    <h3>What I offer</h3>
                    <TextValue value={profile.offer} />
                  </div>
                </ProfileSection>
              )}
              <ProfileSection
                title={founder ? "About your startup" : "About you"}
              >
                <TextValue
                  value={profile.bio}
                  empty="Your profile is a blank slate. Add a short introduction to get started."
                />
              </ProfileSection>
              {!founder && (
                <ProfileSection title="Past experience">
                  <TextValue
                    value={profile.pastExperience}
                    empty="Share previous roles, projects or lessons you can bring to a mentorship."
                  />
                </ProfileSection>
              )}
              <ProfileSection
                title={
                  founder
                    ? "Current goals and requested help"
                    : "A useful mentorship"
                }
              >
                <h3>{founder ? "What I need" : "What I need from founders"}</h3>
                <TagValue value={profile.need} />
                <div className="profile-section-block">
                  <h3>Collaboration goals</h3>
                  <TextValue
                    value={profile.goals}
                    empty="Add a focused goal for your next collaboration."
                  />
                </div>
              </ProfileSection>
              {founder && (
                <ProfileSection title="What you can offer">
                  <TagValue value={profile.offer} />
                  <p className="muted">
                    Skills, feedback and resources you can share with a
                    collaborator.
                  </p>
                </ProfileSection>
              )}
            </div>
            <aside className="profile-side-column">
              <ProfileSection
                title={
                  founder
                    ? "Startup at a glance"
                    : "Availability and startup interests"
                }
              >
                {founder ? (
                  <dl className="profile-facts">
                    <div>
                      <dt>Industry</dt>
                      <dd>{profile.industry || "Not added yet"}</dd>
                    </div>
                    <div>
                      <dt>Stage</dt>
                      <dd>{stageLabel(profile.stage) || "Not added yet"}</dd>
                    </div>
                    <div>
                      <dt>Team size</dt>
                      <dd>{profile.teamSize || "Not added yet"}</dd>
                    </div>
                    {profile.audienceSize && (
                      <div>
                        <dt>Audience</dt>
                        <dd>{profile.audienceSize}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <>
                    <h3>Availability</h3>
                    <TextValue value={profile.availability} />
                    <div className="profile-section-block">
                      <h3>Startups I want to help</h3>
                      <TextValue value={profile.startups} />
                    </div>
                    <p className="muted">
                      Agree on exact session times with your collaborator.
                    </p>
                  </>
                )}
                <p className="profile-preference">
                  {preferenceLabel(profile.engagementPreference)}
                </p>
              </ProfileSection>
              <ProfileSection title="Collaboration record">
                <ProfileStats />
              </ProfileSection>
              <section className="card panel profile-section">
                <h2>Account and community</h2>
                <button
                  className="link-btn"
                  onClick={() => onAction({ page: "settings" })}
                >
                  Account settings and privacy <Icon name="arrow" />
                </button>
                <button
                  className="link-btn"
                  onClick={() => onAction({ page: "notifications" })}
                >
                  Updates <Icon name="arrow" />
                </button>
              </section>
            </aside>
          </div>
          <section
            className="card panel profile-section profile-history"
            aria-label="Collaboration history"
          >
            <h2>
              Collaboration history{" "}
              <span className="tag">{history.length}</span>
            </h2>
            {history.length ? (
              history.map((item) => (
                <article className="profile-history-row" key={item.id}>
                  <h3>
                    {item.type} with {item.partner}
                  </h3>
                  <p>
                    {item.date || "Date unavailable"} · {item.rating}/5
                  </p>
                  {item.note && <p className="preserve-lines">{item.note}</p>}
                </article>
              ))
            ) : (
              <div className="profile-history-empty">
                <Icon name="handshake" />
                <div>
                  <h3>Your collaboration story starts here</h3>
                  <p>
                    Completed collaborations and shared reviews will appear here
                    as you work with others.
                  </p>
                </div>
              </div>
            )}
          </section>
          <CommunityRequests />
        </>
      )}
      <p className="local-workspace-note">
        Your profile and collaborations are saved on this workspace server.
      </p>
    </div>
  );
}
