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
2. From the repo root: `npm install`, then `npx ampx sandbox` to provision your personal dev stack. This deploys Cognito, two DynamoDB tables, and the four API Lambdas defined in [`amplify/backend.ts`](amplify/backend.ts), and writes `amplify_outputs.json` to the repo root.
3. `npm run sync-config` copies the relevant values into `frontend/.env.local`. Then `cd frontend && npm run dev` runs the SPA locally against the sandbox backend.
4. **Production deploy:** in the AWS Console, connect the repo to Amplify Hosting and pick the `master` branch. The `amplify.yml` build spec runs `npx ampx pipeline-deploy --branch master` (CDK-deploys the backend stack) followed by `vite build` (uploads the frontend to Amplify's CDN). Subsequent pushes to `master` redeploy automatically.

Admins (only accounts in the system): self-signup is disabled at the pool level (`AllowAdminCreateUserOnly`), so create each admin via `aws cognito-idp admin-create-user` + `admin-add-user-to-group --group-name admin` against the pool ID from `amplify_outputs.json`, then sign in at the unlisted `/admin-login` route. Full commands in [AWS_SETUP.md](backend-aws/AWS_SETUP.md).

## Known bugs

- **Verse banner reportedly showing previous week's reading.** Observed on a local preview: banner shows `3 John 1:X` and the reader recognized 3 John as the *previous* week's reading. Investigation of the local code path is inconclusive — given today=2026-05-26 (Tue), `nextThursday()` correctly returns 2026-05-28, and the local `db.json` meeting for 2026-05-28 has `book: "3-john", chapter: 1`, so the banner output matches the data. Either (a) the local schedule doesn't match the actual group schedule (someone manually entered the wrong week via Admin → Meetings → Upcoming), or (b) there's a subtler bug not reproducible from the local data alone. Next time it appears: check what date the upcoming meeting in DDB/db.json is actually set to, vs the date the banner thinks is "this Thursday" (`weekOf` in the `/api/verse` response).

## Future changes

- **GitHub Actions PR validation (hybrid CI).** Add `.github/workflows/ci.yml` that runs on `pull_request` against `master` / `release/**`: typechecks `amplify/`, runs `npm --prefix frontend run build` (which does `tsc -b && vite build`), and typechecks `backend-local/`. Amplify Hosting keeps owning the actual deploy from `master`; this just gates PRs so regressions don't reach the release branch. Free for both public and private repos (2,000 minutes/month on private, unlimited on public). Restores the `[skip ci]` convention as a side effect.
- Future / out-of-scope idea: turn this into a **multi-tenant platform** where any group can spin up their own instance with their own roster, attendees, and stats — basically this app becomes one "tenant" inside a larger portal. Keeping the scope of *this* app small (single group, single DB) so it can act as the reference implementation / prototype for what a single tenant would look like inside that bigger system.
