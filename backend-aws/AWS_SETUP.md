# First-time AWS setup

Walks a brand-new AWS user from "I don't have an account" to "ready to run `amplify init`." Estimated 30–45 min.

Cost note: every service in this stack has a generous free tier (Cognito, DynamoDB, Lambda, API Gateway, SES, Amplify Hosting). For a small Bible-study app the monthly bill should round to **$0** for the first 12 months and stay under a few dollars after. Set up a billing alarm anyway (step 4).

---

## 1. Create an AWS account

1. Go to <https://aws.amazon.com/> → **Create an AWS Account**.
2. Enter email, account name (e.g. `dan-personal`), password.
3. Pick **Personal** account type.
4. Add a credit card (required even for free tier).
5. Phone verification, then pick **Basic Support — Free**.

You're now signed in as the **root user**. The root user has unrestricted access and should be used as little as possible.

## 2. Lock down the root user (do this FIRST)

In the AWS console, top-right account menu → **Security credentials**:

1. **Enable MFA** on the root user. Authenticator app (Authy, 1Password, Google Authenticator) is fine.
2. Do **not** create access keys on the root user. We'll create a separate IAM user for daily work.

## 3. Create an IAM admin user for daily work

Console search bar → **IAM** → **Users** → **Create user**.

1. User name: `dan-admin` (or similar).
2. Check **Provide user access to the AWS Management Console**.
3. Console password: auto-generated, **uncheck** "must create a new password at next sign-in" if it's just you.
4. **Next** → Permissions → **Attach policies directly** → search and check **`AdministratorAccess`**.
5. **Next** → **Create user**. Download the `.csv` with the sign-in URL.
6. Sign out of the root account. Sign back in via the IAM sign-in URL with the new user.
7. From this user's **Security credentials** tab: enable MFA here too, then **Create access key** → "Command Line Interface (CLI)" → save the Access key ID + Secret access key somewhere safe (a password manager). You'll paste these into `aws configure` next.

> Production-quality alternative: use **IAM Identity Center** (formerly AWS SSO) instead of long-lived access keys. For a solo hobby project, an IAM user with MFA is fine.

## 4. Set up a billing alarm

Console → **Billing and Cost Management** → **Budgets** → **Create budget**.

- Budget type: **Cost budget**.
- Amount: **$5/month** (adjust to taste).
- Email alert at 80% of budget.

If anything goes wrong this catches it before it gets expensive.

## 5. Install the AWS CLI and configure credentials

Windows installer: <https://awscli.amazonaws.com/AWSCLIV2.msi>. After install, in a fresh PowerShell:

```pwsh
aws --version              # verify install
aws configure              # paste the access key + secret from step 3
```

Region prompt: **`us-east-1`** is the safest default (every service is available, SES sandbox limits are friendliest, most tutorials assume it). Output format: `json`.

Verify it worked:

```pwsh
aws sts get-caller-identity
```

You should see your IAM user ARN.

## 6. Verify a sender email in SES

The `preSignup` Lambda sends "new signup awaiting approval" emails. SES in a new account is in **sandbox mode** — you can only send **from** and **to** addresses you've verified.

Console → **Amazon SES** → make sure the region selector (top-right) is **us-east-1** → **Identities** → **Create identity**:

1. Identity type: **Email address**.
2. Enter the address you want notifications **from** (e.g. your gmail). Click **Create identity**.
3. Check that inbox, click the AWS verification link.
4. Repeat for the address you want notifications sent **to** (likely the same one).

Both addresses now show **Verified**. You can stay in sandbox mode forever for this app — there's only one recipient (you).

> If you ever want to send to addresses you haven't verified, request **production access** in SES. Not needed here.

## 7. Install the Amplify CLI

```pwsh
npm install -g @aws-amplify/cli
amplify --version
```

Then:

```pwsh
amplify configure
```

This walks you through creating a **second IAM user** dedicated to Amplify (separate from the admin user). When the browser opens:

1. Sign in with the `dan-admin` user from step 3 (not root).
2. Region: same as before (`us-east-1`).
3. Suggested user name: `amplify-dev` (or accept default).
4. The console opens with the IAM user creation form pre-filled — click through.
5. Back in the terminal, paste the new user's access key + secret.
6. Profile name: `default` is fine, or `amplify-dev` if you want to keep it separate.

You now have two AWS profiles in `~/.aws/credentials`. Amplify will use the one you specified.

## 8. Sanity check

```pwsh
aws s3 ls                  # should return empty (no buckets yet) — confirms creds work
amplify --help             # confirms Amplify CLI is on PATH
```

If both work, you're ready to deploy. From the project root:

```pwsh
cd C:\Users\danpa\Documents\Coding\Web\bible-study-wheel
amplify init               # then follow backend-aws/README.md
```

---

## What you'll do AFTER this guide (handled by `backend-aws/README.md`)

1. `amplify init` — sets up the local Amplify project, generates `amplify/` and `aws-exports.js`.
2. `amplify add auth` — Cognito user pool with `admin` + `member` groups, preSignup trigger wired up.
3. `amplify add api` — API Gateway + Lambdas for `/attendees`, `/spins`, `/meetings`, `/stats`, `/users`, `/verse`.
4. `amplify add storage` — three DynamoDB tables.
5. `amplify push` — provisions everything in AWS. Generates `frontend/src/aws-exports.js`.
6. Copy the API endpoint out of `aws-exports.js` into `frontend/.env.production`:
   ```
   VITE_USE_AMPLIFY=true
   VITE_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev
   ```
7. Bootstrap yourself as admin (one-time):
   ```pwsh
   # Sign up via the app's UI first (creates an UNCONFIRMED Cognito user)
   aws cognito-idp admin-confirm-sign-up `
     --user-pool-id <pool-id-from-aws-exports.js> `
     --username your-email@example.com
   aws cognito-idp admin-add-user-to-group `
     --user-pool-id <pool-id> `
     --username your-email@example.com `
     --group-name admin
   ```
8. `amplify add hosting` → `amplify publish` — deploys the built frontend.

---

## Troubleshooting

- **`amplify push` hangs or fails partway** — `amplify status` shows what's deployed. `amplify push --force` re-tries. If a CloudFormation stack is wedged, delete it in the **CloudFormation** console then `amplify pull` to resync.
- **"Email address is not verified" in CloudWatch logs for preSignup** — you skipped step 6, or the `FROM_EMAIL` env var on the Lambda doesn't match a verified SES identity in the right region.
- **Browser shows CORS errors after deploy** — API Gateway needs CORS enabled per route. The shared helper already returns `Access-Control-Allow-Origin: *`, but you also need to enable CORS on the API Gateway side during `amplify add api` (it asks).
- **"User is not authorized to perform: cognito-idp:AdminConfirmSignUp"** — the `adminUsers` Lambda's execution role needs Cognito permissions. Edit the auto-generated IAM role in the IAM console and attach `AmazonCognitoPowerUser` (or write a tighter inline policy).
