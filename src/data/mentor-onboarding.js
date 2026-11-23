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

export const approvalCopy = (application, target) => {
  if (application?.status === "pending")
    return `Your profile is with our team. Most approvals take up to ${target} business days. You can finish your profile meanwhile.`;
  if (application?.status === "rejected") return application.reason;
  return "Complete your application before accepting mentorship requests.";
};
