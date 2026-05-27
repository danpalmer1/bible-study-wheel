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

## Deploy to AWS (Amplify Gen 2)

Full first-time walkthrough in [backend-aws/AWS_SETUP.md](backend-aws/AWS_SETUP.md). Short version:

1. `aws configure` with an IAM admin user. Gen 2 talks to AWS via your CLI credentials directly — no `amplify configure`, no separate Amplify IAM user.
2. From the repo root: `npm install`, then `npx ampx sandbox` to provision your personal dev stack. This deploys Cognito, two DynamoDB tables, and the five API Lambdas + preSignUp trigger defined in [`amplify/backend.ts`](amplify/backend.ts), and writes `amplify_outputs.json` to the repo root.
3. `npm run sync-config` copies the relevant values into `frontend/.env.local`. Then `cd frontend && npm run dev` runs the SPA locally against the sandbox backend.
4. (Optional) Verify a sender address in SES if you want admin sign-up notification emails.
5. **Production deploy:** in the AWS Console, connect the repo to Amplify Hosting and pick the `master` branch. The `amplify.yml` build spec runs `npx ampx pipeline-deploy --branch master` (CDK-deploys the backend stack) followed by `vite build` (uploads the frontend to Amplify's CDN). Subsequent pushes to `master` redeploy automatically.

First admin (one-time bootstrap): after signing up via the app, run `aws cognito-idp admin-confirm-sign-up` + `admin-add-user-to-group --group-name admin` against the pool ID from `amplify_outputs.json`. Full commands in [AWS_SETUP.md](backend-aws/AWS_SETUP.md).

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

- **Wheel breaks when its inputs change mid-spin.** Mid-spin state lives in `Wheel.tsx` component state, so anything that re-renders the wheel during a spin corrupts the animation: toggling participants in the `AttendeeSelector` reshuffles the wedges out from under the spinner, and navigating to `/stats` (or any other route) unmounts the wheel entirely. Two design options on the table — pick one before the next release:
  1. **Lock the inputs while spinning.** Disable nav links and the participant selector while `isSpinning === true`, re-enable when the spin resolves. Smallest change; keeps wheel state local to the page.
  2. **Persist the wheel across page changes.** Hoist the wheel/animation state into a context or portal above the router so the wheel survives route changes (and ignore participant edits while spinning). Bigger refactor but a nicer UX.

- **Verse banner reportedly showing previous week's reading.** Observed on a local preview: banner shows `3 John 1:X` and the reader recognized 3 John as the *previous* week's reading. Investigation of the local code path is inconclusive — given today=2026-05-26 (Tue), `nextThursday()` correctly returns 2026-05-28, and the local `db.json` meeting for 2026-05-28 has `book: "3-john", chapter: 1`, so the banner output matches the data. Either (a) the local schedule doesn't match the actual group schedule (someone manually entered the wrong week via Admin → Meetings → Upcoming), or (b) there's a subtler bug not reproducible from the local data alone. Next time it appears: check what date the upcoming meeting in DDB/db.json is actually set to, vs the date the banner thinks is "this Thursday" (`weekOf` in the `/api/verse` response).

## Future changes

- **Open question — drop the user/signup system entirely?** With the wheel and stats both public, signing up gets a member nothing — there's no member-only view left to incentivize an account. Admin is the only role with privileges. Could remove Login/Signup buttons from the nav and have admins navigate to a secret URL (e.g. `/admin-login` or `/wheel?admin=1`) to authenticate, keeping the Cognito user pool + `admin` group but hiding all entry points from the public UI. Keeps admin functionality intact, deletes a lot of UX surface area (PendingUsers tab, signup approval flow, member promotion). Decide before doing it: is the admin-discoverability tradeoff acceptable?

- **GitHub Actions PR validation (hybrid CI).** Add `.github/workflows/ci.yml` that runs on `pull_request` against `master` / `release/**`: typechecks `amplify/`, runs `npm --prefix frontend run build` (which does `tsc -b && vite build`), and typechecks `backend-local/`. Amplify Hosting keeps owning the actual deploy from `master`; this just gates PRs so regressions don't reach the release branch. Free for both public and private repos (2,000 minutes/month on private, unlimited on public). Restores the `[skip ci]` convention as a side effect.
- Future / out-of-scope idea: turn this into a **multi-tenant platform** where any group can spin up their own instance with their own roster, attendees, and stats — basically this app becomes one "tenant" inside a larger portal. Keeping the scope of *this* app small (single group, single DB) so it can act as the reference implementation / prototype for what a single tenant would look like inside that bigger system.
