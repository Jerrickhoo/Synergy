import { mentorFormat } from "./mentor-formats.js";
import { mentorConfig } from "./mentor-rules.js";
import {
  dayMs,
  isMentorRoom,
  mentorSessions,
  roomFormat,
} from "./mentor-room.js";

const rate = (part, total) => (total ? part / total : null);
const mean = (values) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : mean(sorted.slice(i - 1, i + 1));
};
const stat = (value, count) => ({ value, count });
const released = (review) =>
  review?.partner && (review.me || review.windowClosed);

export function mentorshipTrust(
  rooms,
  role,
  {
    requests = [],
    pending = 0,
    approved = false,
    now = Date.now(),
    config = mentorConfig,
  } = {},
) {
  const data = Object.values(rooms).filter(
    (room) => room.role === role && isMentorRoom(room),
  );
  const sessions = data.flatMap((room) =>
    [
      ...new Map(
        [
          ...mentorSessions(room),
          ...(room.mentorship.sessionHistory || []),
        ].map((session, index) => [session.id || index, session]),
      ).values(),
    ].map((session) => ({
      ...session,
      partnerId: room.partnerAccountId,
      roomId: room.id,
    })),
  );
  const held = sessions.filter((session) => session.outcome === "held");
  const asyncWork = data.flatMap((room) =>
    [
      ...room.mentorship.history,
      {
        format: roomFormat(room),
        deliveredAt: room.mentorship.deliveredAt,
        price: room.terms.draft.price || 0,
      },
    ]
      .filter((item) => item.deliveredAt && item.format)
      .map((item) => ({
        partnerId: room.partnerAccountId,
        roomId: room.id,
        minutes: mentorFormat(item.format).effortMinutes,
        paid: item.price > 0,
      })),
  );
  const completed = [...held, ...asyncWork];
  const engagements = new Set(completed.map(({ roomId }) => roomId));
  const founders = new Set(completed.map(({ partnerId }) => partnerId));
  const ratings = [];
  const publicTestimonials = [];
  let immediateReviews = 0;
  function trackReviewTiming(submittedAt, opensAt) {
    const seconds = (Date.parse(submittedAt) - Date.parse(opensAt)) / 1000;
    if (seconds >= 0 && seconds <= config.rapidReviewSeconds)
      immediateReviews += 1;
  }
  const followups = data.flatMap((room) =>
    [
      room.mentorship.followup,
      ...room.mentorship.history.map((entry) => entry.followup),
    ].filter(Boolean),
  );
  for (const room of data) {
    const { mentorship: info } = room;
    const readReview = (review, sameRole = true, topics = info.topics) => {
      if (!sameRole) {
        if (
          !review?.me ||
          !(review.partner || review.windowClosed) ||
          !Number.isFinite(review.rating)
        )
          return;
        ratings.push({
          rating: review.rating,
          scores: review.scores,
          topics,
          partnerId: room.partnerAccountId,
        });
        if (
          role === "mentor" &&
          review.testimonial &&
          review.testimonialPublic &&
          review.testimonialAccepted
        )
          publicTestimonials.push(review.testimonial);
        return;
      }
      if (!released(review) || !Number.isFinite(review.partnerRating)) return;
      ratings.push({
        rating: review.partnerRating,
        scores: review.partnerScores,
        topics,
        partnerId: room.partnerAccountId,
      });
      if (
        role === "mentor" &&
        review.partnerTestimonial &&
        review.partnerTestimonialPublic &&
        review.testimonialAccepted
      )
        publicTestimonials.push(review.partnerTestimonial);
    };
    readReview(room.review);
    if (released(room.review))
      trackReviewTiming(room.review.partnerSubmittedAt, info.reviewOpenedAt);
    for (const past of info.history) {
      const sameRole = !past.role || past.role === role;
      readReview(past.review, sameRole, past.topics || info.topics);
      if (released(past.review))
        trackReviewTiming(
          sameRole ? past.review.partnerSubmittedAt : past.review.submittedAt,
          past.reviewOpenedAt,
        );
    }
    for (const cycle of [...(room.cycleHistory || []), room.cycle].filter(
      Boolean,
    )) {
      const { reviews } = cycle;
      const partner = reviews?.[room.partnerAccountId];
      if (
        partner &&
        (Object.keys(reviews).length >= 2 ||
          cycle.reviewWindowClosed ||
          (cycle === room.cycle && room.review.windowClosed))
      ) {
        ratings.push({
          ...partner,
          topics: info.topics,
          partnerId: room.partnerAccountId,
        });
        trackReviewTiming(partner.at, cycle.endedAt);
      }
    }
  }
  const answered = requests.filter((entry) =>
    ["accepted", "declined", "referred"].includes(entry.status),
  );
  const requestCount =
    answered.length +
    requests.filter((entry) => entry.status === "expired").length +
    pending;
  const responseHours = answered
    .map((entry) => (Date.parse(entry.at) - Date.parse(entry.sentAt)) / 3600000)
    .filter((hours) => Number.isFinite(hours) && hours >= 0);
  const outcomes = sessions.filter(
    (session) => session.outcome && session.outcome !== "disputed",
  );
  const noShows = outcomes.filter(
    ({ outcome }) =>
      outcome === `no-show-${role}` || outcome === "no-show-both",
  );
  const late = sessions.filter(
    (session) =>
      session.cancelledBy === role &&
      session.lateCancel &&
      Date.parse(session.cancelledAt) >= now - config.noShowWindowDays * dayMs,
  );
  const submitted = followups.filter((entry) => entry.submittedAt);
  if (role === "founder")
    late.push(
      ...data.filter(
        (room) =>
          room.closeReason === "payment-lapsed" &&
          Date.parse(room.payment?.dueBy) >=
            now - config.noShowWindowDays * dayMs,
      ),
    );
  const due = followups.filter(
    (entry) =>
      entry.submittedAt ||
      entry.overdue ||
      Date.parse(entry.availableAt) <= now,
  );
  const items = submitted.flatMap((entry) =>
    Object.values(entry.outcomes || {}),
  );
  const preparedness = ratings
    .map((rating) => rating.scores?.preparedness)
    .filter(Number.isFinite);
  const topSkills = [
    ...new Set(
      [...ratings]
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 3)
        .flatMap((entry) => entry.topics || []),
    ),
  ];
  const minutes =
    held.reduce((sum, session) => sum + session.durationMinutes, 0) +
    asyncWork.reduce((sum, item) => sum + item.minutes, 0);
  const result = {
    role,
    approved,
    volunteerMinutes:
      held
        .filter((session) => !session.paid)
        .reduce((sum, session) => sum + session.durationMinutes, 0) +
      asyncWork
        .filter((item) => !item.paid)
        .reduce((sum, item) => sum + item.minutes, 0),
    paidMinutes:
      held
        .filter((session) => session.paid)
        .reduce((sum, session) => sum + session.durationMinutes, 0) +
      asyncWork
        .filter((item) => item.paid)
        .reduce((sum, item) => sum + item.minutes, 0),
    sessions: stat(completed.length, completed.length),
    engagements: engagements.size,
    founders: stat(founders.size, founders.size),
    averageRating: stat(
      mean(ratings.map((entry) => entry.rating)),
      ratings.length,
    ),
    preparedness: stat(mean(preparedness), preparedness.length),
    topSkills: stat(topSkills, ratings.length),
    followThrough: stat(
      rate(items.filter((value) => value === "done").length, items.length),
      items.length,
    ),
    followupRate: stat(rate(submitted.length, due.length), due.length),
    responseRate: stat(rate(answered.length, requestCount), requestCount),
    responseHours: stat(median(responseHours), responseHours.length),
    noShowRate: stat(rate(noShows.length, outcomes.length), outcomes.length),
    noShows: stat(noShows.length, outcomes.length),
    lateCancellations: stat(late.length, outcomes.length + late.length),
    minutes,
    testimonials: publicTestimonials,
    highlights: submitted
      .filter((item) => item.shareable && item.summary)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .slice(0, 3)
      .map((entry) => entry.summary),
    ratingPattern:
      ratings.length >= 3 &&
      new Set(ratings.map((entry) => entry.partnerId)).size === 1 &&
      ratings.every((entry) => entry.rating === 5)
        ? "Repeated five-star ratings from one collaborator"
        : immediateReviews >= config.rapidReviewCount
          ? "Received multiple reviews within seconds of opening"
          : "",
  };
  return { ...result, badges: badgesFor(result, config) };
}

export function badgesFor(trust, config = mentorConfig) {
  const { verifiedMentor, topMentor, preparedFounder } = config.badges;
  if (trust.role === "founder") {
    return trust.engagements >= preparedFounder.engagements &&
      trust.preparedness.value >= preparedFounder.preparedness &&
      trust.followupRate.value >= preparedFounder.followupRate
      ? ["Prepared Founder"]
      : [];
  }
  if (!trust.approved) return [];
  if (
    trust.sessions.value >= topMentor.sessions &&
    trust.averageRating.value >= topMentor.avgRating &&
    trust.followThrough.value >= topMentor.followThrough &&
    trust.responseRate.value >= topMentor.responseRate
  )
    return ["Top Mentor"];
  if (
    trust.sessions.value >= verifiedMentor.sessions &&
    trust.averageRating.value >= verifiedMentor.avgRating
  )
    return ["Verified Mentor"];
  return trust.sessions.value < verifiedMentor.sessions ? ["New Mentor"] : [];
}

export function publicMentorshipTrust(trust, config = mentorConfig) {
  const expose = (entry) =>
    entry.count >= config.minDataPoints
      ? entry
      : { value: null, count: entry.count };
  if (trust.role === "founder") {
    const keys = [
      "followupRate",
      "preparedness",
      "noShows",
      "lateCancellations",
    ];
    return {
      ...Object.fromEntries(keys.map((key) => [key, expose(trust[key])])),
      badges: trust.badges,
      prepared: trust.badges.includes("Prepared Founder"),
      newFounder: trust.sessions.value === 0,
    };
  }
  const keys = [
    "sessions",
    "founders",
    "averageRating",
    "topSkills",
    "followThrough",
    "responseRate",
    "responseHours",
  ];
  return {
    ...Object.fromEntries(keys.map((key) => [key, expose(trust[key])])),
    badges: trust.badges,
    reliable:
      trust.noShowRate.count >= config.minDataPoints &&
      trust.noShowRate.value < 0.05,
    testimonials: trust.testimonials,
    highlights: trust.highlights,
  };
}
