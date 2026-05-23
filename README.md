# Bible Study Wheel

Probability wheel + statistics tracker for a Bible study group.

## Run locally

Two terminals.

**Terminal 1 — backend**
```bash
cd backend-local
npm install
npm run dev
```
Backend boots on `http://localhost:4000`. First run creates `db.json` with seeded roster + the May 14 2026 meeting.

Default admin login (printed on first start too):
- **Email:** `admin@biblestudy.local`
- **Password:** `admin1234`

**Terminal 2 — frontend**
```bash
cd frontend
npm install
npm run dev
```
Frontend boots on `http://localhost:5173`.

## Project layout

```
bible-study-wheel/
├── frontend/        # React + Vite + Tailwind SPA
├── backend-local/   # Express + JSON-file store (for testing)
└── backend-aws/     # Lambda equivalents (for deploy)
```

## Deploy to AWS (Amplify)

See [backend-aws/README.md](backend-aws/README.md). Short version:
1. Install Amplify CLI, `amplify configure`, `amplify init`
2. `amplify add auth` (with `admin` + `member` groups, `PreSignUp` trigger)
3. `amplify add api` (REST, Cognito authorizer)
4. `amplify add storage` (DynamoDB: Attendees, Meetings, Spins)
5. Copy `backend-aws/functions/*` into Amplify's generated function folders
6. Verify admin email in SES
7. `amplify push` then `amplify add hosting && amplify publish`

First admin: after deploy, manually add yourself to the `admin` Cognito group in the AWS Console (bootstrap step).

## Future changes

- Enter key activates the add/save button in text fields (forms should submit on Enter, not require mouse click).
- Add favicon / app icon to the website.
- Sign up: add show/hide password toggle.
- Sign up: separate first name and last name fields (currently one combined name field).
- Bible verse selection: verify it pulls from *next week's* meeting, not the most recent past one. Example: if today is 2026-05-22 (Friday), the displayed verse should be for 2026-05-28's meeting, not 2026-05-21's.
- Open up auth so the site is public-facing — anonymous visitors can land on the page without signing in.
- Wheel defaults to **trial spin mode** for guests: anyone can spin to try it out, but trial spins are not persisted and do not affect attendee stats.
- "Official" spins (the ones that get tracked) are gated. Open question — how to keep the site usable without letting randoms pollute the data. A few options to weigh:
  - **Admin-only official spins** (simplest): only logged-in admins can record real spins. Logged-in non-admin members still get trial mode.
  - **Logged-in members + admin confirmation**: any approved member can spin, but the spin is marked "pending" until an admin confirms it counts. More flexible, more moderation work.
  - **Per-meeting unlock**: an admin opens "official spin mode" for the active meeting; while it's open, approved members can record one spin each; auto-closes after.
  - **Rate-limit + audit trail**: let approved members spin freely but cap to N/day and log everything, with admin tools to retroactively void spam.
- Future / out-of-scope idea: turn this into a **multi-tenant platform** where any group can spin up their own instance with their own roster, attendees, and stats — basically this app becomes one "tenant" inside a larger portal. Keeping the scope of *this* app small (single group, single DB) so it can act as the reference implementation / prototype for what a single tenant would look like inside that bigger system.
