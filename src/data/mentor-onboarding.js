export const mentorApplicationSteps = [
  "Verification",
  "Expertise",
  "Capacity and time zone",
  "Formats",
  "Conflicts of interest",
  "Mentor guidelines",
  "Experience",
  "Preferences",
];

// What a moderator checked when approving a mentor application. Approval is
// the mentor's verification, so founders see it as a Verified badge.
export const mentorVerificationLabels = {
  linkedin: "LinkedIn profile checked",
  "work-email": "Work email checked",
  organization: "Endorsing organization checked",
};
export const mentorVerificationLabel = (application) =>
  application?.status === "approved"
    ? mentorVerificationLabels[application.verification?.method] ||
      "Mentor application checked"
    : "";

// Character limits shared by the application form and the server.
export const experienceLimit = 1500;
export const bioLimit = 2000;

// A mentor may submit twice. After a second rejection the application is
// closed for good.
export const mentorApplicationAttempts = 2;
export const finalRejection = (application) =>
  application?.status === "rejected" &&
  application.attempts >= mentorApplicationAttempts;

export const approvalCopy = (application, target) => {
  if (application?.status === "pending")
    return `Your profile is with our team. Most approvals take up to ${target} business days. You can finish your profile meanwhile.`;
  if (finalRejection(application))
    return `${application.reason} This was your second application, so it can't be resubmitted. You can still use Synergy as a startup founder: switch profiles in Settings.`;
  if (application?.status === "rejected") return application.reason;
  return "Complete your application before accepting mentorship requests.";
};
