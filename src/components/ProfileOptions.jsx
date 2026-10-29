import { useApp } from "../state/AppContext.jsx";

export default function ProfileOptions({ profile, founder = true }) {
  const { state } = useApp();
  return (
    <fieldset className="profile-options grid">
      <legend>Collaboration preferences</legend>
      <div className="field">
        <label htmlFor="profile-goals">Goals for collaborating</label>
        <textarea
          id="profile-goals"
          name="goals"
          defaultValue={profile.goals || ""}
          maxLength={2000}
          placeholder="For example: validate onboarding with 20 student testers"
        />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="profile-engagement">Engagement preference</label>
          <select
            id="profile-engagement"
            name="engagementPreference"
            defaultValue={profile.engagementPreference || ""}
          >
            <option value="">Not specified</option>
            <option value="one-off">One-off</option>
            <option value="ongoing">Ongoing</option>
            <option value="either">Either</option>
          </select>
        </div>
        {founder && (
          <div className="field">
            <label htmlFor="profile-audience">Audience size</label>
            <input
              id="profile-audience"
              name="audienceSize"
              type="number"
              min="0"
              step="1"
              defaultValue={profile.audienceSize || ""}
            />
            <span className="field-help">
              Optional. Used for co-marketing size comparisons.
            </span>
          </div>
        )}
      </div>
      <datalist id="approved-tags">
        {(state.vocabulary || []).map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      {[
        ["offerTags", "Offer tags"],
        ["needTags", "Need tags"],
      ].map(([key, label]) => (
        <div className="field" key={key}>
          <label htmlFor={`profile-${key}`}>{label}</label>
          <input
            id={`profile-${key}`}
            name={key}
            defaultValue={profile[key] || ""}
            list="approved-tags"
          />
          <span className="field-help">
            Choose approved tags, separated by commas. Available:{" "}
            {(state.vocabulary || []).join(", ")}.
          </span>
        </div>
      ))}
    </fieldset>
  );
}
