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

export const approvalCopy = (application, target) => {
  if (application?.status === "pending")
    return `Your profile is with our team. Most approvals take up to ${target} business days. You can finish your profile meanwhile.`;
  if (application?.status === "rejected") return application.reason;
  return "Complete your application before accepting mentorship requests.";
};
