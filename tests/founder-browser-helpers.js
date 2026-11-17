import { expect } from "@playwright/test";
import { decode } from "../src/state/serialization.js";
export const founderProfile = {
  bio: "Building student tools",
  offer: "Technical development",
  need: "Beta testers",
  industry: "EdTech",
  stage: "idea",
  teamSize: "3",
  goals: "Validate onboarding",
  engagementPreference: "one-off",
};
export const sharedTerms = {
  goal: "Validate onboarding",
  scope: "Review the flow",
  timeline: "Two weeks",
  commitment: "Weekly check-in",
  compensation: "Shared learning",
};
export async function post(request, path, data, token) {
  const response = await request.post(`/api/${path}`, {
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  expect(response.ok(), await response.text()).toBe(true);
  return decode(await response.text());
}
export async function user(
  request,
  prefix,
  profile = founderProfile,
  role = "founder",
) {
  const result = await post(request, "signup", {
    firstName: prefix,
    lastName: "Audit",
    email: `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
    role,
    password: "private-password",
  });
  result.role = role;
  await command(request, result, { form: "profile-form", values: profile });
  return result;
}
export async function getState(request, u) {
  const response = await request.get(`/api/state?role=${u.role}`, {
    headers: { Authorization: `Bearer ${u.token}` },
  });
  expect(response.ok()).toBe(true);
  return decode(await response.text()).state;
}
export async function command(request, u, input) {
  const room = (await getState(request, u)).rooms[input.activeRoomId];
  return post(
    request,
    "action",
    {
      role: u.role,
      termsRevision: room?.terms.revision || 0,
      milestoneVersion: room?.milestones[input.id]?.contentVersion || 0,
      ...input,
    },
    u.token,
  );
}
export async function open(page, u, path = "") {
  await page.addInitScript(
    (token) => sessionStorage.setItem("synergy-session", token),
    u.token,
  );
  await page.goto(`/#/${path}`);
  await expect(page.locator(".page h1").first()).toBeVisible();
}
export async function pair(request) {
  const a = await user(request, "FounderAudit"),
    b = await user(request, "PeerAudit", {
      ...founderProfile,
      offer: founderProfile.need,
      need: founderProfile.offer,
    });
  await command(request, a, {
    action: "interest",
    id: `${b.state.accountId}:founder`,
  });
  const id = (
    await command(request, b, {
      action: "accept-interest",
      id: `${a.state.accountId}:founder`,
    })
  ).state.activeRoomId;
  await command(request, a, {
    action: "lock-terms",
    activeRoomId: id,
    values: sharedTerms,
  });
  await command(request, b, { action: "accept-terms", activeRoomId: id });
  return { a, b, id };
}
export async function finish(request, a, b, id) {
  for (const [key, item] of Object.entries(
    (await getState(request, a)).rooms[id].milestones,
  )) {
    if (item.evidence)
      await command(request, a, {
        form: "evidence",
        activeRoomId: id,
        id: key,
        values: { attachment: "Shared audit proof" },
      });
    for (const u of [a, b])
      await command(request, u, {
        action: "confirm-milestone",
        activeRoomId: id,
        id: key,
      });
  }
}
