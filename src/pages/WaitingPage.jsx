import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Icon from "../components/Icon.jsx";
export default function WaitingPage() {
  const { state, model, onAction } = useApp();
  const { roleName, roleInitials, rolePeople, waitingMatches } = model;
  const pending = rolePeople().filter((person) =>
    waitingMatches().has(person.id),
  );
  const person =
    pending.find((candidate) => candidate.id === state.activeWaitingMatch) ||
    pending[0];
  if (!person)
    return (
      <div className="page page-enter">
        <PageHeader
          eyebrow="YOUR INTRODUCTIONS"
          title="Waiting for response"
          intro="Your interest is on its way. We’ll let you know when someone responds."
        />
        <section className="empty-state">
          <Icon name="inbox" />
          <p>
            No introductions are waiting right now. Find someone who fits your
            next move.
          </p>
          <button
            className="btn primary"
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
            Explore matches
          </button>
        </section>
      </div>
    );
  return (
    <div className="page waiting-page page-enter">
      <PageHeader
        eyebrow="YOUR INTRODUCTIONS"
        title="Waiting for response"
        intro="A thoughtful introduction is the first step toward doing good work together."
      />
      <div className="waiting-people-list" aria-label="Pending introductions">
        {pending.map((candidate, itemIndex) => (
          <Fragment key={itemIndex}>
            <button
              className={
                "waiting-person " +
                (candidate.id === person.id ? "selected" : "")
              }
              data-action="select-waiting"
              data-id={candidate.id}
              aria-pressed={candidate.id === person.id}
              onClick={(event) =>
                onAction(
                  {
                    action: "select-waiting",
                    id: candidate.id,
                  },
                  event,
                )
              }
            >
              <Avatar initials={candidate.initials} color={candidate.color} />
              <span>
                <strong>{candidate.name}</strong>
                <span>{candidate.engagement}</span>
              </span>
            </button>
          </Fragment>
        ))}
      </div>
      <div className="grid waiting-layout">
        <section className="card panel waiting-card">
          {"\n        "}
          <h2>Your collaboration space</h2>
          {"\n          "}
          <div className="waiting-parties">
            <Avatar
              initials={roleInitials()}
              color={state.role === "founder" ? "" : "blue"}
            />
            <span className="room-arrow">
              <Icon name="arrow" />
            </span>
            <Avatar initials={person.initials} color={person.color} />
          </div>
          {"\n          "}
          <div>
            <strong>{roleName()}</strong>
            <span className="waiting-divider">and</span>
            <strong>{person.name}</strong>
          </div>
          {"\n          "}
          <span className="status waiting-badge">
            <Icon name="clock" />
            {" Waiting for response"}
          </span>
          {"\n          "}
          <p>
            {person.name}
            {
              " will be able to review your introduction and proposed collaboration terms."
            }
          </p>
          {"\n          "}
          <button
            className="btn primary"
            data-action="review-proposed-terms"
            data-id={person.id}
            onClick={(event) =>
              onAction(
                {
                  action: "review-proposed-terms",
                  id: person.id,
                },
                event,
              )
            }
          >
            Review proposed terms
          </button>
          {"\n        "}
        </section>
        <aside className="card panel waiting-next">
          <h2>What happens next</h2>
          <ol>
            <li>
              <strong>They review your introduction</strong>
              <span>
                Your offer and proposed terms give them a clear starting point.
              </span>
            </li>
            <li>
              <strong>You hear back</strong>
              <span>We’ll update this space when they respond.</span>
            </li>
            <li>
              <strong>Plan together</strong>
              <span>If you both agree, continue in a shared deal room.</span>
            </li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
