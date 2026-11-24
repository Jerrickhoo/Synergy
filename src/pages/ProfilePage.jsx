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
  industryOptions,
  longDate,
  scoreLabel,
} from "../data/profile-presentation.js";
import CollaborationRecord from "../components/CollaborationRecord.jsx";
import { availabilityLine, formatList } from "../data/mentor-rules.js";
import { mentorFormat } from "../data/mentor-formats.js";
import { TagPicker } from "../components/ProfileOptions.jsx";
import Verification from "../components/Verification.jsx";
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
  // Needs come before offers, as the founder's cards do.
  ["need", "What I need", "profile-need"],
  ["offer", "What I offer", "profile-offer"],
];
function focusField(id) {
  const container = document.getElementById(id);
  // A tag list has no input of its own; its first tag takes focus.
  const field = container?.matches("input, select, textarea, button")
    ? container
    : container?.querySelector("button, input, select, textarea");
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
// Expertise and standard topics often repeat each other; list each once.
function uniqueTags(...values) {
  const seen = new Set();
  return values
    .flatMap((value) => profileTags(value))
    .filter((tag) => {
      const key = tag.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}
function TagValue({ value, empty }) {
  const values = profileTags(value);
  return values.length ? (
    <Tags values={values} color="green" />
  ) : (
    <p className="muted">{empty || "Not added yet."}</p>
  );
}
// One finished collaboration: when it ran, the partner's score and, in
// quotation marks, the review the partner wrote about you.
function HistoryRow({ item }) {
  const started = longDate(item.started);
  const ended = longDate(item.date);
  const when =
    started && ended
      ? `${started} – ${ended}`
      : ended
        ? `Ended ${ended}`
        : "Dates unavailable";
  const rated = Number.isFinite(item.rating);
  return (
    <article className="profile-history-row">
      <div className="profile-history-head">
        <h3>
          {item.type} with {item.partner}
        </h3>
        {rated ? (
          <span className="profile-history-score">
            Rated {scoreLabel(item.rating)}
            <span className="visually-hidden"> out of 5</span>
          </span>
        ) : (
          item.status && (
            <span className="profile-history-status">{item.status}</span>
          )
        )}
      </div>
      <p className="profile-history-dates">{when}</p>
      {item.note?.trim() && (
        <blockquote className="profile-history-quote">
          <p className="preserve-lines">“{item.note.trim()}”</p>
        </blockquote>
      )}
    </article>
  );
}
function ProfileContent() {
  const { state, model, onAction, onSubmit } = useApp();
  const [photoReading, setPhotoReading] = useState(false);
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
  const startupName = founder ? savedProfile.startupName?.trim() : "";
  // Card 1: the startup's name with the founder under it. Without a startup
  // name, or for a mentor, the person's name leads with their role.
  const identityTitle = startupName || model.roleName();
  const identityLine = startupName
    ? [model.roleName()]
    : [model.roleLabel(), !founder && savedProfile.expertise?.trim()].filter(
        Boolean,
      );
  // Card 1: "SaaS | Seed stage | Team of 6", only the parts that are added.
  const teamSize = String(savedProfile.teamSize || "").trim();
  const startupFacts = [
    savedProfile.industry?.trim(),
    savedProfile.stage && `${stageLabel(savedProfile.stage)} stage`,
    teamSize && `Team of ${teamSize}`,
  ].filter(Boolean);
  // Edit profile names the needs and offers cards after the startup.
  const draftStartup = founder
    ? String(draft.values.startupName || "").trim()
    : "";
  const needsTitle = draftStartup
    ? `What ${draftStartup} needs`
    : "What your startup needs";
  const offersTitle = draftStartup
    ? `What ${draftStartup} can offer`
    : "What your startup can offer";
  // A founder picks needs and offers as tags; saving copies the picked tags
  // into the need and offer text matching reads. With no tags picked, the
  // saved wording is sent unchanged, so an older profile still saves.
  const pickedTags = founder
    ? Object.fromEntries(
        [
          ["need", draft.values.needTags, draft.values.need],
          ["offer", draft.values.offerTags, draft.values.offer],
        ].map(([key, tags, saved]) => [
          key,
          String(tags || "").trim() ? tags : saved || "",
        ]),
      )
    : {};
  const checkedValues = { ...draft.values, ...pickedTags };
  // The checklist uses the same validator as Save, so an invalid value such
  // as a negative team size is never ticked.
  const draftErrors = validateProfile(checkedValues, state.role);
  const founderChecklist = {
    bio: ["Description", "profile-bio"],
    need: [needsTitle, "profile-needTags-choices"],
    offer: [offersTitle, "profile-offerTags-choices"],
  };
  // Your name is required by Save for every role, alongside the role's keys.
  const checklist = requiredFields
    .filter(([key]) => key === "name" || profileKeys(state.role).includes(key))
    .map(([key, label, target]) => {
      if (founder && founderChecklist[key])
        [label, target] = founderChecklist[key];
      const filled = Boolean(String(checkedValues[key] || "").trim());
      return {
        key,
        label,
        target,
        done: filled && !draftErrors[key],
        error: filled ? draftErrors[key] : "",
      };
    });
  // Founders add a startup logo and their own photo; mentors add one photo.
  const photoSlots = founder
    ? [
        {
          key: "image",
          image: draft.values.image,
          title: "Startup logo",
          detail: draftStartup,
          avatarName: draftStartup || draft.values.name || state.accountName,
          noun: "startup logo",
          chooseLabel: "Choose startup logo",
        },
        {
          key: "personImage",
          image: draft.values.personImage,
          title: "Your photo",
          detail: draft.values.name || state.accountName,
          avatarName: draft.values.name || state.accountName,
          noun: "your photo",
          chooseLabel: "Choose your photo",
        },
      ]
    : [
        {
          key: "image",
          image: draft.values.image,
          title: draft.values.name || state.accountName,
          detail: model.roleLabel(),
          avatarName: draft.values.name || state.accountName,
          noun: "profile photo",
          chooseLabel: "Choose profile photo",
        },
      ];
  // A saved industry outside the standard list stays selectable.
  const industryChoices = [
    ...new Set(
      [...industryOptions, String(profile.industry || "").trim()].filter(
        Boolean,
      ),
    ),
  ];
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
        actions={
          !state.profileEditing && (
            // "See your matches" leads while the live banner shows.
            <button
              className={
                state.profileWentLive && completeness ? "btn" : "btn primary"
              }
              onClick={() => onAction({ action: "edit-profile" })}
            >
              {completeness ? "Edit profile" : "Set up your profile"}
            </button>
          )
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
            {/* The startup logo (a mentor's photo), sized in CSS to match
                the text beside it. */}
            <Avatar
              image={profile.image}
              name={identityTitle}
              identity={state.accountId}
            />
            <div className="own-identity-copy">
              {/* Startup name leads; the founder, with their own photo, sits
                  under it in a smaller grey line. */}
              <h2>{identityTitle}</h2>
              <p className="own-identity-subtitle">
                {startupName && (
                  <Avatar
                    image={profile.personImage}
                    name={model.roleName()}
                    identity={state.accountId}
                    color="own-identity-person"
                  />
                )}
                {identityLine.map((part, index) => (
                  <span key={part}>
                    {index > 0 && (
                      <>
                        <span
                          className="own-identity-separator"
                          aria-hidden="true"
                        >
                          |
                        </span>
                        <span className="visually-hidden">, </span>
                      </>
                    )}
                    {part}
                  </span>
                ))}
              </p>
              {founder ? (
                startupFacts.length > 0 ? (
                  <p className="identity-facts">
                    {startupFacts.map((fact, index) => (
                      <span key={fact}>
                        {index > 0 && (
                          <>
                            <span
                              className="own-identity-separator"
                              aria-hidden="true"
                            >
                              |
                            </span>
                            <span className="visually-hidden">, </span>
                          </>
                        )}
                        {fact}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="own-identity-prompt">
                    Your startup story starts here
                  </p>
                )
              ) : (
                !savedProfile.expertise && (
                  <p className="own-identity-prompt">
                    Add the expertise you can share
                  </p>
                )
              )}
            </div>
          </div>
          {missing.length > 0 &&
            (founder ||
              (!state.mentorListing?.listed && !state.mentorApplication)) && (
              <div className="profile-completion-note">
                <strong>Complete your profile to appear in Matches</strong>
                <p>
                  Still to add:{" "}
                  {missing.map((key) => profileFieldNames[key]).join(", ")}.
                </p>
              </div>
            )}
          {/* A listed mentor is already in Matches; missing details only
              make the profile more useful, so the note never claims otherwise. */}
          {missing.length > 0 && !founder && state.mentorListing?.listed && (
            <div className="profile-completion-note">
              <strong>Founders can find you in Matches</strong>
              <p>
                Add {missing.map((key) => profileFieldNames[key]).join(", ")} so
                founders know more about you.
              </p>
            </div>
          )}
        </section>
      )}
      {state.profileEditing ? (
        <form
          id="profile-form"
          aria-busy={state.busy}
          key={state.role}
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
              ...pickedTags,
              image: withoutSampleImage(
                draft.values.name ?? state.accountName,
                draft.values.image || "",
              ),
              ...(founder && { personImage: draft.values.personImage || "" }),
            });
            if (success) {
              draft.clear();
              returnToTop();
            }
          }}
        >
          <div className="profile-edit-main">
            <FormErrors scope="profile-form" />
            <ProfilePhoto
              legend={founder ? "Photos" : "Profile photo"}
              slots={photoSlots}
              identity={state.accountId}
              disabled={state.busy}
              onReadingChange={setPhotoReading}
              onChange={updateField}
            />
            {founder ? (
              <>
                <EditSection
                  title="Your details"
                  intro="Matches and Deal Rooms show your startup’s name, with you as its founder."
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
                  <ProfileField
                    id="startup-name"
                    label="Startup name"
                    name="startupName"
                    value={profile.startupName}
                    optional
                    autoComplete="organization"
                  />
                </EditSection>
                <EditSection
                  title="About your startup"
                  intro="Helps mentors and founders see what you’re building and where it is today."
                  disabled={state.busy}
                >
                  <ProfileField
                    id="bio"
                    label="Description"
                    name="bio"
                    value={profile.bio}
                    multiline
                    required
                    maxLength={2000}
                    placeholder="What are you building, and who does it help?"
                    hint="Introduce your startup, who it serves and what you’re working on."
                  />
                  <div className="form-grid profile-details-grid">
                    <div className="field">
                      <label htmlFor="profile-industry">Industry</label>
                      <SelectField
                        id="profile-industry"
                        name="industry"
                        required
                        defaultValue={profile.industry || ""}
                      >
                        <option value="" disabled>
                          Choose an industry
                        </option>
                        {industryChoices.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </SelectField>
                    </div>
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
                </EditSection>
                {/* Needs and offers are picked from the standard tags, side
                    by side like the cards on Your profile. */}
                <div className="profile-edit-pair">
                  <EditSection
                    title={needsTitle}
                    intro="Partners who offer this help find you in Matches."
                    disabled={state.busy}
                  >
                    <TagPicker
                      name="needTags"
                      label={needsTitle}
                      inNamedGroup
                      value={profile.needTags}
                      vocabulary={state.vocabulary || []}
                      onChange={updateField}
                    />
                  </EditSection>
                  <EditSection
                    title={offersTitle}
                    intro="What you can give a partner in return."
                    disabled={state.busy}
                  >
                    <TagPicker
                      name="offerTags"
                      label={offersTitle}
                      inNamedGroup
                      value={profile.offerTags}
                      vocabulary={state.vocabulary || []}
                      onChange={updateField}
                    />
                  </EditSection>
                </div>
              </>
            ) : (
              <>
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
                  <ProfileField
                    id="bio"
                    label="About me"
                    name="bio"
                    value={profile.bio}
                    multiline
                    required
                    maxLength={2000}
                    placeholder="What experience and perspective can you share with founders?"
                    hint="Introduce your background and the kinds of challenges you help founders solve."
                  />
                </EditSection>
                <EditSection
                  title="Mentorship focus"
                  intro="Helps founders see where and how often you can help."
                  disabled={state.busy}
                >
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
                </EditSection>
                <EditSection
                  title="Support you can offer"
                  intro="Used to suggest matches. Separate what you need with commas; each item appears as a tag."
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
                      hint="The practical guidance you can provide during a mentorship."
                    />
                    <ProfileField
                      id="need"
                      label="What I need from founders"
                      name="need"
                      value={profile.need}
                      multiline
                      optional
                      maxLength={2000}
                      tags
                      hint="What you need from founders, such as a project brief or focused questions."
                    />
                  </div>
                  <TagPicker
                    name="topics"
                    label="Standard tags for your expertise"
                    help="Founders find you by these tags. Pick the ones you can help with."
                    value={profile.topics}
                    vocabulary={state.vocabulary || []}
                    onChange={updateField}
                  />
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
                    help="Pick the closest tags."
                    value={profile.needTags}
                    vocabulary={state.vocabulary || []}
                    onChange={updateField}
                  />
                </EditSection>
              </>
            )}
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
          <div className="profile-view">
            <ProfileSection
              title={
                founder
                  ? startupName
                    ? `About ${startupName}`
                    : "About your startup"
                  : "About you"
              }
            >
              <TextValue
                value={profile.bio}
                empty="Your profile is a blank slate. Add a short introduction to get started."
              />
            </ProfileSection>
            {/* Needs and offers sit side by side, 50:50. */}
            <div className="profile-pair">
              {founder ? (
                <>
                  <ProfileSection
                    title={
                      startupName
                        ? `What ${startupName} needs`
                        : "What you need"
                    }
                  >
                    <TagValue value={profile.need} />
                  </ProfileSection>
                  <ProfileSection
                    title={
                      startupName
                        ? `What ${startupName} can offer`
                        : "What you can offer"
                    }
                  >
                    <TagValue value={profile.offer} />
                  </ProfileSection>
                </>
              ) : (
                <>
                  <ProfileSection title="Expertise and support">
                    <TagValue
                      value={uniqueTags(profile.expertise, profile.topics)}
                      empty="Add your areas of expertise to help founders find you."
                    />
                    <div className="profile-section-block">
                      <h3>What I offer</h3>
                      <TextValue value={profile.offer} />
                    </div>
                  </ProfileSection>
                  <ProfileSection title="A useful mentorship">
                    <h3>What I need from founders</h3>
                    <TagValue value={profile.need} />
                  </ProfileSection>
                </>
              )}
            </div>
            {!founder && (
              <div className="profile-pair">
                <ProfileSection title="Past experience">
                  <TextValue
                    value={profile.pastExperience}
                    empty="Share previous roles, projects or lessons you can bring to a mentorship."
                  />
                </ProfileSection>
                <ProfileSection title="Availability and startup interests">
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
                  {/* (Nov 22, round 2) Mentor wording: the formats offered
                      and the Office Hours founders can book, not the
                      exchange "agree times with your collaborator". */}
                  {state.mentorOfficeOpenings?.length > 0 && (
                    <p className="muted">
                      Founders can book{" "}
                      {state.mentorOfficeOpenings.length === 1
                        ? "your 1 open Office Hours time"
                        : `your ${state.mentorOfficeOpenings.length} open Office Hours times`}{" "}
                      directly.
                    </p>
                  )}
                  {profile.formats?.length > 0 && (
                    <p className="profile-preference">
                      Offers{" "}
                      {formatList(
                        profile.formats.map(
                          ({ id }) => mentorFormat(id)?.label || id,
                        ),
                      )}
                    </p>
                  )}
                </ProfileSection>
              </div>
            )}
            {/* The record is the smaller column; history gets more room. */}
            <div className="profile-record-row">
              <CollaborationRecord />
              <section
                className="card panel profile-section profile-history"
                aria-label="Collaboration history"
              >
                <h2 id="profile-history-heading">Collaboration history</h2>
                {history.length ? (
                  // Matches the record card's height; longer history scrolls
                  // here, and the list takes keyboard focus so it can scroll.
                  <div
                    className="profile-history-list"
                    role="group"
                    aria-labelledby="profile-history-heading"
                    tabIndex={0}
                  >
                    {history.map((item) => (
                      <HistoryRow key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="profile-history-empty">
                    <Icon name="handshake" />
                    <div>
                      <h3>Your collaboration story starts here</h3>
                      <p>
                        Completed collaborations and shared reviews will appear
                        here as you work with others.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>
            <Verification />
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
          </div>
        </>
      )}
    </div>
  );
}
