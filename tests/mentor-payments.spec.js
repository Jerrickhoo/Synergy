import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import {
  command,
  getState,
  open,
  user,
  post,
} from "./founder-browser-helpers.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";
test.use({ baseURL: "http://127.0.0.1:5187" });
test("paid session checkout, held attendance, no-show refund and moderator split", async ({
  browser,
  request,
}) => {
  let page;
  test.setTimeout(90000);
  const clock = (value) =>
    writeFileSync(".data/mentor-payment-browser-clock.txt", value);
  clock("2031-03-02T02:00:00Z");
  const mentor = await user(
    request,
    "PaidMentor",
    {
      bio: "Coaching product teams",
      offer: "Product strategy",
      need: "Focused questions",
      expertise: "Product strategy",
      startups: "Education startups",
    },
    "mentor",
  );
  await command(request, mentor, { action: "start-payout-setup" });
  await command(request, mentor, {
    action: "set-format-price",
    values: { format: "single-session", price: 150000 },
  });
  async function pair(label) {
    const founder = await user(request, label);
    await command(request, founder, {
      action: "send-request",
      id: mentor.state.accountId + ":mentor",
      values: mentorRequestValues,
    });
    const id = (
      await command(request, mentor, {
        action: "accept-request",
        id: founder.state.accountId + ":founder",
      })
    ).state.activeRoomId;
    page = await (await browser.newContext()).newPage();
    await open(page, founder, "rooms/" + id);
    await page.getByRole("button", { name: "Pay now", exact: true }).click();
    await expect(
      page.getByText("Simulated payment. No money moves."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Simulate success", exact: true })
      .click();
    await expect
      .poll(
        async () => (await getState(request, founder)).rooms[id].payment.status,
      )
      .toBe("held");
    return { founder, id };
  }
  const a = await pair("PaidFounder");
  await command(request, mentor, {
    action: "confirm-goal",
    activeRoomId: a.id,
  });
  await command(request, a.founder, {
    form: "schedule",
    activeRoomId: a.id,
    values: {
      date: "2031-03-04",
      time: "10:00",
      timeZone: "Asia/Manila",
      durationMinutes: 60,
    },
  });
  clock("2031-03-04T02:01:00Z");
  for (const participant of [mentor, a.founder])
    await command(request, participant, {
      action: "report-attendance",
      activeRoomId: a.id,
      values: { scheduleIndex: 0, status: "held" },
    });
  expect((await getState(request, a.founder)).rooms[a.id].payment.status).toBe(
    "released",
  );
  const b = await pair("RefundFounder");
  await command(request, mentor, {
    action: "confirm-goal",
    activeRoomId: b.id,
  });
  await command(request, b.founder, {
    form: "schedule",
    activeRoomId: b.id,
    values: {
      date: "2031-03-06",
      time: "10:00",
      timeZone: "Asia/Manila",
      durationMinutes: 60,
    },
  });
  clock("2031-03-06T02:01:00Z");
  await command(request, mentor, {
    action: "report-attendance",
    activeRoomId: b.id,
    values: { scheduleIndex: 0, status: "i-missed" },
  });
  expect((await getState(request, b.founder)).rooms[b.id].payment.status).toBe(
    "refunded",
  );
  const c = await pair("SplitFounder");
  await page
    .getByLabel("Payment dispute reason")
    .fill("The mentor could not deliver the agreed scope.");
  await page
    .getByRole("button", { name: "Open payment dispute", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await getState(request, c.founder)).rooms[c.id].payment.status,
    )
    .toBe("disputed");
  let response = await request.post("/api/signup", {
    data: {
      role: "founder",
      firstName: "Payment",
      lastName: "Moderator",
      email: "moderator@example.com",
      password: "private-password",
    },
  });
  if (!response.ok())
    response = await request.post("/api/login", {
      data: { email: "moderator@example.com", password: "private-password" },
    });
  expect(response.ok()).toBeTruthy();
  const admin = { ...(await response.json()), role: "founder" };
  page = await (await browser.newContext()).newPage();
  await open(page, admin, "moderation");
  await page.getByLabel("Release in centavos").fill("75000");
  await page.getByLabel("Refund in centavos").fill("75000");
  await page
    .getByRole("button", { name: "Resolve payment dispute", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await getState(request, c.founder)).rooms[c.id].payment.status,
    )
    .toBe("partially-refunded");
});
