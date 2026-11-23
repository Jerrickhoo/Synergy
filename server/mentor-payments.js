import { randomUUID } from "node:crypto";
import { createPayments } from "./payments.js";
import {
  priceRangeText,
  pricingConfig,
  validPrice,
  split,
  installment,
  paymentActionNames,
} from "../src/data/pricing.js";
import { mentorFormat } from "../src/data/mentor-formats.js";
import {
  mentorSessions,
  roomFormat,
  dayMs,
  hourMs,
} from "../src/data/mentor-room.js";

export const paymentActions = new Set(paymentActionNames);

export function createMentorPayments({
  getDb,
  now,
  fail,
  event,
  mirror,
  isAdmin,
  settings,
  bookOffice,
  validateOffice,
  acceptUpgrade,
  roomAction,
  secret,
}) {
  const provider = createPayments(getDb, secret);
  const config = () => ({ ...pricingConfig, ...getDb().pricingConfig });
  const ledger = () => (getDb().payments ||= {});
  const lookup = (ref) => (Object.hasOwn(ledger(), ref) ? ledger()[ref] : null);
  const stamp = () => new Date(now()).toISOString();
  const account = (id) => getDb().accounts[id];
  const paid = (payment) => ["held", "disputed"].includes(payment.status);
  const entry = (room) => room.payment && lookup(room.payment.providerRef);
  function participants(payment) {
    return [account(payment.founderId), account(payment.mentorId)].filter(
      Boolean,
    );
  }
  function notify(payment, kind, text) {
    for (const user of participants(payment))
      event(
        user,
        user.id === payment.founderId ? "founder" : "mentor",
        text,
        payment.roomId,
        { kind, page: payment.roomId ? undefined : "settings" },
      );
  }
  function publish(payment) {
    for (const user of participants(payment)) {
      const room = user.state.rooms[payment.roomId];
      if (room) {
        room.payment = structuredClone(payment);
        room.paymentHistory ||= [];
        if (
          !room.paymentHistory.some(
            (item) => item.providerRef === payment.providerRef,
          )
        )
          room.paymentHistory.push({
            providerRef: payment.providerRef,
            amount: payment.amount,
            format: payment.format,
          });
      }
    }
  }
  function transition(payment, status, reason, by = "system") {
    if (payment.status === status) return false;
    payment.history.push({
      at: stamp(),
      from: payment.status,
      to: status,
      by,
      reason,
    });
    payment.status = status;
    publish(payment);
    return true;
  }
  function create({
    founderId,
    mentorId,
    amount,
    format,
    roomId,
    upgrade,
    hold,
  }) {
    const limits = config();
    if (!Number.isSafeInteger(amount) || amount <= 0)
      fail("This saved price is unavailable.", 409);
    const payment = {
      ...split(amount, limits.platformFeeRate),
      currency: limits.currency,
      feeRate: limits.platformFeeRate,
      providerRef: randomUUID(),
      founderId,
      mentorId,
      format,
      roomId,
      upgrade,
      hold,
      mentorName: account(mentorId).state.accountName,
      status: "due",
      releaseAmount: 0,
      refundAmount: 0,
      history: [],
      dueBy: new Date(
        now() +
          (hold ? limits.slotHoldMinutes / 60 : limits.paymentWindowHours) *
            hourMs,
      ).toISOString(),
      responseDays:
        account(mentorId).state.profiles.mentor.capacity?.responseDays ||
        settings().defaultResponseDays,
    };
    payment.checkoutRef = provider.createCheckout(payment).checkoutRef;
    ledger()[payment.providerRef] = payment;
    payment.history.push({
      at: stamp(),
      from: null,
      to: "due",
      by: "system",
      reason: "Checkout opened",
    });
    publish(payment);
    if (!hold)
      notify(payment, "payment-due", "Complete checkout for your mentorship.");
    return payment;
  }
  function initialize(room, price, ownerId) {
    if (!price || room.payment) return;
    const payment = create({
      founderId: room.role === "founder" ? ownerId : room.partnerAccountId,
      mentorId: room.role === "mentor" ? ownerId : room.partnerAccountId,
      roomId: room.id,
      format: roomFormat(room),
      amount: price,
    });
    room.payment = structuredClone(payment);
    if (room.cycle) {
      payment.checkIns = room.cycle.checkIns;
      payment.cycleNumber = room.cycle.number;
    }
  }
  function settle(payment, release, refund, reason) {
    if (!paid(payment)) return;
    if (release === payment.releaseAmount && refund === payment.refundAmount)
      return;
    if (
      ![release, refund].every(Number.isSafeInteger) ||
      release < payment.releaseAmount ||
      refund < payment.refundAmount ||
      release + refund > payment.amount
    )
      fail("Settlement exceeds the remaining payment.", 409);
    provider.release(payment.providerRef, release);
    provider.refund(payment.providerRef, refund);
    const released = release > payment.releaseAmount;
    const refunded = refund > payment.refundAmount;
    payment.releaseAmount = release;
    payment.refundAmount = refund;
    payment.fee = split(release, payment.feeRate).fee;
    payment.payout = release - payment.fee;
    if (released) {
      payment.releasedAt = stamp();
      notify(payment, "payout-released", "A mentorship payment was released.");
    }
    if (refunded) {
      payment.refundedAt = stamp();
      notify(payment, "refund", "A mentorship payment was refunded.");
    }
    if (release + refund === payment.amount)
      transition(
        payment,
        refund === payment.amount
          ? "refunded"
          : refund
            ? "partially-refunded"
            : "released",
        reason,
      );
    else {
      payment.history.push({
        at: stamp(),
        from: payment.status,
        to: payment.status,
        by: "system",
        reason,
      });
      publish(payment);
    }
  }
  function dispute(payment, reason) {
    if (!paid(payment) || payment.dispute)
      fail("A payment dispute is unavailable.", 409);
    const deadline = new Date(now());
    let remaining = config().paymentDisputeBusinessDays;
    while (remaining) {
      deadline.setUTCDate(deadline.getUTCDate() + 1);
      if (![0, 6].includes(deadline.getUTCDay())) remaining--;
    }
    payment.dispute = {
      reason,
      openedAt: stamp(),
      dueAt: deadline.toISOString(),
    };
    transition(payment, "disputed", reason);
    notify(
      payment,
      "payment-dispute",
      "A mentorship payment needs moderator review.",
    );
  }
  function syncRoom(room) {
    if (
      !room.payment?.upgrade &&
      (!room.payment || room.payment.format === roomFormat(room))
    )
      for (const session of mentorSessions(room))
        session.paid = Boolean(room.payment?.amount);
    let payment = entry(room);
    if (
      roomFormat(room) === "ongoing-advisory" &&
      room.cycle?.number > 1 &&
      !room.cycle.paymentInitialized
    ) {
      const other = account(room.partnerAccountId)?.state.rooms[room.id];
      const mentorId =
        room.role === "mentor"
          ? other?.partnerAccountId
          : room.partnerAccountId;
      const founderId =
        room.role === "founder"
          ? other?.partnerAccountId
          : room.partnerAccountId;
      const amount =
        room.nextCyclePriceAccepted ??
        account(mentorId)?.state.profiles.mentor.formats.find(
          (f) => f.id === "ongoing-advisory",
        )?.price ??
        0;
      room.cycle.paymentInitialized = true;
      if (amount) {
        payment = create({
          founderId,
          mentorId,
          roomId: room.id,
          format: "ongoing-advisory",
          amount,
        });
        payment.cycleNumber = room.cycle.number;
        payment.checkIns = room.cycle.checkIns;
        room.payment = structuredClone(payment);
      } else delete room.payment;
      room.terms.draft.price = amount;
      delete room.nextCyclePriceAccepted;
    }
    if (
      !payment ||
      !paid(payment) ||
      payment.status === "disputed" ||
      payment.upgrade
    )
      return;
    const sessions = mentorSessions(room);
    if (sessions.some((s) => s.outcome === "disputed")) {
      dispute(payment, "Attendance disputed");
      return;
    }
    const format = mentorFormat(payment.format);
    if (!format.sync) {
      const info = room.mentorship;
      if (room.status === "cancelled") {
        settle(payment, 0, payment.amount, "Async engagement cancelled");
        room.payment = structuredClone(payment);
        return;
      }
      if (
        !info.deliveredAt &&
        now() >= Date.parse(payment.paidAt) + payment.responseDays * dayMs
      ) {
        settle(payment, 0, payment.amount, "Response deadline missed");
        room.status = "cancelled";
        room.closeReason = "mentor-non-delivery";
        info.slotReleased = true;
      } else if (info.deliveredAt) {
        const helpful =
          info.answerRating === "helpful" ||
          info.answerRating?.helpful === true;
        const unhelpful =
          info.answerRating === "not-helpful" ||
          info.answerRating?.helpful === false;
        const due = unhelpful
          ? Date.parse(info.answerRatedAt || info.answerRating?.at) +
            settings().asyncAutoCompleteDays * dayMs
          : Date.parse(info.deliveredAt) +
            settings().asyncAutoCompleteDays * dayMs;
        if (helpful || now() >= due)
          settle(payment, payment.amount, 0, "Response delivered");
      }
    } else if (payment.format === "ongoing-advisory") {
      const count =
        payment.checkIns || room.cycle?.checkIns || settings().checkInsPerCycle;
      let release = 0,
        refund = 0;
      for (let i = 0; i < count; i++) {
        const session = sessions[i];
        const share = installment(payment.amount, count, i);
        if (
          session?.outcome === "held" ||
          session?.outcome === "no-show-founder" ||
          (session?.cancelledBy === "founder" && session.lateCancel)
        )
          release += share;
        else if (
          session?.outcome?.startsWith("no-show") ||
          session?.cancelledAt ||
          room.mentorship.endedAt ||
          room.status === "cancelled"
        )
          refund += share;
      }
      if (
        room.cycle?.endedAt &&
        now() >=
          Date.parse(room.cycle.endedAt) +
            config().cycleRemainderReleaseDays * dayMs
      )
        release = payment.amount - refund;
      settle(
        payment,
        Math.max(payment.releaseAmount, release),
        Math.max(payment.refundAmount, refund),
        "Advisory settlement",
      );
    } else {
      const session = sessions[0];
      const old = room.mentorship.sessionHistory || [];
      const changed = old.find(
        (s) => s.lateCancel && !payment.acceptedReschedules?.includes(s.id),
      );
      const cancel = changed || session;
      if (
        session?.outcome === "held" ||
        session?.outcome === "no-show-founder" ||
        (cancel?.cancelledBy === "founder" && cancel.lateCancel)
      )
        settle(
          payment,
          payment.amount,
          0,
          "Session delivered or late founder cancellation",
        );
      else if (
        session?.outcome?.startsWith("no-show") ||
        cancel?.cancelledAt ||
        room.status === "cancelled"
      )
        settle(payment, 0, payment.amount, "Session refunded");
    }
    publish(payment);
    room.payment = structuredClone(payment);
  }
  function expire(payment) {
    if (payment.status !== "due" || now() < Date.parse(payment.dueBy))
      return false;
    transition(payment, "lapsed", "Payment window expired");
    if (payment.hold) {
      delete payment.hold.input;
      return true;
    }
    if (payment.upgrade) {
      notify(
        payment,
        "payment-lapsed",
        "The upgrade payment window expired. Your current format continues.",
      );
      return true;
    }
    for (const user of participants(payment)) {
      const room = user.state.rooms[payment.roomId];
      if (room) {
        room.status = "cancelled";
        room.closeReason = "payment-lapsed";
        room.mentorship.slotReleased = true;
      }
    }
    const founder = account(payment.founderId);
    const lapses = Object.values(ledger()).filter(
      (item) =>
        item.founderId === payment.founderId &&
        item.status === "lapsed" &&
        !item.hold &&
        !item.upgrade &&
        Date.parse(item.dueBy) >=
          now() - config().paymentLapseWindowDays * dayMs,
    );
    if (lapses.length >= config().paymentLapseLimit) {
      founder.state.mentorshipLimits ||= {};
      founder.state.mentorshipLimits.founder = new Date(
        now() + settings().noShowLimitDays * dayMs,
      ).toISOString();
    }
    notify(
      payment,
      "payment-lapsed",
      "The payment window expired and the mentorship closed.",
    );
    return true;
  }
  function holdSlot(user, state, input) {
    if (state.role !== "founder")
      fail("Only founders can book Office Hours.", 403);
    if (typeof input.id !== "string") fail("Choose an available mentor.", 404);
    const mentor = account(input.id?.replace(/:mentor$/, ""));
    const slot = state.directory.mentors
      .find((p) => p.id === input.id)
      ?.officeHours.find(
        (s) =>
          s.slotId === input.values?.slotId && s.date === input.values?.date,
      );
    if (!slot) fail("Just taken. Choose another slot.", 409);
    const amount =
      mentor?.state.profiles.mentor.formats.find((f) => f.id === "office-hours")
        ?.price || 0;
    if (!amount) return false;
    validateOffice(user, state, input);
    const existing = Object.values(ledger()).find(
      (p) =>
        p.hold?.occurrenceId === slot.id &&
        p.mentorId === mentor.id &&
        p.status === "due" &&
        Date.parse(p.dueBy) > now(),
    );
    if (existing) {
      if (existing.founderId !== user.id)
        fail("Just taken. Choose another slot.", 409);
      state.paymentCheckout = existing.providerRef;
      return true;
    }
    const payment = create({
      founderId: user.id,
      mentorId: mentor.id,
      amount,
      format: "office-hours",
      hold: { occurrenceId: slot.id, input: structuredClone(input) },
    });
    state.paymentCheckout = payment.providerRef;
    return true;
  }
  function intercept(user, state, input) {
    const room = state.rooms[input.activeRoomId];
    if (input.action === "book-office-hours")
      return holdSlot(user, state, input);
    if (!room) return false;
    if (input.action === "accept-upgrade") {
      if (paid(entry(room) || {}))
        fail("Finish the current payment before upgrading.", 409);
      const proposal = room.mentorship.upgrade;
      if (proposal && proposal.proposedBy !== state.role) {
        const mentorId =
          room.role === "mentor" ? user.id : room.partnerAccountId;
        const amount =
          account(mentorId).state.profiles.mentor.formats.find(
            (f) => f.id === proposal.format,
          )?.price || 0;
        if (amount) {
          let payment = Object.values(ledger()).find(
            (p) => p.roomId === room.id && p.upgrade && p.status === "due",
          );
          payment ||= create({
            founderId:
              room.role === "founder" ? user.id : room.partnerAccountId,
            mentorId,
            amount,
            roomId: room.id,
            format: proposal.format,
            upgrade: true,
          });
          state.paymentCheckout = payment.providerRef;
          return true;
        }
        if (room.payment) {
          roomAction(user, state, input);
          delete room.payment;
          room.terms.draft.price = 0;
          mirror(user, state, room);
          return true;
        }
      }
    }
    const payment = entry(room);
    if (payment?.status === "held" && input.action === "reschedule-session") {
      const session = mentorSessions(room)[Number(input.values?.scheduleIndex)];
      if (
        session &&
        ((session.reschedules?.[state.role] || 0) >=
          settings().freeReschedulesPerSide ||
          Date.parse(session.startsAt) - now() <
            settings().lateNoticeHours * hourMs)
      ) {
        if (state.role === "mentor") {
          payment.reschedulePending = structuredClone(input);
          publish(payment);
          room.payment = structuredClone(payment);
          state.toast =
            "The founder must accept this late change or receive a refund.";
        } else {
          session.lateCancel = true;
          roomAction(user, state, {
            action: "cancel-session",
            activeRoomId: room.id,
            values: { ...input.values, reason: "Late founder reschedule" },
          });
          if (payment.format !== "ongoing-advisory")
            settle(payment, payment.amount, 0, "Late founder reschedule");
          state.toast =
            "The session was cancelled as a late change. Book a new paid session to choose another time.";
        }
        return true;
      }
    }
    if (payment?.status === "due" && !payment.upgrade)
      fail("Complete payment before starting this mentorship.", 409);
    if (
      paid(payment || {}) &&
      roomFormat(room) === "ongoing-advisory" &&
      input.action === "cycle-decision" &&
      input.values?.decision === "continue"
    )
      fail("The current cycle payment must finish before continuing.", 409);
    if (
      input.action === "cycle-decision" &&
      input.values?.decision === "continue" &&
      state.role === "founder"
    ) {
      const mentor = account(room.partnerAccountId);
      const price =
        mentor.state.profiles.mentor.formats.find(
          (f) => f.id === "ongoing-advisory",
        )?.price || 0;
      if (price && Number(input.values.acceptedPrice) !== price)
        fail("Review the current cycle price before continuing.", 409);
      room.nextCyclePriceAccepted = price;
    }
    return false;
  }
  function confirm(payment, result, user, state) {
    const checkout = provider.getCheckout(payment.providerRef);
    if (checkout.status === "paid") return;
    if (!["success", "failure", "expiry"].includes(result))
      fail("Choose a checkout outcome.");
    if (result !== "success") {
      // The room's next step tells the founder to retry (Nov 22, round 2).
      if (result === "failure") payment.failedAt = stamp();
      if (result === "expiry") {
        payment.dueBy = stamp();
        expire(payment);
        // expire() closes the stored rooms; the caller saves `state`, so the
        // payer's working copy must carry the same closed room.
        const stored = user.state.rooms[payment.roomId];
        if (stored && state.rooms[payment.roomId])
          state.rooms[payment.roomId] = structuredClone(stored);
        state.paymentCheckout = null;
      }
      state.toast =
        result === "failure"
          ? "Payment didn't go through. Nothing was charged. Select Retry payment to try again."
          : payment.status === "lapsed" && !payment.hold && !payment.upgrade
            ? "Checkout expired. This request is closed."
            : "Checkout expired.";
      return;
    }
    checkout.status = "paid";
    payment.paidAt = stamp();
    if (payment.status === "lapsed" || now() >= Date.parse(payment.dueBy)) {
      transition(payment, "held", "Late payment received");
      settle(payment, 0, payment.amount, "Checkout expired before payment");
      state.toast =
        "That slot or payment window was released. Your payment has been refunded.";
      return;
    }
    transition(payment, "held", "Payment received", user.id);
    if (payment.hold) {
      // Booking still checks capacity and conflicts.
      const input = payment.hold.input;
      try {
        bookOffice(user, state, input);
        payment.roomId = state.activeRoomId;
        const room = state.rooms[payment.roomId];
        room.terms.draft.price = payment.amount;
      } catch (error) {
        settle(payment, 0, payment.amount, "Slot no longer available");
        state.toast = "That slot was released. Your payment has been refunded.";
        return;
      }
    }
    if (payment.upgrade) {
      const mentor = account(payment.mentorId);
      const targetState = user.id === mentor.id ? state : mentor.state;
      try {
        acceptUpgrade(mentor, targetState, {
          action: "accept-upgrade",
          activeRoomId: payment.roomId,
          values: {},
        });
      } catch {
        // The accepting participant may be the founder.
        try {
          acceptUpgrade(user, state, {
            action: "accept-upgrade",
            activeRoomId: payment.roomId,
            values: {},
          });
        } catch {
          settle(payment, 0, payment.amount, "Upgrade no longer available");
          return;
        }
      }
      payment.upgrade = false;
      if (user.id !== mentor.id)
        state.rooms[payment.roomId] = structuredClone(
          user.state.rooms[payment.roomId],
        );
      state.rooms[payment.roomId].terms.draft.price = payment.amount;
    }
    const owner =
      state.rooms[payment.roomId] ||
      account(payment.mentorId).state.rooms[payment.roomId];
    if (owner?.cycle) {
      payment.checkIns = owner.cycle.checkIns;
      payment.cycleNumber = owner.cycle.number;
    }
    publish(payment);
    notify(
      payment,
      "payment-received",
      "A mentorship payment is held by the provider.",
    );
    state.paymentCheckout = null;
    if (payment.roomId) {
      state.activeRoomId = payment.roomId;
      state.page = "room-detail";
      state.roomTab = "overview";
    }
  }
  function act(user, state, input) {
    const values = input.values || {};
    if (input.action === "pricing-config") {
      if (!isAdmin(user)) fail("Moderator access required.", 403);
      const before = config();
      if (!Object.hasOwn(before, values.key) || values.key === "currency")
        fail("Choose a pricing setting.");
      const next = { ...before, [values.key]: Number(values.value) };
      if (
        !Object.entries(next).every(
          ([key, value]) =>
            key === "currency" ||
            (Number.isFinite(value) &&
              value > 0 &&
              (key === "platformFeeRate"
                ? value < 1
                : Number.isSafeInteger(value))),
        ) ||
        next.maxPrice < next.minPrice ||
        next.paymentReminderHours >= next.paymentWindowHours
      )
        fail("Choose valid pricing limits.");
      getDb().pricingConfig = next;
      (getDb().pricingHistory ||= []).push({
        at: stamp(),
        by: user.id,
        key: values.key,
        before: before[values.key],
        value: next[values.key],
      });
      return;
    }
    if (input.action === "start-payout-setup") {
      if (state.role !== "mentor")
        fail("Only mentors can set up payouts.", 403);
      state.profiles.mentor.payoutSetup ||= provider.startPayoutSetup();
      state.toast = "Payout setup complete.";
      return;
    }
    if (input.action === "set-format-price") {
      if (state.role !== "mentor") fail("Only mentors can set prices.", 403);
      const amount = Number(values.price);
      const profile = state.profiles.mentor;
      const format = profile.formats.find((f) => f.id === values.format);
      if (!format)
        fail("Offer this format in Mentoring settings before pricing it.");
      // One cause per message, so the mentor knows exactly what to fix.
      const priceError = (message) => fail(message, 400, { price: message });
      if (!validPrice(amount, config()))
        priceError(
          `Choose Free (0) or a price from ${priceRangeText(config())}.`,
        );
      if (amount && profile.guidelinesVersion !== settings().guidelinesVersion)
        priceError(
          "Accept the current mentor guidelines in Settings before charging for a format.",
        );
      if (amount && profile.payoutSetup?.status !== "ready")
        priceError("Complete payout setup before charging for a format.");
      format.price = amount;
      state.toast = `${mentorFormat(format.id)?.label || "Format"} price saved.`;
      return;
    }
    const ref =
      values.providerRef ||
      state.rooms[input.activeRoomId]?.payment?.providerRef ||
      state.paymentCheckout;
    const payment = lookup(ref);
    if (
      !payment ||
      (!participants(payment).some((p) => p.id === user.id) && !isAdmin(user))
    )
      fail("Payment unavailable.", 404);
    if (
      ["accept-paid-reschedule", "decline-paid-reschedule"].includes(
        input.action,
      )
    ) {
      if (
        payment.founderId !== user.id ||
        !payment.reschedulePending ||
        payment.status !== "held"
      )
        fail("This time change is unavailable.", 409);
      const mentor = account(payment.mentorId);
      const command = payment.reschedulePending;
      const target = mentor.state.rooms[payment.roomId];
      if (input.action === "accept-paid-reschedule") {
        const old =
          mentorSessions(target)[Number(command.values.scheduleIndex)];
        (payment.acceptedReschedules ||= []).push(old.id);
        roomAction(mentor, mentor.state, command);
      } else {
        roomAction(mentor, mentor.state, {
          action: "cancel-session",
          activeRoomId: target.id,
          values: {
            ...command.values,
            reason: "Founder declined late mentor change",
          },
        });
      }
      delete payment.reschedulePending;
      state.rooms[target.id] = structuredClone(
        account(user.id).state.rooms[target.id],
      );
      publish(payment);
      return;
    }
    if (["pay", "simulate-payment"].includes(input.action)) {
      if (payment.founderId !== user.id || state.role !== "founder")
        fail("Only the founder can pay.", 403);
      if (input.action === "pay") {
        state.paymentCheckout = ref;
        if (payment.roomId) {
          state.activeRoomId = payment.roomId;
          state.page = "room-detail";
        }
      } else confirm(payment, values.result, user, state);
    } else if (input.action === "confirm-delivery") {
      if (
        state.role !== "founder" ||
        user.id !== payment.founderId ||
        mentorFormat(payment.format).sync
      )
        fail("Only the founder can confirm an async delivery.", 403);
      const room = state.rooms[payment.roomId];
      if (!room.mentorship.deliveredAt)
        fail("The mentor has not delivered a response.");
      roomAction(user, state, {
        action: "rate-answer",
        activeRoomId: room.id,
        values: { rating: "helpful" },
      });
    } else if (input.action === "open-payment-dispute") {
      if (state.role !== "founder" || user.id !== payment.founderId)
        fail("Only the founder can dispute a payment.", 403);
      if (typeof values.reason !== "string" || !values.reason.trim())
        fail("Add a dispute reason.");
      dispute(payment, values.reason.trim().slice(0, 1000));
    } else if (input.action === "resolve-payment-dispute") {
      if (!isAdmin(user)) fail("Moderator access required.", 403);
      const release = Number(values.release),
        refund = Number(values.refund);
      if (payment.status !== "disputed" || release + refund !== payment.amount)
        fail("Release and refund must total the payment.");
      settle(payment, release, refund, "Moderator resolution");
      payment.dispute.resolvedAt = stamp();
      payment.dispute.resolvedBy = user.id;
      publish(payment);
    }
  }
  function sweep() {
    let changed = false;
    for (const payment of Object.values(ledger())) {
      if (expire(payment)) changed = true;
      if (
        payment.status === "due" &&
        !payment.hold &&
        !payment.reminded &&
        now() >=
          Date.parse(payment.dueBy) - config().paymentReminderHours * hourMs
      ) {
        payment.reminded = true;
        notify(
          payment,
          "payment-due",
          "Your mentorship payment window closes soon.",
        );
        changed = true;
      }
      const room = account(payment.mentorId)?.state.rooms[payment.roomId];
      if (
        payment.reschedulePending &&
        room &&
        now() >=
          Date.parse(
            mentorSessions(room)[
              Number(payment.reschedulePending.values.scheduleIndex)
            ]?.startsAt,
          )
      ) {
        const session =
          mentorSessions(room)[
            Number(payment.reschedulePending.values.scheduleIndex)
          ];
        session.cancelledAt = stamp();
        session.cancelledBy = "mentor";
        session.cancelReason = "Late mentor time change unanswered";
        syncRoom(room);
        mirror(
          account(payment.mentorId),
          account(payment.mentorId).state,
          room,
        );
        delete payment.reschedulePending;
        changed = true;
      }
      if (room && paid(payment)) {
        const before = JSON.stringify(payment);
        syncRoom(room);
        if (before !== JSON.stringify(payment)) {
          mirror(
            account(payment.mentorId),
            account(payment.mentorId).state,
            room,
          );
          changed = true;
        }
      }
    }
    return changed;
  }
  function decorate(user, state) {
    for (const room of Object.values(state.rooms)) {
      const payment = entry(room);
      if (payment) room.payment = structuredClone(payment);
      if (room.cycle) {
        const mentorId =
          room.role === "mentor" ? user.id : room.partnerAccountId;
        room.nextCyclePrice =
          account(mentorId)?.state.profiles.mentor.formats.find(
            (f) => f.id === "ongoing-advisory",
          )?.price || 0;
      }
    }
    const mine = Object.values(ledger())
      .filter((p) => !(p.hold && p.status === "lapsed" && !p.paidAt))
      .filter(
        (p) =>
          (p.founderId === user.id && state.role === "founder") ||
          (p.mentorId === user.id && state.role === "mentor"),
      );
    state.pricingConfig = config();
    if (isAdmin(user))
      state.pricingHistory = structuredClone(getDb().pricingHistory || []);
    state.paymentRecords = mine.map((p) => structuredClone(p));
    state.paymentCheckoutData = mine.find(
      (p) => p.providerRef === state.paymentCheckout,
    );
    if (isAdmin(user))
      state.paymentModeration = Object.values(ledger())
        .filter((p) => p.status === "disputed")
        .map((p) => structuredClone(p));
  }
  function webhook(body, signature) {
    if (!provider.verifyWebhook(body, signature))
      fail("Invalid webhook signature.", 403);
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      fail("Invalid webhook.");
    }
    if (
      typeof data.id !== "string" ||
      !data.id ||
      typeof data.providerRef !== "string"
    )
      fail("Invalid webhook event.");
    const seen = (getDb().paymentWebhookEvents ||= {});
    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(data.id))
      fail("Invalid webhook event id.");
    if (Object.hasOwn(seen, data.id)) return { repeated: true };
    const payment = lookup(data.providerRef);
    if (!payment) fail("Payment unavailable.", 404);
    if (!["success", "failure", "expiry"].includes(data.result))
      fail("Invalid payment event.");
    const user = account(payment.founderId);
    confirm(payment, data.result, user, user.state);
    seen[data.id] = { at: stamp(), providerRef: data.providerRef };
    return { ok: true };
  }
  return {
    act,
    initialize,
    intercept,
    syncRoom,
    sweep,
    decorate,
    webhook,
    config,
    provider,
  };
}
