# Proposed product wording — owner review required

Draft only, 7 November 2026. `docs/product/Synergy.md` has not been edited. These proposals reconcile the implementation and the confirmed founder audit decisions; they are not changes to the product reference.

## Section 6: Deal Room lifecycle

Proposed wording: “Rooms move through Matched, Agreeing terms, In progress, Launched (Completed for mentorship), and Reviewed. Terms are agreed only after both participants accept the same revision. A milestone counts when both confirm its current scope and proof. Required proof stays required; milestone ordering prompts a warning and does not prevent out-of-order work. The final mutual confirmation automatically completes an exchange or one-off mentorship in the same transaction. Both participants receive a review prompt and have 14 days from completion to submit blind feedback. Either participant may undo within 24 hours, provided neither has reviewed; the final milestone returns to unconfirmed. A room becomes Reviewed when both reviews arrive or the 14-day window closes, releasing whatever was submitted. Missing reviews are identified rather than invented.”

Ongoing mentorship addition: “Use 8-week review cycles with goals, sessions, a check-in summary and a private review from each participant. After both reviews, each chooses Continue or Finish. Two Continue decisions start a fresh cycle; if either chooses Finish, completion occurs once both have responded. The final public-history rating remains a separate 14-day review. Cycle feedback is private to the participants and does not add extra public ratings.” This continuation policy is an implementation choice for owner review.

## Section 8: Verification and trust

Proposed wording: “Unverified founders can build profiles, browse, search and save. In verification-required workspaces, sending and accepting introductions requires moderator-approved affiliation. Evidence may be a business affiliation, accelerator or university roster, founder-community membership or a checkable referral note. A business domain is not required. Pending requests show the review due date; rejection shows the moderator note and permits resubmission. This prototype does not verify email or deliver verification messages. Demo preview accounts are exempt.”

Trust clarification: “Reviews contribute to public history after both participants submit or the 14-day window closes. Repeat collaborations remain in history but the aggregate uses one rating per distinct partner. Five identical released ratings trigger a context warning. Mutual, irrelevant and moderator-without-penalty closures are neutral; a nonresponse closure counts against the partner who stopped responding.”

## Section 11: Notifications

Proposed wording: “New accounts default to a weekly in-app digest, with daily and Off options. New-match alerts start at 70% using the current symmetric matching algorithm. The digest links to the three highest-scoring new matches in the current period. Messages and ordinary activity follow preferences; anything requiring a reply stays immediate. Quiet collaborations prompt a check-in after 14 days. Completion prompts blind reviews and shows the 14-day deadline. Email delivery is not configured; an outbox and stub exist for a future approved sender.”

## Section 12: Maria and Campus Grocer

Replace the asserted 82% with: “The pair receives a transparent score based on the recorded profiles, with directional need coverage shown separately. The current reproducible fixture scores 59% in both directions under reciprocal-v3 with unchanged weights. Missing stated goals earn no assumed fit.”

Replace the final sequence with: “Once both have confirmed every milestone, including reviewing issues, the deal automatically reaches Launched. Both founders may submit blind ratings within 14 days. It becomes Reviewed when both submit or the window expires. Feedback remains hidden until that release.”

Weight proposal, not applied: evaluate a stronger reciprocal-need contribution or a richer controlled vocabulary using real released outcomes before revising weights. The current 50% need fit reflects partial coverage in both directions, and absent goals contribute zero. Do not tune the system to reproduce one illustrative 82% number. Version any approved change and compare algorithm/version cohorts in the moderation matching report.

## Template milestone differences

Document each template rather than presenting one universal list:

| Template              | Milestones in order                                                                                             | Required proof                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Beta Testing Exchange | Scope defined; Testers assigned; Testing round; Feedback submitted; Issues reviewed                             | Testing round and Feedback submitted                                               |
| Co-Marketing Swap     | Assets shared; Draft approved; Send date locked; Swap executed; Results reported                                | Results reported                                                                   |
| Mentorship            | Goals defined; Sessions scheduled; Guidance delivered; Follow-up actions logged; Progress reflected on together | Guidance delivered; a saved session/series is required before session confirmation |

The mentorship progress reflection is a shared milestone, not the blind private rating. One-off guidance completes after all confirmations. Ongoing guidance repeats these milestones per cycle, retaining earlier cycle goals, proof, sessions, summaries and private feedback in history. Task cards are optional planning tools; marking a task Done never confirms a milestone.
