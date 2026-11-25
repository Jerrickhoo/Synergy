import { useApp } from "../state/AppContext.jsx";
import { formatHours, mentorConfig } from "../data/mentor-rules.js";

const percent = (value) => `${Math.round(value * 100)}%`;
// Response times are medians in hours; mentoring hours use formatHours, the
// same formatter as the certificate (Nov 22, round 2).
const hours = (value) => `${Number(value.toFixed(1))} h`;
const rating = (value) => `${value.toFixed(1)}/5`;

const hasData = (data, min) => data?.value != null && data.count >= min;
// Counts always show; minDataPoints applies to rates and ratings only.
const count = (value) => ({ value: value ?? 0, count: Infinity });
function Metric({ data, label, format = String, min, hideEmpty = false }) {
  const visible = hasData(data, min);
  if (hideEmpty && !visible) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{visible ? format(data.value) : "Not enough data yet"}</dd>
    </div>
  );
}

export function MentorshipBadges({ badges, reliable = false }) {
  return (
    (badges?.length > 0 || reliable) && (
      <div
        className="chip-row mentorship-badges"
        aria-label="Mentorship badges"
      >
        {badges?.map((badge) => (
          <span key={badge} className="badge-verified">
            {badge}
          </span>
        ))}
        {reliable && <span className="badge-verified">Reliable</span>}
      </div>
    )
  );
}

export function FounderTrackRecord({ trackRecord, own = false }) {
  const { state } = useApp();
  const min = state.mentorConfig?.minDataPoints || mentorConfig.minDataPoints;
  if (!own && (!trackRecord || trackRecord.newFounder))
    return <p>First mentorship request</p>;
  // On the founder's own profile, metrics without enough data are left out
  // and one line says what will appear, instead of a tile per empty metric.
  const metrics = [
    ["Follow-up rate", trackRecord.followupRate, percent],
    ["Preparedness", trackRecord.preparedness, rating],
    ["No-shows", trackRecord.noShows, String],
    ["Late cancellations", trackRecord.lateCancellations, String],
  ];
  const shown = own
    ? metrics.filter(([, data]) => hasData(data, min))
    : metrics;
  return (
    <section
      className={`founder-track-record${own ? " profile-record-detail" : ""}`}
    >
      <h3>Founder track record</h3>
      <MentorshipBadges badges={trackRecord.badges} />
      {shown.length > 0 && (
        <dl className="impact-stats">
          {shown.map(([label, data, format]) => (
            <Metric
              key={label}
              label={label}
              data={data}
              format={format}
              min={min}
            />
          ))}
        </dl>
      )}
      {shown.length < metrics.length && (
        <p className="muted">
          {shown.length
            ? `Other measures appear once each has ${min} data points.`
            : `Follow-up rate, preparedness, no-shows and late cancellations appear once each has ${min} data points.`}
        </p>
      )}
      {own && (
        <p>
          Share materials before a session, attend on time and submit your
          follow-up.
        </p>
      )}
    </section>
  );
}

// Public profiles hide tiles without enough data (and the "New Mentor" badge,
// which the trust line already states); the mentor's own view shows them all.
export default function MentorImpact({
  trust,
  privateView = false,
  hideEmpty = false,
  embedded = false,
}) {
  const { state } = useApp();
  const min = state.mentorConfig?.minDataPoints || mentorConfig.minDataPoints;
  if (!trust) return null;
  // "New Mentor" says nothing the empty state doesn't already: it is left
  // out on public profiles and on the mentor's own Impact page.
  const badges =
    hideEmpty || privateView
      ? (trust.badges || []).filter((badge) => badge !== "New Mentor")
      : trust.badges;
  // On the Impact page the page title already says "Impact"; the section
  // keeps its heading for screen readers only.
  const headingClass = privateView ? "visually-hidden" : undefined;
  const metrics = [
    trust.averageRating,
    trust.topSkills,
    trust.followThrough,
    trust.responseRate,
    trust.responseHours,
  ];
  const sessions = trust.sessions?.value || 0;
  // Inside another card (the profile's Collaboration record) it drops its own
  // card and steps the heading down a level, so cards are not nested.
  const Heading = embedded ? "h3" : "h2";
  const frame = embedded ? "profile-record-detail" : "card panel section-gap";
  if (
    hideEmpty &&
    !sessions &&
    !metrics.some((data) => hasData(data, min)) &&
    !badges?.length &&
    !trust.reliable &&
    !trust.testimonials?.length &&
    !trust.highlights?.length
  )
    return null;
  // Before the first held session, one specific line replaces a grid of
  // "Not enough data yet" tiles (readiness plan P8).
  if (!sessions && !metrics.some((data) => hasData(data, min)))
    return (
      <section className={frame}>
        <Heading className={headingClass}>Mentoring impact</Heading>
        <MentorshipBadges badges={badges} reliable={trust.reliable} />
        <p>
          Your impact appears here after your first held session: sessions,
          founders helped, mentoring hours and, after {min} reviews, ratings and
          response rates.
        </p>
      </section>
    );
  return (
    <section className="card panel section-gap">
      <h2 className={headingClass}>Mentoring impact</h2>
      <MentorshipBadges badges={badges} reliable={trust.reliable} />
      <dl className="impact-stats">
        <Metric
          label="Sessions held"
          data={count(trust.sessions?.value)}
          min={0}
        />
        <Metric
          label="Founders helped"
          data={count(trust.founders?.value)}
          min={0}
        />
        <Metric
          label="Mentoring hours"
          data={count(trust.minutes || 0)}
          format={formatHours}
          min={0}
        />
        <Metric
          label="Average rating"
          hideEmpty
          data={trust.averageRating}
          format={rating}
          min={min}
        />
        <Metric
          label="Top-rated skills"
          hideEmpty
          data={trust.topSkills}
          format={(items) => items.join(", ") || "No topics recorded"}
          min={min}
        />
        <Metric
          label="Follow-through rate"
          hideEmpty
          data={trust.followThrough}
          format={percent}
          min={min}
        />
        <Metric
          label="Request response rate"
          hideEmpty
          data={trust.responseRate}
          format={percent}
          min={min}
        />
        <Metric
          label="Median response time"
          hideEmpty
          data={trust.responseHours}
          format={hours}
          min={min}
        />
        {privateView && (
          <>
            <Metric
              label="No-show rate"
              hideEmpty
              data={trust.noShowRate}
              format={percent}
              min={min}
            />
            <Metric
              label="Late cancellations in the last 90 days"
              hideEmpty
              data={trust.lateCancellations}
              min={min}
            />
          </>
        )}
      </dl>
      {/* Rates wait for enough data; one line says so instead of a tile
          per rate (readiness plan P8). */}
      {!hideEmpty &&
        [
          ...metrics,
          ...(privateView ? [trust.noShowRate, trust.lateCancellations] : []),
        ].some((data) => !hasData(data, min)) && (
          <p className="muted">
            Ratings and rates appear once there are at least {min} data points
            for each.
          </p>
        )}
      {trust.testimonials?.length > 0 && (
        <section>
          <h3>Testimonials</h3>
          {trust.testimonials.map((text, index) => (
            <blockquote key={index}>{text}</blockquote>
          ))}
        </section>
      )}
      {trust.highlights?.length > 0 && (
        <section>
          <h3>Follow-up highlights</h3>
          <ul>
            {trust.highlights.map((summary, index) => (
              <li key={index}>{summary}</li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
