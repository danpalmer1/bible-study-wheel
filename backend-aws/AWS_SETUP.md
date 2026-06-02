# First-time AWS setup (Amplify Gen 2)

Walks a brand-new AWS user from "I don't have an account" to "ready to run `npx ampx sandbox`." Estimated 20–30 min — Gen 2 has less ceremony than Gen 1 (no `amplify configure`, no separate IAM user for Amplify).

Cost note: every service in this stack has a generous free tier (Cognito, DynamoDB, Lambda, API Gateway, Amplify Hosting). Expected monthly bill: ~$0 for the first year, a few dollars after. Set up a billing alarm anyway (step 4).

---

## 1. Create an AWS account

1. Go to <https://aws.amazon.com/> → **Create an AWS Account**.
2. Email, account name (e.g. `dan-personal`), password.
3. Personal account, add a credit card (required even for free tier).
4. Phone verification, then pick **Basic Support — Free**.

You're now signed in as the **root user**. Use it as little as possible.

## 2. Lock down the root user

Top-right account menu → **Security credentials**:

1. **Enable MFA** on root (authenticator app: Authy, 1Password, etc.).
2. Do **not** create access keys on root. We'll use a separate IAM user for daily work.

## 3. Create an IAM admin user

Console search → **IAM** → **Users** → **Create user**.

1. User name: `dan-admin`.
2. ✅ **Provide user access to the AWS Management Console**.
3. Console password: auto-generated; uncheck "must reset at next sign-in" for solo use.
4. **Next** → **Attach policies directly** → check **`AdministratorAccess`**.
5. **Next** → **Create user**. Download the `.csv` with the sign-in URL.
6. Sign out of root. Sign back in via the IAM URL as the new user.
7. From this user's **Security credentials** tab: enable MFA, then **Create access key** → **Command Line Interface (CLI)** → save the Access key ID + Secret access key (password manager).

## 4. Billing alarm

**Billing and Cost Management** → **Budgets** → **Create budget**:
- Cost budget, **$5/month**, email alert at 80%.

## 5. Install AWS CLI and configure credentials

Installer: <https://awscli.amazonaws.com/AWSCLIV2.msi>. New PowerShell:

```pwsh
aws --version              # verify install
aws configure              # paste the access key + secret from step 3
```

Region: **`us-east-1`** is the safest default. Output: `json`.

Verify:

```pwsh
aws sts get-caller-identity
```

You should see your IAM user ARN. **This is all the auth Amplify Gen 2 needs** — no `amplify configure` step.

## 6. Sanity check

```pwsh
aws s3 ls                  # empty bucket list, confirms creds work
node --version             # need 18+
```

Then from the project root:

```pwsh
cd C:\Users\danpa\Documents\Coding\Web\bible-study-wheel
npm install                # installs Gen 2 deps from root package.json
npx ampx sandbox           # provisions your personal dev stack
```

`npx ampx sandbox` will:
- Bootstrap CDK in your AWS account (first time only — takes ~3 min).
- Synthesize CloudFormation from `amplify/backend.ts`.
- Deploy auth + 2 DDB tables + 4 Lambdas + API Gateway.
- Write `amplify_outputs.json` at the repo root.
- Keep watching `amplify/` for hot-redeploy.

Leave it running. In a second terminal:

```pwsh
npm run sync-config        # copies amplify_outputs values into frontend/.env.local
cd frontend
npm run dev                # opens at http://localhost:5173, talking to AWS
```

## 7. Bootstrap yourself as admin (one-time)

Self-signup is disabled at the pool level (`AllowAdminCreateUserOnly`), so there's no registration surface in the app — admins are the only accounts and you create each one from the CLI. From PowerShell:

```pwsh
$POOL_ID = (Get-Content amplify_outputs.json | ConvertFrom-Json).auth.user_pool_id
aws cognito-idp admin-create-user `
  --user-pool-id $POOL_ID `
  --username your-email@example.com `
  --user-attributes Name=email,Value=your-email@example.com Name=email_verified,Value=true `
  --message-action SUPPRESS
aws cognito-idp admin-set-user-password `
  --user-pool-id $POOL_ID `
  --username your-email@example.com `
  --password 'YourStrongPassw0rd!' `
  --permanent
aws cognito-idp admin-add-user-to-group `
  --user-pool-id $POOL_ID `
  --username your-email@example.com `
  --group-name admin
```

Then sign in at the unlisted **`/admin-login`** route (`http://localhost:5173/admin-login`). You should land on the Admin panel. Repeat these commands for any additional admins.

---

## Production deploy (later)

Once the sandbox flow works end-to-end:

1. Push your code to GitHub (already done).
2. AWS Console → **Amplify** → **Create new app** → **Host web app** → connect to your GitHub repo.
3. Build settings: Amplify auto-detects Gen 2 via `amplify/backend.ts`. Confirm the build spec runs `npm ci && npx ampx pipeline-deploy --branch <branch>` then builds `frontend/`.
4. First build provisions a fresh prod stack alongside your sandbox; `amplify_outputs.json` is regenerated server-side and frontend build picks it up.

---

## Troubleshooting

- **`npx ampx sandbox` fails with bootstrap error** → run `npx cdk bootstrap aws://<account-id>/us-east-1` manually once.
- **"User is not authorized to perform: sts:AssumeRole"** → your IAM user is missing `AdministratorAccess`. Re-attach in IAM console.
- **`npm run sync-config` says file missing** → sandbox hasn't finished. Watch the first terminal for "Deployment completed."
- **Frontend logs `[amplify] VITE_USE_AMPLIFY=true but ...`** → you forgot to run `npm run sync-config`, or you're running the frontend without restarting after env var changes.
