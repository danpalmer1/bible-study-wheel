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

## Known bugs

- **Admin sign-up notification email not firing.** Multiple users have signed up but no notification email arrived at `xdanielpalmerx@gmail.com`, despite verifying the sender identity in SES. The trigger Lambda already has `ses:SendEmail` IAM permission (granted in `amplify/backend.ts`), so the failure is one of:
  1. **`ADMIN_NOTIFY_EMAIL` and/or `FROM_EMAIL` env vars not set on the prod `preSignUpTrigger` Lambda.** The handler (`backend-aws/functions/preSignup/index.js`) reads both env vars and **silently skips the SES call** if either is missing — that's the most likely cause. Verify in Lambda console → preSignUpTrigger → Configuration → Environment variables. Both must be set, and `FROM_EMAIL` defaults to `ADMIN_NOTIFY_EMAIL` if unset.
  2. **SES still in sandbox mode in the deployed region.** In SES sandbox, *both* sender and recipient must be verified identities. Verifying only `xdanielpalmerx@gmail.com` as sender isn't enough — it also has to be verified as a recipient (or you have to request production-access from AWS to send to unverified addresses). For a single-recipient admin notification, the simplest path is to verify the same address for both, which the SES console treats as one verified identity covering both sender and recipient.
  3. **Region mismatch.** SES identities are per-region. If the Lambda runs in `us-east-1` but the verified identity is in another region, sends fail. Confirm Lambda region matches the region where the identity was verified.
  4. **CloudWatch logs.** The handler catches and logs SES errors (`console.error('SES notify failed (signup still allowed):', e)`) but doesn't fail the sign-up. Check the `preSignUpTrigger` log group for the actual error — that nails down which of the above is hitting.

  Requirements checklist for fixing:
  - Verify `xdanielpalmerx@gmail.com` as an SES identity in the same region as the prod Lambda (likely `us-east-1`).
  - Set `ADMIN_NOTIFY_EMAIL=xdanielpalmerx@gmail.com` on the prod `preSignUpTrigger` Lambda environment.
  - Set `FROM_EMAIL=xdanielpalmerx@gmail.com` (or another verified address).
  - Either keep both addresses verified (sandbox-mode-friendly), or request SES production access if you ever want to email arbitrary recipients.
  - Trigger a test sign-up and check CloudWatch — the `SES notify failed` message will appear if anything is still off.
- Bible verse selection: verify it pulls from *next week's* meeting, not the most recent past one. Example: if today is 2026-05-22 (Friday), the displayed verse should be for 2026-05-28's meeting, not 2026-05-21's.

## Future changes

- Enter key activates the add/save button in text fields (forms should submit on Enter, not require mouse click).
- Add favicon / app icon to the website.
- Sign up: add show/hide password toggle.
- Sign up: separate first name and last name fields (currently one combined name field).
- Open up auth so the site is public-facing — anonymous visitors can land on the page without signing in.
- Wheel defaults to **trial spin mode** for guests: anyone can spin to try it out, but trial spins are not persisted and do not affect attendee stats.
- Official spins for now: **unlimited, open to any logged-in user.** No rate-limiting, no admin gating, no per-meeting unlock. Revisit if data pollution becomes a real problem — the earlier ideas (admin-only, member+confirm, per-meeting unlock, rate-limit+audit) are parked for that future revisit.
- **Meeting log: record and display who was selected by the wheel spin.** Each meeting entry should show the selected attendee for that meeting's official spin alongside attendance and topic info.
- **User management within Attendees** (separate feature). Admin-only UI to (a) link an existing attendee record to a Cognito user account, and (b) promote a linked user to admin (adds them to the `admin` Cognito group). Lets members who sign up be tied to their historical roster entry rather than creating duplicates.
- Future / out-of-scope idea: turn this into a **multi-tenant platform** where any group can spin up their own instance with their own roster, attendees, and stats — basically this app becomes one "tenant" inside a larger portal. Keeping the scope of *this* app small (single group, single DB) so it can act as the reference implementation / prototype for what a single tenant would look like inside that bigger system.
