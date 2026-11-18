import { useApp } from "../state/AppContext.jsx";
import { mentorConfig } from "../data/mentor-rules.js";

const percent = (value) => `${Math.round(value * 100)}%`;
const hours = (value) => `${Number(value.toFixed(1))} h`;
const rating = (value) => `${value.toFixed(1)}/5`;

function Metric({ data, label, format = String, min }) {
  const visible = data?.value != null && data.count >= min;
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

export default function MentorImpact({ trust, privateView = false }) {
  const { state } = useApp();
  const min = state.mentorConfig?.minDataPoints || mentorConfig.minDataPoints;
  if (!trust) return null;
  return (
    <section className="card panel section-gap">
      <h2>Mentoring impact</h2>
      <MentorshipBadges badges={trust.badges} reliable={trust.reliable} />
      <dl className="impact-stats">
        <Metric label="Sessions held" data={trust.sessions} min={min} />
        <Metric label="Founders helped" data={trust.founders} min={min} />
        <Metric
          label="Average rating"
          data={trust.averageRating}
          format={rating}
          min={min}
        />
        <Metric
          label="Top-rated skills"
          data={trust.topSkills}
          format={(items) => items.join(", ") || "No topics recorded"}
          min={min}
        />
        <Metric
          label="Follow-through rate"
          data={trust.followThrough}
          format={percent}
          min={min}
        />
        <Metric
          label="Request response rate"
          data={trust.responseRate}
          format={percent}
          min={min}
        />
        <Metric
          label="Median response time"
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
