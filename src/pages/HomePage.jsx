import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Tags from "../components/Tags.jsx";
import MatchCard from "../components/MatchCard.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Icon from "../components/Icon.jsx";
export default function HomePage() {
  const { state, model, onAction } = useApp();
  const { allPeople, roleName, roleInitials, roomStatusLabel, matches } = model;
  const roleIntro =
    state.role === "founder"
      ? "The right people are closer than you think. Here’s what’s moving your startup forward."
      : "Your experience can change a founder’s trajectory. Here’s where your guidance can make a difference.";
  const activeRooms = Object.values(state.rooms).filter(
    (item) => item.role === state.role,
  ).length;
  const cardStats =
    state.role === "founder"
      ? [
          [
            <Icon name="spark" />,
            "New matches",
            String(matches().length),
            <>
              <strong>2</strong>
              {" high-fit this week"}
            </>,
          ],
          [
            <Icon name="handshake" />,
            "Active deal rooms",
            String(activeRooms),
            "Shared workspaces",
          ],
          [
            <Icon name="profile" />,
            "Profile views",
            "24",
            <>
              <strong>+18%</strong>
              {" this month"}
            </>,
          ],
          [
            <Icon name="check" />,
            "Trust score",
            "4.9",
            `from ${state.trustHistoryByRole[state.role].length} completed deals`,
          ],
        ]
      : [
          [
            <Icon name="spark" />,
            "Founders to meet",
            String(matches().length),
            <>
              <strong>2</strong>
              {" high-fit this week"}
            </>,
          ],
          [
            <Icon name="handshake" />,
            "Active engagements",
            String(activeRooms),
            "Mentorship rooms",
          ],
          [
            <Icon name="profile" />,
            "Profile views",
            "31",
            <>
              <strong>+12%</strong>
              {" this month"}
            </>,
          ],
          [
            <Icon name="check" />,
            "Trust score",
            "5.0",
            `from ${state.trustHistoryByRole[state.role].length} completed deals`,
          ],
        ];
  const primary = matches()[0];
  const room = Object.values(state.rooms).find(
    (item) => item.role === state.role,
  );
  const roomPartner =
    room && allPeople().find((person) => person.id === room.partnerId);
  const profile = state.profiles[state.role];
  const completenessFields =
    state.role === "founder"
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
    (completenessFields.filter((value) => String(value || "").trim()).length /
      completenessFields.length) *
      100,
  );
  return (
    <div className="page page-enter">
      {"\n          "}
      <PageHeader
        eyebrow="YOUR SYNERGY WORKSPACE"
        title={`Good morning, ${roleName()}`}
        intro={roleIntro}
        actions={
          <>
            <button
              className="btn"
              data-page="discover"
              onClick={(event) =>
                onAction(
                  {
                    page: "discover",
                  },
                  event,
                )
              }
            >
              Browse all matches
            </button>
            <button
              className="btn primary"
              data-page="profile"
              onClick={(event) =>
                onAction(
                  {
                    page: "profile",
                  },
                  event,
                )
              }
            >
              Edit profile
            </button>
          </>
        }
      />
      {"\n          "}
      <section className="grid stats">
        {cardStats.map(([icon, label, value, foot], itemIndex) => (
          <Fragment key={itemIndex}>
            <div className="card stat">
              <div className="stat-top">
                <span className="stat-label">{label}</span>
                <span className="stat-icon">{icon}</span>
              </div>
              <div className="stat-value">{value}</div>
              <div className="stat-foot">{foot}</div>
            </div>
          </Fragment>
        ))}
      </section>
      {"\n          "}
      <div className="grid home-grid">
        {"\n            "}
        <section className="card panel">
          {"\n              "}
          <div className="panel-head">
            <div>
              <div className="panel-title">
                <h2>Made for your next move</h2>
                <span className="tag green">Just for you</span>
              </div>
              <p className="panel-subtitle">
                Thoughtful matches, with the why behind every introduction.
              </p>
            </div>
            <button
              className="link-btn"
              data-page="discover"
              onClick={(event) =>
                onAction(
                  {
                    page: "discover",
                  },
                  event,
                )
              }
            >
              See all →
            </button>
          </div>
          {"\n              "}
          <div className="match-list">
            <MatchCard person={primary} />
            <MatchCard person={matches()[1]} />
          </div>
          {"\n              "}
          <div className="callout">
            <span className="callout-icon">
              <Icon name="spark" />
            </span>
            <span>
              <strong>Not another lookalike list.</strong>
              {
                " Synergy matches what you need with what someone else can offer—and tells you how it got there."
              }
            </span>
          </div>
          {"\n              "}
          <div className="section-gap">
            {"\n                "}
            <div className="panel-head">
              <div>
                <h2>In motion</h2>
                <p className="panel-subtitle">
                  Your partnerships, moving one step at a time.
                </p>
              </div>
              <button
                className="link-btn"
                data-page="rooms"
                onClick={(event) =>
                  onAction(
                    {
                      page: "rooms",
                    },
                    event,
                  )
                }
              >
                All deal rooms →
              </button>
            </div>
            {"\n                "}
            {room ? (
              <div className="active-deal">
                <div className="deal-icon">
                  <Icon name="handshake" />
                </div>
                <div
                  style={{
                    flex: "1",
                  }}
                >
                  <div className="deal-title">
                    {room.type === "mentorship"
                      ? "Mentorship Engagement"
                      : room.engagementType}{" "}
                    <span className="status">
                      {roomStatusLabel(
                        room.status,
                        roomPartner?.name || room.partnerId,
                      )}
                    </span>
                  </div>
                  <div className="deal-meta">
                    {"With "}
                    {roomPartner?.name || room.partnerId}
                    {" · "}
                    {
                      Object.values(room.milestones).filter(
                        (item) => item.me && item.partner,
                      ).length
                    }
                    {" of 5 milestones confirmed"}
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: room.progress + "%",
                      }}
                    />
                  </div>
                  <div className="completion-row">
                    <span>Room progress</span>
                    <span>{room.progress}%</span>
                  </div>
                </div>
                <button
                  className="btn small"
                  data-action="open-room"
                  data-id={room.id}
                  onClick={(event) =>
                    onAction(
                      {
                        action: "open-room",
                        id: room.id,
                      },
                      event,
                    )
                  }
                >
                  Open room
                </button>
              </div>
            ) : (
              <div className="empty-state">No active rooms yet.</div>
            )}
            {"\n              "}
          </div>
          {"\n            "}
        </section>
        {"\n            "}
        <aside className="grid">
          {"\n              "}
          <section className="card panel">
            {"\n                "}
            <div className="panel-head">
              <div>
                <h2>Your profile</h2>
                <p className="panel-subtitle">
                  A strong profile makes the right match easier.
                </p>
              </div>
              <button
                className="link-btn"
                data-page="profile"
                onClick={(event) =>
                  onAction(
                    {
                      page: "profile",
                    },
                    event,
                  )
                }
              >
                Edit
              </button>
            </div>
            {"\n                "}
            <div className="profile-card">
              <div className="profile-top">
                <Avatar
                  initials={roleInitials()}
                  color={state.role === "founder" ? "" : "blue"}
                />
                <div>
                  <div className="match-title">{roleName()}</div>
                  <div className="verified">
                    <span className="verify-icon">
                      <Icon name="check" />
                    </span>
                    Verified member
                  </div>
                </div>
              </div>
              <p>{profile.bio}</p>
              <Tags
                values={
                  state.role === "founder"
                    ? [
                        profile.industry,
                        profile.stage,
                        `Team of ${profile.teamSize}`,
                      ]
                    : profile.expertise.split(",").map((tag) => tag.trim())
                }
                color="green"
              />
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: completeness + "%",
                  }}
                />
              </div>
              <div className="completion-row">
                <span>Profile completeness</span>
                <strong
                  style={{
                    color: "var(--green)",
                  }}
                >
                  {completeness}%
                </strong>
              </div>
            </div>
            {"\n              "}
          </section>
          {"\n              "}
          <section className="card panel">
            {"\n                "}
            <div className="panel-head">
              <div>
                <h2>Around your workspace</h2>
                <p className="panel-subtitle">The latest from your people.</p>
              </div>
              <span
                style={{
                  color: "#7e8a82",
                }}
              >
                ···
              </span>
            </div>
            {"\n                "}
            <div className="activity-list">
              {"\n                  "}
              <div className="activity">
                <span className="activity-dot" />
                <div className="activity-copy">
                  <strong>
                    {state.role === "founder" ? "Campus Grocer" : "BudgetBuddy"}
                  </strong>
                  {" confirmed "}
                  {state.role === "founder"
                    ? "“Scope defined”."
                    : "'Goals defined'."}
                  <span className="activity-time">
                    {"18 min ago · "}
                    {state.role === "founder"
                      ? "Beta Testing Exchange"
                      : "Mentorship Engagement"}
                  </span>
                </div>
              </div>
              {"\n                  "}
              <div className="activity">
                <span
                  className="activity-dot"
                  style={{
                    background: "#e49a68",
                    boxShadow: "0 0 0 4px #fff1e6",
                  }}
                />
                <div className="activity-copy">
                  <strong>
                    {state.role === "founder" ? "David Park" : "BudgetBuddy"}
                  </strong>{" "}
                  {state.role === "founder"
                    ? "is a great fit for your product goals."
                    : "is looking for your product experience."}
                  <span className="activity-time">Yesterday · New match</span>
                </div>
              </div>
              {"\n                  "}
              <div className="activity">
                <span
                  className="activity-dot"
                  style={{
                    background: "#8795c3",
                    boxShadow: "0 0 0 4px #eef0fa",
                  }}
                />
                <div className="activity-copy">
                  {"Your profile was viewed by "}
                  <strong>3 founders</strong>
                  {" this week."}
                  <span className="activity-time">2 days ago · Profile</span>
                </div>
              </div>
              {"\n                "}
            </div>
            {"\n              "}
          </section>
          {"\n            "}
        </aside>
        {"\n          "}
      </div>
      {"\n        "}
    </div>
  );
}
