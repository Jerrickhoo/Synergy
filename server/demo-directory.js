// Fictional collaborators for prototype workspaces. Scores use the normal matcher.
import { mentorDefaults } from "../src/data/mentor-rules.js";
import { canonicalTags } from "../src/data/collaboration.js";
import { createModel } from "../src/data/model.js";
import { appointment, initMentorship } from "../src/data/mentor-room.js";
export const legacyDemoProfiles = [
  {
    id: "david-park",
    name: "David Park",
    role: "mentor",
    profile: {
      bio: "Two-time founder helping student finance teams simplify onboarding and find their first loyal users.",
      offer: "Product strategy, Onboarding guidance, Growth",
      need: "Early teams, Product challenges",
      expertise: "Product strategy, Onboarding guidance",
      availability: "Weekly sessions",
      startups: "FinTech, Idea and pre-seed teams",
      pastExperience: "Led product teams at two early-stage finance startups.",
      goals: "Help founders validate onboarding and grow their products",
      engagementPreference: "mentorship",
    },
  },
  {
    id: "isabel-cruz",
    name: "Isabel Cruz",
    role: "mentor",
    profile: {
      bio: "Product designer turning user research into welcoming first-time experiences for early-stage apps.",
      offer: "Onboarding guidance, Product strategy, User research",
      need: "Student user insights, Design challenges",
      expertise: "Onboarding guidance, User research",
      availability: "Twice a month",
      startups: "EdTech, Consumer, Idea and pre-seed teams",
      pastExperience:
        "Eight years designing mobile products and running usability studies.",
      goals: "Make first-time experiences easier to understand",
      engagementPreference: "mentorship",
    },
  },
  {
    id: "priya-shah",
    name: "Priya Shah",
    role: "mentor",
    profile: {
      bio: "Former founder helping ambitious teams tell a clearer story, sharpen their strategy, and prepare to raise.",
      offer: "Fundraising, Pitch review, Product strategy",
      need: "Mission-led founders, Clear goals",
      expertise: "Fundraising, Product strategy",
      availability: "Monthly sessions",
      startups: "FinTech, SaaS, Seed teams",
      pastExperience:
        "Raised a seed round and advised university startup accelerators.",
      goals: "Prepare early teams for fundraising",
      engagementPreference: "mentorship",
    },
  },
  {
    id: "studyloop",
    name: "StudyLoop",
    role: "founder",
    profile: {
      bio: "A peer study-planning app connecting students with calmer routines. Ready to exchange product feedback with other campus teams.",
      offer: "Product strategy, Onboarding guidance, Beta testing",
      need: "Student user insights, Beta testing",
      industry: "EdTech",
      stage: "pre-seed",
      teamSize: "4",
      goals: "Validate onboarding and improve student retention",
      engagementPreference: "beta",
    },
  },
  {
    id: "launchpad-labs",
    name: "LaunchPad Labs",
    role: "founder",
    profile: {
      bio: "Building simple finance tools for student entrepreneurs. Seeking fresh testers for a new budgeting prototype.",
      offer: "Product strategy, Prototype testing, Financial research",
      need: "Beta testing, Student user insights",
      industry: "FinTech",
      stage: "pre-seed",
      teamSize: "6",
      goals: "Test a budgeting prototype with students",
      engagementPreference: "beta",
    },
  },
  {
    id: "greenplate",
    name: "GreenPlate",
    role: "founder",
    profile: {
      bio: "Helping campus communities rescue surplus meals. Looking for student feedback before launching our first food-sharing pilot.",
      offer: "Onboarding guidance, Campus pilot, Impact research",
      need: "Student user insights, Beta testing",
      industry: "FoodTech",
      stage: "idea",
      teamSize: "3",
      goals: "Launch a campus food-sharing pilot",
      engagementPreference: "either",
    },
  },
];

export const demoDirectoryVersion = 11;
const startup = (
  id,
  name,
  industry,
  stage,
  teamSize,
  offer,
  need,
  goals,
  bio,
  engagementPreference = "one-off",
  image = "",
) => ({
  id,
  name,
  role: "founder",
  profile: {
    industry,
    stage,
    teamSize,
    offer,
    need,
    goals,
    bio,
    engagementPreference,
    ...(image && { image: `/demo/avatars/${image}.svg` }),
  },
});
const mentor = (
  id,
  name,
  expertise,
  startups,
  goals,
  bio,
  availability = "Monthly sessions",
  image = "",
) => ({
  id,
  name,
  role: "mentor",
  profile: {
    expertise,
    offer: expertise,
    need: "Focused questions, A clear project brief",
    startups,
    goals,
    bio,
    availability,
    engagementPreference: "ongoing",
    ...(image && { image: `/demo/avatars/${image}.svg` }),
  },
});
const images = {
  "david-park": "david",
  "isabel-cruz": "isabel",
  "priya-shah": "priya",
  studyloop: "studyloop",
  "launchpad-labs": "launchpad",
  greenplate: "greenplate",
};

const baseDemoProfiles = [
  ...legacyDemoProfiles.map((sample) => ({
    ...sample,
    profile: {
      ...sample.profile,
      engagementPreference:
        sample.profile.engagementPreference === "either"
          ? "either"
          : sample.role === "mentor"
            ? "ongoing"
            : "one-off",
      image: `/demo/avatars/${images[sample.id]}.svg`,
    },
  })),
  mentor(
    "rafael-lim",
    "Rafael Lim",
    "Technical development, API design, Security",
    "SaaS, FinTech, seed, growth",
    "Build reliable software systems",
    "Engineering mentor helping small teams plan dependable services.",
    "Twice a month",
    "rafael",
  ),
  mentor(
    "amara-okafor",
    "Amara Okafor",
    "Growth, Co-marketing, Audience research",
    "Consumer, EdTech, pre-seed, seed",
    "Grow a community through useful partnerships",
    "Community builder helping founders run focused growth experiments.",
    "Monthly sessions",
    "amara",
  ),
  mentor(
    "lina-reyes",
    "Lina Reyes",
    "Clinical validation, Medical regulation",
    "HealthTech, seed, growth",
    "Plan clinical validation studies",
    "Health product advisor working on clinical evidence and responsible pilots.",
    "Monthly sessions",
    "lina",
  ),
  mentor(
    "noah-tan",
    "Noah Tan",
    "Cold chain logistics, Route planning",
    "Logistics, seed, growth",
    "Reduce spoilage in refrigerated deliveries",
    "Operations mentor focused on refrigerated distribution and delivery routes.",
    "Monthly sessions",
    "noah",
  ),
  mentor(
    "sofia-mendez",
    "Sofia Mendez",
    "Farm trials, Soil sampling, Irrigation",
    "AgriTech, idea, seed",
    "Design practical agricultural field trials",
    "Agricultural researcher helping teams plan useful field experiments.",
    "Monthly sessions",
    "sofia",
  ),
  mentor(
    "kai-chen",
    "Kai Chen",
    "Accessibility, User research, Product strategy",
    "EdTech, SaaS, idea, pre-seed",
    "Validate accessible onboarding",
    "Inclusive design mentor working with student teams and accessible learning tools.",
    "Weekly sessions",
    "kai",
  ),
  mentor(
    "elena-rossi",
    "Elena Rossi",
    "Textile sourcing, Circular manufacturing",
    "Fashion, growth",
    "Build circular textile supply chains",
    "Manufacturing advisor focused on materials reuse and supplier relationships.",
  ),
  // Version 10: every standard tag is offered by at least two sample profiles.
  mentor(
    "marcus-webb",
    "Marcus Webb",
    "Pricing strategy, Monetization, B2B SaaS packaging, Fundraising",
    "SaaS, B2B, seed, growth",
    "Price B2B software so customers stay and expand",
    "Former SaaS revenue lead helping seed teams set prices, plans and upgrade paths.",
    "Twice a month",
  ),
  mentor(
    "hana-sato",
    "Hana Sato",
    "Customer retention, Churn analysis, Product feedback",
    "SaaS, Consumer, seed, growth",
    "Keep customers past their first months",
    "Customer success mentor who helps small teams find why customers leave and fix it.",
    "Weekly sessions",
  ),
  mentor(
    "diego-alvarez",
    "Diego Alvarez",
    "Go-to-market, Distribution partnerships, Pricing strategy, Co-marketing",
    "SaaS, Marketplace, Consumer, pre-seed, seed",
    "Find the first repeatable sales channel",
    "Go-to-market advisor helping early teams choose channels, partners and launch prices.",
    "Monthly sessions",
  ),
  mentor(
    "grace-liu",
    "Grace Liu",
    "Product design, Interaction design, Product feedback",
    "EdTech, Consumer, SaaS, idea, pre-seed",
    "Turn early feedback into clearer product design",
    "Product designer helping founders run feedback sessions and simplify their first screens.",
    "Twice a month",
  ),
  startup(
    "campuskit",
    "CampusKit",
    "FinTech",
    "pre-seed",
    "4",
    "Product strategy, Onboarding guidance, Beta testing",
    "Beta testing, Student user insights",
    "Validate onboarding and student budgets",
    "Tools for student clubs to plan budgets and welcome new members.",
    "one-off",
    "campuskit",
  ),
  startup(
    "accesslearn",
    "AccessLearn",
    "EdTech",
    "idea",
    "3",
    "Accessibility, User research",
    "Product strategy, Onboarding guidance",
    "Validate accessible onboarding",
    "Accessible learning activities designed with students who use assistive technology.",
  ),
  startup(
    "ledgerleaf",
    "LedgerLeaf",
    "FinTech",
    "seed",
    "8",
    "Financial research, Beta testing",
    "Security, API design",
    "Build reliable bookkeeping tools",
    "Bookkeeping software for independent shops preparing a security review.",
  ),
  startup(
    "clinicbridge",
    "ClinicBridge",
    "HealthTech",
    "seed",
    "7",
    "Patient interviews, Clinical research",
    "Clinical validation, Medical regulation",
    "Plan clinical validation studies",
    "A patient intake tool preparing an evidence-based clinic pilot.",
    "ongoing",
  ),
  startup(
    "harvestlink",
    "HarvestLink",
    "AgriTech",
    "idea",
    "2",
    "Farm trials, Soil sampling",
    "Irrigation, Field research",
    "Design practical agricultural field trials",
    "Connecting small farms with affordable soil and irrigation experiments.",
  ),
  startup(
    "chillroute",
    "ChillRoute",
    "Logistics",
    "seed",
    "9",
    "Delivery data, Warehouse research",
    "Cold chain logistics, Route planning",
    "Reduce spoilage in refrigerated deliveries",
    "Route planning for local refrigerated food deliveries.",
    "ongoing",
    "chillroute",
  ),
  startup(
    "threadcycle",
    "ThreadCycle",
    "Fashion",
    "growth",
    "22",
    "Textile sourcing, Circular manufacturing",
    "Supplier relationships, Materials reuse",
    "Build circular textile supply chains",
    "A materials exchange connecting apparel makers with reusable textile stock.",
    "ongoing",
  ),
  startup(
    "makerrelay",
    "MakerRelay",
    "SaaS",
    "growth",
    "18",
    "Technical development, API design",
    "Growth, Co-marketing",
    "Grow a community through useful partnerships",
    "A workspace for makers coordinating small manufacturing projects.",
    "ongoing",
  ),
  startup(
    "trailnest",
    "TrailNest",
    "Travel",
    "pre-seed",
    "5",
    "Travel interviews, Destination research",
    "Audience research, Growth",
    "Test local travel guides",
    "Local travel guides built around walking routes and small neighborhood businesses.",
    "one-off",
  ),
  startup(
    "soundgarden",
    "SoundGarden",
    "Music",
    "idea",
    "2",
    "Audio production, Listening sessions",
    "Royalty licensing, Acoustic engineering",
    "Prototype collaborative sound installations",
    "Musicians exploring collaborative sound installations for public spaces.",
  ),
  startup(
    "tidewatch",
    "TideWatch",
    "MarineTech",
    "growth",
    "30",
    "Ocean sensors, Buoy telemetry",
    "Corrosion testing, Marine certification",
    "Measure coastal salinity",
    "Coastal sensors for long-running ocean measurements.",
    "ongoing",
  ),
  startup(
    "shelfshare",
    "ShelfShare",
    "Marketplace",
    "seed",
    "6",
    "Retail distribution, Packaging design, Co-marketing",
    "Pricing strategy, Customer retention",
    "Grow repeat orders from independent shops",
    "A marketplace placing local food brands on independent grocery shelves.",
    "either",
  ),
  // Version 11: startups that trade help founders commonly need for help
  // founders commonly offer, so typical founders see an exchange in Suggested.
  startup(
    "fairtab",
    "Fairtab",
    "FinTech",
    "seed",
    "7",
    "Pricing strategy, Fundraising, Customer interviews",
    "Product design, Product feedback",
    "Redesign onboarding before our next raise",
    "Invoicing for freelancers. We repriced twice and closed a seed round, and can share both playbooks.",
    "either",
  ),
  startup(
    "pacecircle",
    "PaceCircle",
    "Consumer",
    "pre-seed",
    "3",
    "User research, Beta testers, Distribution",
    "Technical development, Product feedback",
    "Ship a stable app for our running-club members",
    "A community app for local running clubs, with 3,000 members happy to test new products.",
    "either",
  ),
  startup(
    "stagebolt",
    "StageBolt",
    "SaaS",
    "pre-seed",
    "2",
    "Technical development, Product feedback, Product design",
    "Distribution, Co-marketing, User research",
    "Find our first 50 paying venues",
    "Two engineers building booking tools for small venues. We trade technical help for go-to-market help.",
    "either",
  ),
];

// Sample mentors carry the Phase 1 mentoring settings with accepted guidelines,
// and a few vary them so Discover shows real availability states.
const demoMentoring = {
  "priya-shah": { paused: true, pausedAt: "2026-11-01T00:00:00.000Z" },
  "rafael-lim": {
    noConflicts: false,
    conflicts: [
      {
        company: "Signal Harbor",
        relation: "investor",
        industry: "Cybersecurity",
      },
    ],
    formats: [
      { id: "quick-ask", price: 0 },
      { id: "doc-review", price: 0 },
      { id: "single-session", price: 0 },
      { id: "office-hours", price: 0 },
    ],
    officeHours: [
      {
        id: "demo-rafael-weekly",
        date: "2026-11-02",
        weekday: 1,
        time: "10:00",
        timeZone: "Asia/Manila",
        durationMinutes: 30,
        recurring: true,
        closedDates: [],
      },
    ],
  },
  "isabel-cruz": {
    formats: [
      { id: "quick-ask", price: 0 },
      { id: "single-session", price: 0 },
      { id: "ongoing-advisory", price: 0 },
    ],
  },
};
export const demoProfiles = baseDemoProfiles.map((sample) =>
  sample.role === "mentor"
    ? {
        ...sample,
        profile: {
          ...sample.profile,
          ...mentorDefaults(),
          formats: [
            { id: "single-session", price: 0 },
            { id: "ongoing-advisory", price: 0 },
          ],
          topics: canonicalTags(sample.profile.expertise).join(", "),
          noConflicts: true,
          guidelinesVersion: 2,
          guidelinesAcceptedAt: "2026-11-01T00:00:00.000Z",
          ...demoMentoring[sample.id],
        },
      }
    : sample,
);

export function seedDemoImpact(accounts) {
  const mentor = accounts["demo-sample-rafael-lim"];
  if (!mentor?.demoSample) return false;
  let changed = false;
  for (const [sample, date, goal] of [
    ["studyloop", "2026-09-07", "Simplify signup for the first pilot"],
    ["launchpad-labs", "2026-09-14", "Plan a smaller first release"],
    ["greenplate", "2026-09-21", "Measure reliability before adding partners"],
  ]) {
    const founder = accounts[`demo-sample-${sample}`];
    if (!founder?.demoSample || founder.deletedAt || mentor.deletedAt) continue;
    const id = `demo-impact-rafael-${sample}`;
    if (mentor.state.rooms[id] || founder.state.rooms[id]) continue;
    const session = appointment({
      id: `${id}-session`,
      date,
      time: "10:00",
      timeZone: "Asia/Manila",
      durationMinutes: 45,
    });
    for (const [account, role, partner, partnerRole] of [
      [mentor, "mentor", founder, "founder"],
      [founder, "founder", mentor, "mentor"],
    ]) {
      const room = initMentorship(
        createModel(account.state).createRoom({
          id,
          role,
          partnerId: `${partner.id}:${partnerRole}`,
          type: "mentorship",
        }),
        "single-session",
        goal,
        Date.parse(session.startsAt),
      );
      room.partnerAccountId = partner.id;
      room.partnerRole = partnerRole;
      room.status = "reviewed";
      room.createdAt = room.updatedAt = room.completedAt = session.startsAt;
      room.mentorship.topics = canonicalTags(
        mentor.state.profiles.mentor.expertise,
      );
      room.mentorship.sample = true;
      for (const milestone of Object.values(room.milestones))
        milestone.me = milestone.partner = true;
      room.milestones.held.schedules = [{ ...session, outcome: "held" }];
      room.mentorship.followup = {
        submittedAt: session.startsAt,
        outcomes: { example: "done" },
      };
      room.review = { me: true, partner: true, rating: 5, partnerRating: 5 };
      room.progress = 100;
      account.state.rooms[id] = room;
    }
    changed = true;
  }
  return changed;
}

// Viewer inputs are reproducible reference scenarios, not extra directory accounts.
// Scores and suggestion counts are always derived by the real matcher.
export const demoViewerScenarios = {
  many: {
    role: "founder",
    profile: {
      bio: "Student budgeting tools",
      offer: "Beta testing, Student user insights",
      need: "Product strategy, Onboarding guidance",
      industry: "FinTech",
      stage: "pre-seed",
      teamSize: "4",
      goals: "Validate onboarding and grow products",
      engagementPreference: "either",
    },
  },
  few: {
    role: "founder",
    profile: {
      bio: "Refrigerated delivery planning",
      offer: "Warehouse research",
      need: "Cold chain logistics, Route planning",
      industry: "Logistics",
      stage: "seed",
      teamSize: "9",
      goals: "Reduce spoilage in refrigerated deliveries",
      engagementPreference: "ongoing",
    },
  },
  none: {
    role: "founder",
    profile: {
      bio: "Lunar instrumentation",
      offer: "Regolith spectroscopy",
      need: "Cryogenic propulsion",
      industry: "SpaceTech",
      stage: "growth",
      teamSize: "60",
      goals: "Map lunar craters",
      engagementPreference: "one-off",
    },
  },
  sparseMentor: {
    role: "mentor",
    profile: {
      bio: "Refrigerated delivery advisor",
      offer: "Cold chain logistics, Route planning",
      need: "Focused questions",
      expertise: "Cold chain logistics, Route planning",
      availability: "Monthly sessions",
      startups: "Logistics, seed",
      goals: "Reduce spoilage in refrigerated deliveries",
      engagementPreference: "ongoing",
    },
  },
};
