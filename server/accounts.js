import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createInitialState } from "../src/data/model.js";
import { isMentorRoom } from "../src/data/mentor-room.js";
import { terminalStatuses } from "../src/data/collaboration.js";
const derive = promisify(scrypt);

export function accountControls({
  getDb,
  authenticate,
  sessions,
  hash,
  save,
  response,
  mirror,
  fail,
  disconnectMentorship,
  closeMentorship,
}) {
  const revoke = (id, keep) => {
    for (const [token, session] of sessions)
      if (session.id === id && token !== keep) sessions.delete(token);
  };
  async function password(token, value) {
    const account = authenticate(token);
    if (account.demo) return;
    if (typeof value !== "string" || value.length > 1024)
      fail("Enter your current password.", 400);
    const expected = account.passwordHash;
    const candidate = await derive(value, account.salt, 64);
    if (
      authenticate(token).passwordHash !== expected ||
      !timingSafeEqual(candidate, Buffer.from(expected, "hex"))
    )
      fail("Your current password is incorrect.", 403);
    return authenticate(token);
  }
  function clearIntroductions(account, target, reason) {
    disconnectMentorship?.(account, target, reason);
    for (const other of Object.values(getDb().accounts)) {
      if (target && other.id !== target) continue;
      for (const role of ["founder", "mentor"])
        for (const otherRole of ["founder", "mentor"])
          for (const collection of [
            "waitingByRole",
            "interestByRole",
            "incomingByRole",
            "introductionTypesByRole",
            "introductionMetaByRole",
          ]) {
            const own = account.state[collection]?.[role];
            const theirs = other.state[collection]?.[otherRole];
            if (own instanceof Set) own.delete(`${other.id}:${otherRole}`);
            else if (own) delete own[`${other.id}:${otherRole}`];
            if (theirs instanceof Set) theirs.delete(`${account.id}:${role}`);
            else if (theirs) delete theirs[`${account.id}:${role}`];
          }
    }
  }
  function closeRooms(account, target, reason) {
    for (const room of Object.values(account.state.rooms)) {
      if (
        (target && room.partnerAccountId !== target) ||
        terminalStatuses.includes(room.status)
      )
        continue;
      if (isMentorRoom(room)) closeMentorship?.(room, room.role, reason);
      room.status = "cancelled";
      room.closedAt = new Date().toISOString();
      room.closeReason = reason;
      mirror(account, account.state, room, reason);
    }
  }
  return {
    password,
    settings(token) {
      const account = authenticate(token);
      return {
        visible: account.profileVisible !== false,
        blocked: (account.blockedAccounts || []).map((id) => ({
          id,
          name: getDb().accounts[id]?.state.accountName || "Deleted account",
        })),
        sessions: [...sessions]
          .filter(
            ([, session]) =>
              session.id === account.id && session.expires > Date.now(),
          )
          .map(([key, session]) => ({
            id: hash(key),
            current: key === token,
            createdAt: session.createdAt,
            expiresAt: session.expires,
          })),
      };
    },
    visibility(token, visible) {
      const account = authenticate(token);
      if (typeof visible !== "boolean")
        fail("Choose whether your profile is visible.");
      account.profileVisible = visible;
      if (!visible) clearIntroductions(account, null, "profile-hidden");
      save();
      return response(account);
    },
    block(token, id, blocked) {
      const account = authenticate(token),
        other = Object.hasOwn(getDb().accounts, id)
          ? getDb().accounts[id]
          : null;
      if (
        !other ||
        (blocked && other.deletedAt) ||
        id === account.id ||
        typeof blocked !== "boolean"
      )
        fail("Choose an available collaborator.");
      const list = new Set(account.blockedAccounts || []);
      if (blocked) {
        list.add(id);
        account.blockedAccounts = [...list];
        clearIntroductions(account, id, "blocked");
        closeRooms(
          account,
          id,
          "A participant blocked further contact. This collaboration is closed.",
        );
      } else list.delete(id);
      account.blockedAccounts = [...list];
      save();
      return response(account);
    },
    revoke(token, id) {
      const account = authenticate(token);
      if (id === "others") revoke(account.id, token);
      else {
        const entry = [...sessions].find(
          ([key, session]) =>
            session.id === account.id && hash(key) === id && key !== token,
        );
        if (!entry) fail("That session is no longer available.", 404);
        sessions.delete(entry[0]);
      }
      return { ok: true };
    },
    export(token) {
      const account = authenticate(token);
      const workspace = response(account).state;
      for (const key of [
        "directory",
        "calendarToken",
        "moderation",
        "isAdmin",
        "integrations",
        "engagementTemplates",
        "matchingConfig",
        "vocabulary",
      ])
        delete workspace[key];
      return {
        exportedAt: new Date().toISOString(),
        email: account.email,
        workspace,
        uploadedFiles: Object.values(getDb().files || {}).filter(
          (file) => file.accountId === account.id,
        ),
        preferences: {
          profileVisible: account.profileVisible !== false,
          notificationPreferences: account.notificationPreferences || {},
          blockedAccounts: account.blockedAccounts || [],
        },
        retention:
          "Shared agreements, messages, evidence and released reviews remain available to collaborators after deletion. Credentials and private profile information are removed.",
      };
    },
    delete(token) {
      const account = authenticate(token);
      clearIntroductions(account, null, "account-deleted");
      closeRooms(
        account,
        null,
        "A participant deleted their account. This collaboration is closed.",
      );
      const db = getDb();
      const oldName = account.state.accountName;
      const startupName = account.state.profiles.founder?.startupName;
      const oldNames = [
        ...new Set([oldName, startupName].filter(Boolean)),
      ].sort((a, b) => b.length - a.length);
      const anonymise = (text) =>
        typeof text === "string"
          ? oldNames.reduce(
              (value, before) => value.replaceAll(before, "Deleted account"),
              text,
            )
          : text;
      for (const owner of Object.values(db.accounts)) {
        for (const role of ["mentor", "founder"]) {
          for (const record of owner.state.mentorRequestsByRole?.[role] || []) {
            if (!record.partnerId?.startsWith(account.id + ":")) continue;
            record.name = "Deleted account";
            for (const key of [
              "note",
              "problem",
              "tried",
              "question",
              "desiredOutcome",
              "links",
              "quality",
              "qualityReasons",
              "sharpenedFrom",
              "consentAt",
              "message",
              "safetyFlags",
            ])
              delete record[key];
          }
        }
        for (const room of Object.values(owner.state.rooms)) {
          const authorRole =
            owner.id === account.id
              ? room.role
              : room.partnerAccountId === account.id
                ? room.partnerRole
                : null;
          if (isMentorRoom(room) && authorRole) {
            if (room.notes)
              room.notes = room.notes.filter(
                (note) => note.authorRole !== authorRole,
              );
            const deleteFeedback = (review, own) => {
              if (!review) return;
              for (const key of own
                ? ["note", "testimonial", "testimonialPublic"]
                : [
                    "partnerNote",
                    "partnerTestimonial",
                    "partnerTestimonialPublic",
                  ])
                delete review[key];
            };
            deleteFeedback(room.review, room.role === authorRole);
            for (const entry of room.mentorship.history || [])
              deleteFeedback(entry.review, entry.role === authorRole);
            for (const cycle of [room.cycle, ...(room.cycleHistory || [])]) {
              const review = cycle?.reviews?.[account.id];
              if (review) delete review.note;
            }
          }
          for (const message of room.messages || []) {
            const authoredByDeleted =
              owner.id === account.id
                ? message.who === "me"
                : room.partnerAccountId === account.id &&
                  message.who === "partner";
            if (authoredByDeleted) {
              message.name = "Deleted account";
              message.initials = "?";
            }
          }
        }
        for (const activity of owner.state.activity)
          activity.text = anonymise(activity.text);
      }
      db.outbox = (db.outbox || []).filter(
        (entry) => entry.accountId !== account.id,
      );
      for (const entry of db.outbox) {
        if (!entry.payload) continue;
        if (entry.payload.text)
          entry.payload.text = anonymise(entry.payload.text);
        for (const item of entry.payload.items || [])
          if (item.text) item.text = anonymise(item.text);
      }
      const retainedRooms = account.state.rooms;
      for (const key of Object.keys(account))
        if (key !== "id") delete account[key];
      Object.assign(account, {
        email: "",
        salt: "",
        passwordHash: "",
        deletedAt: new Date().toISOString(),
        suspended: true,
        state: {
          ...createInitialState(),
          accountName: "Deleted account",
          rooms: retainedRooms,
        },
      });
      save();
      revoke(account.id);
      return { ok: true };
    },
  };
}
