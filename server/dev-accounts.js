// Built-in dev accounts for local testing: one startup founder and one
// approved mentor, both with finished profiles so they can sign in and use the
// app straight away. Added at start-up whenever SYNERGY_DEV_ACCOUNTS is on
// (the default outside production). They are ordinary accounts tagged
// `devAccount: true` and never receive email, since the addresses are not ours.
import { randomBytes, scryptSync } from "node:crypto";
import { defaultPreferences } from "./features.js";
import { mentorDefaults, mentorConfig } from "../src/data/mentor-rules.js";
import { mentorFormatIds } from "../src/data/mentor-formats.js";
import { createInitialState } from "../src/data/model.js";

export const devPassword = "123123123";

export const devAccounts = [
  {
    id: "dev-startup",
    email: "startup@gmail.com",
    role: "founder",
    name: "Dev Startup",
    profile: {
      startupName: "Dev Startup",
      bio: "Building a budgeting app that helps students manage their money.",
      offer: "Beta testing, Student user insights",
      need: "Product strategy, Onboarding guidance",
      industry: "FinTech",
      stage: "pre-seed",
      teamSize: "3",
    },
  },
  {
    id: "dev-mentor",
    email: "mentor@gmail.com",
    role: "mentor",
    name: "Dev Mentor",
    profile: {
      bio: "Helping early teams improve their products and find traction.",
      offer: "Product strategy, Growth, Onboarding guidance",
      need: "Early teams, Product challenges",
      expertise: "Product strategy, Growth",
      availability: "Monthly sessions",
      startups: "FinTech, Idea and pre-seed teams",
    },
  },
];

// Adds any dev account that is missing. Existing ones are left alone, so work
// done while testing survives a restart. Returns the number added.
export function seedDevAccounts(accounts, at = Date.now()) {
  const stamp = new Date(at).toISOString();
  let added = 0;
  for (const dev of devAccounts) {
    if (accounts[dev.id]) continue;
    if (Object.values(accounts).some((account) => account.email === dev.email))
      continue;
    const state = createInitialState();
    state.role = dev.role;
    state.accountName = dev.name;
    state.accountEmail = dev.email;
    state.profileDone = true;
    Object.assign(state.profiles.mentor, mentorDefaults());
    Object.assign(state.profiles[dev.role], dev.profile);
    if (dev.role === "mentor")
      Object.assign(state.profiles.mentor, {
        mentorApprovedAt: stamp,
        mentorApprovedBy: "dev-accounts",
        noConflicts: true,
        formats: mentorFormatIds.map((id) => ({ id, price: 0 })),
        guidelinesVersion: mentorConfig.guidelinesVersion,
        guidelinesAcceptedAt: stamp,
      });
    const salt = randomBytes(16).toString("hex");
    accounts[dev.id] = {
      id: dev.id,
      devAccount: true,
      email: dev.email,
      salt,
      passwordHash: scryptSync(devPassword, salt, 64).toString("hex"),
      emailVerifiedAt: stamp,
      notificationPreferences: { ...defaultPreferences },
      state,
    };
    added += 1;
  }
  return added;
}
