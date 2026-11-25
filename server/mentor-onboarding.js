import { randomUUID } from "node:crypto";
import {
  capacityErrorMessage,
  capacityErrors,
  conflictRelations,
} from "../src/data/mentor-rules.js";
import {
  mentorFormatIds,
  normalizeOfferedFormats,
} from "../src/data/mentor-formats.js";
import {
  bioLimit,
  experienceLimit,
  finalRejection,
  mentorApplicationSteps,
} from "../src/data/mentor-onboarding.js";
import { dayMs } from "../src/data/mentor-room.js";

export const applicationActions = new Set([
  "mentor-onboarding-save",
  "mentor-onboarding-back",
  "approve-mentor",
  "reject-mentor",
  "simulate-mentor-approval",
]);
const clean = (value, length = 150) =>
  typeof value === "string" ? value.trim().slice(0, length) : "";
const fresh = () => ({
  status: "draft",
  step: 0,
  attempts: 0,
  verification: null,
});
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function applicationProfile(profile = {}) {
  return {
    topics: profile.topics || "",
    formats: (profile.formats || []).map((format) => format.id),
    capacity: profile.capacity || null,
    timeZone: profile.timeZone || "",
    pastExperience: profile.pastExperience || "",
    bio: profile.bio || "",
    stages: profile.stages || [],
    industries: profile.industries || [],
    conflicts: (profile.conflicts || []).map(
      ({ company, relation, industry }) => ({ company, relation, industry }),
    ),
    noConflicts: Boolean(profile.noConflicts),
  };
}

export function approvalDeadline(timestamp, businessDays) {
  let date = Date.parse(timestamp);
  let left = businessDays;
  while (left > 0) {
    date += dayMs;
    if (![0, 6].includes(new Date(date + 8 * 3600000).getUTCDay())) left -= 1;
  }
  return new Date(date).toISOString();
}

export function createMentorOnboarding({
  accounts,
  config,
  now,
  fail,
  isAdmin,
  audit,
  event,
  vocabulary,
  required = true,
  simulate = () => false,
}) {
  const stamp = () => new Date(now()).toISOString();
  const approvedText =
    "Your mentor profile is approved. Founders can now request your guidance.";
  const simulatedNote =
    "Simulated approval for a demo. No moderator reviewed it.";
  // Approves `target`'s pending application. `state` is the state that holds
  // their mentor profile: the stored one for a moderator, or the working copy
  // when the mentor approves their own through the demo shortcut.
  function markApproved(target, state, by) {
    const application = target.mentorApplication;
    application.status = "approved";
    application.reason = null;
    application.decidedAt = stamp();
    Object.assign(state.profiles.mentor, {
      mentorApprovedAt: stamp(),
      mentorApprovedBy: by,
    });
    if (
      ["work-email", "organization"].includes(application.verification.method)
    )
      target.affiliation ||= {
        status: "verified",
        organization:
          application.verification.method === "organization"
            ? "Endorsing organization"
            : "Work email verified",
        confirmedAt: stamp(),
      };
  }
  const migrations = (db) => {
    if (!required || db.mentorRules.phase6At) return false;
    const at = stamp();
    db.mentorRules.phase6At = at;
    for (const account of Object.values(accounts())) {
      const profile = account.state.profiles.mentor;
      if (
        !account.deletedAt &&
        !account.demo &&
        (account.state.role === "mentor" ||
          account.state.bothRoles ||
          [profile.expertise, profile.offer, profile.bio].some((value) =>
            Boolean(value?.trim()),
          ))
      ) {
        profile.mentorApprovedAt ||= at;
        profile.mentorApprovedBy ||= "migration";
      }
    }
    return true;
  };
  const approved = (account) =>
    Boolean(
      account &&
      (!required ||
        account.demo ||
        account.state.profiles.mentor.mentorApprovedAt),
    );
  const begin = (account) => {
    if (!approved(account)) account.mentorApplication ||= fresh();
  };

  function get(account, role) {
    return role === "mentor" && !approved(account)
      ? account.mentorApplication || fresh()
      : null;
  }

  function submitStep(application, state, values) {
    const profile = state.profiles.mentor;
    const step = application.step;
    const c = config();
    if (step === 0) {
      const method = values.method;
      const evidence = clean(values.evidence, 500);
      let valid = false;
      if (method === "linkedin") {
        try {
          const url = new URL(evidence);
          valid =
            url.protocol === "https:" &&
            /(^|\.)linkedin\.com$/.test(url.hostname) &&
            /^\/in\/[^/]+/.test(url.pathname);
        } catch {
          valid = false;
        }
      } else if (method === "work-email") valid = emailPattern.test(evidence);
      else if (method === "organization") valid = evidence.length >= 8;
      if (!valid)
        fail(
          "Provide a LinkedIn profile URL, work email or an endorsing organization with verification details.",
          400,
          {
            evidence: "Choose a verification method and enter valid evidence.",
          },
        );
      application.verification = { method, evidence };
    } else if (step === 1) {
      const topics = [
        ...new Set(Array.isArray(values.topics) ? values.topics : []),
      ];
      if (
        topics.length < 3 ||
        topics.some((topic) => !vocabulary().includes(topic))
      )
        fail("Choose at least three approved expertise tags.", 400, {
          topics: "Choose at least three tags from the list.",
        });
      profile.topics = topics.join(", ");
      profile.expertise = profile.topics;
      profile.offer ||= profile.topics;
    } else if (step === 2) {
      const { errors, capacity } = capacityErrors(values);
      if (Object.keys(errors).length)
        fail(capacityErrorMessage(errors), 400, errors);
      profile.capacity = { ...profile.capacity, ...capacity };
      profile.timeZone = values.timeZone;
    } else if (step === 3) {
      const requested = Array.isArray(values.formats) ? values.formats : [];
      const formats = normalizeOfferedFormats(requested);
      if (
        !formats.length ||
        requested.some((format) => !mentorFormatIds.includes(format))
      )
        fail("Choose at least one available mentorship format.");
      profile.formats = formats;
    } else if (step === 4) {
      const conflicts = Array.isArray(values.conflicts) ? values.conflicts : [];
      const declaredNone =
        values.noConflicts === true || values.noConflicts === "on";
      if (
        (!conflicts.length && !declaredNone) ||
        (conflicts.length && declaredNone) ||
        conflicts.length > 20
      )
        fail(
          "List your conflicts of interest, or explicitly confirm you have none.",
        );
      const checked = conflicts.map((conflict) => {
        const company = clean(conflict?.company, 100);
        const relation = clean(conflict?.relation);
        if (
          company.length < 2 ||
          !conflictRelations.some(([id]) => id === relation)
        )
          fail("Enter the company and relationship for each conflict.");
        return {
          id: randomUUID(),
          company,
          relation,
          industry: clean(conflict.industry, 60),
        };
      });
      profile.conflicts = checked;
      profile.noConflicts = declaredNone;
    } else if (step === 5) {
      if (
        !(values.agreed === true || values.agreed === "on") ||
        Number(values.version) !== c.guidelinesVersion
      )
        fail(
          "Read and accept the current mentor guidelines before continuing.",
        );
      profile.guidelinesAcceptedAt = stamp();
      profile.guidelinesVersion = c.guidelinesVersion;
      profile.guidelinesGraceUntil = null;
    } else if (step === 6) {
      // The summary is past experience only. The introduction founders read
      // first is its own answer, never a copy of the summary. It is required:
      // a mentor profile without one can't send introductions.
      const errors = {};
      const experience =
        typeof values.experience === "string" ? values.experience.trim() : "";
      const bio = typeof values.bio === "string" ? values.bio.trim() : "";
      if (experience.length > experienceLimit)
        errors.experience = `Experience summary: shorten it to ${experienceLimit.toLocaleString("en")} characters (now ${experience.length.toLocaleString("en")}).`;
      if (!bio)
        errors.bio =
          "Short introduction: add two or three sentences on who you help.";
      else if (bio.length > bioLimit)
        errors.bio = `Short introduction: shorten it to ${bioLimit.toLocaleString("en")} characters (now ${bio.length.toLocaleString("en")}).`;
      if (Object.keys(errors).length)
        fail(Object.values(errors).join(" "), 400, errors);
      if (experience) profile.pastExperience = experience;
      profile.bio = bio;
    } else {
      profile.stages = clean(values.stages, 250)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      profile.industries = clean(values.industries, 250)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (profile.industries.length)
        profile.startups ||= profile.industries.join(", ");
      // An application saved past this step before the introduction was
      // required still needs one before it goes to a moderator.
      if (!String(profile.bio || "").trim())
        fail(
          "Go back to the Experience step and add a short introduction.",
          400,
          {
            bio: "Short introduction: add two or three sentences on who you help.",
          },
        );
      if (profile.guidelinesVersion !== c.guidelinesVersion) {
        fail(
          "The guidelines changed. Go back to the Mentor guidelines step and accept the new version.",
          409,
        );
      }
      application.status = "pending";
      application.submittedAt = stamp();
      application.attempts += 1;
      application.dueAt = approvalDeadline(
        application.submittedAt,
        c.approvalTargetBusinessDays,
      );
      application.reason = null;
      state.page = "onboarding";
      state.toast = "Mentor application submitted for review.";
      return;
    }
    application.step += 1;
    state.toast = "Progress saved.";
  }

  function act(account, state, input) {
    const values = input.values || {};
    if (typeof values !== "object" || Array.isArray(values))
      fail("Invalid mentor application.");
    if (["approve-mentor", "reject-mentor"].includes(input.action)) {
      if (!isAdmin(account)) fail("Moderator access required.", 403);
      const id = input.id;
      const target = Object.hasOwn(accounts(), id) ? accounts()[id] : null;
      const application = target?.mentorApplication;
      if (
        id === account.id ||
        !target ||
        target.deletedAt ||
        application?.status !== "pending"
      )
        fail("This mentor application is unavailable.", 409);
      const approve = input.action === "approve-mentor";
      const reason = clean(values.reason, 500);
      if (!approve && !reason)
        fail("Explain why the application was rejected.");
      if (approve) markApproved(target, target.state, account.id);
      else {
        application.status = "rejected";
        application.reason = reason;
        application.decidedAt = stamp();
      }
      audit(account, "mentor-approval", target.id, application.status, reason);
      event(
        target,
        "mentor",
        approve
          ? approvedText
          : `Your mentor application was rejected. ${reason}`,
        undefined,
        {
          kind: approve ? "mentor-approved" : "mentor-rejected",
          page: "onboarding",
        },
      );
      state.toast = approve
        ? "Mentor approved."
        : "Mentor application rejected.";
      return;
    }
    if (input.action === "simulate-mentor-approval") {
      // TEMPORARY demo shortcut (SYNERGY_SIMULATE_VERIFICATION). Approves the
      // caller's own pending application as if a moderator had, and audits it.
      if (!simulate()) fail("Simulated approval is turned off.", 403);
      if (
        state.role !== "mentor" ||
        account.mentorApplication?.status !== "pending"
      )
        fail("Submit your mentor application first.", 409);
      // `state` is this request's working copy and replaces account.state
      // afterwards, so the profile change and the Update go to it.
      markApproved(account, state, "simulated");
      account.mentorApplication.reason = simulatedNote;
      audit(
        { email: "simulated" },
        "mentor-approval",
        account.id,
        "approved",
        simulatedNote,
      );
      event({ state }, "mentor", approvedText, undefined, {
        kind: "mentor-approved",
        page: "onboarding",
      });
      state.toast = "Mentor approved (simulated).";
      return;
    }
    if (state.role !== "mentor" || approved(account))
      fail("There is no mentor application to edit.", 409);
    const current = account.mentorApplication || fresh();
    const application = structuredClone(current);
    if (application.status === "pending" || finalRejection(application))
      fail("This mentor application cannot be edited.", 409);
    if (application.status === "rejected") {
      application.status = "draft";
      application.step = 0;
    } else if (input.action === "mentor-onboarding-back") {
      application.step = Math.max(0, application.step - 1);
    } else {
      if (Number(values.step) !== application.step)
        fail(
          "The application moved to another step. Refresh before continuing.",
          409,
        );
      submitStep(application, state, values);
    }
    account.mentorApplication = application;
  }

  function queue() {
    return Object.values(accounts())
      .filter(
        (account) =>
          !account.deletedAt && account.mentorApplication?.status === "pending",
      )
      .map((account) => ({
        accountId: account.id,
        name: account.state.accountName,
        ...account.mentorApplication,
        // What the mentor entered, so a moderator can judge the application
        // beside its verification evidence. Only moderators see this queue.
        profile: applicationProfile(account.state.profiles.mentor),
        overdue: Date.parse(account.mentorApplication.dueAt) < now(),
        waitHours: Math.max(
          0,
          Math.floor(
            (now() - Date.parse(account.mentorApplication.submittedAt)) /
              3600000,
          ),
        ),
      }))
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  }
  return {
    migrations,
    approved,
    get,
    begin,
    act,
    queue,
    steps: mentorApplicationSteps,
  };
}
