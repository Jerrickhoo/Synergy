import defaultTemplates from "./engagement-templates.json" with { type: "json" };
import { terminalStatuses } from "./collaboration.js";
export function createModel(state) {
  const people = state.directory;
  const allPeople = () => [
    ...people.founders,
    ...people.mentors,
    ...people.mentorStartups,
    ...people.browseFounders,
    ...people.browseMentorStartups,
    ...people.roomPartners,
  ];
  const roomTypeForPerson = (person) =>
    person.kind === "Mentor" || person.engagement === "Mentorship"
      ? "mentorship"
      : person.engagement === "Co-Marketing Swap"
        ? "marketing"
        : "beta";
  const peopleForRole = () =>
    state.role === "founder"
      ? [
          ...people.founders.filter((person) => person.id !== "campus"),
          ...people.mentors,
        ]
      : people.mentorStartups;
  const roleName = () =>
    state.role === "founder"
      ? state.accountName || "Your account"
      : state.accountName || "Your account";
  const roleInitials = () =>
    !state.accountName
      ? "?"
      : roleName()
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
  const roomMilestones = (type, seeded = false) => {
    const template =
      (state.engagementTemplates || defaultTemplates)[type] ||
      defaultTemplates.beta;
    const names = template.milestones.map((item) => [
      item.id,
      item.title,
      item.description,
      item.evidence,
    ]);
    return Object.fromEntries(
      names.map(([id, title, description, evidence], index) => [
        id,
        {
          title,
          description,
          evidence,
          me: seeded && index < (type === "mentorship" ? 1 : 2),
          partner: seeded && index < (type === "mentorship" ? 1 : 2),
          attachment: "",
          disputed: false,
          evidenceOpen: false,
          schedule: null,
        },
      ]),
    );
  };
  const senderForRole = (role) => {
    const name =
      role === state.role
        ? roleName()
        : role === "founder"
          ? "Founder"
          : "Mentor";
    return {
      name,
      initials: name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    };
  };
  const createRoom = ({
    id,
    role,
    partnerId,
    type,
    status = "matched",
    seeded = false,
    sender,
  }) => {
    const partner = allPeople().find((person) => person.id === partnerId);
    const roomSender = sender || senderForRole(role);
    const terms = {
      goal: "",
      scope: "",
      timeline: "",
      commitment: "",
      compensation: "",
    };
    return {
      id,
      role,
      type,
      partnerId,
      engagementType:
        partner?.engagement ||
        (type === "mentorship" ? "Mentorship" : "Beta Testing Exchange"),
      status,
      terms: {
        draft: terms,
        locked: seeded,
        partnerLocked: seeded,
      },
      template: {
        id: type,
        name: (state.engagementTemplates || defaultTemplates)[type]?.name,
        version:
          (state.engagementTemplates || defaultTemplates)[type]?.version || 1,
      },
      milestones: roomMilestones(type, seeded),
      messages: [],
      targetDate: "",
      review: {
        me: false,
        partner: false,
      },
      progress: seeded ? (type === "mentorship" ? 20 : 40) : 0,
    };
  };
  function currentAgreement() {
    return activeRoom()?.terms;
  }
  const activeRoom = () => {
    const room = state.rooms[state.activeRoomId];
    return room?.role === state.role ? room : null;
  };
  const roomStatusLabel = (status, partnerName, confirmedByMe = true, type) =>
    status === "terms"
      ? confirmedByMe
        ? `Waiting for ${partnerName || "your partner"} to confirm`
        : "Your confirmation needed"
      : {
          matched: "Matched",
          "in-progress": "In progress",
          launched: type === "mentorship" ? "Completed" : "Launched",
          reviewed: "Reviewed",
          cancelled: "Closed",
        }[status];
  const matches = () =>
    [...peopleForRole()].sort((first, second) => second.score - first.score);
  const browsePeople = () =>
    state.role === "founder"
      ? [...peopleForRole(), ...people.browseFounders]
      : [...peopleForRole(), ...people.browseMentorStartups];
  const rolePeople = () => [
    ...new Map(
      [...matches(), ...browsePeople()].map((person) => [person.id, person]),
    ).values(),
  ];
  const savedMatches = () => state.savedByRole[state.role];
  const waitingMatches = () => state.waitingByRole[state.role];
  const interestedMatches = () => state.interestByRole[state.role];
  const scoreFactors = (person) => {
    const factors = [
      ["Need Fit", 0],
      ["Expertise Fit", 1],
      ["Industry Fit", 2],
      ["Stage/Size Fit", 3],
      ["Goal Fit", 4],
    ];
    return person.kind === "Mentor" || state.role === "mentor"
      ? factors
      : factors.filter(([, index]) => index !== 1);
  };
  const roleLabel = () =>
    state.role === "founder" ? "Startup founder" : "Mentor";
  const statusText = (id) => {
    const item = activeRoom().milestones[id];
    if (item.me && item.partner) return "Confirmed by both";
    if (item.me) return "Waiting on partner";
    if (item.partner) return "Your confirmation needed";
    return "Needs confirmation";
  };
  const existingRoomFor = (role, partnerId) =>
    Object.values(state.rooms).find(
      (room) =>
        room.role === role &&
        room.partnerId === partnerId &&
        !terminalStatuses.includes(room.status),
    );
  const suggestedMatches = () =>
    matches()
      .filter(
        (person) =>
          person.score >= 30 && !existingRoomFor(state.role, person.id),
      )
      .slice(0, 12);
  return {
    state,
    people,
    allPeople,
    roomTypeForPerson,
    peopleForRole,
    roleName,
    roleInitials,
    roomMilestones,
    senderForRole,
    createRoom,
    currentAgreement,
    activeRoom,
    roomStatusLabel,
    matches,
    suggestedMatches,
    browsePeople,
    rolePeople,
    savedMatches,
    waitingMatches,
    interestedMatches,
    scoreFactors,
    roleLabel,
    statusText,
    existingRoomFor,
  };
}
export function createInitialState() {
  return {
    authenticated: false,
    routeTick: 0,
    routePath: "",
    formErrors: null,
    activity: [],
    role: "founder",
    accountName: "",
    accountEmail: "",
    bothRoles: false,
    page: "home",
    activeMatch: null,
    activeWaitingMatch: null,
    activeRoomId: null,
    expanded: new Set(),
    matchTab: "suggested",
    onboardingStep: 1,
    roomTab: "terms",
    profileTab: "about",
    confirmation: "",
    profileDone: false,
    profiles: {
      founder: {
        bio: "",
        offer: "",
        need: "",
        industry: "",
        stage: "",
        teamSize: "",
      },
      mentor: {
        bio: "",
        offer: "",
        need: "",
        pastExperience: "",
        expertise: "",
        availability: "",
        startups: "",
      },
    },
    directory: {
      founders: [],
      mentors: [],
      mentorStartups: [],
      roomPartners: [],
      browseFounders: [],
      browseMentorStartups: [],
    },
    matchFilters: {
      search: "",
      type: "all",
      industry: "all",
      score: "0",
      engagement: "all",
    },
    profileEditing: false,
    onboarding: {
      verified: false,
      verifying: false,
      analyzed: false,
      analyzing: false,
      tags: [],
      pendingTags: [],
      signup: null,
    },
    rooms: {},
    waitingByRole: { founder: new Set(), mentor: new Set() },
    savedByRole: { founder: new Set(), mentor: new Set() },
    interestByRole: { founder: new Set(), mentor: new Set() },
    incomingByRole: { founder: new Set(), mentor: new Set() },
    introductionTypesByRole: { founder: {}, mentor: {} },
    trustHistoryByRole: { founder: [], mentor: [] },
    fields: {},
    notificationOpen: false,
    demoOpen: false,
    moreOpen: false,
    passwordVisible: false,
    toast: "",
    toastType: "success",
    toastTitle: "",
    toastId: 0,
    rating: 0,
  };
}
