import MentorImpact, { MentorshipBadges } from "../components/MentorImpact.jsx";
import { FormatPrices } from "../components/Payments.jsx";
import { OfficeHoursBooking } from "../components/OfficeHours.jsx";
import MentorRequestForm, {
  MentorAlternatives,
} from "../components/MentorRequestForm.jsx";
import SelectField from "../components/SelectField.jsx";
import Overlay from "../components/Overlay.jsx";
import Confirmation from "../components/Confirmation.jsx";
import VerificationGate from "../components/VerificationGate.jsx";
import DeclineIntroduction from "../components/DeclineIntroduction.jsx";
import { useRef, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Tags from "../components/Tags.jsx";
import PageHeader from "../components/PageHeader.jsx";
import TrustSummary from "../components/TrustSummary.jsx";
import Icon from "../components/Icon.jsx";
import SimulateAcceptance from "../components/SimulateAcceptance.jsx";
import defaultTemplates from "../data/engagement-templates.json" with { type: "json" };
import {
  cooldownActive,
  cooldownText,
  ownUnavailableText,
  unavailableText,
} from "../data/mentor-rules.js";
import OtherRoleNotice from "../components/OtherRoleNotice.jsx";
import {
  fitFactors,
  fitSentence,
  needsYouCover,
  offeredToYou,
  overlapSentence,
  sameHelp,
  stageLabel,
} from "../data/profile-presentation.js";
import { formatDate } from "../data/dates.js";
import { missingProfileKeys, missingProfileText } from "../data/selectors.js";
import { personVerified } from "../data/collaboration.js";
import { noteQuality, qualityLabel } from "../data/request-assistant.js";
import { startupTypes, typeLabel } from "../data/collaboration-types.js";
import { profileEntries } from "../data/profile-content.js";

export default function MatchDetailPage() {
  const { state } = useApp();
  return (
    <MatchDetail
      key={`${state.role}:${state.activeMatch}:${state.mentorReferralId || ""}`}
    />
  );
}
function MatchDetail() {
  const { state, model, onAction, onTabKeyDown } = useApp();
  const [engagementType, setEngagementType] = useState("");
  const [detailTab, setDetailTab] = useState("breakdown");
  // Choosing Ask on a referral comes here to send the request, so its
  // dialog opens straight away.
  const [actionOpen, setActionOpen] = useState(Boolean(state.mentorReferralId));
  // A failed send shows inside the dialog (the page's toast sits behind it):
  // any error raised after the dialog opened.
  const openedToast = useRef(state.toastId);
  const openAction = () => {
    openedToast.current = state.toastId;
    setActionOpen(true);
  };
  const dialogError =
    actionOpen &&
    state.toastType === "error" &&
    state.toast &&
    state.toastId !== openedToast.current
      ? state.toast
      : "";
  const [note, setNote] = useState("");
  // Long introductions start as a few lines, so the actions stay in view.
  const [summaryOpen, setSummaryOpen] = useState(false);
  const person = model
    .rolePeople()
    .find((item) => item.id === state.activeMatch);
  const longSummary = String(person?.summary || "").length > 320;
  const mentorUnavailable =
    state.role === "founder" &&
    (person
      ? person.kind === "Mentor" && person.available === false
      : state.activeMatch?.endsWith(":mentor"));
  // A mentor who declined this founder can't be asked until the cooldown ends,
  // so the request form gives way to that date and other mentors (Nov 22,
  // round 3).
  const cooledDown =
    state.role === "founder" &&
    person?.kind === "Mentor" &&
    cooldownActive(person.cooldownUntil);
  const alternatives =
    mentorUnavailable || cooledDown
      ? model.people.mentors
          .filter(
            (item) =>
              item.id !== state.activeMatch &&
              item.available &&
              !cooldownActive(item.cooldownUntil),
          )
          .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
          .slice(0, state.mentorConfig?.alternativesCount ?? 3)
      : [];
  // Mentors only match startups, so a mentor link seen as a mentor belongs to
  // this account's founder profile.
  if (
    !person &&
    state.role === "mentor" &&
    String(state.activeMatch || "").endsWith(":mentor")
  )
    return <OtherRoleNotice role="founder" kind="match" />;
  if (!person)
    return (
      <div className="page page-enter">
        <PageHeader
          title="Match unavailable"
          intro="This profile may have changed its visibility or is no longer available. Explore Matches to find someone else."
        />
        <MentorAlternatives alternatives={alternatives} />
        <button className="btn" onClick={() => onAction({ page: "discover" })}>
          Back to matches
        </button>
      </div>
    );
  const existingRoom = model.existingRoomFor(state.role, person.id);
  const incoming = state.incomingByRole[state.role].has(person.id);
  const interested = model.interestedMatches().has(person.id);
  const mentor = person.kind === "Mentor";
  const requestForm =
    state.role === "founder" && mentor && !incoming && !existingRoom;
  const mentorRequest =
    state.role === "mentor" &&
    incoming &&
    state.introductionMetaByRole?.mentor?.[person.id]?.kind;
  const referral = state.mentorRequests?.find(
    (entry) =>
      entry.id === state.mentorReferralId &&
      entry.status === "referred" &&
      entry.alternatives.some((item) => item.id === person.id),
  );
  const detailTabs = [
    ["breakdown", "Match breakdown"],
    ["focus", mentor ? "Compare needs and expertise" : "Collaboration focus"],
    ["trust", "Experience and collaboration history"],
  ];
  const noteRating = noteQuality(note, {
    offers: [
      ...profileEntries(state.profiles[state.role]?.offerTags),
      ...profileEntries(state.profiles[state.role]?.offer),
    ],
    theirOffers: person.offer || [],
  });
  // Both sides' needs and offers for Collaboration focus; the shared ones
  // are highlighted.
  const myProfile = state.profiles[state.role] || {};
  const listed = (...values) => [
    ...new Map(
      values
        .flatMap((value) => profileEntries(value))
        .map((item) => [item.toLowerCase(), item]),
    ).values(),
  ];
  const myNeeds = listed(myProfile.needTags, myProfile.need);
  const myOffers = listed(myProfile.offerTags, myProfile.offer);
  const youGet = offeredToYou(person);
  const theyGet = mentor ? [] : person.exchange?.theyGet || [];
  const covered =
    state.role === "mentor" && !mentor
      ? needsYouCover(person, myProfile.offer)
      : null;
  const factors = model.scoreFactors(person);
  const rows = fitFactors(person, factors);
  // Weights as shares of the factors shown, so they add up to 100%.
  const weightTotal = rows.reduce(
    (sum, row) => sum + (person.factorWeights?.[row.index] || 0),
    0,
  );
  const isScore =
    typeof person.score === "number" && Number.isFinite(person.score);
  const proposed =
    state.introductionTypesByRole?.[state.role]?.[person.id] ||
    model.roomTypeForPerson(person);
  const chosenType = engagementType || proposed;
  const template =
    (state.engagementTemplates || defaultTemplates)[chosenType] ||
    defaultTemplates[chosenType];
  const meta = state.introductionMetaByRole?.[state.role]?.[person.id];
  const founderPair = state.role === "founder" && !mentor;
  const pastRooms = Object.values(state.rooms).filter(
    (room) =>
      room.role === state.role &&
      room.partnerId === person.id &&
      ["launched", "reviewed"].includes(room.status),
  );
  const myAudience = Number(state.profiles.founder?.audienceSize);
  const swapWithoutAudience = chosenType === "marketing" && !(myAudience > 0);
  // A mentor who can't take requests (paused, full, guidelines) blocks sending
  // here, and a mentor whose own limits are full can't accept. The server
  // enforces both; this explains why and offers similar mentors.
  const ownUnavailable =
    state.role === "mentor" &&
    state.mentorUsage &&
    !state.mentorUsage.available;
  const startBlocked =
    !existingRoom && !interested && (mentorUnavailable || ownUnavailable);
  // The server refuses an introduction from an incomplete profile, so say
  // which fields are missing here instead of after a failed send.
  const missingProfile =
    existingRoom || (interested && !incoming)
      ? []
      : missingProfileKeys(state.profiles[state.role], state.role);
  const profileBlocked = missingProfile.length > 0;
  // Under the name: what kind of profile it is and, for a startup, its
  // industry, stage and size.
  const heroFacts = [
    person.kind,
    ...(mentor
      ? []
      : [
          person.sector,
          person.stage && stageLabel(person.stage),
          person.teamSize && `Team of ${person.teamSize}`,
          person.audienceSize &&
            `Audience ${Number(person.audienceSize).toLocaleString()}`,
        ]),
    person.founderName && person.founderName !== person.name
      ? `Founder: ${person.founderName}`
      : "",
    person.affiliation ? `Verified: ${person.affiliation.organization}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  // The header's pills: up to three things they can offer, the ones you
  // need first and ticked; the full lists are on the second tab. A mentor
  // looking at a startup sees what it needs, the help they offer ticked.
  const shortName = mentor ? person.name.split(" ")[0] : person.name;
  const heroPills =
    state.role === "mentor" && !mentor
      ? {
          label: `What ${shortName} needs`,
          items: profileEntries(person.need),
          match: covered || [],
          fit: "you offer this",
        }
      : {
          label: `What ${shortName} can offer`,
          items: profileEntries(person.offer),
          match: youGet,
          fit: "you need this",
        };
  const heroShown = [...heroPills.items]
    .sort(
      (a, b) =>
        Number(sameHelp(b, heroPills.match)) -
        Number(sameHelp(a, heroPills.match)),
    )
    .slice(0, 3);
  const heroMore = heroPills.items.length - heroShown.length;
  return (
    <div className="page match-detail-page page-enter">
      <button
        className="link-btn back-link"
        onClick={() => onAction({ page: "discover" })}
      >
        <Icon name="back" /> Back to matches
      </button>
      <div className="match-detail-layout">
        <section className="card identity-panel match-identity-panel">
          {/* Who they are on the left; the fit on the right, its top level
              with the name. */}
          <div className="match-hero-layout">
            <div className="match-hero-main">
              <div className="identity-heading match-hero">
                <Avatar
                  image={person.image}
                  name={person.name}
                  identity={person.accountId || person.id}
                  verified={personVerified(person)}
                  color={person.color}
                  size={72}
                />
                {/* The name with Save beside it. */}
                <div className="page-head match-hero-head">
                  <div>
                    <div className="match-hero-name">
                      <h1 tabIndex="-1">{person.name}</h1>
                      <button
                        className={`icon-btn match-save${model.savedMatches().has(person.id) ? " is-saved" : ""}`}
                        aria-label="Save for later"
                        title={
                          model.savedMatches().has(person.id)
                            ? "Saved: select to remove"
                            : "Save for later"
                        }
                        aria-pressed={model.savedMatches().has(person.id)}
                        disabled={state.busy}
                        onClick={() =>
                          onAction({ action: "save", id: person.id })
                        }
                      >
                        <Icon name="bookmark" />
                      </button>
                    </div>
                    <p className="intro">{heroFacts}</p>
                  </div>
                </div>
              </div>
              <Confirmation />
              <p
                className={`identity-summary preserve-lines${longSummary && !summaryOpen ? " clamped" : ""}`}
                id="match-summary"
              >
                {person.summary || "A description has not been added yet."}
              </p>
              {longSummary && (
                <button
                  className="link-btn"
                  aria-expanded={summaryOpen}
                  aria-controls="match-summary"
                  onClick={() => setSummaryOpen(!summaryOpen)}
                >
                  {summaryOpen ? "Show less" : "Show more"}
                </button>
              )}
              {heroPills.items.length > 0 && (
                <div className="match-offers">
                  <p className="match-offers-label" id="match-offers-label">
                    {heroPills.label}
                  </p>
                  <ul
                    className="match-pills"
                    aria-labelledby="match-offers-label"
                  >
                    {heroShown.map((item) => {
                      const fits = sameHelp(item, heroPills.match);
                      return (
                        <li
                          key={item}
                          className={fits ? "is-match" : undefined}
                        >
                          {fits && <Icon name="check" />}
                          {item}
                          {fits && (
                            <span className="visually-hidden">
                              , {heroPills.fit}
                            </span>
                          )}
                        </li>
                      );
                    })}
                    {heroMore > 0 && (
                      <li className="match-pills-more">
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => setDetailTab("focus")}
                        >
                          +{heroMore} more
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {/* The request lives in a dialog; the page itself is the profile
              and its three tabs. */}
              <div className="match-actions-bar">
                {existingRoom ? (
                  <button
                    className="btn primary"
                    onClick={() =>
                      onAction({ action: "open-room", id: existingRoom.id })
                    }
                  >
                    {existingRoom.type === "mentorship"
                      ? "Open room"
                      : "Open Deal Room"}
                    <Icon name="arrow" />
                  </button>
                ) : mentorRequest ? (
                  <button
                    className="btn primary"
                    onClick={() =>
                      onAction({
                        action: "mentor-request-link",
                        page: "requests",
                        requestId: meta.id,
                      })
                    }
                  >
                    View request
                  </button>
                ) : (
                  <button
                    className="btn primary match-action-open"
                    aria-haspopup="dialog"
                    onClick={openAction}
                  >
                    {requestForm
                      ? "Request mentorship"
                      : incoming
                        ? "Respond to request"
                        : interested
                          ? "Request sent"
                          : "Send a request"}
                    <Icon name="arrow" />
                  </button>
                )}
              </div>
            </div>
            {isScore && (
              <span className="match-hero-score">
                <span
                  className="fit-ring"
                  style={{ "--fit": `${person.score}%` }}
                  aria-hidden="true"
                >
                  <strong>
                    {person.score}
                    <small>%</small>
                  </strong>
                </span>
                <span aria-hidden="true">match</span>
                <span className="visually-hidden">{person.score}% match</span>
              </span>
            )}
          </div>
          {pastRooms.length > 0 && (
            <p className="info-note">
              You completed {pastRooms.length === 1 ? "a" : pastRooms.length}{" "}
              {pastRooms.map((room) => room.engagementType).join(" and ")}{" "}
              together
              {pastRooms[0].completedAt || pastRooms[0].launchedAt
                ? ` in ${new Date(pastRooms[0].completedAt || pastRooms[0].launchedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
                : ""}
              .
            </p>
          )}
        </section>
        {actionOpen && (
          <Overlay
            id="match-action"
            title={person.name}
            onClose={() => setActionOpen(false)}
          >
            <div className="match-action-panel in-modal">
              {dialogError && (
                <p className="warning-note dialog-error" role="alert">
                  {dialogError}
                </p>
              )}
              {requestForm ? (
                <>
                  {cooledDown ? (
                    <div className="mentor-cooldown">
                      <h2>{cooldownText(person.cooldownUntil)}</h2>
                      <p>
                        {person.name} declined your last request. Try another
                        mentor in the meantime.
                      </p>
                      <MentorAlternatives alternatives={alternatives} />
                    </div>
                  ) : (
                    person.formats?.some(
                      (format) => format.id !== "office-hours",
                    ) && (
                      <MentorRequestForm
                        person={person}
                        alternatives={alternatives}
                        referral={referral}
                      />
                    )
                  )}
                  <OfficeHoursBooking person={person} />
                  {mentorUnavailable &&
                    !cooledDown &&
                    person.formats?.every(
                      (format) => format.id === "office-hours",
                    ) && <MentorAlternatives alternatives={alternatives} />}
                </>
              ) : mentorRequest ? (
                <>
                  <h2>Mentorship request received</h2>
                  <button
                    className="btn"
                    onClick={() =>
                      onAction({
                        action: "mentor-request-link",
                        page: "requests",
                        requestId: meta.id,
                      })
                    }
                  >
                    View request
                  </button>
                </>
              ) : (
                <>
                  <span className="action-eyebrow">
                    <Icon
                      name={
                        existingRoom
                          ? "rooms"
                          : incoming
                            ? "inbox"
                            : "handshake"
                      }
                    />
                    {existingRoom
                      ? "Connected"
                      : incoming
                        ? "Request received"
                        : interested
                          ? "Waiting for a reply"
                          : "Your next step"}
                  </span>
                  <h2>
                    {existingRoom
                      ? existingRoom.type === "mentorship"
                        ? "Continue in your mentorship room"
                        : "Continue in your Deal Room"
                      : incoming
                        ? `${person.name} wants to work with you`
                        : interested
                          ? "Request sent"
                          : pastRooms.length
                            ? "Start another collaboration"
                            : "Send a request"}
                  </h2>
                  <p>
                    {existingRoom
                      ? existingRoom.type === "mentorship"
                        ? "Open your mentorship room to pick up where you left off."
                        : "Your shared Deal Room has the agreed terms and next steps."
                      : state.role === "mentor"
                        ? incoming
                          ? "Accepting opens a mentorship room where you confirm a goal and schedule a session."
                          : interested
                            ? `If ${person.name} accepts, a mentorship room opens. Requests expire after 14 days without a reply. You can withdraw it while you wait.`
                            : `If ${person.name} accepts, a mentorship room opens where you confirm a goal and schedule a session.`
                        : incoming
                          ? `Accepting opens a Deal Room where you agree terms together. Nothing is committed until you both accept the terms.`
                          : interested
                            ? `If ${person.name} accepts, a Deal Room opens automatically. Requests expire after 14 days without a reply. You can withdraw it while you wait.`
                            : `If ${person.name} accepts, a Deal Room opens where you agree terms before any work starts.`}
                  </p>
                  {incoming && meta?.note && (
                    <blockquote className="intro-note">
                      “{meta.note}”
                    </blockquote>
                  )}
                  {profileBlocked && !startBlocked && (
                    <div className="mentoring-banner" role="status">
                      <p>
                        Add {missingProfileText(missingProfile)} to your profile
                        before you{" "}
                        {incoming
                          ? "accept this request"
                          : "introduce yourself"}
                        .
                      </p>
                      <button
                        className="btn small"
                        onClick={() => onAction({ action: "edit-profile" })}
                      >
                        Edit profile
                      </button>
                    </div>
                  )}
                  {startBlocked && (
                    <div className="mentoring-banner" role="status">
                      <p>
                        {mentorUnavailable
                          ? unavailableText(person.reason, person.name, {
                              month: person.reasonMonth,
                            })
                          : ownUnavailableText(state.mentorUsage.reason)}
                      </p>
                      {ownUnavailable && (
                        <button
                          className="btn small"
                          onClick={() => onAction({ page: "settings" })}
                        >
                          Open mentoring settings
                        </button>
                      )}
                    </div>
                  )}
                  {alternatives.length > 0 && !existingRoom && (
                    <div className="mentoring-alternatives">
                      <h3>Ask one of these mentors instead</h3>
                      <ul>
                        {alternatives.map((item) => (
                          <li key={item.id}>
                            <span>
                              <strong>{item.name}</strong>
                              <span className="muted">
                                {item.score}% fit · {item.availability}
                              </span>
                            </span>
                            <button
                              className="btn small"
                              onClick={() =>
                                onAction({
                                  action: "match-detail",
                                  id: item.id,
                                })
                              }
                            >
                              View match
                              <span className="visually-hidden">
                                : {item.name}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Mentorship is the only type a mentor can start: no choice. */}
                  {!existingRoom && !interested && state.role !== "mentor" && (
                    <div className="field">
                      <label htmlFor="introduction-type">
                        {incoming ? "Accept as" : "Collaboration type"}
                      </label>
                      <SelectField
                        id="introduction-type"
                        value={chosenType}
                        onChange={(event) =>
                          setEngagementType(event.target.value)
                        }
                      >
                        {state.role === "mentor" || mentor ? (
                          <option value="mentorship">Mentorship</option>
                        ) : (
                          <>
                            {startupTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.label}
                              </option>
                            ))}
                          </>
                        )}
                      </SelectField>
                      <p className="field-help">
                        {incoming
                          ? `${person.name} proposed ${typeLabel(proposed)}. Choosing another type tells them when the room opens.`
                          : `First step: ${template?.milestones?.[0]?.title || "agree on terms"}. ${person.name} sees this before accepting.`}
                      </p>
                      {swapWithoutAudience && (
                        <p className="warning-note">
                          Add your audience size to your profile so{" "}
                          {person.name} can judge whether the swap is fair.
                        </p>
                      )}
                      {chosenType === "marketing" && person.audienceWarning && (
                        <p className="warning-note">
                          {person.audienceWarning}.
                        </p>
                      )}
                    </div>
                  )}
                  {!existingRoom && !incoming && !interested && (
                    <div className="field">
                      <label htmlFor="introduction-note">
                        Add a short note (optional)
                      </label>
                      <textarea
                        id="introduction-note"
                        maxLength={280}
                        value={note}
                        placeholder={
                          state.role === "mentor"
                            ? `Which of ${person.name}’s needs can you help with?`
                            : `Why ${person.name}? For example: what you can share and what you hope to learn from them.`
                        }
                        onChange={(event) => setNote(event.target.value)}
                      />
                      <span className="field-count">{note.length} / 280</span>
                      {/* The same assistant as a mentorship request: amber
                      until the note covers the basics. */}
                      <section
                        className={
                          noteRating.score < 60
                            ? "mentoring-banner note-quality"
                            : "mentoring-banner note-quality request-quality-good"
                        }
                        aria-label="Request assistant"
                      >
                        <div className="quality-head">
                          <h3>Quality of Request</h3>
                          <span className="quality-badge">
                            {qualityLabel(noteRating.score)}
                            <span className="visually-hidden">
                              , {noteRating.score} out of 100
                            </span>
                          </span>
                        </div>
                        {noteRating.reasons.length > 0 && (
                          <ul>
                            {noteRating.reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        )}
                      </section>
                    </div>
                  )}
                  {interested && !existingRoom && !incoming && meta?.sentAt && (
                    <p className="muted">
                      Sent {formatDate(meta.sentAt)} · expires{" "}
                      {formatDate(Date.parse(meta.sentAt) + 14 * 86400000)}
                    </p>
                  )}
                  <button
                    className="btn primary full"
                    data-action="interest"
                    data-id={person.id}
                    disabled={
                      state.busy ||
                      startBlocked ||
                      profileBlocked ||
                      (interested && !existingRoom && !incoming)
                    }
                    onClick={() =>
                      onAction({
                        action: existingRoom
                          ? "open-room"
                          : incoming
                            ? "accept-interest"
                            : "interest",
                        id: existingRoom?.id || person.id,
                        engagementType: chosenType,
                        values: incoming || existingRoom ? undefined : { note },
                      })
                    }
                  >
                    {existingRoom
                      ? existingRoom.type === "mentorship"
                        ? "Open room"
                        : "Open Deal Room"
                      : incoming
                        ? "Accept request"
                        : interested
                          ? "Request sent"
                          : "Send request"}
                    <Icon name="arrow" />
                  </button>
                  {!existingRoom && <VerificationGate />}
                  {incoming && !existingRoom && (
                    <DeclineIntroduction person={person} />
                  )}
                  {interested && !incoming && !existingRoom && (
                    <SimulateAcceptance person={person} />
                  )}
                  {interested && !incoming && !existingRoom && (
                    <button
                      className="btn full"
                      disabled={state.busy}
                      onClick={() =>
                        onAction({ action: "cancel-interest", id: person.id })
                      }
                    >
                      Withdraw request
                    </button>
                  )}
                </>
              )}
            </div>
          </Overlay>
        )}
        <div className="match-reading-column">
          {/* Breakdown, focus and trust as tabs: one panel at a time, so
              the page stays short and easy to scan. */}
          <section className="card panel profile-section match-tabs-card">
            <div
              className="tabs match-detail-tabs"
              role="tablist"
              aria-label="About this match"
            >
              {detailTabs.map(([id, label]) => (
                <button
                  key={id}
                  className={`tab${detailTab === id ? " active" : ""}`}
                  role="tab"
                  id={`match-detail-tab-${id}`}
                  aria-controls="match-detail-panel"
                  aria-selected={detailTab === id}
                  tabIndex={detailTab === id ? 0 : -1}
                  onKeyDown={onTabKeyDown}
                  onClick={() => setDetailTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              id="match-detail-panel"
              role="tabpanel"
              aria-labelledby={`match-detail-tab-${detailTab}`}
              className="match-detail-panel"
            >
              {detailTab === "breakdown" && (
                <div className="fit-section">
                  <h2>Why this match</h2>
                  {/* One sentence on why: what lines up and what doesn't. */}
                  <p className="fit-sentence">
                    {fitSentence(person, rows, {
                      mentorViewer: state.role === "mentor",
                    })}
                  </p>
                  <div className="fit-details">
                    <div className="score-breakdown">
                      {rows.map((row) => (
                        <div className="fit-detail-row" key={row.index}>
                          <div className="fit-detail-heading">
                            <h3>{row.label}</h3>
                            <span>
                              {row.status}
                              {row.score !== null ? ` · ${row.score}%` : ""}
                            </span>
                          </div>
                          {row.score !== null && (
                            <div className="score-track" aria-hidden="true">
                              <i style={{ width: `${row.score}%` }} />
                            </div>
                          )}
                          <p>{row.detail}</p>
                          {weightTotal > 0 && (
                            <small>
                              Weight in the overall score:{" "}
                              {Math.round(
                                ((person.factorWeights[row.index] || 0) /
                                  weightTotal) *
                                  100,
                              )}
                              %
                            </small>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {detailTab === "focus" && (
                <div className="focus-panel">
                  <h2>
                    {mentor
                      ? "Compare needs and expertise"
                      : state.role === "mentor"
                        ? "What this startup needs"
                        : "What you could trade"}
                  </h2>
                  {/* Where the two profiles meet, in one sentence, then
                      both sides with the shared help highlighted. */}
                  <p className="focus-summary">
                    {state.role === "mentor" && !mentor
                      ? covered?.length
                        ? `You can help with ${covered.join(", ")}, which they need.`
                        : "None of their needs match what you offer yet."
                      : overlapSentence({
                          youGet,
                          theyGet,
                          name: person.name,
                          mentor,
                        })}
                  </p>
                  {mentor && person.expertise && (
                    <p className="expertise-lead">{person.expertise}</p>
                  )}
                  <div className="focus-sides">
                    {[
                      {
                        key: "you",
                        title: "You",
                        needs: myNeeds,
                        offers: myOffers,
                        needMatch: youGet,
                        offerMatch: theyGet,
                      },
                      {
                        key: "them",
                        title: person.name,
                        needs: person.need || [],
                        offers: person.offer || [],
                        needMatch: theyGet,
                        offerMatch: youGet,
                      },
                    ].map((side) => (
                      <section
                        className="focus-side"
                        key={side.key}
                        aria-label={side.title}
                      >
                        <h3>{side.title}</h3>
                        {[
                          ["Needs", side.needs, side.needMatch],
                          ["Offers", side.offers, side.offerMatch],
                        ].map(([label, items, match]) => (
                          <div className="focus-row" key={label}>
                            <span className="focus-label">{label}</span>
                            {items.length ? (
                              <ul className="focus-tags">
                                {items.map((item) => (
                                  <li
                                    key={item}
                                    className={
                                      sameHelp(item, match) ? "is-shared" : ""
                                    }
                                  >
                                    {sameHelp(item, match) && (
                                      <Icon name="check" />
                                    )}
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="muted">Not added yet.</span>
                            )}
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                  {mentor && person.startups && (
                    <div className="profile-section-block">
                      <h3>Startups they want to help</h3>
                      <p>{person.startups}</p>
                    </div>
                  )}
                </div>
              )}
              {detailTab === "trust" && (
                <div>
                  <h2>Experience and collaboration history</h2>
                  <MentorshipBadges
                    badges={person.badges?.filter(
                      (badge) => badge !== "New Mentor",
                    )}
                  />
                  {person.pastExperience && (
                    <div className="profile-section-block">
                      <h3>Past experience</h3>
                      <p className="preserve-lines">{person.pastExperience}</p>
                    </div>
                  )}
                  <TrustSummary person={person} detailed />
                  {person.mentorImpact && (
                    <FormatPrices person={person} showUnavailable />
                  )}
                  {person.mentorImpact && (
                    <MentorImpact trust={person.mentorImpact} hideEmpty />
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
