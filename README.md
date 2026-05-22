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
