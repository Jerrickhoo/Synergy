import SelectField from "../components/SelectField.jsx";
import { useId, useState } from "react";
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
import MentorImpact, {
  FounderTrackRecord,
} from "../components/MentorImpact.jsx";
import ProfileStats from "../components/ProfileStats.jsx";
import { availabilityLine } from "../data/mentor-rules.js";
import ProfileOptions, { TagPicker } from "../components/ProfileOptions.jsx";
import ProfileAssistant from "../components/ProfileAssistant.jsx";
import Verification from "../components/Verification.jsx";
import CommunityRequests from "../components/CommunityRequests.jsx";
import Icon from "../components/Icon.jsx";
import ProfilePhoto from "../components/ProfilePhoto.jsx";
import { normalizeProfile } from "../data/profile-content.js";
import { validateProfile } from "../state/validation.js";
import { withoutSampleImage } from "../data/profile-assistant.js";

// After a successful save, return to the top of the profile so the result is
// visible. Reduced-motion users jump instead of scrolling.
function returnToTop() {
  requestAnimationFrame(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "instant" : "smooth" });
    document.querySelector("#content h1")?.focus({ preventScroll: true });
  });
}

export default function ProfilePage() {
  const { state } = useApp();
  return <ProfileContent key={`${state.accountId}:${state.role}`} />;
}
function ProfileField({
  id,
  label,
  value,
  multiline = false,
  hint,
  optional = false,
  tags = false,
  ...props
}) {
  const Input = multiline ? "textarea" : "input";
  const describedBy =
    [optional && `profile-${id}-optional`, hint && `profile-${id}-help`]
      .filter(Boolean)
      .join(" ") || undefined;
  const entries = tags ? profileTags(value) : [];
  const labelElement = <label htmlFor={`profile-${id}`}>{label}</label>;
  return (
    <div className="field">
      {optional ? (
        <div className="profile-label-row">
          {labelElement}
          <span className="field-optional" id={`profile-${id}-optional`}>
            Optional
          </span>
        </div>
      ) : (
        labelElement
      )}
      <Input
        id={`profile-${id}`}
        defaultValue={value || ""}
        aria-describedby={describedBy}
        {...props}
      />
      {entries.length > 0 && (
        <div className="profile-tag-preview" aria-hidden="true">
          <Tags values={entries} color="green" />
        </div>
      )}
      {(hint || props.maxLength) && (
        <div className="field-footer">
          {hint && (
            <p className="field-help" id={`profile-${id}-help`}>
              {hint}
            </p>
          )}
          {props.maxLength && (
            <span className="field-count" aria-hidden="true">
              {String(value || "").length} / {props.maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
function EditSection({ title, intro, disabled, children }) {
  const introId = useId();
  return (
    <fieldset
      className="card profile-fieldset"
      disabled={disabled}
      aria-describedby={intro ? introId : undefined}
    >
      <legend>{title}</legend>
      {intro && (
        <p className="profile-fieldset-intro" id={introId}>
          {intro}
        </p>
      )}
      {children}
    </fieldset>
  );
}
// Form order for the checklist; profileKeys decides which keys apply.
const requiredFields = [
  ["name", "Your name", "profile-name"],
  ["bio", "About me", "profile-bio"],
  ["industry", "Industry", "profile-industry"],
  ["stage", "Stage", "profile-stage"],
  ["teamSize", "Team size", "profile-size"],
  ["expertise", "Expertise areas", "profile-expertise"],
  ["startups", "Startups I want to help", "profile-startups"],
  ["offer", "What I offer", "profile-offer"],
  ["need", "What I need", "profile-need"],
];
function focusField(id) {
  const field = document.getElementById(id);
  if (!field) return;
  field.focus({ preventScroll: true });
  field.scrollIntoView({ block: "center" });
}
function ProfileChecklist({ items }) {
  const added = items.filter((item) => item.done).length;
  const ready = added === items.length;
  return (
    <section
      className={`card profile-checklist${ready ? " ready" : ""}`}
      aria-labelledby="profile-checklist-heading"
    >
      <h2 id="profile-checklist-heading">
        {ready ? "Ready for Matches" : "Finish your profile"}
      </h2>
      <p>
        {ready
          ? "Every required detail is filled in."
          : `${added} of ${items.length} required details added. Complete them to appear in Matches.`}
      </p>
      <div className="profile-checklist-bar" aria-hidden="true">
        <span style={{ width: `${(added / items.length) * 100}%` }} />
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            {item.done ? (
              <span className="profile-checklist-item" data-done="true">
                <span className="profile-checklist-mark" aria-hidden="true">
                  <Icon name="check" />
                </span>
                {item.label}
                <span className="visually-hidden">, added</span>
              </span>
            ) : (
              <button
                type="button"
                className="profile-checklist-item interactive-surface"
                onClick={() => focusField(item.target)}
              >
                <span className="profile-checklist-mark" aria-hidden="true" />
                <span className="profile-checklist-label">
                  {item.label}
                  {item.error && (
                    <small className="profile-checklist-error">
                      {item.error}
                    </small>
                  )}
                </span>
                <span className="visually-hidden">
                  {item.error ? ", needs a valid value" : ", still to add"}
                </span>
                <Icon name="arrow" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
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
  value = String(value || "").trim();
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
  const [photoReading, setPhotoReading] = useState(false);
  // Remounts the uncontrolled fields after the assistant fills the draft.
  const [formKey, setFormKey] = useState(0);
  // The assistant's text and result note survive that remount.
  const [assistantText, setAssistantText] = useState("");
  const [assistantNote, setAssistantNote] = useState("");
  const founder = state.role === "founder";
  const savedProfile = normalizeProfile(state.profiles[state.role]);
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
  // The checklist uses the same validator as Save, so an invalid value such
  // as a negative team size is never ticked.
  const draftErrors = validateProfile(draft.values, state.role);
  // Your name is required by Save for every role, alongside the role's keys.
  const checklist = requiredFields
    .filter(([key]) => key === "name" || profileKeys(state.role).includes(key))
    .map(([key, label, target]) => {
      const filled = Boolean(String(draft.values[key] || "").trim());
      return {
        key,
        label,
        target,
        done: filled && !draftErrors[key],
        error: filled ? draftErrors[key] : "",
      };
    });
  const optionalAdded = [
    "goals",
    "engagementPreference",
    founder && "audienceSize",
    "offerTags",
    "needTags",
  ].filter((key) => key && String(draft.values[key] || "").trim()).length;
  const updateField = (key, value) =>
    draft.update({ ...draft.values, [key]: value });
  return (
    <div className="page simple-profile profile-page page-enter">
      <PageHeader
        title={
          state.profileEditing
            ? completeness
              ? "Edit profile"
              : "Set up your profile"
            : "Your profile"
        }
        intro={
          state.profileEditing
            ? founder
              ? "Update what mentors and other founders see about you. Nothing changes until you save."
              : "Update what founders see about you. Nothing changes until you save."
            : founder
              ? "Show what you’re building and the help that would move it forward."
              : "Share your expertise, experience and the startups you want to support."
        }
      />
      {!state.profileEditing && state.profileWentLive && (
        <section className="card panel profile-live" role="status">
          <h2>Your profile is live</h2>
          <p>Partners can now find you. See who fits what you need.</p>
          <button
            className="btn primary"
            onClick={() => onAction({ page: "discover" })}
          >
            See your matches
          </button>
        </section>
      )}
      {!state.profileEditing && (
        <section className="card identity-panel own-identity-panel">
          <div className="identity-heading">
            <Avatar
              image={profile.image}
              name={model.roleName()}
              identity={state.accountId}
              size={64}
            />
            <div className="own-identity-copy">
              <span className="section-eyebrow">{model.roleLabel()}</span>
              <h2>
                {founder && savedProfile.startupName
                  ? savedProfile.startupName
                  : model.roleName()}
              </h2>
              {founder && savedProfile.startupName && (
                <p className="muted">Founder: {model.roleName()}</p>
              )}
              <p>
                {founder
                  ? [
                      savedProfile.industry,
                      stageLabel(savedProfile.stage),
                      savedProfile.teamSize &&
                        `Team of ${savedProfile.teamSize}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Your startup story starts here"
                  : savedProfile.expertise || "Add the expertise you can share"}
              </p>
            </div>
            <button
              className="btn primary"
              onClick={() => onAction({ action: "edit-profile" })}
            >
              {completeness ? "Edit profile" : "Set up your profile"}
            </button>
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
      )}
      {state.profileEditing ? (
        <form
          id="profile-form"
          aria-busy={state.busy}
          key={`${state.role}-${formKey}`}
          className="profile-edit-form"
          onChange={(event) => {
            if (event.target.type !== "file")
              draft.update({
                ...draft.values,
                ...Object.fromEntries(new FormData(event.currentTarget)),
              });
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.target.tagName === "INPUT")
              event.preventDefault();
          }}
          onSubmit={async (event) => {
            event.preventDefault();
            if (event.nativeEvent.submitter?.id !== "save-profile") return;
            const success = await onSubmit(event, {
              image: withoutSampleImage(
                draft.values.name ?? state.accountName,
                draft.values.image || "",
              ),
            });
            if (success) {
              draft.clear();
              setAssistantNote("");
              returnToTop();
            }
          }}
        >
          <div className="profile-edit-main">
            <FormErrors scope="profile-form" />
            {founder && (
              <ProfileAssistant
                values={draft.values}
                text={assistantText}
                onTextChange={setAssistantText}
                note={assistantNote}
                onApply={(applied, note) => {
                  draft.update({ ...draft.values, ...applied });
                  setAssistantNote(note);
                  setFormKey((key) => key + 1);
                }}
              />
            )}
            <ProfilePhoto
              identity={state.accountId}
              image={draft.values.image}
              name={draft.values.name || state.accountName}
              role={model.roleLabel()}
              disabled={state.busy}
              onReadingChange={setPhotoReading}
              onChange={(image) => updateField("image", image)}
            />
            <EditSection
              title="About you"
              intro="The first thing people read on your profile."
              disabled={state.busy}
            >
              <ProfileField
                id="name"
                label="Your name"
                name="name"
                value={profile.name || state.accountName}
                autoComplete="name"
                required
              />
              {founder && (
                <ProfileField
                  id="startup-name"
                  label="Startup name"
                  name="startupName"
                  value={profile.startupName}
                  optional
                  autoComplete="organization"
                  hint="Matches and Deal Rooms show your startup’s name, with you as its founder."
                />
              )}
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
            </EditSection>
            <EditSection
              title={founder ? "Startup details" : "Mentorship focus"}
              intro={
                founder
                  ? "Helps mentors and founders see where your startup is today."
                  : "Helps founders see where and how often you can help."
              }
              disabled={state.busy}
            >
              {founder ? (
                <div className="form-grid profile-details-grid">
                  <ProfileField
                    id="industry"
                    label="Industry"
                    name="industry"
                    required
                    value={profile.industry}
                  />
                  <div className="field">
                    <label htmlFor="profile-stage">Stage</label>
                    <SelectField
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
                    </SelectField>
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
                </div>
              ) : (
                <div className="form-grid profile-focus-grid">
                  <ProfileField
                    id="expertise"
                    label="Expertise areas"
                    name="expertise"
                    required
                    value={profile.expertise}
                    tags
                    hint="Separate areas with commas, for example: product strategy, fundraising."
                  />
                  <div className="field">
                    <strong>Availability</strong>
                    <p className="field-help">
                      {state.mentorUsage
                        ? availabilityLine(state.mentorUsage)
                        : "Set in Mentoring settings."}{" "}
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => onAction({ page: "settings" })}
                      >
                        Change in Settings
                      </button>
                    </p>
                  </div>
                  <ProfileField
                    id="startups"
                    label="Startups I want to help"
                    name="startups"
                    required
                    value={profile.startups}
                    hint="Include relevant industries and startup stages."
                  />
                </div>
              )}
            </EditSection>
            <EditSection
              title={
                founder ? "Offers and requested help" : "Support you can offer"
              }
              intro={
                founder
                  ? "Used to suggest matches. Separate items with commas; each one appears as a tag on your profile."
                  : "Used to suggest matches. Separate what you need with commas; each item appears as a tag."
              }
              disabled={state.busy}
            >
              <div className="form-grid">
                <ProfileField
                  id="offer"
                  label="What I offer"
                  name="offer"
                  value={profile.offer}
                  multiline
                  required
                  maxLength={2000}
                  tags={founder}
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
                  tags
                  hint={
                    founder
                      ? "Be specific about the help your startup needs now."
                      : "What you need from founders, such as a project brief or focused questions."
                  }
                />
              </div>
              {!founder && (
                <TagPicker
                  name="topics"
                  label="Standard tags for your expertise"
                  help="Founders find you by these tags. Pick the ones you can help with."
                  value={profile.topics}
                  vocabulary={state.vocabulary || []}
                  onChange={updateField}
                />
              )}
              <TagPicker
                name="offerTags"
                label="Standard tags for what you offer"
                help="Matching uses these tags as well as your wording, so the right partners find you."
                value={profile.offerTags}
                vocabulary={state.vocabulary || []}
                onChange={updateField}
              />
              <TagPicker
                name="needTags"
                label="Standard tags for what you need"
                help="Pick the closest tags. Propose a new one from your profile if none fit."
                value={profile.needTags}
                vocabulary={state.vocabulary || []}
                onChange={updateField}
              />
            </EditSection>
            {!founder && (
              <EditSection
                title="Relevant experience"
                intro="Roles, startups and projects that shape your advice."
                disabled={state.busy}
              >
                <ProfileField
                  id="experience"
                  label="Past experience"
                  name="pastExperience"
                  value={profile.pastExperience}
                  multiline
                  optional
                  maxLength={2000}
                  placeholder="Previous roles, startups advised, projects and lessons you can share."
                  hint="This appears on your mentor profile."
                />
              </EditSection>
            )}
            <details className="card optional-profile">
              <summary className="interactive-surface">
                <span className="optional-profile-heading">
                  <span className="optional-profile-title">
                    Collaboration preferences
                  </span>
                  <span className="optional-profile-meta">
                    Optional · Goals, engagement preference
                    {founder ? " and audience size" : ""}
                    {optionalAdded > 0 && ` · ${optionalAdded} added`}
                  </span>
                </span>
                <Icon name="chevron" />
              </summary>
              <div className="optional-profile-body">
                <ProfileOptions
                  profile={profile}
                  founder={founder}
                  onFieldChange={updateField}
                  showTags={false}
                />
              </div>
            </details>
          </div>
          <div className="profile-edit-aside">
            <ProfileChecklist items={checklist} />
            <div className="profile-edit-actions">
              <button
                id="save-profile"
                className="btn primary"
                type="submit"
                disabled={state.busy || photoReading}
              >
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
              <p className="profile-edit-status" role="status">
                {draft.dirty
                  ? "Unsaved changes are kept as a draft in this tab."
                  : ""}
              </p>
            </div>
          </div>
        </form>
      ) : (
        <>
          <div className="profile-view-grid">
            <div className="profile-main-column">
              {!founder && (
                <ProfileSection title="Expertise and support">
                  <TagValue
                    value={[profile.expertise, profile.topics]
                      .filter(Boolean)
                      .join(", ")}
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
                    <p>
                      {state.mentorUsage
                        ? availabilityLine(state.mentorUsage)
                        : "Not set yet."}
                    </p>
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
                {state.role === "mentor" ? (
                  <MentorImpact
                    trust={state.trustSummary?.mentorship}
                    privateView
                  />
                ) : (
                  state.trustSummary?.mentorship && (
                    <FounderTrackRecord
                      trackRecord={state.trustSummary.mentorship}
                      own
                    />
                  )
                )}
              </ProfileSection>
              <section className="card panel profile-section">
                <h2>Account and community</h2>
                <button
                  className="account-navigation-row interactive-surface"
                  onClick={() => onAction({ page: "settings" })}
                >
                  Account settings and privacy <Icon name="arrow" />
                </button>
                <button
                  className="account-navigation-row interactive-surface"
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
              Collaboration history
              {history.length > 0 && (
                <>
                  {" "}
                  <span className="tag">{history.length}</span>
                </>
              )}
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
          <Verification />
          <CommunityRequests />
        </>
      )}
    </div>
  );
}
