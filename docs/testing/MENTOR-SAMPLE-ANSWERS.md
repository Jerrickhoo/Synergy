# Mentor sample answers

Sample values that pass every check, from sign-up to a submitted mentor application. Copy them as you go. The rules come from the server, so anything outside them gets rejected.

Your character is **Sam Ortega**, a former head of growth at a subscription software company who mentors early-stage founders on pricing and retention.

## Sign up

| Field         | Sample                    | Rule                                                     |
| ------------- | ------------------------- | -------------------------------------------------------- |
| First name    | Sam                       | Required                                                 |
| Last name     | Ortega                    | Required                                                 |
| Email         | `you+mentor1@example.com` | An unused address whose inbox you can open               |
| Password      | `SamOrtega2026!`          | At least 8 characters, not counting spaces at either end |
| I'm here as a | Mentor                    | Choose Mentor, or the mentor application never appears   |

Open the link in the confirmation email before you continue.

## Mentor application

The application has 8 steps. Select **Save and continue** after each one. **Continue later** keeps your progress.

### Step 1: Verification

Pick a method first, then enter details that match it. A mismatch shows "Provide a LinkedIn profile URL, work email or an endorsing organization with verification details."

| Method                 | Sample                                             | Rule                                                                      |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| LinkedIn profile       | `https://www.linkedin.com/in/sam-ortega`           | Starts with `https://`, on linkedin.com, path starts with `/in/your-name` |
| Work email             | `sam.ortega@acmesubscriptions.com`                 | Any valid email address                                                   |
| Endorsing organization | Rundown test cohort, checked by the test moderator | At least 8 characters                                                     |

**Use for testing:** Endorsing organization.

These are rejected:

- `linkedin.com/in/sam-ortega` (no `https://`)
- `http://www.linkedin.com/in/sam-ortega` (`http`, not `https`)
- `https://www.linkedin.com/company/acme` (a company page, not an `/in/` profile)
- `Acme` with Endorsing organization (under 8 characters)

The method dropdown starts on LinkedIn profile, so change it before you type anything else.

### Step 2: Expertise

Tick **at least 3** tags from the list. If a topic is missing, **Missing a topic?** lets you propose it, but it only joins the list once a moderator approves it.

**Sample:** Pricing Strategy, Distribution, Mentorship, Fundraising

The tags available out of the box:

| Tags          |                       |
| ------------- | --------------------- |
| Beta Testers  | Mentorship            |
| Co-Marketing  | Pricing Strategy      |
| Distribution  | Product Design        |
| Fundraising   | Product Feedback      |
| User Research | Technical Development |

A moderator can approve extra tags, and those appear in the list too. There is no retention tag. A founder can type "Customer retention" as a need, but it doesn't match any tag.

Include **Pricing Strategy**. ShelfShare and the Fairway founder in the rundown both need it, so without it they won't match you.

### Step 3: Capacity and time zone

| Field                       | Sample                     | Allowed                |
| --------------------------- | -------------------------- | ---------------------- |
| Mentees at once             | 3                          | Whole number, 1 to 10  |
| Hours per month             | 6                          | Whole number, 1 to 40  |
| Open quick asks and reviews | 3                          | Whole number, 1 to 10  |
| Reply time                  | 2 days                     | 1, 2, 3, 5 or 7 days   |
| Time zone                   | Your own, e.g. Asia/Manila | Any zone from the list |

### Step 4: Formats

Tick **at least 1**.

| Format           | Effort                 | Sample |
| ---------------- | ---------------------- | ------ |
| Quick Ask        | 10–15 min              | Yes    |
| Doc/Pitch Review | 30–60 min              | Yes    |
| Single Session   | About 1 hr             | Yes    |
| Office Hours     | Mentor's choice        | No     |
| Ongoing Advisory | Check-ins over a cycle | No     |

Keep **Quick Ask** and **Single Session**, because the rundown uses both later.

### Step 5: Conflicts of interest

Do **one** of these, not both:

- **Sample:** tick **I have no conflicts**.
- Or list each conflict with a company name of at least 2 characters and a relationship: Advisor, Employee, Investor, Founder or Other. Industry is optional. Up to 20 conflicts.

Sample conflict, if you want to test that path:

| Company            | Relationship | Industry |
| ------------------ | ------------ | -------- |
| Acme Subscriptions | Advisor      | Software |

### Step 6: Mentor guidelines

Open at least two sections to read them, then tick **I accept the mentor guidelines**. You can't continue without the tick.

### Step 7: Experience

The experience summary is optional. The short introduction is **required**: founders read it first, and you can't send introductions without it.

| Field              | Rule                       | Sample                                                                                                                                                               |
| ------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experience summary | Optional, 1,500 characters | Head of growth at a 40-person subscription software company for 5 years. Ran pricing, packaging and retention, and moved the business from monthly to annual plans.  |
| Short introduction | Required, 2,000 characters | I help early-stage founders price their product and keep the customers they win. You'll leave a session with two pricing options to test and a plan to measure them. |

### Step 8: Preferences

Both fields are optional. Separate values with commas, up to 250 characters per field.

| Field          | Sample                                     |
| -------------- | ------------------------------------------ |
| Startup stages | Pre-seed, Seed, Series A                   |
| Industries     | SaaS, Consumer subscriptions, Marketplaces |

Fill **Industries** anyway. It becomes _Startups I want to help_ on your profile, and you can't send introductions without that. If you leave it blank, **Send introduction** is disabled and the card says "Add the startups you want to help to your profile", with an **Edit profile** button.

Select **Submit for approval**. You land on _Application under review_, which says how long approval usually takes. Home shows the same banner, with **View application** to come back here.

## After you submit

A moderator account, one whose email is in `SYNERGY_ADMIN_EMAILS`, opens **Moderation**. **Mentor approvals (1 waiting)** sits below Tag proposals, above the collapsed Account access list. Expand the applicant and select **Approve mentor**. You can't approve your own application.

Rejecting needs a written reason. After a first rejection, the mentor sees _Mentor application needs changes_ with the reason and **Edit and resubmit**, which reopens the application at step 1. After a second rejection, the page reads _Mentor application not approved_, says the application can't be resubmitted, and offers **Switch profiles in Settings** to carry on as a founder.

**For testing without a moderator:** when `SYNERGY_SIMULATE_VERIFICATION` is `true`, _Application under review_ shows a **Simulate approval** button in a dashed _Prototype only_ box. It approves your application straight away and logs it in the moderation audit as simulated.

The full end-to-end run, including approval and helping founders, is in [MENTOR-RUNDOWN-HOSTED.md](MENTOR-RUNDOWN-HOSTED.md).
