// Showcase profiles: the fictional sample directory, added as ordinary
// accounts so Matches has people in it when demo mode is off (real accounts
// never see the demo-mode samples). They are tagged `showcase: true`, never
// receive email, and share one password so a presenter can sign in as the
// other side of a request and accept it.
import { randomBytes, scryptSync } from "node:crypto";
import { demoProfiles } from "./demo-directory.js";
import { defaultPreferences } from "./features.js";
import { mentorDefaults } from "../src/data/mentor-rules.js";
import { createInitialState } from "../src/data/model.js";

export const showcasePassword = "synergy-demo";
export const showcaseEmail = (sample) => `${sample.id}@showcase.test`;
const accountId = (sample) => `showcase-${sample.id}`;

// Adds any showcase account that is missing. Existing ones are left alone, so
// edits and shared work made during a demo survive a re-run. Returns the
// number of accounts added.
export function seedShowcase(accounts, at = Date.now()) {
  const stamp = new Date(at).toISOString();
  let added = 0;
  for (const sample of demoProfiles) {
    const id = accountId(sample);
    const email = showcaseEmail(sample);
    if (accounts[id]) continue;
    // Someone already signed up with this address: leave theirs untouched.
    if (Object.values(accounts).some((account) => account.email === email))
      continue;
    const state = createInitialState();
    state.role = sample.role;
    state.accountName = sample.name;
    state.accountEmail = email;
    state.profileDone = true;
    Object.assign(state.profiles.mentor, mentorDefaults());
    Object.assign(state.profiles[sample.role], sample.profile);
    if (sample.role === "founder")
      state.profiles.founder.startupName = sample.name;
    else
      Object.assign(state.profiles.mentor, {
        mentorApprovedAt: stamp,
        mentorApprovedBy: "showcase",
      });
    const salt = randomBytes(16).toString("hex");
    accounts[id] = {
      id,
      showcase: true,
      email,
      salt,
      passwordHash: scryptSync(showcasePassword, salt, 64).toString("hex"),
      emailVerifiedAt: stamp,
      notificationPreferences: { ...defaultPreferences },
      state,
    };
    added += 1;
  }
  return added;
}
