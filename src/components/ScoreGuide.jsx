import { Fragment, useState } from "react";
import { defaultMatching } from "../data/matching.js";
import Icon from "./Icon.jsx";

// Each factor's icon sits in a tile tinted with its bar colour.
function FactorIcon({ name }) {
  return (
    <div className="score-drawing">
      <Icon name={name} />
    </div>
  );
}

// Real pairs the tag vocabulary treats as the same help (data/collaboration.js).
const examples = [
  ["Beta testers", "People to try our product"],
  ["Fundraising", "Pitch deck and investor intros"],
  ["Product design", "UX reviews"],
];

const factors = [
  {
    key: "need",
    icon: "handshake",
    name: "Need fit",
    text: {
      founder:
        "What you need lines up with what they offer, and the other way round.",
      mentor: "What you need lines up with what the mentor offers.",
    },
  },
  {
    key: "expertise",
    icon: "award",
    name: "Expertise fit",
    text: "Mentors only: your needs compared with the mentor's listed expertise.",
  },
  {
    key: "industry",
    icon: "blend",
    name: "Industry fit",
    text: "You work in the same space or serve the same users.",
  },
  {
    key: "stage",
    icon: "trending-up",
    name: "Stage and size fit",
    text: "Similar company stage and team size. For co-marketing, similar audience size.",
  },
  {
    key: "goal",
    icon: "target",
    name: "Goal fit",
    text: "Your stated goals and how you like to work agree. Blank answers add nothing.",
  },
];

export default function ScoreGuide({ role }) {
  const [kind, setKind] = useState(role === "mentor" ? "mentor" : "founder");
  const weights = defaultMatching[kind];
  // Unused factors stay mounted but fold away, so switching match type
  // animates the change instead of popping rows in and out.
  const shown = factors.map((factor, index) => ({
    ...factor,
    weight: Math.round(weights[index] * 100),
  }));
  const counted = shown.filter((factor) => factor.weight > 0);

  return (
    <div className="score-guide-body">
      <p className="score-guide-lead">
        Every match gets a score out of 100, built from up to five signals in
        your profiles.
      </p>

      {role !== "mentor" && (
        <div
          className="score-guide-switch"
          role="group"
          aria-label="Match type"
        >
          {[
            ["founder", "Startup matches"],
            ["mentor", "Mentor matches"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div
        className="score-mix"
        role="img"
        aria-label={`Score makeup: ${counted.map((f) => `${f.name} ${f.weight}%`).join(", ")}`}
      >
        {shown.map((factor) => (
          <span
            key={factor.key}
            className={`score-mix-part factor-${factor.key}`}
            style={{ flexGrow: factor.weight }}
            aria-hidden="true"
          >
            {factor.weight > 0 && `${factor.weight}%`}
          </span>
        ))}
      </div>

      <ul className="score-factors">
        {shown.map((factor) => (
          <li
            key={factor.key}
            className={`score-factor-slot${factor.weight ? "" : " is-hidden"}`}
            aria-hidden={factor.weight ? undefined : true}
            inert={factor.weight ? undefined : true}
          >
            <div className="score-factor-clip">
              <div className={`score-factor factor-${factor.key}`}>
                <FactorIcon name={factor.icon} />
                <div>
                  <h3>
                    {factor.name}
                    <span className="score-factor-weight">
                      {factor.weight}%
                    </span>
                  </h3>
                  <p>{factor.text[kind] || factor.text}</p>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <section className="score-example" aria-labelledby="score-example-title">
        <h3 id="score-example-title">Matched on meaning, not exact words</h3>
        <div className="score-example-grid">
          <span className="score-example-head">You need</span>
          <span aria-hidden="true" />
          <span className="score-example-head">They offer</span>
          {examples.map(([need, offer]) => (
            <Fragment key={need}>
              <span className="score-chip">{need}</span>
              <span className="score-example-equals" aria-label="counts as">
                =
              </span>
              <span className="score-chip">{offer}</span>
            </Fragment>
          ))}
        </div>
      </section>

      <section className="score-cap" aria-labelledby="score-cap-title">
        <span className="score-drawing score-cap-drawing">
          <Icon name="scale" />
        </span>
        <div>
          <h3 id="score-cap-title">Uneven swaps are capped at 40%</h3>
          <p>
            If one side's audience is more than 10 times bigger, a co-marketing
            swap can't score above 40.
          </p>
        </div>
      </section>

      <p className="score-guide-note">
        The score summarizes profile signals. It isn't a prediction that the
        collaboration will succeed.
      </p>
    </div>
  );
}
