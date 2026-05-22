# backend-aws

Lambda source for the AWS deployment. Mirrors the local Express routes but targets DynamoDB + Cognito instead of the JSON store.

> Spec last refreshed **2026-05-22** against frontend ≥0.4.0 (verse banner + meeting topics).

## What's here

```
functions/
├── attendees/      GET, POST, PUT  /attendees[/{id}]
├── meetings/       GET, POST, DELETE /meetings[/{id}]     (upsert by date)
├── spins/          GET /spins/latest, POST /spins
├── stats/          GET /stats
├── verse/          GET /verse                              (public, no auth)
├── adminUsers/     GET /users/pending, POST /users/{id}/approve|reject
├── preSignup/      Cognito PreSignUp trigger (admin SES notification)
└── shared/         helpers.js — DDB doc client, ok/err, claim/group helpers
```

## ⚠️ Auth integration is **not wired up yet**

The frontend's `AuthContext` calls `/api/auth/login`, `/api/auth/me`, and `/api/auth/signup` and stores a JWT in `localStorage`. None of those endpoints exist in `backend-aws` — the AWS deployment expects Cognito JWTs minted by Cognito itself.

Before this app can ship to AWS, pick one of:

- **(Recommended) Replace `AuthContext` with Amplify Auth** — use `aws-amplify`'s `Auth.signIn`, `Auth.currentAuthenticatedUser`, and `Auth.signUp`. The current `api/client.ts` Bearer-token wiring stays; just swap how the token is obtained (`(await Auth.currentSession()).getIdToken().getJwtToken()`). The PreSignUp trigger already prevents auto-confirmation, so the existing "pending → approve" flow still works through `adminUsers`.
- **Add `/auth/*` Lambdas** that wrap `AdminInitiateAuth` / `SignUp` / `GetUser`. Heavier, and means storing/refreshing tokens manually. Only worth it if the frontend cannot pull in Amplify.

Until one of these is in place, **the deployed app will not be able to log in**, even though every other endpoint works.

## Prereqs

```
npm install -g @aws-amplify/cli
amplify configure
```

All Lambdas target **Node.js 18+** (`verse/index.js` uses global `fetch`).

## Deploy with Amplify

From the project root:

```bash
amplify init

amplify add auth
# - Default config with social provider: No
# - Users sign in with: Email
# - Add user pool groups: Yes -> "admin", "member"
# - Add admin queries API: No
# - Multifactor: No
# - Email-based password recovery
# - Override defaults: Yes
#   - Add Lambda trigger: PreSignUp -> Custom -> backend-aws/functions/preSignup

amplify add api
# - REST, restrict access by Cognito User Pool
# - One Lambda per route group:
#     /attendees[/{id}]              -> attendees
#     /spins, /spins/latest          -> spins
#     /meetings[/{id}]               -> meetings
#     /stats                         -> stats
#     /users/pending,
#     /users/{id}/approve,
#     /users/{id}/reject             -> adminUsers
#     /verse                         -> verse           (PUBLIC — disable authorizer)
#   (Optional, only if you choose the "/auth Lambdas" path above:)
#     /auth/login, /auth/me, /auth/signup -> new auth lambda you add

amplify add storage    # DynamoDB
# Three on-demand tables (see schema below)

amplify add hosting    # then `amplify publish`
```

After `amplify push`:

1. Verify your admin sender address in **SES**.
2. Set env vars on each Lambda (see table below).
3. Manually add yourself to the `admin` Cognito group to bootstrap.

## DynamoDB tables

On-demand billing, single string partition key, no GSIs (Scan-based access is fine at this scale; add a GSI on a constant PK + timestamp sort key if `Spins` ever exceeds ~10k items).

| Table       | PK            | Attributes |
|-------------|---------------|-----------|
| `Attendees` | `attendeeId`  | `name`, `active`, `createdAt` |
| `Meetings`  | `meetingId`   | `date`, `attendeeIds` (L), `topicType` (`fourTs`\|`reading`\|`presentation`\|null), `book`, `chapter`, `topicText`, `createdBy`, `createdAt` |
| `Spins`     | `spinId`      | `timestamp`, `selectedAttendeeId`, `eligibleAttendeeIds` (L), `triggeredBy` |

The `meetings` Lambda treats `POST /meetings` as **upsert by `date`** — scheduling a topic and recording attendance for the same date target the same record. The frontend's "Save changes" in Admin → Upcoming meetings sends one POST per dirty week.

## Lambda environment variables

| Lambda        | Required env vars |
|---------------|---|
| `attendees`   | `ATTENDEES_TABLE` |
| `meetings`    | `MEETINGS_TABLE`, `ATTENDEES_TABLE` (the POST handler validates attendee IDs against the Attendees table) |
| `spins`       | `SPINS_TABLE`, `ATTENDEES_TABLE` |
| `stats`       | `ATTENDEES_TABLE`, `MEETINGS_TABLE`, `SPINS_TABLE` |
| `verse`       | `MEETINGS_TABLE` |
| `adminUsers`  | `USER_POOL_ID` |
| `preSignup`   | `ADMIN_NOTIFY_EMAIL`, `FROM_EMAIL` (optional; defaults to `ADMIN_NOTIFY_EMAIL`) |

## IAM

Each handler needs `dynamodb:Scan`, `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem` on the tables it references (above). Additionally:

- `verse` makes outbound HTTPS to `bible-api.com` — no extra IAM, but the Lambda must be on a subnet with NAT if you VPC-attach it. Default (no VPC) is simplest.
- `adminUsers` needs Cognito IDP permissions: `ListUsers`, `AdminConfirmSignUp`, `AdminAddUserToGroup`, `AdminDeleteUser` on the user pool.
- `preSignup` needs `ses:SendEmail` from the verified sender.

## Group-gated endpoints

Handlers inspect `event.requestContext.authorizer.claims['cognito:groups']`. Admin-only routes (anything that mutates `meetings`, `attendees`, or the user list) call `isAdmin(event)` from `shared/helpers.js` and 403 otherwise.

`/verse` and `/attendees` (GET only) are read by all signed-in users; `/verse` itself is **public** so the banner can render on `/login`.

## Verse endpoint behavior

`GET /verse`:

1. Computes the current Thursday in **UTC**.
2. Scans `Meetings` for the next 5 Thursdays (this week + 4).
3. If a meeting has `topicType === 'reading'` with `book` + `chapter`, fetches `https://bible-api.com/<book>+<chapter>?translation=web`. Result is in-memory cached for 24h per Lambda container.
4. Returns a random verse from that chapter. If no upcoming reading is scheduled, returns `null` and the frontend falls back to ourmanna.

> **Date note:** the frontend now generates Thursday `dateStr` values from **local** date components (post-0.4.1 fix). For US users this still matches UTC Thursday for all but the late-evening-Wednesday edge case. If you observe a stale verse just after Wed→Thu rollover in a UTC− timezone, you're hitting last week's reading until UTC catches up — this is expected for now.

## Local parity

Routes in `../backend-local/src/routes/*.ts` are the authoritative behavior reference. Each Lambda has a 1:1 counterpart there (except `/auth/*` — see the warning at the top). When changing a route's behavior, update both sides.
