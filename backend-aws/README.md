# backend-aws

Lambda handler source for the AWS deployment. **Provisioning lives in [`../amplify/`](../amplify/)** (Amplify Gen 2 + CDK). This directory is just the handler code that Gen 2 bundles and deploys.

> Spec last refreshed **2026-05-22** for the Amplify Gen 2 migration (0.5.x).

## Layout

```
functions/
├── attendees/      GET, POST /attendees;  PUT /attendees/{id}
├── meetings/       GET, POST /meetings;   DELETE /meetings/{id}     (upsert by date)
├── stats/          GET /stats
├── verse/          GET /verse                                       (public, no auth)
├── adminUsers/     GET /users/pending, POST /users/{id}/approve|reject
├── preSignup/      Cognito PreSignUp trigger (autoVerifyEmail + admin SES notify)
└── shared/         helpers.js — DDB doc client, ok/err, claim/group helpers
```

Each handler is plain CommonJS (`exports.handler = ...`). `amplify/functions/<name>/resource.ts` references the file via `defineFunction({ entry: '../../../backend-aws/functions/<name>/index.js' })`, so this is the **single source of truth** for handler code — there's no duplication between the local Express path and the AWS path.

## Deploying

See [`AWS_SETUP.md`](./AWS_SETUP.md) for first-time AWS account + CLI setup. Once `aws sts get-caller-identity` works:

```pwsh
cd <project root>
npm install
npx ampx sandbox             # provisions your personal dev stack, watches amplify/
npm run sync-config          # copies amplify_outputs.json values into frontend/.env.local
cd frontend && npm run dev   # frontend points at AWS
```

`npx ampx sandbox` reads [`amplify/backend.ts`](../amplify/backend.ts) and provisions:

- **Cognito user pool** with `admin` and `member` groups, `preSignUpTrigger` attached.
- **2 DynamoDB tables** (Attendees, Meetings, on-demand billing, single string PK each).
- **5 Lambdas** wrapping the handlers in this directory.
- **API Gateway REST API** with a Cognito User Pools authorizer on every route except `GET /verse`.
- IAM grants — least-privilege per Lambda (e.g. `meetings` gets read-only on `attendees` for ID validation; `verse` only gets read on `meetings`).

## Auth flow

The frontend supports two backends via `VITE_USE_AMPLIFY`:

- `false` (default) → local Express `/auth/*` + Bearer JWT.
- `true` → Amplify v6 (`aws-amplify/auth`) → Cognito ID token sent raw in the `Authorization` header (no `Bearer` prefix; API Gateway Cognito authorizer expects it that way).

On AWS:

1. Sign-up creates an **UNCONFIRMED** Cognito user.
2. `preSignUpTrigger` sets `autoVerifyEmail=true` (suppresses the self-confirm code email Cognito would otherwise send) but leaves `autoConfirmUser=false`, and SES-notifies the admin if `ADMIN_NOTIFY_EMAIL` is set on the Lambda.
3. Login throws `UserNotConfirmedException` → frontend shows "Account not yet approved by admin".
4. Admin opens **Admin → Pending users**, clicks Approve → `adminUsers` Lambda calls `AdminConfirmSignUp` + `AdminAddUserToGroup(member)`.
5. User can now log in.

## DynamoDB tables

| Table       | PK           | Attributes |
|-------------|--------------|-----------|
| `Attendees` | `attendeeId` | `name`, `active`, `userId` (optional), `createdAt` |
| `Meetings`  | `meetingId`  | `date`, `attendeeIds` (L), `selectedAttendeeId` (optional — admin-recorded wheel pick), `topicType` (`fourTs`\|`reading`\|`presentation`\|null), `book`, `chapter`, `topicText`, `createdBy`, `createdAt` |

Provisioned via CDK in [`amplify/backend.ts`](../amplify/backend.ts) with `PAY_PER_REQUEST` (on-demand) billing. No GSIs — `Scan` is fine at this scale.

## Lambda env vars

| Lambda             | Env vars (wired in `amplify/backend.ts`) |
|--------------------|---|
| `attendees`        | `ATTENDEES_TABLE`, `MEETINGS_TABLE` |
| `meetings`         | (same) |
| `stats`            | (same) |
| `verse`            | (same) — uses `MEETINGS_TABLE` |
| `adminUsers`       | (same) + `USER_POOL_ID` |
| `preSignUpTrigger` | optional: `ADMIN_NOTIFY_EMAIL`, `FROM_EMAIL` — set via Lambda console to enable signup notifications |

All Lambdas run on **Node.js 20** (`verse/index.js` uses global `fetch`).

## Local parity

Routes in `../backend-local/src/routes/*.ts` mirror these handlers and are the authoritative behavior reference. When changing a route, update both:

- `backend-local/src/routes/<name>.ts` (Express + JSON store)
- `backend-aws/functions/<name>/index.js` (Lambda + DynamoDB)

The CDK wiring in `amplify/backend.ts` rarely needs to change — only when adding/removing routes or env vars.
