import { Fragment } from "react";
import { useApp } from "../state/AppContext.jsx";
import Tags from "../components/Tags.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Icon from "../components/Icon.jsx";
import AuthStory from "../components/AuthStory.jsx";
export default function OnboardingPage() {
  const { state, model, onAction, onField, fieldValue } = useApp();
  const { roleName, roleLabel } = model;
  const step = state.onboardingStep;
  const founder = state.role === "founder";
  const names = ["Verify", "Role", "Story", "Confirm", "Done"];
  const profile = state.profiles[state.role];
  const progress = Math.round((step / names.length) * 100);
  const stepper = (
    <>
      <div
        className="onboard-progress"
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin="1"
        aria-valuemax="5"
        aria-valuenow={step}
      >
        <span
          style={{
            width: progress + "%",
          }}
        />
      </div>
      <div className="stepper onboard-stepper">
        {names.map((name, index) => (
          <Fragment key={index}>
            <>
              <div
                className={
                  "step-item " +
                  (step === index + 1 ? "active" : "") +
                  " " +
                  (step > index + 1 ? "complete" : "")
                }
              >
                <span className="step-number">
                  {step > index + 1 ? <Icon name="check" /> : index + 1}
                </span>
                {name}
              </div>
              {index < names.length - 1 ? (
                <span className="step-connector" />
              ) : (
                ""
              )}
            </>
          </Fragment>
        ))}
      </div>
    </>
  );
  const illustration = (
    <Icon name={["check", "people", "spark", "profile", "check"][step - 1]} />
  );
  let stepContent = "";
  if (step === 1)
    stepContent = (
      <>
        <div className="onboard-illustration">{illustration}</div>
        <h2>Verify your email</h2>
        <p className="panel-subtitle">
          Verification keeps this a trusted space. Your email stays private.
        </p>
        <div className="field">
          <label htmlFor="verify-email">Your email</label>
          <input
            id="verify-email"
            type="email"
            value={fieldValue(
              "verify-email",
              state.onboarding.signup?.email || "maria@budgetbuddy.app",
            )}
            required
            onChange={(event) => onField("verify-email", event.target.value)}
          />
          <span className="field-help">Verify your email to continue</span>
        </div>
        <button
          className="btn primary"
          data-action="verify-email"
          {...(state.onboarding.verifying || state.onboarding.verified
            ? {
                disabled: true,
              }
            : {})}
          onClick={(event) =>
            onAction(
              {
                action: "verify-email",
              },
              event,
            )
          }
        >
          {state.onboarding.verifying
            ? "Checking…"
            : state.onboarding.verified
              ? "Email verified"
              : "Verify email"}
        </button>
      </>
    );
  if (step === 2)
    stepContent = (
      <>
        <div className="onboard-illustration">{illustration}</div>
        <h2>Which role fits you?</h2>
        <p className="panel-subtitle">
          Choose how you’d like to take part. You can adjust this later.
        </p>
        <div className="grid role-options">
          <button
            className={"card panel role-choice " + (founder ? "selected" : "")}
            data-action="choose-role"
            data-role-choice="founder"
            onClick={(event) =>
              onAction(
                {
                  action: "choose-role",
                  roleChoice: "founder",
                },
                event,
              )
            }
          >
            <Icon name="spark" />
            <h3>I’m building a startup</h3>
            <p>Find partners, early users, and people who help you grow.</p>
          </button>
          <button
            className={"card panel role-choice " + (!founder ? "selected" : "")}
            data-action="choose-role"
            data-role-choice="mentor"
            onClick={(event) =>
              onAction(
                {
                  action: "choose-role",
                  roleChoice: "mentor",
                },
                event,
              )
            }
          >
            <Icon name="people" />
            <h3>I’m here to mentor</h3>
            <p>Share experience with founders who need a thoughtful guide.</p>
          </button>
          <button
            className={
              "card panel role-choice " + (state.bothRoles ? "selected" : "")
            }
            data-action="toggle-both"
            aria-pressed={state.bothRoles}
            onClick={(event) =>
              onAction(
                {
                  action: "toggle-both",
                },
                event,
              )
            }
          >
            <Icon name="people" />
            <h3>I’ll do both</h3>
            <p>
              Build a startup and share your experience with other founders.
            </p>
          </button>
        </div>
      </>
    );
  if (step === 3)
    stepContent = (
      <>
        <div className="onboard-illustration">{illustration}</div>
        <h2>Tell your story</h2>
        <p className="panel-subtitle">
          A short story helps us identify useful offers, needs, and shared
          goals.
        </p>
        <div className="field">
          <label htmlFor="story">
            {founder
              ? "About your startup and what you need next"
              : "Your experience and who you want to help"}
          </label>
          <textarea
            id="story"
            value={fieldValue("story", profile.bio)}
            onChange={(event) => onField("story", event.target.value)}
          />
        </div>
        <button
          className="btn"
          data-action="analyze-story"
          {...(state.onboarding.analyzing
            ? {
                disabled: true,
              }
            : {})}
          onClick={(event) =>
            onAction(
              {
                action: "analyze-story",
              },
              event,
            )
          }
        >
          {state.onboarding.analyzing ? "Analyzing…" : "Analyze"}
        </button>
        {state.onboarding.analyzed ? (
          <div className="ai-preview">
            <h3>Draft suggestions</h3>
            <div className="tags">
              {state.onboarding.tags.map((tag, itemIndex) => (
                <Fragment key={itemIndex}>
                  <span className="tag green">{tag}</span>
                </Fragment>
              ))}
            </div>
          </div>
        ) : (
          ""
        )}
      </>
    );
  if (step === 4)
    stepContent = (
      <>
        <div className="onboard-illustration">{illustration}</div>
        <h2>Here’s what we found: confirm or edit</h2>
        <p className="panel-subtitle">
          Adjust any details before your profile goes live.
        </p>
        <div className="tags onboarding-tags">
          {(state.onboarding.tags.length
            ? state.onboarding.tags
            : profile.offer.split(",").map((item) => item.trim())
          ).map((tag, index) => (
            <Fragment key={index}>
              <span className="tag green">
                {tag}
                <button
                  className="tag-remove"
                  data-action="remove-tag"
                  data-index={index}
                  aria-label={"Remove " + tag}
                  onClick={(event) =>
                    onAction(
                      {
                        action: "remove-tag",
                        index: index,
                      },
                      event,
                    )
                  }
                >
                  ×
                </button>
              </span>
            </Fragment>
          ))}
          {profile.need.split(",").map((tag, itemIndex) => (
            <Fragment key={itemIndex}>
              <span className="tag">{tag.trim()}</span>
            </Fragment>
          ))}
          {state.onboarding.pendingTags.map((tag, index) => (
            <Fragment key={index}>
              <span className="tag pending-tag">
                {tag}
                <span className="status">Pending admin review</span>
                <button
                  className="tag-remove"
                  data-action="remove-pending-tag"
                  data-index={index}
                  aria-label={"Remove " + tag}
                  onClick={(event) =>
                    onAction(
                      {
                        action: "remove-pending-tag",
                        index: index,
                      },
                      event,
                    )
                  }
                >
                  ×
                </button>
              </span>
            </Fragment>
          ))}
        </div>
        <div className="add-tag-row">
          <input
            id="tag-input"
            aria-label="Add a profile tag"
            placeholder="Add a skill, need, or goal"
            value={fieldValue("tag-input", "")}
            onChange={(event) => onField("tag-input", event.target.value)}
          />
          <button
            className="btn"
            type="button"
            data-action="add-tag"
            onClick={(event) =>
              onAction(
                {
                  action: "add-tag",
                },
                event,
              )
            }
          >
            + Add tag
          </button>
        </div>
        <div className="form-grid section-gap">
          <div className="field">
            <label htmlFor="confirm-offer">What I offer</label>
            <input
              id="confirm-offer"
              value={fieldValue("confirm-offer", profile.offer)}
              onChange={(event) => onField("confirm-offer", event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-need">What I need</label>
            <input
              id="confirm-need"
              value={fieldValue("confirm-need", profile.need)}
              onChange={(event) => onField("confirm-need", event.target.value)}
            />
          </div>
          {founder ? (
            <>
              <div className="field">
                <label htmlFor="confirm-industry">Industry</label>
                <input
                  id="confirm-industry"
                  value={fieldValue(
                    "confirm-industry",
                    profile.industry || "Product",
                  )}
                  onChange={(event) =>
                    onField("confirm-industry", event.target.value)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="confirm-stage">Stage</label>
                <input
                  id="confirm-stage"
                  value={fieldValue(
                    "confirm-stage",
                    profile.stage || "Pre-seed",
                  )}
                  onChange={(event) =>
                    onField("confirm-stage", event.target.value)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="confirm-team">Team size</label>
                <input
                  id="confirm-team"
                  value={fieldValue("confirm-team", profile.teamSize || "4")}
                  onChange={(event) =>
                    onField("confirm-team", event.target.value)
                  }
                />
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="confirm-expertise">Expertise areas</label>
                <input
                  id="confirm-expertise"
                  value={fieldValue(
                    "confirm-expertise",
                    profile.expertise || "Product strategy",
                  )}
                  onChange={(event) =>
                    onField("confirm-expertise", event.target.value)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="confirm-availability">Availability</label>
                <input
                  id="confirm-availability"
                  value={fieldValue(
                    "confirm-availability",
                    profile.availability || "Monthly sessions",
                  )}
                  onChange={(event) =>
                    onField("confirm-availability", event.target.value)
                  }
                />
              </div>
              <div className="field full-width">
                <label htmlFor="confirm-startups">
                  Startups I want to help
                </label>
                <input
                  id="confirm-startups"
                  value={fieldValue(
                    "confirm-startups",
                    profile.startups || "Idea and pre-seed teams",
                  )}
                  onChange={(event) =>
                    onField("confirm-startups", event.target.value)
                  }
                />
              </div>
            </>
          )}
          <div className="field full-width">
            <label htmlFor="confirm-goals">Goals</label>
            <input
              id="confirm-goals"
              value={fieldValue(
                "confirm-goals",
                profile.goals || "Find the right partners",
              )}
              onChange={(event) => onField("confirm-goals", event.target.value)}
            />
          </div>
        </div>
      </>
    );
  if (step === 5)
    stepContent = (
      <>
        <div className="onboard-illustration">{illustration}</div>
        <h2>You’re ready to go</h2>
        <p className="panel-subtitle">
          Your profile is set up. Start with the people who match what you need
          next.
        </p>
        <div className="confirmation-card">
          <Icon name="check" />
          {" Profile ready for "}
          {roleLabel().toLowerCase()} {roleName()}.
        </div>
        <div className="profile-card">
          <h3>{profile.industry || profile.expertise || "Your experience"}</h3>
          <p>{profile.bio}</p>
          <Tags
            values={profile.offer.split(",").map((tag) => tag.trim())}
            color="green"
          />
        </div>
      </>
    );
  const nextAction = step === 5 ? "finish-onboarding" : "onboarding-next";
  return (
    <div className="page auth-page page-enter">
      <AuthStory />
      <section className="auth-form-panel">
        <div className="onboard-layout">
          <PageHeader
            eyebrow="LET’S GET STARTED"
            title="Build a profile that feels like you"
            intro="A few small steps help good people find each other."
          />
          {stepper}
          <section className="card panel onboarding-card">
            {stepContent}
            <div className="onboarding-actions">
              <button
                className="btn"
                data-action="onboarding-back"
                {...(step === 1
                  ? {
                      disabled: true,
                    }
                  : {})}
                onClick={(event) =>
                  onAction(
                    {
                      action: "onboarding-back",
                    },
                    event,
                  )
                }
              >
                Back
              </button>
              <button
                className="btn primary"
                data-action={nextAction}
                {...(step === 1 && !state.onboarding.verified
                  ? {
                      disabled: true,
                    }
                  : {})}
                onClick={(event) =>
                  onAction(
                    {
                      action: nextAction,
                    },
                    event,
                  )
                }
              >
                {step === 5 ? "Explore Synergy" : "Continue"}
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
