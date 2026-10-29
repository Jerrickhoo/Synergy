import { randomUUID } from "node:crypto";
import {
  defaultVocabulary,
  suggestTags,
  terminalStatuses,
  trustSummary,
} from "../src/data/collaboration.js";
import { scheduleInstant } from "../src/data/selectors.js";
import { roomProgress } from "../src/data/selectors.js";
import defaultTemplates from "../src/data/engagement-templates.json" with { type: "json" };
import { defaultMatching, matchingReport } from "../src/data/matching.js";

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
}) {
  const db = () => getDb();
  const accountById = (id) =>
    Object.hasOwn(db().accounts, id) ? db().accounts[id] : null;
  const isAdmin = (account) =>
    Boolean(options.adminEmails?.includes(account.email));
  const vocabulary = () =>
    [...new Set([...defaultVocabulary, ...(db().approvedTags || [])])].sort();
  function notifications(account, state, now = Date.now()) {
    const items = state.activity
      .filter((item) => item.role === state.role)
      .map((item) => ({ ...item, kind: "activity" }));
    const add = (id, text, roomId, kind, matchId, timing = {}) =>
      items.push({
        id,
        text,
        roomId,
        kind,
        matchId,
        timestamp:
          account.notificationCreatedAt?.[`${state.role}:${id}`] ||
          new Date(now).toISOString(),
        generated: true,
        ...timing,
        role: state.role,
      });
    for (const person of state.role === "mentor"
      ? state.directory.mentorStartups
      : [...state.directory.founders, ...state.directory.mentors]) {
      if (person.score >= 60)
        add(
          `match:${person.id}:${person.score}`,
          `${person.name} is a ${person.score}% profile fit.`,
          null,
          "match",
          person.id,
        );
    }
    for (const room of Object.values(state.rooms).filter(
      (room) => room.role === state.role,
    )) {
      if (room.status === "launched" && !room.review.me)
        add(
          `review:${room.id}`,
          "Your completed collaboration is ready for a review.",
          room.id,
          "review",
        );
      if (terminalStatuses.includes(room.status)) continue;
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
          const remaining = Date.parse(`${item.dueDate}T23:59:59Z`) - now;
          if (remaining < 86400000)
            add(
              `due:${room.id}:${id}:${item.dueDate}`,
              `${item.title} is ${remaining < 0 ? "overdue" : "due within a day"} (${item.dueDate}, UTC).`,
              room.id,
              "reminder",
              null,
              { dueAt: `${item.dueDate}T23:59:59Z`, tab: "milestones" },
            );
        }
        for (const schedule of item.schedules ||
          (item.schedule ? [item.schedule] : [])) {
          const remaining = scheduleInstant(schedule).getTime() - now;
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
        now -
          Date.parse(
            room.updatedAt || room.createdAt || new Date(now).toISOString(),
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
    const read = new Set(account.readNotifications || []);
    return items
      .map((item) => ({ ...item, read: read.has(item.id) }))
      .sort(
        (a, b) =>
          (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0),
      );
  }
  // Called only at the response boundary, after successful commands. Preparing
  // data for validation remains read-only; repeated polls do not write again.
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
    return changed;
  }
  function decorate(account, state) {
    state.isAdmin = isAdmin(account);
    state.vocabulary = vocabulary();
    state.engagementTemplates = db().engagementTemplates || defaultTemplates;
    state.matchingConfig = db().matchingConfig || defaultMatching;
    state.notifications = notifications(account, state);
    state.affiliation = account.affiliation || null;
    state.trustSummary = trustSummary(state.rooms, state.role);
    if (state.isAdmin)
      state.moderation = {
        matchingReport: matchingReport(db().accounts),
        reports: db().reports.map((report) => {
          const room =
            db().accounts[report.accountId]?.state.rooms[report.roomId];
          return {
            ...report,
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
        tags: db().tagProposals || [],
        affiliations: Object.values(db().accounts)
          .filter((a) => a.affiliation?.status === "pending")
          .map((a) => ({
            accountId: a.id,
            name: a.state.accountName,
            ...a.affiliation,
          })),
        accounts: Object.values(db().accounts).map((a) => ({
          id: a.id,
          name: a.state.accountName,
          email: a.email,
          suspended: Boolean(a.suspended),
        })),
        moderators: options.adminEmails || [],
        audit: (db().moderationAudit || []).slice(-100).reverse(),
      };
    else delete state.moderation;
    return state;
  }
  const actions = new Set(["reopen-terms", "close-room", "read-notifications"]);
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
  ]);
  function act(token, input) {
    const account = authenticate(token);
    if (!["founder", "mentor"].includes(input.role))
      fail("Choose a valid role.");
    if (Boolean(input.action) === Boolean(input.form))
      fail("Submit one action or form at a time.");
    const state = prepare(account, input.role);
    const values = input.values || {};
    if (!values || typeof values !== "object" || Array.isArray(values))
      fail("Invalid form values.");
    const text = (key) =>
      String(values[key] || "")
        .trim()
        .slice(0, 3000);
    const room = state.rooms[input.activeRoomId];
    const roomAction =
      ["reopen-terms", "close-room"].includes(input.action) ||
      [
        "task-create",
        "task-update",
        "task-delete",
        "close-room",
        "milestone-date",
        "milestone-proposal",
        "milestone-decision",
      ].includes(input.form);
    if (roomAction && (!room || room.role !== input.role))
      fail("This room is unavailable for your account and role.", 404);
    if (roomAction && terminalStatuses.includes(room.status))
      fail("Completed or closed collaborations cannot be changed.");
    state.toast = "";
    state.toastType = "success";
    state.toastTitle = "";
    state.formErrors = null;
    state.confirmation = "";
    if (["engagement-template", "matching-config"].includes(input.form)) {
      if (!isAdmin(account)) fail("Moderator access required.", 403);
      if (input.form === "engagement-template") {
        const id = text("type");
        const current = (db().engagementTemplates || defaultTemplates)[id];
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
        db().engagementTemplates = structuredClone(
          db().engagementTemplates || defaultTemplates,
        );
        db().engagementTemplates[id] = {
          id,
          name,
          version: current.version + 1,
          milestones,
        };
        state.toast = "Template saved. New rooms will use this version.";
      } else {
        const current = db().matchingConfig || defaultMatching;
        if (Number(values.version) !== current.version)
          fail("Matching weights changed. Refresh before saving.", 409);
        const config = { version: current.version + 1 };
        for (const kind of ["founder", "mentor"]) {
          const weights = Array.from({ length: 5 }, (_, i) =>
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
      room.terms = {
        ...room.terms,
        locked: false,
        partnerLocked: false,
        confirmedByMe: false,
        revision: (room.terms.revision || 0) + 1,
      };
      for (const item of Object.values(room.milestones))
        item.me = item.partner = false;
      room.status = "matched";
      room.progress = 0;
      state.toast =
        "Terms reopened. Both collaborators must accept the revised agreement and reconfirm the work.";
    } else if (input.action === "close-room" || input.form === "close-room") {
      if (!text("reason"))
        fail("Give a reason for closing this collaboration.");
      room.status = "cancelled";
      room.closedAt = new Date().toISOString();
      room.closeReason = text("reason");
      state.toast = "Collaboration closed. Its history remains available.";
    } else if (
      ["task-create", "task-update", "task-delete"].includes(input.form)
    ) {
      room.tasks ||= [];
      const task = room.tasks.find((item) => item.id === input.id);
      if (input.form !== "task-create") {
        if (!task) fail("This task is unavailable. Refresh the board.", 404);
        if (Number(values.version) !== task.version)
          fail("This task changed. Review the latest card and try again.", 409);
      }
      if (input.form === "task-delete") {
        room.tasks = room.tasks.filter((item) => item.id !== task.id);
        state.toast = "Task deleted.";
      } else {
        const title = text("title"),
          description = text("description");
        const status = text("status"),
          priority = text("priority");
        const assignee = text("assignee"),
          dueDate = text("dueDate");
        const milestoneId = text("milestoneId");
        if (!title || title.length > 160)
          fail("Use a task title of 1–160 characters.");
        if (!["todo", "doing", "done"].includes(status))
          fail("Choose a valid task status.");
        if (!["low", "normal", "high"].includes(priority))
          fail("Choose a valid priority.");
        if (assignee && ![account.id, room.partnerAccountId].includes(assignee))
          fail("Assign this task to a room collaborator.");
        if (milestoneId && !Object.hasOwn(room.milestones, milestoneId))
          fail("Choose a room milestone.");
        const parsed = new Date(`${dueDate}T12:00:00Z`);
        if (
          dueDate &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
            Number.isNaN(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== dueDate)
        )
          fail("Choose a valid task due date.");
        const fields = {
          title,
          description,
          status,
          priority,
          assignee,
          dueDate,
          milestoneId,
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
        state.toast = task ? "Task updated." : "Task added to the board.";
      }
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
      item.dueDate = date;
      item.me = item.partner = false;
      room.progress = roomProgress(room);
      state.toast = "Milestone due date updated. Dates use UTC.";
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
        if (affected && decision === "resolved") {
          if (
            values.remedy === "close" &&
            !terminalStatuses.includes(affected.status)
          ) {
            affected.status = "cancelled";
            affected.closeReason = `Moderator resolution: ${note}`;
            affected.closedAt = report.updatedAt;
          } else if (
            values.remedy === "resolve-disputes" &&
            !terminalStatuses.includes(affected.status)
          ) {
            for (const item of Object.values(affected.milestones))
              if (item.disputed)
                Object.assign(item, {
                  disputed: false,
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
      mirror(account, state, room, `${state.accountName}: ${state.toast}`);
      event({ state }, state.role, state.toast, room.id);
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
    vocabulary,
    suggestTags,
    isAdmin,
    handles: (input) => actions.has(input.action) || forms.has(input.form),
    act,
  };
}
