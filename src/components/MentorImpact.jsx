import { useApp } from "../state/AppContext.jsx";
import { mentorConfig } from "../data/mentor-rules.js";

const percent = (value) => `${Math.round(value * 100)}%`;
const hours = (value) => `${Number(value.toFixed(1))} h`;
const rating = (value) => `${value.toFixed(1)}/5`;

const hasData = (data, min) => data?.value != null && data.count >= min;
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
  return (
    <section className="founder-track-record">
      <h3>Founder track record</h3>
      <MentorshipBadges badges={trackRecord.badges} />
      <dl className="impact-stats">
        <Metric
          label="Follow-up rate"
          data={trackRecord.followupRate}
          format={percent}
          min={min}
        />
        <Metric
          label="Preparedness"
          data={trackRecord.preparedness}
          format={rating}
          min={min}
        />
        <Metric label="No-shows" data={trackRecord.noShows} min={min} />
        <Metric
          label="Late cancellations"
          data={trackRecord.lateCancellations}
          min={min}
        />
      </dl>
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
}) {
  const { state } = useApp();
  const min = state.mentorConfig?.minDataPoints || mentorConfig.minDataPoints;
  if (!trust) return null;
  const badges = hideEmpty
    ? (trust.badges || []).filter((badge) => badge !== "New Mentor")
    : trust.badges;
  const metrics = [
    trust.sessions,
    trust.founders,
    trust.averageRating,
    trust.topSkills,
    trust.followThrough,
    trust.responseRate,
    trust.responseHours,
  ];
  if (
    hideEmpty &&
    !metrics.some((data) => hasData(data, min)) &&
    !badges?.length &&
    !trust.reliable &&
    !trust.testimonials?.length &&
    !trust.highlights?.length
  )
    return null;
  return (
    <section className="card panel section-gap">
      <h2>Mentoring impact</h2>
      <MentorshipBadges badges={badges} reliable={trust.reliable} />
      <dl className="impact-stats">
        <Metric
          label="Sessions held"
          hideEmpty={hideEmpty}
          data={trust.sessions}
          min={min}
        />
        <Metric
          label="Founders helped"
          hideEmpty={hideEmpty}
          data={trust.founders}
          min={min}
        />
        <Metric
          label="Average rating"
          hideEmpty={hideEmpty}
          data={trust.averageRating}
          format={rating}
          min={min}
        />
        <Metric
          label="Top-rated skills"
          hideEmpty={hideEmpty}
          data={trust.topSkills}
          format={(items) => items.join(", ") || "No topics recorded"}
          min={min}
        />
        <Metric
          label="Follow-through rate"
          hideEmpty={hideEmpty}
          data={trust.followThrough}
          format={percent}
          min={min}
        />
        <Metric
          label="Request response rate"
          hideEmpty={hideEmpty}
          data={trust.responseRate}
          format={percent}
          min={min}
        />
        <Metric
          label="Median response time"
          hideEmpty={hideEmpty}
          data={trust.responseHours}
          format={hours}
          min={min}
        />
        {privateView && (
          <>
            <Metric
              label="No-show rate"
              data={trust.noShowRate}
              format={percent}
              min={min}
            />
            <Metric
              label="Late cancellations in the last 90 days"
              data={trust.lateCancellations}
              min={min}
            />
          </>
        )}
      </dl>
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
