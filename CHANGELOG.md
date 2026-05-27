# Changelog

All notable changes to the Bible Study Wheel project.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning is loose pre-1.0 — minor versions may include breaking changes.

## [Unreleased]

_Add new entries here as work lands; promote to a versioned section when shipping._

### Added — v0.5.0 public, stateless wheel
- `frontend/src/App.tsx` — drop the `ProtectedRoute` wrapper on `/wheel` so anonymous visitors can land directly on the spinner.
- `frontend/src/components/Nav.tsx` — show the "Wheel" link in both logged-in and logged-out nav states.
- `frontend/src/pages/WheelPage.tsx` — wheel becomes a pure visual roll. Removed: the `GET /spins/latest` fetch, the `POST /spins` call, the `lastSpin` / `submitting` state, the auto-exclude-last-picked behavior, and the "Recording…" button label. Button now toggles between `Spin` and `Spinning…`. The authoritative "who got picked" record moves to `Meeting.selectedAttendeeId` (separate entry below).
- `amplify/backend.ts` — `GET /attendees` flipped from `authed` → `publicOpts` so the unauthenticated wheel can read the roster. Writes (`POST`, `PUT`) still require an admin-group Cognito token.
- `backend-local/src/routes/attendees.ts` — local mirror: `GET /attendees` drops the `requireAuth` middleware.

### Added — v0.5.0 meeting selected-attendee record
- `frontend/src/api/client.ts` + `backend-local/src/db.ts` — `Meeting` gains an optional `selectedAttendeeId: string | null` field. Authoritative record of who the wheel picked for a given meeting.
- `backend-aws/functions/meetings/index.js` + `backend-local/src/routes/meetings.ts` — `POST /meetings` accepts `selectedAttendeeId`, validates it against the known-attendee set (reusing the existing Scan in the AWS handler to avoid a second round-trip), and persists `null` to clear. Mirrored across AWS Lambda and local route.
- `frontend/src/pages/AdminPage.tsx` (`MeetingsTab`) — new "Selected by wheel" dropdown below the attendance checkboxes, sourced from the same `visibleAttendees` list. Recent-meetings list shows a `✦ Name` inline badge for meetings that have a recorded selection.
- **Known gap:** Stats still reads the legacy `Spins` table for `timesSelected` and `lastSpin`. Migration to read from `Meeting.selectedAttendeeId` is tracked as a follow-up branch (`feature/stats-from-meetings`) and documented under README → Known bugs. Must ship before `release/v0.5.0` merges to master.

### Added — v0.5.0 admin: link attendees to users + promote
- New endpoints, mirrored across `backend-aws/functions/adminUsers/index.js` and `backend-local/src/routes/users.ts`:
  - `GET /users` — list approved (CONFIRMED / `active`) users with `role` derived from admin-group membership. Admin-only. AWS implementation issues `ListUsersCommand` + `ListUsersInGroupCommand` in parallel and joins them in-memory.
  - `POST /users/{id}/promote` — adds the user to the `admin` Cognito group (AWS: `AdminAddUserToGroupCommand`) or flips `User.role` (local). Admin-only.
- `PUT /attendees/{id}` now accepts an optional `userId` (string to link, `null` to unlink). Local route validates the userId exists in the user list; AWS Lambda trusts the caller (admin-only, no DDB FK to enforce).
- `frontend/src/api/client.ts` — new `ApprovedUser` type; `Attendee` gains optional `userId`.
- `frontend/src/pages/AdminPage.tsx` (`AttendeesTab`) — each attendee row now shows the linked user (name + email + admin badge) below the name, a select to link/unlink inline, and a "Promote" action that appears only when the linked user isn't already admin. The link-user picker filters out users already linked to another attendee to prevent duplicates.
- `backend-aws/functions/adminUsers/index.js` — new `displayName(u)` helper prefers `given_name + family_name` (v0.5.0 split signup) and falls back to `name` for legacy users. Used by both the `/users/pending` list and the new `/users` list.
- `amplify/backend.ts` — register `GET /users` and `POST /users/{id}/promote`; add `cognito-idp:ListUsersInGroup` to the `adminUsers` Lambda's IAM policy.

### Fixed — Amplify Gen 2 sandbox deploys end-to-end
- `amplify/backend.ts` — replaced the 6 API Lambdas' `defineFunction()` definitions with raw CDK `NodejsFunction` in the custom `BibleStudyApiStack`. The previous setup created a cross-stack cycle (`auth → function → BibleStudyApiStack → auth`) via Lambda env vars referencing tables in one stack and the user pool in another. Co-locating tables, Lambdas, and grants in a single stack breaks the cycle. Bonus: `NodejsFunction` externalizes `@aws-sdk/*` by default (Lambda Node 20 runtime provides them), so Lambdas are smaller.
- Root `package.json` — added `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-ses`, `@aws-sdk/client-cognito-identity-provider` as runtime deps and `@types/node` as dev. `defineFunction()` (still used for the preSignUp trigger) doesn't externalize the SDK by default, so esbuild needs to resolve them; the explicit deps give it a path. Future API-Lambda changes don't need them since `NodejsFunction` externalizes by default.
- `backend-aws/functions/preSignup/index.js` — converted from CommonJS to ESM (`import` + `export const handler`). `defineFunction()` bundles with `--format=esm`, which mangles the CJS `exports.handler` pattern into something Lambda can't resolve (`index.handler is undefined or not exported`). The other handlers stay CJS because `NodejsFunction` preserves source format.
- `backend-aws/functions/preSignup/index.js` — removed the `autoVerifyEmail=true` / `autoConfirmUser=false` response. Cognito rejects that combination at runtime (*"Phone or email cannot be auto verified, when user is not being auto confirmed"*). The trigger now only handles the optional SES notification; the admin-approval gate is enforced by Cognito's UNCONFIRMED state instead.
- `amplify/backend.ts` — added CDK escape hatch on the Cognito user pool to set `autoVerifiedAttributes = []` and `userAttributeUpdateSettings.attributesRequireVerificationBeforeUpdate = []`. Together these stop Cognito from sending the self-confirm code email at signup, which would otherwise let users bypass admin approval. Trade-off: email-based self-service password reset is unavailable; admin must use `AdminSetUserPassword`.

### Added — Amplify Gen 2 migration
- `amplify/backend.ts` — Gen 2 backend defined in TypeScript:
  - `defineAuth()` with `admin` + `member` groups and the preSignUpTrigger attached.
  - CDK escape hatch for the REST API: API Gateway with a `CognitoUserPoolsAuthorizer` on every route except `GET /verse` (public).
  - 3 DynamoDB tables (PAY_PER_REQUEST), 6 Lambdas (Node 20) wired via `defineFunction({ entry: '../../../backend-aws/functions/<name>/index.js' })` so handler source stays in `backend-aws/` as the single source of truth.
  - Least-privilege DDB grants per Lambda; Cognito IDP perms scoped to the user pool ARN on `adminUsers`; SES grant on the preSignUp trigger.
- Root `package.json` + `amplify/tsconfig.json` — Gen 2 deps and TS config.
- `scripts/sync-amplify-config.mjs` — reads `amplify_outputs.json` (generated by `npx ampx sandbox`) and writes `frontend/.env.local`. Run via `npm run sync-config` after every sandbox start.

### Changed — Amplify Gen 2 migration
- `backend-aws/AWS_SETUP.md` — rewritten for Gen 2: no `amplify configure`, no separate Amplify IAM user, no `amplify init/add/push`. The flow is now `aws configure` → `npx ampx sandbox` → `npm run sync-config`. Bootstrap-admin instructions use `aws cognito-idp` calls with the pool ID read from `amplify_outputs.json`.
- `backend-aws/README.md` — repurposed as handler reference; provisioning lives in `amplify/`. Documents the env vars CDK wires into each Lambda and the auth flow end-to-end.
- `.gitignore` — `amplify/` is now tracked (Gen 2 source-of-truth); `.amplify/` (build artifacts), `amplify_outputs.json`, and `amplifyconfiguration.json` are ignored. Removed Gen 1's `aws-exports.js`.
- `frontend/.env.example` — field-mapping comment updated for amplify_outputs.json keys.

### Removed — Amplify Gen 2 migration
- Reliance on the Gen 1 CLI (`@aws-amplify/cli` global). Gen 1 enters maintenance May 2027; Gen 2 is the supported path for new projects. No app code was using Gen 1 yet, so this only affected docs.

### Added
- **AWS deploy path is now wired.** Frontend has a dual-mode auth selector via `VITE_USE_AMPLIFY`:
  - `false` (default) — keeps the existing local Express `/auth/*` + Bearer-JWT flow.
  - `true` — uses Amplify v6 (`aws-amplify/auth`) for sign in/up/out; the API client pulls a fresh Cognito ID token via `fetchAuthSession()` per request.
- `frontend/src/aws-amplify-init.ts` — configures Amplify from env vars (`VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_USER_POOL_CLIENT_ID`) so the gitignored `aws-exports.js` doesn't need to exist at build time. Dynamic-imported so local builds tree-shake Amplify out entirely (production bundle stays at ~88 kB gzipped).
- `frontend/.env.example` — documents the two env vars + `VITE_API_URL`.
- `backend-aws/AWS_SETUP.md` — first-time AWS portal walkthrough: account creation, root MFA, IAM admin user, billing alarm, AWS CLI configure, SES sender verification, Amplify CLI configure. Everything you need before running `amplify init`.

### Changed
- `backend-aws/functions/preSignup/index.js` — sets `autoVerifyEmail=true` so Cognito doesn't send the self-confirmation code email that would let users bypass the admin-approval gate. Combined with `autoConfirmUser=false`, users stay UNCONFIRMED until an admin clicks Approve.
- `backend-aws/README.md` — auth-integration section rewritten to describe the wired-up flow instead of the gap.
- `frontend/tsconfig.json` — added `"types": ["vite/client"]` so `import.meta.env` typechecks.

### Fixed
- Admin → Meetings → Upcoming meetings: editing multiple weeks and saving no longer wipes the unsaved siblings. Per-row Save replaced with a single centralized **Save changes** button; a `dirty` set tracks edited rows so the post-save refresh only reseeds untouched ones. Each row now shows a "• unsaved" hint and the footer reports the unsaved-change count.
- `toISODate` was converting dates via `toISOString()`, which is UTC. This shifted the "today" default in Record meeting (US evening → next day's date) and, for UTC+ timezones, mis-labeled the generated Thursdays. Now uses local `getFullYear/getMonth/getDate`.
- Inactive attendees who were marked present on an existing meeting were invisible in the Record form — admins couldn't uncheck them. The form now shows active attendees plus any inactive ones currently in the meeting's roster, rendered italic with an "(inactive)" tag.
- Topic completeness is validated before save: Reading requires book + chapter, Presentation requires non-empty text. Incomplete drafts no longer round-trip to the server and back as "No topic".
- Wheel page: the spin animation could get stuck on `mustStartSpinning={true}` if the `/spins` POST failed or `onStopSpinning` never fired. The POST now runs first; the wheel only starts after the spin is recorded. New "Recording…" button state covers the round-trip.

---

## [0.4.0] — 2026-05-22 — Weekly reading verse + meeting topics

### Added
- `frontend/src/data/bibleBooks.ts` — all 66 books in canonical Protestant order, with chapter counts and url-safe slug ids (`1-samuel`, `song-of-solomon`, etc.).
- `backend-local/src/routes/verse.ts` and `backend-aws/functions/verse/index.js` — new public `GET /api/verse` endpoint.
  - Computes current Thursday-anchored week.
  - Scans current week + next 4 weeks for a `topicType === 'reading'` meeting.
  - Fetches the chapter from `bible-api.com` (WEB translation), 24h server-side cache.
  - Returns a random verse from the chapter per request (rotates on every page load).
  - Returns `null` if no reading scheduled — frontend falls back to ourmanna.
- `TopicEditor` component in `AdminPage.tsx` — type dropdown (4 T's / Reading / Presentation) with conditional sub-fields:
  - Reading → optgrouped Old/New Testament book picker + chapter dropdown.
  - Presentation → free-text topic field.
  - 4 T's → no sub-fields.
- "Upcoming meetings" section in Admin → Meetings — auto-filled list of the next 4 Thursdays, each editable inline with `TopicEditor` + per-row Save.
- "Recent meetings" list now shows topic summary (e.g. `Reading: John 1`, `Presentation: Faith and works`, `4 T's`).

### Changed
- `Meeting` schema (local + AWS): added optional `topicType`, `book`, `chapter`, `topicText` fields.
- `POST /api/meetings` is now **upsert by date** — scheduling a topic and recording attendance for the same date target the same record.
- "Record meeting attendance" form auto-prefills topic and attendees when the date matches an existing meeting.
- `VerseBanner.tsx` now calls `/api/verse` first, falls back to ourmanna on null/error.
- Removed `localStorage` cache from the verse banner so verses rotate per page load.
- `seed.ts` adds a starter reading topic (John 1) for the current Thursday on fresh install.

### Notes
- Free Bible APIs do not carry NIV (copyright). Default translation is **WEB (World English Bible, public domain)**. To use NIV, swap to a paid API like `scripture.api.bible` — small change in `routes/verse.ts` and the Lambda.
- Existing `db.json` from prior sessions will not auto-gain the new seeded topic — add one via Admin → Meetings → Upcoming.

---

## [0.3.0] — 2026-05-22 — Stats metric fairness

### Added
- `timesEligible` field on the stats response — count of spins each person was eligible for (on the wheel).
- "On wheel" and "Pick rate" columns on the Stats page (pick rate = picked ÷ on wheel).
- Footnote on the Stats page explaining wheel auto-exclusion bias.

### Reasoning
The wheel auto-excludes the last winner, so raw "times selected" is biased against frequent winners. **Pick rate** is the unbiased fairness metric.

### Files touched
- `backend-local/src/routes/stats.ts`
- `backend-aws/functions/stats/index.js`
- `frontend/src/api/client.ts` (Stats type)
- `frontend/src/pages/StatsPage.tsx`

---

## [0.2.0] — 2026-05-22 — Cool Woodland styling + verse banner

### Added
- Custom Tailwind palette under the `woodland` namespace: `bg`, `surface`, `surface-2`, `border`, `primary`, `primary-hover`, `accent`, `accent-soft`, `ink`, `muted`, `subtle`, `danger`, `warning`.
- Google Fonts integration: Fraunces (serif headings, brand, quoted text) and Inter (body, UI).
- Paper-soft `shadow-paper` and `shadow-card` shadow tokens.
- Component utility classes in `index.css`: `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`.
- `VerseBanner.tsx` — slim banner under the nav on every page; pulls daily verse from `ourmanna.com`.
- Reusable Claude skill at `~/.claude/skills/earthy-web-style/SKILL.md` — palette tokens, Tailwind config, type stack, component recipes, plain-CSS variable fallback, apply checklist. Triggers on "earthy", "woodland", "mossy", "forest", "sage", "Bible Study Wheel style".

### Changed
- Every component restyled from default Tailwind (slate/emerald/sky/red) to the `woodland-*` palette.
- Wheel slice colors swapped to woodland palette (forest, moss, gold, brick, olive, sage, bark, wheat).
- Headings now use Fraunces; body uses Inter.

### Files touched
- `frontend/tailwind.config.js`, `frontend/index.html`, `frontend/src/index.css`
- All `frontend/src/components/*.tsx` and `frontend/src/pages/*.tsx`
- New: `~/.claude/skills/earthy-web-style/SKILL.md`

---

## [0.1.0] — 2026-05-22 — Initial scaffold

### Added
- Project layout: `frontend/` (React+Vite+TS+Tailwind), `backend-local/` (Express + JSON file store), `backend-aws/` (Lambda + DynamoDB + Cognito + SES handlers).
- Auth: JWT-based locally, Cognito User Pool with `admin` and `member` groups on AWS. Pending-user approval flow.
- Pages:
  - **Login / Signup** — signup creates pending user awaiting admin approval.
  - **Wheel** — attendee multi-select, random spin, auto-excludes the last winner when ≥3 are selected, records every spin to the database.
  - **Stats** — per-attendee meetings attended, times selected, last-picked indicator.
  - **Admin** — Pending users (approve/reject), Attendees (add/rename/deactivate), Meetings (record attendance).
- Initial roster seeded (17 names) plus the May 14 2026 meeting and the spin that selected Josh Marshall.
- README with run-locally instructions and AWS deploy outline.

### Architecture notes
- Local backend uses a JSON file (`db.json`) instead of SQLite to avoid Windows native-module issues.
- AWS deployment via Amplify (S3+CloudFront, API Gateway, Lambda, DynamoDB, SES). Expected cost: $0–$1/month at Bible-study scale.
- Single-table-per-entity DynamoDB design: `Attendees`, `Meetings`, `Spins`. Cognito holds users.

### Design decisions
- Attendees are separate from auth users (an attendee doesn't need an account to be on the wheel).
- Wheel uses uniform random (no weighting).
- Signup approval is email + admin panel (both, not just email).
- Admin records meeting attendance via a checkboxes form (not self-check-in).
