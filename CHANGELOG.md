# Changelog

All notable changes to the Bible Study Wheel project.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning is loose pre-1.0 — minor versions may include breaking changes.

## [Unreleased]

_Add new entries here as work lands; promote to a versioned section when shipping._

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
