import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createHmac } from "node:crypto";
import { createWorkspace, scoreProfile } from "../server/workspace.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";
import { split, pricingConfig } from "../src/data/pricing.js";

function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), "synergy-payments-"));
  const clock = { value: Date.parse("2031-03-02T02:00:00Z") };
  const secret = "payment-test-secret-32-characters";
  const w = createWorkspace(join(folder, "workspace.sqlite"), {
    now: () => clock.value,
    mentorApprovalRequired: false,
    adminEmails: ["admin@example.com"],
    paymentsWebhookSecret: secret,
  });
  t.after(() => {
    w.close();
    assert.ok(resolve(folder).startsWith(resolve(tmpdir()) + sep));
    rmSync(folder, { recursive: true });
  });
  const act = (u, input) => w.act(u.token, { role: u.role, ...input }).state;
  const view = (u) => w.get(u.token, u.role).state;
  function user(name, role) {
    const u = {
      ...w.login(
        {
          firstName: name,
          lastName: "Test",
          email: name + "@example.com",
          password: "private-password",
          role,
        },
        true,
      ),
      role,
    };
    act(u, {
      form: "profile-form",
      values:
        role === "mentor"
          ? {
              bio: "Advising product teams",
              offer: "Product strategy",
              need: "Focused questions",
              expertise: "Product strategy",
              startups: "Education startups",
            }
          : {
              startupName: name,
              bio: "Building student tools",
              offer: "User feedback",
              need: "Product strategy",
              industry: "Education",
              stage: "idea",
              teamSize: "3",
              goals: "Improve onboarding",
              engagementPreference: "one-off",
            },
    });
    if (role === "mentor")
      act(u, { form: "accept-guidelines", values: { version: 2 } });
    return u;
  }
  const mentor = user("mentor", "mentor"),
    founder = user("founder", "founder"),
    admin = user("admin", "founder");
  act(mentor, {
    form: "mentor-capacity",
    values: {
      maxMentees: 10,
      monthlyHours: 40,
      maxOpenAsync: 10,
      responseDays: 3,
      timeZone: "Asia/Manila",
      ...Object.fromEntries(
        [
          "single-session",
          "quick-ask",
          "doc-review",
          "ongoing-advisory",
          "office-hours",
        ].map((id) => ["format-" + id, "on"]),
      ),
    },
  });
  act(mentor, { action: "start-payout-setup" });
  const price = (format, amount = 150000) =>
    act(mentor, {
      action: "set-format-price",
      values: { format, price: amount },
    });
  function connect(format = "single-session") {
    price(format);
    act(founder, {
      action: "send-request",
      id: mentor.state.accountId + ":mentor",
      values: { ...mentorRequestValues, format, price: 1 },
    });
    return act(mentor, {
      action: "accept-request",
      id: founder.state.accountId + ":founder",
    }).activeRoomId;
  }
  const payment = (id) => view(founder).rooms[id].payment;
  const pay = (id) =>
    act(founder, {
      action: "simulate-payment",
      activeRoomId: id,
      values: { result: "success", amount: 1 },
    });
  const roomAct = (u, id, action, values = {}) =>
    act(u, { action, activeRoomId: id, values });
  return {
    w,
    act,
    view,
    clock,
    secret,
    mentor,
    founder,
    admin,
    price,
    connect,
    payment,
    pay,
    roomAct,
    user,
  };
}

test("advisory remainder releases after the configured cycle grace period", (t) => {
  const s = fixture(t),
    id = s.connect("ongoing-advisory");
  s.pay(id);
  s.clock.value += 64 * 86400000;
  assert.equal(s.payment(id).status, "released");
  assert.equal(s.payment(id).releaseAmount, 150000);
});

test("a free reschedule holds funds and the second founder reschedule pays the mentor", (t) => {
  const s = fixture(t),
    id = s.connect();
  s.pay(id);
  s.roomAct(s.mentor, id, "confirm-goal");
  s.act(s.founder, {
    form: "schedule",
    activeRoomId: id,
    values: {
      date: "2031-03-08",
      time: "10:00",
      timeZone: "Asia/Manila",
      durationMinutes: 60,
    },
  });
  const values = {
    scheduleIndex: 0,
    date: "2031-03-09",
    time: "10:00",
    timeZone: "Asia/Manila",
  };
  s.roomAct(s.founder, id, "reschedule-session", values);
  assert.equal(s.payment(id).status, "held");
  s.roomAct(s.founder, id, "reschedule-session", {
    ...values,
    date: "2031-03-10",
  });
  assert.equal(s.payment(id).status, "released");
});

test("declining a late mentor change refunds the payment", (t) => {
  const s = fixture(t),
    id = s.connect();
  s.pay(id);
  s.roomAct(s.mentor, id, "confirm-goal");
  s.act(s.founder, {
    form: "schedule",
    activeRoomId: id,
    values: {
      date: "2031-03-04",
      time: "10:00",
      timeZone: "Asia/Manila",
      durationMinutes: 60,
    },
  });
  s.clock.value += 1.75 * 86400000;
  s.roomAct(s.mentor, id, "reschedule-session", {
    scheduleIndex: 0,
    date: "2031-03-05",
    time: "10:00",
    timeZone: "Asia/Manila",
  });
  s.roomAct(s.founder, id, "decline-paid-reschedule");
  assert.equal(s.payment(id).status, "refunded");
});

test("partial advisory releases are stable across repeated reads", (t) => {
  const s = fixture(t),
    id = s.connect("ongoing-advisory");
  s.pay(id);
  const history = s.payment(id).history;
  for (let i = 0; i < 4; i++) assert.deepEqual(s.payment(id).history, history);
});

test("failure remains retryable and expiry refunds a late payment", (t) => {
  const s = fixture(t),
    id = s.connect();
  s.roomAct(s.founder, id, "simulate-payment", { result: "failure" });
  assert.equal(s.payment(id).status, "due");
  s.roomAct(s.founder, id, "simulate-payment", { result: "expiry" });
  assert.equal(s.payment(id).status, "lapsed");
  s.pay(id);
  assert.equal(s.payment(id).status, "refunded");
});

test("pricing-limit changes preserve the saved pending quote", (t) => {
  const s = fixture(t);
  s.price("single-session");
  s.act(s.founder, {
    action: "send-request",
    id: s.mentor.state.accountId + ":mentor",
    values: mentorRequestValues,
  });
  s.roomAct(s.admin, null, "pricing-config", {
    key: "maxPrice",
    value: 100000,
  });
  const id = s.act(s.mentor, {
    action: "accept-request",
    id: s.founder.state.accountId + ":founder",
  }).activeRoomId;
  assert.equal(s.payment(id).amount, 150000);
});

test("paid upgrade switches format only after payment succeeds", (t) => {
  const s = fixture(t),
    id = s.connect("quick-ask");
  s.pay(id);
  s.roomAct(s.mentor, id, "deliver-answer", {
    answer: "Measure first screen completion for a week.",
  });
  s.roomAct(s.founder, id, "rate-answer", { rating: "helpful" });
  s.price("single-session", 200000);
  s.roomAct(s.founder, id, "propose-upgrade", { format: "single-session" });
  s.roomAct(s.mentor, id, "accept-upgrade");
  s.pay(id);
  assert.equal(
    s.view(s.founder).rooms[id].terms.draft.format,
    "single-session",
  );
  assert.equal(s.payment(id).amount, 200000);
});

for (const who of ["mentor", "founder"]) {
  test("late " + who + " reschedule preserves financial rules", (t) => {
    const s = fixture(t),
      id = s.connect();
    s.pay(id);
    s.roomAct(s.mentor, id, "confirm-goal");
    s.act(s.founder, {
      form: "schedule",
      activeRoomId: id,
      values: {
        date: "2031-03-04",
        time: "10:00",
        timeZone: "Asia/Manila",
        durationMinutes: 60,
      },
    });
    s.clock.value += 1.75 * 86400000;
    s.roomAct(s[who], id, "reschedule-session", {
      scheduleIndex: 0,
      date: "2031-03-05",
      time: "10:00",
      timeZone: "Asia/Manila",
    });
    if (who === "mentor") {
      assert.ok(s.payment(id).reschedulePending);
      s.roomAct(s.founder, id, "accept-paid-reschedule");
      assert.equal(s.payment(id).status, "held");
    } else assert.equal(s.payment(id).status, "released");
  });
}

test("advisory renewals quote and save the new cycle price", (t) => {
  const s = fixture(t),
    id = s.connect("ongoing-advisory");
  s.pay(id);
  s.roomAct(s.mentor, id, "confirm-goal");
  s.act(s.founder, {
    form: "propose-check-in-time",
    activeRoomId: id,
    values: { date: "2031-03-04", time: "10:00", timeZone: "Asia/Manila" },
  });
  s.roomAct(s.mentor, id, "confirm-check-in-time");
  for (let index = 0; index < 4; index++) {
    const session = s.view(s.founder).rooms[id].milestones.checkins.schedules[
      index
    ];
    s.clock.value = Date.parse(session.startsAt) + 60000;
    for (const u of [s.mentor, s.founder])
      s.roomAct(u, id, "report-attendance", {
        scheduleIndex: index,
        status: "held",
      });
  }
  assert.equal(s.payment(id).status, "released");
  s.clock.value += 86400000;
  for (const u of [s.mentor, s.founder])
    s.act(u, {
      form: "cycle-review",
      activeRoomId: id,
      values: {
        usefulness: 5,
        clarity: 5,
        responsiveness: 5,
        valueForMoney: 5,
        preparedness: 5,
        followThrough: 5,
      },
    });
  s.price("ongoing-advisory", 200000);
  s.roomAct(s.founder, id, "cycle-decision", {
    decision: "continue",
    acceptedPrice: 200000,
  });
  s.price("ongoing-advisory", 250000);
  s.roomAct(s.mentor, id, "cycle-decision", { decision: "continue" });
  assert.equal(s.payment(id).amount, 200000);
  assert.equal(s.payment(id).status, "due");
  assert.equal(s.view(s.founder).rooms[id].cycle.number, 2);
});

for (const format of ["quick-ask", "doc-review"]) {
  test(
    format + " refunds when the mentor misses the paid response deadline",
    (t) => {
      const s = fixture(t),
        id = s.connect(format);
      s.pay(id);
      s.clock.value += 4 * 86400000;
      assert.equal(s.payment(id).status, "refunded");
      assert.equal(s.view(s.founder).rooms[id].status, "cancelled");
    },
  );
  test(format + " automatically releases five days after delivery", (t) => {
    const s = fixture(t),
      id = s.connect(format);
    s.pay(id);
    s.roomAct(s.mentor, id, "deliver-answer", {
      answer: "Focus on a smaller, measurable onboarding change.",
    });
    s.clock.value += 6 * 86400000;
    assert.equal(s.payment(id).status, "released");
  });
}

for (const [who, hours, expected] of [
  ["mentor", 3.75, "refunded"],
  ["founder", 1, "refunded"],
  ["founder", 3.75, "released"],
]) {
  test(who + " cancellation on day " + hours + " settles " + expected, (t) => {
    const s = fixture(t),
      id = s.connect();
    s.pay(id);
    s.roomAct(s.mentor, id, "confirm-goal");
    s.act(s.founder, {
      form: "schedule",
      activeRoomId: id,
      values: {
        date: "2031-03-06",
        time: "10:00",
        timeZone: "Asia/Manila",
        durationMinutes: 60,
      },
    });
    s.clock.value += hours * 86400000;
    s.roomAct(s[who], id, "cancel-session", {
      scheduleIndex: 0,
      reason: "Schedule changed",
    });
    assert.equal(s.payment(id).status, expected);
  });
}

test("both participants missing receives a full refund", (t) => {
  const s = fixture(t),
    id = s.connect();
  s.pay(id);
  s.roomAct(s.mentor, id, "confirm-goal");
  s.act(s.founder, {
    form: "schedule",
    activeRoomId: id,
    values: {
      date: "2031-03-04",
      time: "10:00",
      timeZone: "Asia/Manila",
      durationMinutes: 60,
    },
  });
  s.clock.value += 2 * 86400000 + 60000;
  for (const u of [s.mentor, s.founder])
    s.roomAct(u, id, "report-attendance", {
      scheduleIndex: 0,
      status: "i-missed",
    });
  assert.equal(s.payment(id).status, "refunded");
});

test("Office Hours hold expires cleanly and late webhook payment is refunded", (t) => {
  const s = fixture(t);
  s.price("office-hours");
  s.act(s.mentor, {
    action: "open-office-slot",
    values: { date: "2031-03-04", time: "10:00", durationMinutes: 30 },
  });
  const slot = s
    .view(s.founder)
    .directory.mentors.find((p) => p.accountId === s.mentor.state.accountId)
    .officeHours[0];
  s.act(s.founder, {
    action: "book-office-hours",
    id: s.mentor.state.accountId + ":mentor",
    values: { ...mentorRequestValues, slotId: slot.slotId, date: slot.date },
  });
  const p = s.view(s.founder).paymentCheckoutData;
  assert.equal(Object.keys(s.view(s.founder).rooms).length, 0);
  assert.equal(s.view(s.founder).directory.mentors[0].officeHours.length, 0);
  s.clock.value += 16 * 60000;
  assert.equal(s.view(s.founder).directory.mentors[0].officeHours.length, 1);
  s.act(s.founder, {
    action: "simulate-payment",
    values: { providerRef: p.providerRef, result: "success" },
  });
  assert.equal(s.view(s.founder).paymentRecords[0].status, "refunded");
  assert.equal(Object.keys(s.view(s.founder).rooms).length, 0);
  assert.equal(s.view(s.founder).mentorRequestLimit, 3);
});

test("Office Hours payment creates exactly one booked room and settles on attendance", (t) => {
  const s = fixture(t);
  s.price("office-hours");
  s.act(s.mentor, {
    action: "open-office-slot",
    values: { date: "2031-03-04", time: "10:00", durationMinutes: 30 },
  });
  const slot = s.view(s.founder).directory.mentors[0].officeHours[0];
  s.act(s.founder, {
    action: "book-office-hours",
    id: s.mentor.state.accountId + ":mentor",
    values: { ...mentorRequestValues, slotId: slot.slotId, date: slot.date },
  });
  const ref = s.view(s.founder).paymentCheckoutData.providerRef;
  const state = s.act(s.founder, {
    action: "simulate-payment",
    values: { providerRef: ref, result: "success" },
  });
  const id = state.activeRoomId;
  assert.equal(Object.keys(state.rooms).length, 1);
  assert.equal(s.payment(id).status, "held");
  s.clock.value += 2 * 86400000 + 60000;
  for (const u of [s.mentor, s.founder])
    s.roomAct(u, id, "report-attendance", { scheduleIndex: 0, status: "held" });
  assert.equal(s.payment(id).status, "released");
});

test("advisory releases each check-in share and refunds the unheld shares on early end", (t) => {
  const s = fixture(t),
    id = s.connect("ongoing-advisory");
  s.pay(id);
  s.roomAct(s.mentor, id, "confirm-goal");
  s.act(s.founder, {
    form: "propose-check-in-time",
    activeRoomId: id,
    values: { date: "2031-03-04", time: "10:00", timeZone: "Asia/Manila" },
  });
  s.roomAct(s.mentor, id, "confirm-check-in-time");
  s.clock.value += 2 * 86400000 + 60000;
  for (const u of [s.mentor, s.founder])
    s.roomAct(u, id, "report-attendance", { scheduleIndex: 0, status: "held" });
  assert.equal(s.payment(id).releaseAmount, 37500);
  s.roomAct(s.mentor, id, "end-mentorship", {
    reason: "End this cycle early.",
  });
  assert.equal(s.payment(id).releaseAmount, 37500);
  assert.equal(s.payment(id).refundAmount, 112500);
});

test("a paid upgrade waits for checkout and lapse keeps the old format", (t) => {
  const s = fixture(t),
    id = s.connect("quick-ask");
  s.pay(id);
  s.roomAct(s.mentor, id, "deliver-answer", {
    answer: "Measure completion before adding more onboarding steps.",
  });
  s.roomAct(s.founder, id, "rate-answer", { rating: "helpful" });
  s.price("single-session", 200000);
  s.roomAct(s.founder, id, "propose-upgrade", { format: "single-session" });
  s.roomAct(s.mentor, id, "accept-upgrade");
  assert.equal(s.view(s.founder).rooms[id].terms.draft.format, "quick-ask");
  s.clock.value += 49 * 3600000;
  assert.equal(s.payment(id).status, "lapsed");
  assert.equal(s.view(s.founder).rooms[id].terms.draft.format, "quick-ask");
});

test("fee conservation covers every allowed price and price never changes matching", () => {
  for (
    let price = pricingConfig.minPrice;
    price <= pricingConfig.maxPrice;
    price++
  ) {
    const parts = split(price);
    assert.equal(parts.fee + parts.payout, price);
  }
  const a = { offer: "Product strategy", need: "Feedback" },
    b = { expertise: "Product strategy", offer: "Product strategy" };
  assert.equal(
    scoreProfile(a, { ...b, formats: [{ id: "quick-ask", price: 0 }] }, true)
      .score,
    scoreProfile(
      a,
      { ...b, formats: [{ id: "quick-ask", price: 150000 }] },
      true,
    ).score,
  );
});

test("paid sessions keep saved prices, require founder payment, release once and mirror settlement", (t) => {
  const s = fixture(t),
    id = s.connect();
  assert.equal(s.payment(id).amount, 150000);
  s.price("single-session", 200000);
  assert.equal(s.payment(id).amount, 150000);
  assert.throws(() => s.roomAct(s.mentor, id, "confirm-goal"), /payment/i);
  s.pay(id);
  s.pay(id);
  s.roomAct(s.mentor, id, "confirm-goal");
  s.act(s.founder, {
    form: "schedule",
    activeRoomId: id,
    values: {
      date: "2031-03-04",
      time: "10:00",
      timeZone: "Asia/Manila",
      durationMinutes: 60,
    },
  });
  s.clock.value = Date.parse("2031-03-04T02:01:00Z");
  for (const u of [s.founder, s.mentor])
    s.roomAct(u, id, "report-attendance", { scheduleIndex: 0, status: "held" });
  assert.equal(s.payment(id).status, "released");
  assert.equal(s.view(s.mentor).rooms[id].payment.releaseAmount, 150000);
  assert.equal(
    s.payment(id).history.filter((e) => e.to === "released").length,
    1,
  );
});

for (const [label, report, expected] of [
  ["mentor absent", "partner-absent", "refunded"],
  ["founder absent", "i-missed", "released"],
]) {
  test(label + " settles to " + expected, (t) => {
    const s = fixture(t),
      id = s.connect();
    s.pay(id);
    s.roomAct(s.mentor, id, "confirm-goal");
    s.act(s.founder, {
      form: "schedule",
      activeRoomId: id,
      values: {
        date: "2031-03-04",
        time: "10:00",
        timeZone: "Asia/Manila",
        durationMinutes: 60,
      },
    });
    s.clock.value = Date.parse("2031-03-04T02:01:00Z");
    s.roomAct(s.founder, id, "report-attendance", {
      scheduleIndex: 0,
      status: report,
    });
    s.clock.value += 73 * 3600000;
    assert.equal(s.payment(id).status, expected);
  });
}

test("webhook signatures and event ids prevent replay and forged settlement", (t) => {
  const s = fixture(t),
    id = s.connect(),
    ref = s.payment(id).providerRef;
  const body = JSON.stringify({
    id: "evt-one",
    providerRef: ref,
    result: "success",
  });
  assert.throws(() => s.w.paymentWebhook(body, "bad"), { status: 403 });
  const signature = createHmac("sha256", s.secret).update(body).digest("hex");
  s.w.paymentWebhook(body, signature);
  const before = s.payment(id);
  assert.deepEqual(s.w.paymentWebhook(body, signature), { repeated: true });
  assert.deepEqual(s.payment(id), before);
});

test("moderator splits only held funds and keeps the fee on the released part", (t) => {
  const s = fixture(t),
    id = s.connect("quick-ask");
  s.pay(id);
  s.roomAct(s.founder, id, "open-payment-dispute", {
    reason: "The response did not address the question.",
  });
  assert.throws(
    () =>
      s.roomAct(s.founder, id, "resolve-payment-dispute", {
        release: 75000,
        refund: 75000,
      }),
    { status: 403 },
  );
  s.roomAct(s.admin, id, "resolve-payment-dispute", {
    providerRef: s.payment(id).providerRef,
    release: 75000,
    refund: 75000,
  });
  assert.equal(s.payment(id).status, "partially-refunded");
  assert.equal(s.payment(id).fee, 11250);
});

test("unpaid rooms lapse without consuming capacity", (t) => {
  const s = fixture(t),
    id = s.connect();
  s.clock.value += 49 * 3600000;
  assert.equal(s.payment(id).status, "lapsed");
  assert.equal(s.view(s.mentor).mentorUsage.activeMentees, 0);
});

for (const rating of ["helpful", "not-helpful"]) {
  test("async " + rating + " uses the correct release delay", (t) => {
    const s = fixture(t),
      id = s.connect("quick-ask");
    s.pay(id);
    s.act(s.mentor, {
      action: "deliver-answer",
      activeRoomId: id,
      values: { answer: "Run one focused test on the first signup screen." },
    });
    s.roomAct(s.founder, id, "rate-answer", { rating });
    if (rating === "not-helpful") {
      assert.equal(s.payment(id).status, "held");
      s.clock.value += 6 * 86400000;
    }
    assert.equal(s.payment(id).status, "released");
  });
}

test("confirm delivery completes the normal async feedback milestone", (t) => {
  const s = fixture(t),
    id = s.connect("quick-ask");
  s.pay(id);
  s.roomAct(s.mentor, id, "deliver-answer", {
    answer: "Test the first screen with five new users.",
  });
  s.roomAct(s.founder, id, "confirm-delivery");
  assert.equal(s.payment(id).status, "released");
  assert.equal(s.view(s.founder).rooms[id].milestones.helpful.me, true);
});
