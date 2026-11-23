import {
  dayMs,
  followupEngagement,
  hourMs,
  isMentorRoom,
  mentorSessions,
  setMentorMilestone,
} from "../src/data/mentor-room.js";
import { createInitialState } from "../src/data/model.js";
import { randomUUID } from "node:crypto";
import {
  closeCategories,
  defaultVocabulary,
  offersNeed,
  reviewDeadline,
  suggestTags,
  terminalStatuses,
  trustSummary,
  moderationDueAt,
  ongoingMentorship,
  ensureCycle,
  resolveCycleDecisions,
} from "../src/data/collaboration.js";
import { queueMentorEmail } from "./mentor-email.js";
import { mentorEmailKinds } from "../src/data/mentor-email.js";
import { enqueueDelivery } from "./delivery.js";
export const defaultPreferences = {
  match: true,
  activity: true,
  reminders: true,
  digest: "weekly",
};
import { scheduleInstant } from "../src/data/selectors.js";
import { roomProgress } from "../src/data/selectors.js";
import defaultTemplates from "../src/data/engagement-templates.json" with { type: "json" };
import {
  defaultMatching,
  matchingReport,
  weightCount,
} from "../src/data/matching.js";
import {
  capacityErrorMessage,
  capacityErrors,
  conflictRelations,
  guidelinesStatus,
  mentorConfig,
  ownUnavailableText,
  validTimeZone,
} from "../src/data/mentor-rules.js";
import {
  mentorFormatIds,
  normalizeOfferedFormats,
} from "../src/data/mentor-formats.js";
import { profileCompleteness } from "../src/data/selectors.js";

// Mentoring settings forms (roadmap Phase 1). Only the mentor role can use them.
const mentoringForms = new Set([
  "mentor-capacity",
  "set-mentor-pause",
  "mentor-conflicts",
  "accept-guidelines",
]);

function requestDigestUpdates(items, time) {
  const digests = new Map();
  const updates = [];
  for (const item of items) {
    const timestamp = item.requestDigestAt;
    if (item.kind !== "request" || !timestamp) {
      updates.push(item);
      continue;
    }
    if (Date.parse(timestamp) <= time)
      digests.set(timestamp, (digests.get(timestamp) || 0) + 1);
  }
  for (const [timestamp, count] of digests) {
    updates.push({
      id: `request-digest:${timestamp}`,
      kind: "request-digest",
      role: "mentor",
      timestamp,
      text: `${count} new mentorship ${count === 1 ? "request" : "requests"}`,
      page: "requests",
    });
  }
  return updates;
}

export function createFeatures({
  getDb,
  save,
  authenticate,
  prepare,
  response,
  mirror,
  event,
  options,
  fail,
  sessions,
  displayName = (account) => account.state.accountName,
  simulatePartner = () => {},
  advanceRoom,
  keepHistory = () => {},
  similarMentors = () => [],
  mentorRequestActions = new Set(),
  mentorRequestAction,
  returnMentorRequests,
  mentorSettings = () => mentorConfig,
  mentorAdmin,
  changeMentorSetting,
  validateOfficeHours,
  mentorApproved = () => true,
  approvalQueue = () => [],
  mentorSafetyQueue = () => ({
    flags: [],
    limits: [],
    suspensions: [],
    ratings: [],
  }),
}) {
  const now = () => options.now?.() ?? Date.now();
  const db = () => getDb();
  const accountById = (id) =>
    Object.hasOwn(db().accounts, id) ? db().accounts[id] : null;
  const isAdmin = (account) =>
    Boolean(options.adminEmails?.includes(account.email));
  const vocabulary = () =>
    [...new Set([...defaultVocabulary, ...(db().approvedTags || [])])].sort();
  // The eligible directory for the viewer's role, as used by match suggestions.
  // Mentors in a decline cooldown with this founder are left out: the founder
  // can't ask them again yet, so suggesting them would be a dead end.
  const alertPeople = (state) =>
    state.role === "mentor"
      ? state.directory.mentorStartups
      : [
          ...state.directory.founders,
          ...state.directory.mentors.filter((person) => !person.cooldownUntil),
        ];
  function notifications(account, state, time = now(), rawRequests = false) {
    const activity = state.activity
      .filter((item) => item.role === state.role)
      .map((item) => ({
        ...item,
        kind: item.kind || "activity",
        self:
          item.self ?? /^(You\b|Milestone due date updated)/.test(item.text),
      }));
    const items = rawRequests ? activity : requestDigestUpdates(activity, time);
    const add = (id, text, roomId, kind, matchId, timing = {}) =>
      items.push({
        id,
        text,
        roomId,
        kind,
        matchId,
        timestamp:
          account.notificationCreatedAt?.[`${state.role}:${id}`] ||
          new Date(time).toISOString(),
        generated: true,
        ...timing,
        role: state.role,
      });
    for (const alert of account.matchAlerts?.[state.role] || []) {
      const baseline = new Set(alert.baseline || []);
      for (const person of alertPeople(state))
        if (
          !baseline.has(person.id) &&
          offersNeed(person, alert.need, vocabulary())
        )
          add(
            `match-alert:${alert.need.toLowerCase()}:${person.id}`,
            `${person.name} offers ${alert.need}.`,
            null,
            "match",
            person.id,
          );
    }
    for (const person of alertPeople(state)) {
      if (person.score >= 70)
        add(
          `match:${person.id}`,
          `${person.name} is a ${person.score}% profile fit.`,
          null,
          "match",
          person.id,
        );
    }
    if (
      state.role === "mentor" &&
      profileCompleteness(state.profiles.mentor, "mentor") === 100
    ) {
      const mentor = state.profiles.mentor;
      const guidelines = guidelinesStatus(mentor, time, mentorSettings());
      const version = mentorSettings().guidelinesVersion;
      const settingsLink = { page: "settings" };
      if (guidelines.status !== "accepted") {
        const until = guidelines.graceUntil
          ? new Date(guidelines.graceUntil).toLocaleDateString("en", {
              day: "numeric",
              month: "short",
            })
          : "";
        add(
          `guidelines-required:${version}`,
          guidelines.status === "grace"
            ? `Accept the mentor guidelines by ${until} to keep receiving requests.`
            : "Accept the mentor guidelines to start receiving requests.",
          null,
          "guidelines-required",
          null,
          settingsLink,
        );
        if (
          guidelines.status === "grace" &&
          Date.parse(guidelines.graceUntil) - time <= 3 * 86400000
        )
          add(
            `guidelines-required:${version}:ending`,
            `3 days or less left to accept the mentor guidelines. Requests stop after ${until} until you do.`,
            null,
            "guidelines-required",
            null,
            settingsLink,
          );
      }
      const usage = state.mentorUsage;
      if (
        ["mentee-limit", "async-limit", "hours-limit"].includes(usage?.reason)
      )
        add(
          `capacity:${usage.reason}:${new Date(time).toISOString().slice(0, 7)}`,
          usage.reason === "mentee-limit"
            ? `You've reached ${usage.activeMentees} of ${usage.capacity.maxMentees} mentees. New session requests are paused until a slot opens.`
            : ownUnavailableText(usage.reason),
          null,
          "capacity",
          null,
          settingsLink,
        );
    }
    for (const room of Object.values(state.rooms).filter(
      (room) => room.role === state.role,
    )) {
      if (room.status === "launched" && !room.review.me) {
        const deadline = reviewDeadline(room, options.reviewWindowMs);
        const left = deadline ? Date.parse(deadline) - time : null;
        add(
          `review:${room.id}`,
          `Your completed collaboration is ready for a review.${deadline ? ` Reviews close on ${new Date(deadline).toLocaleDateString("en", { day: "numeric", month: "short" })}.` : ""}`,
          room.id,
          "review",
        );
        for (const day of [7, 12])
          if (left !== null && left <= (14 - day) * 86400000 && left > 0)
            add(
              `review-remind:${room.id}:${day}`,
              `Reminder: ${Math.ceil(left / 86400000)} days left to review your collaboration.`,
              room.id,
              "review",
            );
      }
      if (terminalStatuses.includes(room.status)) continue;
      if (room.cycle?.phase === "review") {
        const cycle = room.cycle;
        if (
          !cycle.reviews[account.id] ||
          (cycle.reviews[room.partnerAccountId] && !cycle.decisions[account.id])
        )
          add(
            `cycle:${room.id}:${cycle.number}:${cycle.reviews[account.id] ? "decision" : "review"}`,
            cycle.reviews[account.id]
              ? "Choose Continue or Finish for your mentorship cycle."
              : "Your mentorship cycle is ready for a private review.",
            room.id,
            "confirmation",
            null,
            { tab: "milestones" },
          );
      }
      if (room.terms.locked && !room.terms.confirmedByMe)
        add(
          `terms:${room.id}:${room.terms.revision || 0}`,
          "Review your collaborator's proposed terms.",
          room.id,
          "confirmation",
        );
      for (const [id, item] of Object.entries(room.milestones)) {
        if (item.proposal && item.proposal.proposedBy !== account.id)
          add(
            `revision:${room.id}:${id}:${item.proposal.id}`,
            `Review the proposed revision: ${item.title}.`,
            room.id,
            "confirmation",
            null,
            { tab: "milestones" },
          );
        if (item.partner && !item.me)
          add(
            `confirm:${room.id}:${id}:${item.attachment || ""}`,
            `Your confirmation is needed: ${item.title}.`,
            room.id,
            "confirmation",
            null,
            { tab: "milestones" },
          );
        if (item.dueDate && !(item.me && item.partner)) {
          const remaining = Date.parse(`${item.dueDate}T23:59:59Z`) - time;
          if (remaining < 3 * 86400000)
            add(
              `due:${room.id}:${id}:${item.dueDate}:${remaining < 0 ? "late" : remaining < 86400000 ? "1" : "3"}`,
              `${item.title} is ${remaining < 0 ? "overdue" : remaining < 86400000 ? "due within a day" : "due within 3 days"}.`,
              room.id,
              "reminder",
              null,
              { dueAt: `${item.dueDate}T23:59:59Z`, tab: "milestones" },
            );
        }
        for (const schedule of item.schedules ||
          (item.schedule ? [item.schedule] : [])) {
          const remaining = scheduleInstant(schedule).getTime() - time;
          if (remaining > 0 && remaining <= 86400000)
            add(
              `session:${room.id}:${schedule.date}:${schedule.time}`,
              "Your mentorship session starts within 24 hours.",
              room.id,
              "reminder",
              null,
              {
                sessionAt: scheduleInstant(schedule).toISOString(),
                tab: "schedule",
              },
            );
        }
      }
      if (
        time -
          Date.parse(
            room.updatedAt || room.createdAt || new Date(time).toISOString(),
          ) >
        14 * 86400000
      )
        add(
          `quiet:${room.id}:${room.updatedAt}`,
          "This collaboration has been quiet for two weeks. Check in with your partner.",
          room.id,
          "reminder",
        );
    }
    for (const room of Object.values(state.rooms)) {
      if (!isMentorRoom(room) || room.role !== state.role) continue;
      const followup = followupEngagement(room)?.followup;
      if (room.role === "founder" && followup && !followup.submittedAt)
        for (const day of mentorSettings().followupRemindDays)
          if (time >= Date.parse(followup.heldAt) + day * dayMs)
            add(
              `followup-due:${room.id}:${day}`,
              "Share what happened after your mentorship session.",
              room.id,
              "followup-due",
              undefined,
              { tab: "overview" },
            );
      if (room.status === "cancelled") continue;
      for (const [index, session] of mentorSessions(room).entries()) {
        if (session.cancelledAt || session.outcome) continue;
        const starts = scheduleInstant(session).getTime();
        const ends = starts + session.durationMinutes * 60000;
        const base = `${room.id}:${session.id || index}`;
        const sessionLink = {
          tab: "schedule",
          sessionAt: new Date(starts).toISOString(),
        };
        for (const [hours, label] of [
          [24, "tomorrow"],
          [1, "in one hour"],
        ])
          if (time >= starts - hours * hourMs && time < starts)
            add(
              `session-reminder:${base}:${hours}`,
              `Your mentorship session starts ${label}. Check your schedule and prep materials.`,
              room.id,
              "session-reminder",
              undefined,
              { ...sessionLink, reminderHours: hours },
            );
        if (
          !room.mentorship.prep?.sharedAt &&
          room.role === "founder" &&
          time >= starts - 26 * hourMs &&
          time < starts
        )
          add(
            `prep-missing:${base}`,
            "Share your deck, metrics or links before your session.",
            room.id,
            "prep-missing",
            undefined,
            { tab: "overview" },
          );
        if (!session.attendance?.[room.role] && time >= ends) {
          add(
            `attendance-needed:${base}`,
            "Report attendance for your mentorship session.",
            room.id,
            "attendance-needed",
            undefined,
            sessionLink,
          );
          if (time >= ends + 48 * hourMs)
            add(
              `attendance-needed:${base}:48`,
              "We still need your mentorship attendance report.",
              room.id,
              "attendance-needed",
              undefined,
              sessionLink,
            );
        }
      }
      const review = room.mentorship;
      if (
        review.reviewOpenedAt &&
        !room.review.me &&
        !room.review.windowClosed
      ) {
        add(
          `review-open:${room.id}:${review.reviewOpenedAt}`,
          "Your private mentorship review is open.",
          room.id,
          "review-open",
          undefined,
          { review: true },
        );
        if (time >= Date.parse(review.reviewClosesAt) - 3 * dayMs)
          add(
            `review-open:${room.id}:${review.reviewOpenedAt}:closing`,
            "Your private mentorship review closes soon.",
            room.id,
            "review-open",
            undefined,
            { review: true },
          );
      }
    }
    // Introductions that need a reply expire after 14 days; remind at day 7.
    for (const [id, meta] of Object.entries(
      state.introductionMetaByRole?.[state.role] || {},
    )) {
      if (!state.incomingByRole[state.role].has(id)) continue;
      if (meta.kind) {
        const expiry = Date.parse(meta.expiresAt);
        const window = expiry - Date.parse(meta.sentAt);
        if (time >= expiry - Math.min(86400000, window / 2) && time < expiry) {
          add(
            `request-expiring:${meta.id}`,
            `${meta.name}'s mentorship request is expiring soon.`,
            null,
            "request-expiring",
            undefined,
            { page: "requests", requestId: meta.id },
          );
        }
        continue;
      }
      const age = time - Date.parse(meta.sentAt || time);
      if (age >= 7 * 86400000)
        add(
          `intro-remind:${id}:${meta.sentAt}`,
          `${meta.name}'s introduction expires in ${Math.max(1, Math.ceil((14 * 86400000 - age) / 86400000))} days.`,
          null,
          "reminder",
          id,
        );
    }
    if (state.isAdmin) {
      const overdue = approvalQueue().filter((item) => item.overdue).length;
      if (overdue)
        add(
          `approval-queue:${new Date(time).toISOString().slice(0, 10)}`,
          `${overdue} mentor ${overdue === 1 ? "application is" : "applications are"} past the approval target.`,
          null,
          "approval-queue",
          undefined,
          { page: "moderation" },
        );
    }
    const trust = state.trustSummary?.mentorship;
    for (const badge of trust?.badges || [])
      add(
        `badge:${badge}`,
        `You earned the ${badge} badge.`,
        null,
        "badge",
        undefined,
        { page: state.role === "mentor" ? "impact" : "profile" },
      );
    const read = new Set(account.readNotifications || []);
    const prefs = {
      ...defaultPreferences,
      ...(account.notificationPreferences || {}),
    };
    const category = (item) =>
      item.kind === "match"
        ? "match"
        : ["reminder", "prep-missing"].includes(item.kind)
          ? "reminders"
          : [
                "confirmation",
                "review",
                "review-release",
                "request",
                "request-digest",
                "payment-due",
                "payment-lapsed",
                "payment-received",
                "payout-released",
                "refund",
                "payment-dispute",
                "request-expiring",
                "session-reminder",
                "attendance-needed",
                "session-disputed",
                "accepted",
                "declined",
                "expired",
                "referred",
                "returned",
                "check-in-time",
                "followup-due",
                "mentor-approved",
                "mentor-rejected",
                "approval-queue",
                "guidelines-required",
                "mentor-suspended",
                "mentor-reinstated",
                "mentor-unavailable",
                "no-show-limit",
                "limit-lifted",
                "slot-closed",
                "booking",
              ].includes(item.kind)
            ? "action"
            : "activity";
    return items
      .map((item) => {
        const group = category(item);
        // Actions that need a reply are never muted or folded into a digest.
        const muted = group !== "action" && prefs[group] === false;
        const digested =
          group !== "action" &&
          !muted &&
          prefs.digest !== "off" &&
          group !== "reminders";
        return {
          ...item,
          category: group,
          muted,
          digested,
          read: read.has(item.id) || Boolean(item.self) || muted || digested,
        };
      })
      .sort(
        (a, b) =>
          (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0),
      );
  }
  // Called only at the response boundary, after successful commands. Preparing
  // data for validation remains read-only; repeated polls do not write again.
  function collectMentorshipEmail(account, items) {
    let changed = false;
    for (const item of items) {
      if (item.self || Date.parse(item.timestamp) < now() - 7 * dayMs) continue;
      if (queueMentorEmail(db(), account, item, mentorSettings(), now()))
        changed = true;
    }
    return changed;
  }

  function scheduledEmails(account) {
    let changed = false;
    for (const role of ["founder", "mentor"]) {
      const state = { ...account.state, role };
      if (
        collectMentorshipEmail(
          account,
          notifications(account, state, now(), true),
        )
      )
        changed = true;
    }
    return changed;
  }

  function rememberNotifications(account, state) {
    let changed = false;
    for (const item of state.notifications || []) {
      if (!item.generated) continue;
      const key = `${state.role}:${item.id}`;
      if (account.notificationCreatedAt?.[key]) continue;
      account.notificationCreatedAt ||= {};
      account.notificationCreatedAt[key] = item.timestamp;
      changed = true;
    }
    if (options.emailProvider === "brevo")
      return (
        collectMentorshipEmail(account, [
          ...(state.notifications || []).filter(
            (item) => item.kind !== "request",
          ),
          ...account.state.activity.filter(
            (item) => item.role === state.role && item.kind === "request",
          ),
        ]) || changed
      );
    for (const item of state.notifications || []) {
      if (item.self || item.muted || item.digested) continue;
      changed =
        enqueueDelivery(
          db(),
          {
            key: `${account.id}:${state.role}:${item.id}`,
            accountId: account.id,
            kind: item.kind,
            payload: {
              text: item.text,
              roomId: item.roomId,
              matchId: item.matchId,
            },
          },
          now(),
        ) || changed;
    }
    const prefs = state.notificationPreferences;
    if (prefs?.digest !== "off") {
      const span = (prefs.digest === "daily" ? 1 : 7) * 86400000;
      const period = Math.floor(now() / span);
      const items = state.notifications.filter(
        (item) => item.digested && now() - Date.parse(item.timestamp) <= span,
      );
      if (items.length)
        changed =
          enqueueDelivery(
            db(),
            {
              key: `${account.id}:${state.role}:digest:${prefs.digest}:${period}`,
              accountId: account.id,
              kind: "digest",
              payload: {
                items: items.map(({ text, matchId, roomId }) => ({
                  text,
                  matchId,
                  roomId,
                })),
              },
              availableAt: new Date((period + 1) * span).toISOString(),
            },
            now(),
          ) || changed;
    }
    return changed;
  }
  function decorate(account, state) {
    state.isAdmin = isAdmin(account);
    state.vocabulary = vocabulary();
    // Saved moderator edits win; room types added later keep their defaults.
    state.engagementTemplates = {
      ...defaultTemplates,
      ...db().engagementTemplates,
    };
    state.matchingConfig = db().matchingConfig || defaultMatching;
    state.mentorEmailStatus = account.emailDeliveryStatus || null;
    state.notificationPreferences = {
      ...defaultPreferences,
      mentorRequestEmail: "daily",
      mentorEmailKinds: {},
      ...(account.notificationPreferences || {}),
    };
    state.matchAlerts = (account.matchAlerts?.[state.role] || []).map(
      ({ need, since }) => ({ need, since }),
    );
    state.myTagProposals = (db().tagProposals || [])
      .filter((tag) => tag.accountId === account.id)
      .map(({ id, label, status, note }) => ({ id, label, status, note }));
    state.affiliation = account.affiliation || null;
    state.mentorConfig = mentorSettings();
    state.trustSummary = trustSummary(state.rooms, state.role, now(), {
      requests: account.state?.mentorRequestsByRole?.[state.role] || [],
      pending: state.role === "mentor" ? state.incomingByRole.mentor.size : 0,
      approved: state.role === "mentor" && mentorApproved(account),
      config: mentorSettings(),
    });
    state.notifications = notifications(account, state);
    if (state.isAdmin)
      state.moderation = {
        matchingReport: matchingReport(db().accounts),
        reports: db().reports.map((report) => {
          const room =
            db().accounts[report.accountId]?.state.rooms[report.roomId];
          const reporter = accountById(report.accountId);
          const reported = accountById(report.reportedAccountId);
          const roleOf = (profileId) =>
            String(profileId || "").endsWith(":mentor") ? "mentor" : "founder";
          return {
            ...report,
            dueAt: report.dueAt || moderationDueAt(report.timestamp),
            overdue:
              !["resolved", "dismissed"].includes(report.status) &&
              now() >
                Date.parse(report.dueAt || moderationDueAt(report.timestamp)),
            reporterName: reporter
              ? displayName(reporter, roleOf(report.reporterProfileId))
              : "",
            reportedName: reported
              ? displayName(reported, roleOf(report.reportedProfileId))
              : "",
            context: room
              ? {
                  type: room.engagementType,
                  goal: room.terms.draft.goal,
                  milestones: Object.values(room.milestones).map((item) => ({
                    title: item.title,
                    disputed: item.disputed,
                    attachment: item.attachment,
                    file: item.file,
                  })),
                  messages: room.messages
                    .slice(-20)
                    .map(({ name, text }) => ({ name, text })),
                }
              : null,
          };
        }),
        tags: (db().tagProposals || []).map((tag) => ({
          ...tag,
          dueAt: moderationDueAt(tag.createdAt),
          overdue:
            tag.status === "pending" &&
            now() > Date.parse(moderationDueAt(tag.createdAt)),
        })),
        affiliations: Object.values(db().accounts)
          .filter((a) => a.affiliation?.status === "pending")
          .map((a) => ({
            accountId: a.id,
            name: a.state.accountName,
            ...a.affiliation,
            dueAt:
              a.affiliation.dueAt ||
              moderationDueAt(
                a.affiliation.requestedAt || new Date(now()).toISOString(),
              ),
            overdue:
              now() >
              Date.parse(
                a.affiliation.dueAt ||
                  moderationDueAt(
                    a.affiliation.requestedAt || new Date(now()).toISOString(),
                  ),
              ),
          })),
        accounts: Object.values(db().accounts).map((a) => ({
          id: a.id,
          name: a.state.accountName,
          email: a.email,
          suspended: Boolean(a.suspended),
          mentor:
            a.state.role === "mentor" ||
            a.state.bothRoles ||
            Boolean(a.state.profiles.mentor.mentorApprovedAt),
          mentorSuspension: a.mentorSuspension || null,
        })),
        sessionDisputes: Object.values(db().accounts).flatMap((owner) =>
          Object.values(owner.state.rooms)
            .filter((room) => isMentorRoom(room) && room.role === "mentor")
            .flatMap((room) =>
              mentorSessions(room).flatMap((session, index) =>
                session.outcome === "disputed"
                  ? [
                      {
                        accountId: owner.id,
                        roomId: room.id,
                        scheduleId: session.id,
                        index,
                        attendance: session.attendance,
                        startsAt: session.startsAt,
                        mentor: owner.state.accountName,
                        founder:
                          accountById(room.partnerAccountId)?.state
                            .accountName || "Founder",
                      },
                    ]
                  : [],
              ),
            ),
        ),
        mentorApprovals: approvalQueue(),
        mentorSafety: mentorSafetyQueue(),
        mentoring: mentorAdmin?.(),
        moderators: options.adminEmails || [],
        audit: (db().moderationAudit || []).slice(-100).reverse(),
      };
    else delete state.moderation;
    return state;
  }
  const actions = new Set([
    "reopen-terms",
    "accept-reopen",
    "decline-reopen",
    "close-room",
    "read-notifications",
    "withdraw-dispute",
    "escalate-dispute",
    "send-back",
    "nudge-partner",
    "undo-launch",
    "cycle-decision",
  ]);
  const forms = new Set([
    "task-create",
    "task-update",
    "task-delete",
    "close-room",
    "milestone-date",
    "tag-proposal",
    "affiliation-request",
    "moderation",
    "milestone-proposal",
    "milestone-decision",
    "engagement-template",
    "matching-config",
    "notification-preferences",
    "match-alert",
    "mentor-config",
    "mentorship-survey",
    "send-back",
    "cycle-details",
    "cycle-review",
    ...mentoringForms,
  ]);
  // Returns every pending request to a mentor who turned on Pause Mode. The
  // founder keeps a "returned" history entry with similar available mentors,
  // and the return never counts against the mentor's response rate.
  function returnPendingRequests(account, state) {
    const structuredCount =
      returnMentorRequests?.(account, state, "mentor-paused") || 0;
    const mentorId = `${account.id}:mentor`;
    const mentorName = displayName(account, "mentor");
    // Alternatives are worked out before anything changes, so a save during
    // those reads can never store a half-returned request.
    const pending = [...state.incomingByRole.mentor].map((id) => {
      const [otherId, otherRole] = id.split(":");
      const other = accountById(otherId);
      const alternatives = other ? similarMentors(other, mentorId) : [];
      return { id, other, otherRole, alternatives };
    });
    for (const { id, other, otherRole, alternatives } of pending) {
      const meta = state.introductionMetaByRole?.mentor?.[id];
      state.incomingByRole.mentor.delete(id);
      delete state.introductionMetaByRole?.mentor?.[id];
      delete state.introductionTypesByRole?.mentor?.[id];
      keepHistory(state, "mentor", {
        id,
        name: meta?.name || "Founder",
        status: "returned",
        reason: "mentor-paused",
        direction: "received",
      });
      if (!other) continue;
      other.state.waitingByRole[otherRole]?.delete(mentorId);
      other.state.interestByRole[otherRole]?.delete(mentorId);
      delete other.state.introductionMetaByRole?.[otherRole]?.[mentorId];
      delete other.state.introductionTypesByRole?.[otherRole]?.[mentorId];
      keepHistory(other.state, otherRole, {
        id: mentorId,
        name: mentorName,
        status: "returned",
        reason: "mentor-paused",
        direction: "sent",
        alternatives,
      });
      const names = alternatives.map((item) => item.name);
      event(
        other,
        otherRole,
        `${mentorName} paused new mentoring requests, so your request was returned.${names.length ? ` You could ask ${names.join(", ").replace(/, ([^,]*)$/, " or $1")} instead.` : ""}`,
        undefined,
        { kind: "confirmation", page: "discover" },
      );
    }
    return structuredCount + pending.length;
  }
  function mentoringSettings(account, state, input, values, text) {
    if (state.role !== "mentor")
      fail("Switch to your mentor profile to change mentoring settings.");
    const mentor = state.profiles.mentor;
    const stamp = new Date(now()).toISOString();
    if (input.form === "accept-guidelines") {
      if (Number(values.version) !== mentorSettings().guidelinesVersion)
        fail(
          "The guidelines have been updated. Refresh to read the latest version.",
          409,
        );
      mentor.guidelinesVersion = mentorSettings().guidelinesVersion;
      mentor.guidelinesAcceptedAt = stamp;
      state.toast = "Mentor guidelines accepted.";
    } else if (input.form === "set-mentor-pause") {
      if (Date.parse(state.mentorshipLimits?.mentor || "") > now())
        fail(
          "Pause Mode stays on until the attendance limit ends or a moderator lifts it.",
          409,
        );
      const paused = values.paused === "on";
      const until = text("pausedUntil");
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: validTimeZone(mentor.timeZone) ? mentor.timeZone : "UTC",
      }).format(now());
      if (
        paused &&
        until &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(until) ||
          Number.isNaN(Date.parse(until)) ||
          until <= today)
      )
        fail("Choose a resume date after today, or leave it empty.", 400, {
          pausedUntil: "Choose a date after today.",
        });
      if (paused && !mentor.paused) {
        Object.assign(mentor, {
          paused: true,
          pausedAt: stamp,
          pausedUntil: until || null,
        });
        const returned = returnPendingRequests(account, state);
        state.toast = `Pause Mode is on. Your current mentees are not affected.${returned ? ` ${returned} pending ${returned === 1 ? "request was" : "requests were"} returned to founders with other mentors to ask.` : ""}`;
      } else if (paused) {
        mentor.pausedUntil = until || null;
        state.toast = until
          ? "Resume date saved."
          : "Resume date removed. Pause Mode stays on until you turn it off.";
      } else {
        const wasPaused = mentor.paused;
        Object.assign(mentor, {
          paused: false,
          pausedAt: null,
          pausedUntil: null,
        });
        state.toast = wasPaused
          ? "Pause Mode is off. Founders can send you requests again."
          : "Pause Mode is off.";
      }
    } else if (input.form === "mentor-capacity") {
      const { errors, capacity } = capacityErrors(values);
      const formats = normalizeOfferedFormats(
        mentorFormatIds
          .filter((id) => values[`format-${id}`] === "on")
          .map(
            (id) =>
              mentor.formats.find((item) => item.id === id) || { id, price: 0 },
          ),
        mentor.payoutSetup?.status === "ready",
      );
      if (!formats.length)
        errors.formats = "Formats you offer: keep at least one selected.";
      const timeZone = text("timeZone");
      if (Object.keys(errors).length)
        fail(capacityErrorMessage(errors), 400, errors);
      validateOfficeHours?.(state, capacity);
      Object.assign(mentor, { capacity, formats, timeZone });
      if (mentor.preferredHours) mentor.preferredHours.timeZone = timeZone;
      state.toast = "Mentoring settings saved.";
    } else {
      const op = text("op");
      mentor.conflicts ||= [];
      if (op === "add") {
        const company = text("company").slice(0, 100);
        const relation = text("relation");
        const industry = text("industry").slice(0, 60);
        const errors = {};
        if (company.length < 2) errors.company = "Enter the company name.";
        if (!conflictRelations.some(([value]) => value === relation))
          errors.relation = "Choose how you're connected.";
        if (Object.keys(errors).length)
          fail("Check the conflict details.", 400, errors);
        if (mentor.conflicts.length >= 50)
          fail("You can list up to 50 conflicts.");
        mentor.conflicts.push({
          id: randomUUID(),
          company,
          relation,
          industry,
        });
        mentor.noConflicts = false;
        state.toast = `${company} added to your conflicts of interest.`;
      } else if (op === "remove") {
        const item = mentor.conflicts.find((entry) => entry.id === text("id"));
        if (!item) fail("This conflict is no longer listed.", 404);
        mentor.conflicts = mentor.conflicts.filter((entry) => entry !== item);
        state.toast = `${item.company} removed from your conflicts of interest.`;
      } else if (op === "none") {
        if (mentor.conflicts.length)
          fail("Remove your listed conflicts before confirming you have none.");
        mentor.noConflicts = true;
        state.toast = "Saved: you have no conflicts of interest.";
      } else fail("This action is unavailable.");
    }
  }
  function act(token, input) {
    const account = authenticate(token);
    if (!["founder", "mentor"].includes(input.role))
      fail("Choose a valid role.");
    if (Boolean(input.action) === Boolean(input.form))
      fail("Submit one action or form at a time.");
    const state = prepare(account, input.role);
    if (mentorRequestActions.has(input.action)) {
      state.toast = "";
      state.confirmation = "";
      state.formErrors = null;
      mentorRequestAction(account, state, input);
      state.directory = createInitialState().directory;
      account.state = state;
      save();
      return response(account, input.role);
    }
    const values = input.values || {};
    if (!values || typeof values !== "object" || Array.isArray(values))
      fail("Invalid form values.");
    const text = (key) =>
      String(values[key] || "")
        .trim()
        .slice(0, 3000);
    const room = state.rooms[input.activeRoomId];
    const roomAction =
      [
        "reopen-terms",
        "accept-reopen",
        "decline-reopen",
        "close-room",
        "withdraw-dispute",
        "escalate-dispute",
        "send-back",
        "nudge-partner",
        "undo-launch",
        "cycle-decision",
      ].includes(input.action) ||
      input.form === "send-back" ||
      [
        "task-create",
        "task-update",
        "task-delete",
        "close-room",
        "milestone-date",
        "milestone-proposal",
        "milestone-decision",
        "cycle-details",
        "cycle-review",
      ].includes(input.form);
    if (roomAction && (!room || room.role !== input.role))
      fail("This room is unavailable for your account and role.", 404);
    if (
      roomAction &&
      room.cycle?.phase === "review" &&
      Object.keys(room.cycle.reviews).length &&
      [
        "reopen-terms",
        "accept-reopen",
        "send-back",
        "withdraw-dispute",
        "escalate-dispute",
        "milestone-date",
        "milestone-proposal",
        "milestone-decision",
      ].includes(input.action || input.form)
    )
      fail(
        "Cycle work is locked after a private cycle review. Choose Continue or Finish after both reviews.",
      );
    if (
      roomAction &&
      terminalStatuses.includes(room.status) &&
      input.action !== "undo-launch"
    )
      fail("Completed or closed collaborations cannot be changed.");
    state.toast = "";
    state.toastType = "success";
    state.toastTitle = "";
    state.formErrors = null;
    state.confirmation = "";
    if (mentoringForms.has(input.form)) {
      mentoringSettings(account, state, input, values, text);
    } else if (input.action === "undo-launch") {
      if (
        room.status !== "launched" ||
        !room.launchedAt ||
        now() - Date.parse(room.launchedAt) >= 86400000 ||
        room.review.me ||
        room.review.partner
      )
        fail(
          "Undo is available for 24 hours after completion, before either review is submitted.",
        );
      room.status = "in-progress";
      delete room.launchedAt;
      delete room.finishingCycles;
      // Reopen the final confirmation so a later action can complete the room again.
      const last = Object.values(room.milestones).at(-1);
      last.me = last.partner = false;
      if (room.cycle) {
        room.cycle.phase = "active";
        room.cycle.decisions = {};
      }
      state.toast = "Completion undone. Review the final milestone together.";
    } else if (
      ["cycle-details", "cycle-review", "cycle-decision"].includes(
        input.form || input.action,
      )
    ) {
      if (!ongoingMentorship(room) || !room.terms.partnerLocked)
        fail("Agree ongoing mentorship terms first.");
      const cycle = ensureCycle(room, now());
      if (input.form === "cycle-details") {
        if (Object.keys(cycle.reviews).length)
          fail("Cycle details are locked after a review is submitted.");
        if (cycle.phase === "review" && text("goals") !== cycle.goals)
          fail("Cycle goals are locked during review.");
        if (!text("goals")) fail("Add goals for this cycle.");
        if (cycle.goals !== text("goals"))
          for (const item of Object.values(room.milestones))
            item.me = item.partner = false;
        cycle.goals = text("goals");
        cycle.summary = text("summary");
        state.toast = "Cycle goals and check-in summary saved.";
      } else if (input.form === "cycle-review") {
        if (cycle.phase !== "review" || !cycle.summary)
          fail(
            "Complete the cycle milestones and add a check-in summary before reviewing.",
          );
        if (cycle.reviews[account.id])
          fail("Your cycle review is already submitted.");
        const rating = Number(values.rating);
        if (![1, 2, 3, 4, 5].includes(rating))
          fail("Choose a rating from 1 to 5.");
        cycle.reviews[account.id] = {
          rating,
          note: text("note"),
          at: new Date(now()).toISOString(),
        };
        state.toast =
          "Private cycle review submitted. Feedback is released when both reviews are in.";
      } else {
        if (!cycle.reviews[account.id] || !cycle.reviews[room.partnerAccountId])
          fail("Both private cycle reviews are needed before deciding.");
        const decision = text("decision");
        if (!["continue", "finish"].includes(decision))
          fail("Choose Continue or Finish.");
        cycle.decisions[account.id] = decision;
        const result = resolveCycleDecisions(room, now());
        if (result === "finish") advanceRoom(account, state, room);
        else if (result === "continue")
          state.toast = `Cycle ${room.cycle.number} started. Agree new goals and sessions.`;
        else
          state.toast =
            "Decision saved. Waiting for your partner to choose Continue or Finish.";
      }
    } else if (
      ["engagement-template", "matching-config"].includes(input.form)
    ) {
      if (!isAdmin(account)) fail("Moderator access required.", 403);
      if (input.form === "engagement-template") {
        const id = text("type");
        if (id === "mentorship")
          fail("Mentorship templates follow the format definitions.", 409);
        const current = { ...defaultTemplates, ...db().engagementTemplates }[
          id
        ];
        if (!Object.hasOwn(defaultTemplates, id) || !current)
          fail("Choose a valid room type.");
        if (Number(values.version) !== current.version)
          fail(
            "This template changed. Refresh and review it before saving.",
            409,
          );
        const name = text("name");
        if (!name || name.length > 100)
          fail("Use a template name of 1–100 characters.");
        const milestones = current.milestones.map((item) => {
          const title = text(`title-${item.id}`),
            description = text(`description-${item.id}`);
          if (
            !title ||
            title.length > 120 ||
            !description ||
            description.length > 2000
          )
            fail(
              "Each milestone needs a title (up to 120 characters) and scope (up to 2,000 characters).",
            );
          return {
            id: item.id,
            title,
            description,
            evidence: values[`evidence-${item.id}`] === "on",
          };
        });
        db().engagementTemplates = structuredClone({
          ...defaultTemplates,
          ...db().engagementTemplates,
        });
        db().engagementTemplates[id] = {
          id,
          name,
          version: current.version + 1,
          fields: current.fields || defaultTemplates[id]?.fields || [],
          milestones,
        };
        state.toast = "Template saved. New rooms will use this version.";
      } else {
        const current = db().matchingConfig || defaultMatching;
        if (Number(values.version) !== current.version)
          fail("Matching weights changed. Refresh before saving.", 409);
        const config = { version: current.version + 1 };
        for (const kind of ["founder", "mentor"]) {
          const weights = Array.from({ length: weightCount[kind] }, (_, i) =>
            Number(values[`${kind}-${i}`]),
          );
          if (
            weights.some(
              (w, i) =>
                !String(values[`${kind}-${i}`] ?? "").trim() ||
                !Number.isFinite(w) ||
                w < 0 ||
                w > 100,
            ) ||
            Math.abs(weights.reduce((a, b) => a + b, 0) - 100) > 0.001 ||
            (kind === "founder" && weights[1] !== 0)
          )
            fail(
              "Weights must be between 0 and 100 and total 100 for each role; founder expertise remains zero.",
            );
          config[kind] = weights.map((w) => w / 100);
        }
        db().matchingConfig = config;
        state.toast =
          "Matching weights saved as a new version. Earlier room scores are preserved.";
      }
      (db().moderationAudit ||= []).push({
        id: randomUUID(),
        moderator: account.email,
        kind: input.form,
        targetId: text("type") || "weights",
        decision: "updated",
        note: state.toast,
        timestamp: new Date().toISOString(),
      });
    } else if (
      input.form === "milestone-proposal" ||
      input.form === "milestone-decision"
    ) {
      if (!Object.hasOwn(room.milestones, input.id))
        fail("This milestone is unavailable.", 404);
      const item = room.milestones[input.id];
      if (input.form === "milestone-proposal") {
        if (item.proposal)
          fail(
            "Resolve or withdraw the current proposal before proposing another revision.",
            409,
          );
        if (Number(values.revision) !== (item.revision || 0))
          fail(
            "This milestone changed. Review the latest scope before proposing a revision.",
            409,
          );
        const title = text("title"),
          description = text("description");
        if (
          !title ||
          title.length > 120 ||
          !description ||
          description.length > 2000
        )
          fail(
            "Add a title (up to 120 characters) and scope (up to 2,000 characters).",
          );
        if (title === item.title && description === item.description)
          fail("Change the title or scope before proposing a revision.");
        item.proposal = {
          id: randomUUID(),
          title,
          description,
          proposedBy: account.id,
          proposedAt: new Date().toISOString(),
        };
        state.toast =
          "Revision proposed. Your collaborator must approve it before the milestone changes.";
      } else {
        const proposal = item.proposal;
        if (!proposal || values.proposalId !== proposal.id)
          fail("This proposal changed. Review the latest revision.", 409);
        const mine = proposal.proposedBy === account.id;
        const decision = text("decision");
        if (
          !(["accept", "reject"].includes(decision) && !mine) &&
          !(decision === "withdraw" && mine)
        )
          fail(
            "Only the other collaborator can accept or reject a revision.",
            403,
          );
        (item.revisions ||= []).push({
          ...proposal,
          previousTitle: item.title,
          previousDescription: item.description,
          decision,
          decidedBy: account.id,
          decidedAt: new Date().toISOString(),
        });
        if (decision === "accept") {
          Object.assign(item, {
            title: proposal.title,
            description: proposal.description,
            revision: (item.revision || 0) + 1,
            me: false,
            partner: false,
          });
          room.progress = roomProgress(room);
        }
        delete item.proposal;
        state.toast =
          decision === "accept"
            ? "Revision accepted. Evidence is preserved; both collaborators must reconfirm this milestone."
            : `Revision ${decision === "reject" ? "rejected" : "withdrawn"}. The agreed milestone is unchanged.`;
      }
    } else if (input.action === "reopen-terms") {
      if (!room.terms.locked) fail("These terms are already a draft.");
      if (room.terms.reopenRequest)
        fail("A request to change the terms is already waiting.");
      room.terms.reopenRequest = {
        byAccountId: account.id,
        at: new Date().toISOString(),
        note: text("note").slice(0, 500),
      };
      state.toast =
        "Change request sent. The current terms and confirmations stay in place until your collaborator agrees.";
    } else if (input.action === "decline-reopen") {
      if (!room.terms.reopenRequest) fail("There is no change request.");
      const mine = room.terms.reopenRequest.byAccountId === account.id;
      room.terms.reopenRequest = null;
      state.toast = mine
        ? "Change request withdrawn. The agreed terms stay in place."
        : "Change request declined. The agreed terms stay in place.";
    } else if (input.action === "accept-reopen") {
      const request = room.terms.reopenRequest;
      if (!request) fail("There is no change request.");
      if (request.byAccountId === account.id)
        fail("Your collaborator must agree to reopen the terms.", 403);
      room.terms = {
        ...room.terms,
        locked: false,
        partnerLocked: false,
        confirmedByMe: false,
        reopenRequest: null,
        revision: (room.terms.revision || 0) + 1,
      };
      for (const item of Object.values(room.milestones))
        item.me = item.partner = false;
      room.status = "matched";
      room.progress = 0;
      state.toast =
        "Terms reopened. Both collaborators must accept the revised agreement and reconfirm the work.";
    } else if (input.action === "close-room" || input.form === "close-room") {
      const category = Object.hasOwn(closeCategories, text("category"))
        ? text("category")
        : "other";
      if (!text("reason") && category === "other")
        fail("Give a reason for closing this collaboration.");
      room.status = "cancelled";
      room.closedAt = new Date().toISOString();
      room.closeReason = text("reason") || closeCategories[category];
      room.closeCategory = category;
      room.closedByAccountId = account.id;
      state.toast =
        category === "unresponsive"
          ? "Collaboration closed. Because your partner stopped responding, this does not count against your follow-through."
          : "Collaboration closed. Its history remains available.";
    } else if (input.action === "withdraw-dispute") {
      const item = room.milestones[input.id];
      if (!item?.disputed) fail("This milestone has no open dispute.");
      if (item.dispute?.byAccountId && item.dispute.byAccountId !== account.id)
        fail("Only the person who raised the dispute can withdraw it.", 403);
      Object.assign(item, {
        disputed: false,
        dispute: null,
        resolvedByMe: false,
        resolvedByPartner: false,
      });
      state.toast = `Dispute withdrawn. “${item.title}” is back in progress.`;
    } else if (input.action === "escalate-dispute") {
      const item = room.milestones[input.id];
      if (!item?.disputed) fail("This milestone has no open dispute.");
      if (item.dispute?.escalatedAt)
        fail("This dispute is already with a moderator.");
      item.dispute = {
        ...(item.dispute || {}),
        escalatedAt: new Date(now()).toISOString(),
        dueAt: moderationDueAt(new Date(now()).toISOString()),
      };
      db().reports.push({
        id: randomUUID(),
        kind: "dispute",
        dueAt: item.dispute.dueAt,
        accountId: account.id,
        reporterAccountId: account.id,
        reporterProfileId: `${account.id}:${state.role}`,
        reportedAccountId: room.partnerAccountId,
        reportedProfileId: room.partnerId,
        roomId: room.id,
        milestoneId: input.id,
        reason: `Milestone dispute: ${item.title}`,
        details: [
          item.dispute.reason,
          item.dispute.outcome && `Wanted outcome: ${item.dispute.outcome}`,
        ]
          .filter(Boolean)
          .join("\n"),
        timestamp: new Date(now()).toISOString(),
        status: "open",
      });
      state.toast =
        "Sent to a moderator. Moderators aim to decide within 3 business days: confirm the milestone, reopen it, or close the collaboration without penalty.";
    } else if (input.action === "send-back" || input.form === "send-back") {
      const item = room.milestones[input.id];
      if (!item) fail("This milestone is unavailable.", 404);
      if (!item.partner || item.me)
        fail(
          "Only a milestone your collaborator marked done can be sent back.",
        );
      const note = text("note");
      if (!note) fail("Add a short note explaining what is still missing.");
      item.partner = false;
      room.progress = roomProgress(room);
      room.messages.push({
        who: "me",
        name: displayName(account, state.role),
        text: `Not done yet: “${item.title}”. ${note}`,
        timestamp: new Date().toISOString(),
      });
      state.toast = `Sent back. “${item.title}” is in progress again, and your note is in Chat.`;
    } else if (input.action === "nudge-partner") {
      if (
        room.lastNudgeAt &&
        Date.now() - Date.parse(room.lastNudgeAt) < 86400000
      )
        fail("You can send one nudge a day.");
      room.lastNudgeAt = new Date().toISOString();
      state.toast =
        "Nudge sent. Your collaborator was reminded that you are waiting.";
    } else if (
      ["task-create", "task-update", "task-delete"].includes(input.form)
    ) {
      room.tasks ||= [];
      const task = room.tasks.find((item) => item.id === input.id);
      // Mentorship rooms call them action items (Nov 22, round 2).
      const noun = isMentorRoom(room) ? "action item" : "task";
      if (input.form !== "task-create") {
        if (!task)
          fail(
            `This ${noun} is unavailable. Refresh the ${isMentorRoom(room) ? "list" : "board"}.`,
            404,
          );
        if (Number(values.version) !== task.version)
          fail(
            `This ${noun} changed. Review the latest ${isMentorRoom(room) ? "version" : "card"} and try again.`,
            409,
          );
      }
      if (input.form === "task-delete") {
        room.tasks = room.tasks.filter((item) => item.id !== task.id);
        state.toast = isMentorRoom(room)
          ? "Action item deleted."
          : "Task deleted.";
      } else {
        const title = text("title"),
          description = text("description");
        const status = text("status"),
          priority = text("priority");
        const assignee = isMentorRoom(room)
            ? room.role === "founder"
              ? account.id
              : room.partnerAccountId
            : text("assignee"),
          dueDate = text("dueDate");
        const milestoneId = text("milestoneId");
        if (!title || title.length > 160)
          fail(
            `Use ${isMentorRoom(room) ? "an action item" : "a task title"} of 1–160 characters.`,
          );
        if (
          isMentorRoom(room) &&
          room.role !== "founder" &&
          status === "done" &&
          task?.status !== "done"
        )
          fail("Only the founder can mark an action item done.", 403);
        if (!["todo", "doing", "done"].includes(status))
          fail(`Choose a valid ${noun} status.`);
        if (!["low", "normal", "high"].includes(priority))
          fail("Choose a valid priority.");
        if (assignee && ![account.id, room.partnerAccountId].includes(assignee))
          fail(`Assign this ${noun} to a room collaborator.`);
        if (milestoneId && !Object.hasOwn(room.milestones, milestoneId))
          fail("Choose a room milestone.");
        const parsed = new Date(`${dueDate}T12:00:00Z`);
        if (
          dueDate &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
            Number.isNaN(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== dueDate)
        )
          fail(`Choose a valid ${noun} due date.`);
        const fields = {
          title,
          description,
          status,
          priority,
          assignee,
          dueDate,
          milestoneId,
          ...(isMentorRoom(room) && { kind: "action" }),
        };
        if (task) Object.assign(task, fields, { version: task.version + 1 });
        else {
          if (room.tasks.length >= 300)
            fail("This board has reached its 300-task limit.");
          room.tasks.push({
            ...fields,
            id: randomUUID(),
            version: 1,
            createdAt: new Date().toISOString(),
          });
        }
        state.toast = isMentorRoom(room)
          ? task
            ? "Action item updated."
            : "Action item added."
          : task
            ? "Task updated."
            : "Task added to the board.";
      }
      if (isMentorRoom(room))
        setMentorMilestone(
          room,
          "actions",
          room.tasks.some((task) => task.kind === "action"),
        );
    } else if (input.form === "milestone-date") {
      if (!Object.hasOwn(room.milestones, input.id))
        fail("This milestone is unavailable.", 404);
      const item = room.milestones[input.id];
      if (!item) fail("This milestone is unavailable.", 404);
      const date = text("dueDate");
      const parsed = new Date(`${date}T12:00:00Z`);
      if (
        date &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          Number.isNaN(parsed.getTime()) ||
          parsed.toISOString().slice(0, 10) !== date)
      )
        fail("Choose a valid milestone date.");
      const owner = text("owner");
      if (owner && !["me", "partner", "both"].includes(owner))
        fail("Choose who owns this milestone.");
      if ("owner" in values)
        item.ownerAccountId =
          owner === "me"
            ? account.id
            : owner === "partner"
              ? room.partnerAccountId
              : owner === "both"
                ? "both"
                : "";
      const changed = (item.dueDate || "") !== date;
      item.dueDate = date;
      // A new date changes what was agreed, so both reconfirm; owners do not.
      if (changed) item.me = item.partner = false;
      room.progress = roomProgress(room);
      state.toast = changed
        ? date
          ? `Due date set for “${item.title}”: ${new Date(`${date}T12:00:00Z`).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })}. Your collaborator was notified.`
          : `Due date removed from “${item.title}”.`
        : `Milestone details updated for “${item.title}”.`;
    } else if (input.form === "mentor-config") {
      if (!isAdmin(account)) fail("Moderator access required.", 403);
      state.toast = changeMentorSetting?.(account, values.path, values.value)
        ? "Mentoring setting saved."
        : "That value is already active.";
    } else if (input.form === "mentorship-survey") {
      if (state.role !== "mentor")
        fail("Switch to your mentor profile to answer this survey.", 403);
      if (!["yes", "no"].includes(values.wouldCharge))
        fail("Choose Yes or No.");
      account.mentorshipSurvey = {
        wouldCharge: values.wouldCharge === "yes",
        at: new Date(now()).toISOString(),
      };
      state.toast = "Survey response saved.";
    } else if (input.form === "notification-preferences") {
      const digest = text("digest");
      if (!["off", "daily", "weekly"].includes(digest))
        fail("Choose Off, Daily or Weekly.");
      account.notificationPreferences = {
        ...(account.notificationPreferences || {}),
        match: values.match === "on",
        activity: values.activity === "on",
        reminders: values.reminders === "on",
        digest,
        ...(state.role === "mentor" && {
          mentorRequestEmail:
            values.mentorRequestEmail === "instant" ? "instant" : "daily",
        }),
        ...(values.mentorshipEmailPreferences === "yes" && {
          mentorEmailKinds: {
            ...(account.notificationPreferences?.mentorEmailKinds || {}),
            ...Object.fromEntries(
              Object.keys(mentorEmailKinds)
                .filter(
                  (kind) =>
                    state.role === "mentor" ||
                    ![
                      "request",
                      "mentor-approved",
                      "guidelines-required",
                    ].includes(kind),
                )
                .map((kind) => [kind, values[`email-${kind}`] === "on"]),
            ),
          },
        }),
      };
      if (
        values.mentorshipEmailPreferences === "yes" &&
        account.emailDeliveryStatus?.unsubscribedKinds
      )
        account.emailDeliveryStatus.unsubscribedKinds =
          account.emailDeliveryStatus.unsubscribedKinds.filter(
            (kind) => values[`email-${kind}`] !== "on",
          );
      state.toast = "Notification preferences saved.";
    } else if (input.form === "match-alert") {
      // "Get notified when someone offers <need>" reuses match-suggestion
      // Updates. Profiles that already offer it are the baseline, so only
      // people who appear or change later produce an update.
      const need = text("need").slice(0, 100);
      if (need.length < 2) fail("Choose the help you want to hear about.");
      const role = state.role;
      account.matchAlerts ||= { founder: [], mentor: [] };
      const alerts = (account.matchAlerts[role] || []).filter(
        (alert) => alert.need.toLowerCase() !== need.toLowerCase(),
      );
      if (values.enabled === "off") {
        account.matchAlerts[role] = alerts;
        state.toast = `Stopped notifications for ${need}.`;
      } else {
        if (alerts.length >= 10)
          fail("Remove a match alert before adding another.");
        account.matchAlerts[role] = [
          ...alerts,
          {
            need,
            since: new Date(now()).toISOString(),
            baseline: alertPeople(state)
              .filter((person) => offersNeed(person, need, vocabulary()))
              .map((person) => person.id),
          },
        ];
        account.notificationPreferences = {
          ...defaultPreferences,
          ...(account.notificationPreferences || {}),
          match: true,
        };
        state.toast = `We'll add an Update when someone offers ${need}.`;
      }
    } else if (input.action === "read-notifications") {
      const ids = state.notifications
        .filter((item) => !input.id || item.id === input.id)
        .map((item) => item.id);
      account.readNotifications = [
        ...new Set([...(account.readNotifications || []), ...ids]),
      ].slice(-10000);
      state.toast = "Updates marked as read.";
    } else if (input.form === "tag-proposal") {
      const label = text("label");
      if (label.length < 3 || label.length > 60)
        fail("Use 3–60 characters for a tag.");
      db().tagProposals ||= [];
      if (
        [
          ...vocabulary(),
          ...db()
            .tagProposals.filter((t) => t.status === "pending")
            .map((t) => t.label),
        ].some((t) => t.toLowerCase() === label.toLowerCase())
      )
        fail("This tag is already available or awaiting review.");
      db().tagProposals.push({
        id: randomUUID(),
        label,
        accountId: account.id,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      state.toast = "Tag proposed for moderator approval.";
    } else if (input.form === "affiliation-request") {
      if (!text("organization") || !text("evidence"))
        fail("Provide your organization and evidence of affiliation.");
      account.affiliation = {
        organization: text("organization"),
        evidence: text("evidence"),
        status: "pending",
        requestedAt: new Date(now()).toISOString(),
        dueAt: moderationDueAt(new Date(now()).toISOString()),
      };
      state.toast = "Affiliation submitted for moderator verification.";
    } else if (input.form === "moderation") {
      if (!isAdmin(account)) fail("Moderator access required.", 403);
      const kind = text("kind"),
        id = text("id"),
        decision = text("decision"),
        note = text("note");
      if (!note) fail("Record a reason for this moderator decision.");
      if (kind === "report") {
        const report = db().reports.find((r) => r.id === id);
        if (!report) fail("Report unavailable.", 404);
        if (
          !["assigned", "escalated", "resolved", "dismissed"].includes(decision)
        )
          fail("Choose a valid report decision.");
        const assignee = text("assignee").toLowerCase();
        if (assignee && !options.adminEmails?.includes(assignee))
          fail("Choose a configured moderator.");
        if (decision === "assigned" && !assignee)
          fail("Choose a moderator to assign this report.");
        report.status = decision;
        report.assignee = assignee || account.email;
        report.resolution = note;
        report.updatedAt = new Date().toISOString();
        const owner = db().accounts[report.accountId];
        const affected = owner?.state.rooms[report.roomId];
        const confirmedIds = [];
        if (affected && decision === "resolved") {
          if (
            values.remedy === "close" &&
            !terminalStatuses.includes(affected.status)
          ) {
            affected.status = "cancelled";
            affected.closeReason = `Moderator resolution: ${note}`;
            affected.closedAt = report.updatedAt;
          } else if (
            values.remedy === "confirm-milestone" &&
            !terminalStatuses.includes(affected.status)
          ) {
            for (const [milestoneId, item] of Object.entries(
              affected.milestones,
            ))
              if (item.disputed) {
                confirmedIds.push(milestoneId);
                Object.assign(item, {
                  disputed: false,
                  dispute: null,
                  me: true,
                  partner: true,
                  resolvedByMe: false,
                  resolvedByPartner: false,
                });
              }
            affected.progress = roomProgress(affected);
          } else if (
            values.remedy === "close-without-penalty" &&
            !terminalStatuses.includes(affected.status)
          ) {
            affected.status = "cancelled";
            affected.closeReason = `Closed by a moderator without penalty: ${note}`;
            affected.closeCategory = "moderator";
            affected.closedAt = report.updatedAt;
          } else if (
            values.remedy === "resolve-disputes" &&
            !terminalStatuses.includes(affected.status)
          ) {
            for (const item of Object.values(affected.milestones))
              if (item.disputed)
                Object.assign(item, {
                  disputed: false,
                  dispute: null,
                  me: false,
                  partner: false,
                  resolvedByMe: false,
                  resolvedByPartner: false,
                });
          }
          affected.updatedAt = report.updatedAt;
          // Work from the caller's snapshot when the moderator is also a member.
          const ownerState = owner.id === account.id ? state : owner.state;
          ownerState.rooms[affected.id] = affected;
          mirror(
            owner,
            ownerState,
            affected,
            `A moderator resolved a report: ${note}`,
          );
          owner.state = ownerState;
          // The room sync clears confirmations when a dispute flag changes, so
          // reapply the moderator's "confirmed" outcome on both copies.
          for (const copy of [
            ownerState.rooms[affected.id],
            db().accounts[affected.partnerAccountId]?.state.rooms[affected.id],
          ])
            if (copy) {
              for (const id of confirmedIds)
                Object.assign(copy.milestones[id], { me: true, partner: true });
              copy.progress = roomProgress(copy);
            }
          // A moderator may confirm the final disputed milestone.
          const previousPhase = affected.cycle?.phase;
          const completed = advanceRoom(owner, ownerState, affected);
          if (completed || previousPhase !== affected.cycle?.phase) {
            mirror(
              owner,
              ownerState,
              affected,
              completed
                ? ownerState.confirmation
                : "Your mentorship cycle is ready for a private review.",
              {
                kind: completed ? "review" : "confirmation",
                review: completed,
                tab: "milestones",
              },
            );
          }
          if (
            affected.partnerAccountId === account.id &&
            owner.id !== account.id
          )
            state.rooms[affected.id] = account.state.rooms[affected.id];
        }
        for (const member of Object.values(db().accounts)) {
          const ownRoom = member.state.rooms[report.roomId];
          if (ownRoom)
            event(
              member.id === account.id ? { state } : member,
              ownRoom.role,
              `Report ${decision}: ${note}`,
              ownRoom.id,
            );
        }
      } else if (kind === "tag") {
        const proposal = db().tagProposals?.find((t) => t.id === id);
        if (!proposal || proposal.status !== "pending")
          fail("Pending tag unavailable.");
        if (!["approved", "rejected"].includes(decision))
          fail("Choose approved or rejected.");
        proposal.status = decision;
        proposal.note = note;
        if (decision === "approved")
          (db().approvedTags ||= []).push(proposal.label);
        const proposer = accountById(proposal.accountId);
        if (proposer)
          event(
            proposer.id === account.id ? { state } : proposer,
            proposer.state.role,
            decision === "approved"
              ? `Your tag “${proposal.label}” was approved and is now available.`
              : `Your tag “${proposal.label}” was not added: ${note}`,
          );
      } else if (kind === "affiliation") {
        const target = accountById(id);
        if (!target?.affiliation || target.affiliation.status !== "pending")
          fail("Pending affiliation unavailable.");
        if (!["verified", "rejected"].includes(decision))
          fail("Choose verified or rejected.");
        target.affiliation = {
          ...target.affiliation,
          status: decision,
          note,
          reviewedAt: new Date().toISOString(),
        };
        event(
          target.id === account.id ? { state } : target,
          target.state.role,
          decision === "verified"
            ? `You are verified through ${target.affiliation.organization}. The badge now shows on your profile and cards.`
            : `Your verification request was not approved: ${note}`,
        );
      } else if (kind === "account") {
        const target = accountById(id);
        if (
          !target ||
          target.id === account.id ||
          options.adminEmails?.includes(target.email)
        )
          fail("This account cannot be moderated here.");
        if (!["suspend", "restore"].includes(decision))
          fail("Choose suspend or restore.");
        target.suspended = decision === "suspend";
        for (const [key, session] of sessions)
          if (session.id === id) sessions.delete(key);
      } else fail("Choose a moderation queue.");
      (db().moderationAudit ||= []).push({
        id: randomUUID(),
        moderator: account.email,
        kind,
        targetId: id,
        decision,
        note,
        timestamp: new Date().toISOString(),
      });
      state.toast = "Moderator decision saved.";
    }
    if (roomAction) {
      room.updatedAt = new Date().toISOString();
      const who = displayName(account, state.role);
      const partnerText = {
        "reopen-terms": `${who} asked to change the agreed terms. The current terms stay in place until you respond.`,
        "accept-reopen": `${who} agreed to reopen the terms. Agree on revised terms together.`,
        "decline-reopen": `${who} kept the agreed terms unchanged.`,
        "close-room": `${who} closed this collaboration: ${room.closeReason}`,
        "withdraw-dispute": `${who} withdrew the dispute.`,
        "escalate-dispute": `${who} sent a milestone dispute to a moderator.`,
        "send-back": `${who} marked a milestone as not done yet. See the note in Chat.`,
        "nudge-partner": `${who} is waiting on you in your collaboration.`,
        "milestone-date": state.toast.startsWith("Due date set")
          ? `${who} ${state.toast.replace(/^Due date set for /, "set a due date for ").replace(/ Your collaborator was notified.$/, "")}`
          : `${who}: ${state.toast}`,
      }[input.action || input.form];
      mirror(account, state, room, partnerText || `${who}: ${state.toast}`, {
        kind: ["reopen-terms", "send-back", "nudge-partner"].includes(
          input.action || input.form,
        )
          ? "confirmation"
          : undefined,
        tab:
          input.action === "reopen-terms"
            ? "terms"
            : input.form === "send-back" || input.action === "send-back"
              ? "chat"
              : "milestones",
      });
      event({ state }, state.role, state.toast, room.id, { self: true });
      simulatePartner(account, state, room);
    }
    state.directory = {
      founders: [],
      mentors: [],
      mentorStartups: [],
      roomPartners: [],
      browseFounders: [],
      browseMentorStartups: [],
    };
    account.state = state;
    save();
    return response(account, input.role);
  }
  return {
    decorate,
    rememberNotifications,
    scheduledEmails,
    vocabulary,
    suggestTags,
    isAdmin,
    handles: (input) =>
      actions.has(input.action) ||
      forms.has(input.form) ||
      mentorRequestActions.has(input.action),
    act,
  };
}
