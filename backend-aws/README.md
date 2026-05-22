# backend-aws

Lambda function source for the AWS deployment. These files mirror the local Express routes but target DynamoDB + Cognito instead of the JSON store.

## Deploy with Amplify

Prereqs: `npm install -g @aws-amplify/cli`, then `amplify configure`.

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
#   - Add Lambda trigger: PreSignUp -> Custom -> point to backend-aws/functions/preSignup
amplify add api
# - REST
# - Path: /attendees, /spins, /meetings, /stats, /users (one Lambda each)
# - Restrict access by: Authorization (Cognito)
amplify add storage
# - NoSQL Database (DynamoDB) x3:
#   - Attendees: PK=attendeeId (string)
#   - Meetings:  PK=meetingId (string)
#   - Spins:     PK=spinId (string)
```

After `amplify push`:
1. Verify your admin sender email in **SES** (console).
2. Set `ADMIN_NOTIFY_EMAIL` env var on the `preSignup` Lambda.
3. Manually add yourself to the `admin` group in Cognito (bootstrap).

Then `amplify add hosting` → `amplify publish`.

## DynamoDB tables

Each table uses on-demand billing and a single string partition key.

| Table     | PK            | Attributes |
|-----------|---------------|-----------|
| Attendees | `attendeeId`  | `name`, `active`, `createdAt` |
| Meetings  | `meetingId`   | `date`, `attendeeIds` (SS), `createdBy`, `createdAt` |
| Spins     | `spinId`      | `timestamp`, `selectedAttendeeId`, `eligibleAttendeeIds` (SS), `triggeredBy` |

For "latest spin" and "stats" queries the Lambdas do full table scans — fine at this scale (<10k items). If the dataset ever grows large, add a GSI on a constant partition key + `timestamp` sort key.

## Group-gated endpoints

Each handler inspects `event.requestContext.authorizer.claims['cognito:groups']` to enforce admin-only routes.
