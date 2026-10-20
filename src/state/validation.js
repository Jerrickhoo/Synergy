import { profileKeys, scheduleInstant } from "../data/selectors.js";

export const stages = ["idea", "pre-seed", "seed", "growth"];
export const cleanValues = (values) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      String(value ?? "").trim(),
    ]),
  );
const labels = {
  bio: "About me",
  offer: "What I offer",
  need: "What I need",
  industry: "Industry",
  stage: "Stage",
  teamSize: "Team size",
  expertise: "Expertise areas",
  availability: "Availability",
  startups: "Startups I want to help",
  goal: "Shared goal",
  scope: "Scope and deliverables",
  timeline: "Timeline",
  commitment: "Commitment",
  compensation: "Exchange",
  attachment: "Evidence description",
  firstName: "First name",
  lastName: "Last name",
  name: "Your name",
  story: "Your story",
};
export function requiredFields(values, keys) {
  return Object.fromEntries(
    keys
      .filter((key) => !String(values[key] || "").trim())
      .map((key) => [key, `${labels[key] || key} is required.`]),
  );
}
export function validateProfile(profile, role) {
  const errors = requiredFields(profile, profileKeys(role));
  if (String(profile.pastExperience || "").length > 2000)
    errors.pastExperience =
      "Keep past experience to 2,000 characters or fewer.";
  if (
    profile.audienceSize &&
    (!/^\d+$/.test(profile.audienceSize) ||
      !Number.isSafeInteger(Number(profile.audienceSize)))
  )
    errors.audienceSize = "Audience size must be a non-negative whole number.";
  if (
    profile.engagementPreference &&
    !["one-off", "ongoing", "either"].includes(profile.engagementPreference)
  )
    errors.engagementPreference = "Choose a valid engagement preference.";
  if (role === "founder") {
    if (!stages.includes(profile.stage)) errors.stage = "Choose a valid stage.";
    if (
      !/^\d+$/.test(String(profile.teamSize)) ||
      Number(profile.teamSize) < 1 ||
      !Number.isSafeInteger(Number(profile.teamSize))
    )
      errors.teamSize = "Team size must be a positive whole number.";
  }
  return errors;
}
export const validateTerms = (values) =>
  requiredFields(values, [
    "goal",
    "scope",
    "timeline",
    "commitment",
    "compensation",
  ]);
export function validateCredentials(values, signup = false) {
  const errors = signup
    ? requiredFields(values, ["firstName", "lastName"])
    : {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email || ""))
    errors.email = "Enter a valid email address.";
  if (String(values.password || "").trim().length < (signup ? 8 : 4))
    errors.password = `Use at least ${signup ? 8 : 4} characters for your password.`;
  return errors;
}
export function validateSchedule(values, now = new Date()) {
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(values.date || "") &&
    !Number.isNaN(Date.parse(`${values.date}T00:00`)) &&
    new Date(`${values.date}T00:00`).getDate() ===
      Number(values.date.slice(-2));
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(values.time || "");
  if (!validDate || !validTime)
    return { date: "Enter a valid session date and time." };
  const instant = scheduleInstant(values);
  if (Number.isNaN(instant.getTime()))
    return { date: "Choose a valid session timezone." };
  return instant <= now
    ? { date: "Choose a future session date and time." }
    : {};
}
