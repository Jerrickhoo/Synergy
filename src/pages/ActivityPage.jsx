import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import InfoTip from "../components/InfoTip.jsx";
import { partnerName } from "../data/home.js";
import { activityLabel, activityText } from "../data/home-planner.js";
import {
  activityDays,
  dealRecords,
  dealStatusLabel,
  dealStatuses,
  introductionRecords,
  introductionStatusLabel,
  introductionStatuses,
  statusMeaning,
} from "../data/activity.js";

const logStep = 25;

function DateCell({ iso, empty = "Not recorded" }) {
  const when = iso ? new Date(iso) : null;
  if (!when || !Number.isFinite(when.getTime()))
    return <span className="activity-empty-date">{empty}</span>;
  return (
    <time className="activity-date" dateTime={when.toISOString()}>
      {when.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}
      <span className="activity-time">
        {when.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })}
      </span>
    </time>
  );
}

// The badge carries its meaning as a tooltip; the ⓘ beside each Status
// column lists them all, on hover, focus or tap.
function StatusBadge({ id, label, meaning }) {
  return (
    <span className={`activity-status status-${id}`} title={meaning}>
      {label}
    </span>
  );
}

// "Deals ⓘ": the ⓘ lists what each status means. It sits by the heading,
// not in the table head, so phones (which hide the head) still have it.
function RecordTitle({ id, title, list, label }) {
  return (
    <div className="activity-record-title">
      <h2 id={id}>{title}</h2>
      <InfoTip label={label}>
        <span className="info-tip-title">{label}</span>
        <span className="info-tip-list">
          {list.map((item) => (
            <span className="info-tip-row" key={item.id}>
              <StatusBadge id={item.id} label={item.label} />
              <span>{item.meaning}</span>
            </span>
          ))}
        </span>
      </InfoTip>
    </div>
  );
}

function Deals({ rows, mentor }) {
  const { onAction } = useApp();
  return (
    <section
      className="card panel activity-record"
      id="activity-deals"
      aria-labelledby="activity-deals-heading"
    >
      <div className="activity-record-head">
        <RecordTitle
          id="activity-deals-heading"
          title={mentor ? "Mentorships" : "Deals"}
          list={dealStatuses}
          label={`What each ${mentor ? "mentorship" : "deal"} status means`}
        />
        <p className="muted">
          {mentor
            ? "Each mentorship room, from the day it opened."
            : "Each Deal Room, from the day the request was accepted."}
        </p>
      </div>
      {rows.length ? (
        <div
          className="activity-table-wrap"
          role="region"
          aria-labelledby="activity-deals-heading"
          tabIndex={0}
        >
          <table className="activity-table">
            <thead>
              <tr>
                <th scope="col">With</th>
                <th scope="col">Type</th>
                <th scope="col">Opened</th>
                <th scope="col">Status</th>
                <th scope="col">Last update</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" data-label="With">
                    {row.name}
                  </th>
                  <td data-label="Type">{row.kind}</td>
                  <td data-label="Opened">
                    <DateCell iso={row.openedAt} />
                  </td>
                  <td data-label="Status">
                    <StatusBadge
                      id={row.status}
                      label={dealStatusLabel(row)}
                      meaning={statusMeaning(row.status, "deal")}
                    />
                    {row.finishedAt && (
                      <span className="activity-sub">
                        {row.status === "cancelled" ? "Closed" : "Finished"}{" "}
                        <DateCell iso={row.finishedAt} />
                      </span>
                    )}
                  </td>
                  <td data-label="Last update">
                    <DateCell iso={row.updatedAt} />
                  </td>
                  <td className="activity-actions">
                    <button
                      className="btn small"
                      onClick={() =>
                        onAction({ action: "open-room", id: row.room.id })
                      }
                    >
                      Open room
                      <span className="visually-hidden">: {row.name}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="activity-none">
          {mentor
            ? "No mentorships yet. A room opens when you accept a founder's request."
            : "No deals yet. A Deal Room opens when someone accepts a request."}
        </p>
      )}
    </section>
  );
}

function Introductions({ rows, mentor }) {
  const { model, onAction } = useApp();
  const known = new Set(model.rolePeople().map((person) => person.id));
  return (
    <section
      className="card panel activity-record"
      id="activity-introductions"
      aria-labelledby="activity-introductions-heading"
    >
      <div className="activity-record-head">
        <RecordTitle
          id="activity-introductions-heading"
          title="Requests"
          list={introductionStatuses}
          label="What each request status means"
        />
        <p className="muted">
          When each one was sent, where it stands and when it closed.
        </p>
      </div>
      {rows.length ? (
        <div
          className="activity-table-wrap"
          role="region"
          aria-labelledby="activity-introductions-heading"
          tabIndex={0}
        >
          <table className="activity-table">
            <thead>
              <tr>
                <th scope="col">With</th>
                <th scope="col">Type</th>
                <th scope="col">Requested</th>
                <th scope="col">Status</th>
                <th scope="col">Closed or expires</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const open = ["needs-reply", "waiting"].includes(row.status);
                return (
                  <tr key={row.id}>
                    <th scope="row" data-label="With">
                      {row.name}
                    </th>
                    <td data-label="Type">
                      {row.kind}
                      <span className="activity-sub">
                        {row.direction === "sent" ? "You sent" : "You received"}
                      </span>
                    </td>
                    <td data-label="Requested">
                      <DateCell iso={row.requestedAt} />
                    </td>
                    <td data-label="Status">
                      <StatusBadge
                        id={row.status}
                        label={introductionStatusLabel(row.status)}
                        meaning={statusMeaning(row.status)}
                      />
                    </td>
                    <td data-label={open ? "Expires" : "Closed"}>
                      {open ? (
                        <span className="activity-sub-lead">
                          {/* Phones label the cell "Expires" already. */}
                          <span className="activity-expires-word">
                            Expires{" "}
                          </span>
                          <DateCell iso={row.expiresAt} />
                        </span>
                      ) : (
                        <DateCell iso={row.closedAt} />
                      )}
                    </td>
                    <td className="activity-actions">
                      {open ? (
                        <button
                          className="btn small"
                          onClick={() =>
                            row.requestId
                              ? onAction({
                                  action: "mentor-request-link",
                                  page: mentor ? "requests" : "waiting",
                                  requestId: row.requestId,
                                })
                              : onAction({
                                  page: mentor ? "requests" : "waiting",
                                })
                          }
                        >
                          {row.status === "needs-reply" ? "Reply" : "View"}
                          <span className="visually-hidden">: {row.name}</span>
                        </button>
                      ) : (
                        known.has(row.personId) && (
                          <button
                            className="btn small"
                            onClick={() =>
                              onAction({
                                action: "match-detail",
                                id: row.personId,
                              })
                            }
                          >
                            View profile
                            <span className="visually-hidden">
                              : {row.name}
                            </span>
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="activity-none">
          {mentor
            ? "No requests yet. Founders' requests and the ones you send appear here."
            : "Nothing sent or received yet. Send a request from Matches to start."}
        </p>
      )}
    </section>
  );
}

function ActivityLog() {
  const { state, model } = useApp();
  const [limit, setLimit] = useState(logStep);
  const people = model.allPeople();
  const total = (state.activity || []).filter(
    (item) => item.role === state.role,
  ).length;
  const days = activityDays(state, limit);
  return (
    <section
      className="card panel activity-log"
      id="activity-log"
      aria-labelledby="activity-log-heading"
    >
      <div className="activity-record-head">
        <h2 id="activity-log-heading">Activity log</h2>
        <p className="muted">Everything you did in Synergy, newest first.</p>
      </div>
      {days.length ? (
        <>
          {days.map(([label, items]) => (
            <section
              className="activity-day"
              key={label}
              aria-label={`Activity on ${label}`}
            >
              <h3>{label}</h3>
              <ul className="activity-log-list">
                {items.map((item) => {
                  const tag = activityLabel(item, state, people);
                  const when = new Date(item.timestamp);
                  return (
                    <li key={item.id}>
                      <time
                        dateTime={
                          Number.isFinite(when.getTime())
                            ? when.toISOString()
                            : undefined
                        }
                      >
                        {Number.isFinite(when.getTime())
                          ? when.toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : ""}
                      </time>
                      <span className="activity-log-copy">
                        {tag && <span className="activity-label">{tag}</span>}
                        <span>{activityText(item.text, tag)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {total > limit && (
            <button
              className="btn activity-more"
              onClick={() => setLimit((value) => value + logStep)}
            >
              Show earlier activity
            </button>
          )}
        </>
      ) : (
        <p className="activity-none">
          Nothing yet. What you do in Synergy is recorded here.
        </p>
      )}
    </section>
  );
}

export default function ActivityPage() {
  const { state, onTabKeyDown } = useApp();
  const mentor = state.role === "mentor";
  const [section, setSection] = useState("deals");
  const sections = [
    ["deals", mentor ? "Mentorships" : "Deals"],
    ["requests", "Requests"],
    ["log", "Activity log"],
  ];
  const deals = dealRecords(state, (room) => partnerName(state, room));
  const introductions = introductionRecords(state);
  const replies = introductions.filter(
    (row) => row.status === "needs-reply",
  ).length;
  const waiting = introductions.filter(
    (row) => row.status === "waiting",
  ).length;
  const live = deals.filter((row) =>
    ["matched", "in-progress"].includes(row.status),
  ).length;
  const finished = deals.filter((row) =>
    ["launched", "reviewed"].includes(row.status),
  ).length;
  const summary = [
    replies > 0 && {
      key: "replies",
      urgent: true,
      text: `${replies} need${replies === 1 ? "s" : ""} your reply`,
    },
    waiting > 0 && { key: "waiting", text: `${waiting} waiting for a reply` },
    live > 0 && {
      key: "live",
      text: `${live} ${mentor ? "mentorship" : "deal"}${live === 1 ? "" : "s"} under way`,
    },
    finished > 0 && { key: "finished", text: `${finished} finished` },
  ].filter(Boolean);
  return (
    <div className="page activity-page page-enter">
      <PageHeader
        title="Activity"
        intro={`A dated record of every request and ${mentor ? "mentorship" : "deal"}, and everything you did.`}
      />
      {summary.length > 0 && (
        <ul className="activity-summary" aria-label="At a glance">
          {summary.map((item) => (
            <li key={item.key} className={item.urgent ? "urgent" : ""}>
              {item.text}
            </li>
          ))}
        </ul>
      )}
      {/* Tabs like Matches and Requests: one record at a time. */}
      <div className="tabs activity-tabs" role="tablist" aria-label="Activity">
        {sections.map(([id, label]) => (
          <button
            key={id}
            className={`tab${section === id ? " active" : ""}`}
            role="tab"
            id={`activity-tab-${id}`}
            aria-controls="activity-panel"
            aria-selected={section === id}
            tabIndex={section === id ? 0 : -1}
            onKeyDown={onTabKeyDown}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className="activity-sections"
        id="activity-panel"
        role="tabpanel"
        aria-labelledby={`activity-tab-${section}`}
      >
        {section === "deals" && <Deals rows={deals} mentor={mentor} />}
        {section === "requests" && (
          <Introductions rows={introductions} mentor={mentor} />
        )}
        {section === "log" && <ActivityLog />}
      </div>
    </div>
  );
}
