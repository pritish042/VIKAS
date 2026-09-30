# VIKAS — Student platform source

A responsive Next.js + MongoDB foundation rebuilt from the supplied Stitch screens. No fictional accounts, activities, progress, testimonials, or metrics are seeded. Educational-stage choices are interface configuration, not student records.

## Quick start

Requires Node.js 22.12+ and MongoDB (Atlas or a local instance).

1. Open this folder in VS Code / Codex.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local`.
4. Set `MONGODB_URI`, `MONGODB_DB`, `BETTER_AUTH_URL`, and `BETTER_AUTH_SECRET`.
5. Generate a secret using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste it into your local env file. Never share this file in chat or Git.
6. Run `npm run db:indexes` before creating accounts.
7. Run `npm run dev` and open http://localhost:3000.

Without the database settings, the screens remain browsable but signup and saving are unavailable. There is no local-storage substitute pretending to be a real account. Only appearance preferences use localStorage; unsigned onboarding choices live temporarily in memory.

## Included

- Question-by-question onboarding, editable education details and personal home.
- Responsive desktop/mobile navigation; Light / Dark / System themes and reduced-motion support.
- Email/password registration, login, logout, database sessions using Better Auth.
- Password hashing managed by Better Auth, not handwritten cryptography.
- Optional SMTP-backed verification and password-reset screens.
- Editable student profile, board/class/subjects or degree/program/branch/year, goal, interests and available time.
- Personal task creation, completion/reopen, and deletion.
- Student-reviewed step feedback and deterministic next-step suggestions that require explicit acceptance, editing, or rejection.
- Personal skills/projects/certifications/achievements journal.
- Shared resource submission and verified-editor publication queue.
- Empty states throughout; data appears when people add it.
- Optional Gemini-backed DISHA conversation and clearing saved history. It is a context-aware assistant, not a completed autonomous agent system. It cannot change plans or access external tools.
- Server validation, ownership-scoped queries, mutation origin checks, database-backed throttling, index setup script, and focused validation tests.

## Free cloud setup

**Database:** MongoDB Atlas Free cluster. Atlas stores application and auth records; it does not host the Next.js application. Official docs currently list 0.5 GB storage and other usage limits. Free clusters do not include managed backups; arrange exports before a real pilot.

1. Create an Atlas project and Free cluster.
2. Create a dedicated database user with read/write permission only for the VIKAS database. This is separate from students' app accounts.
3. Configure network access for your local machine and the selected application's hosting egress. Prefer narrow IP ranges. If a serverless host requires broader access, understand the exposure, use TLS and strong database-only credentials, and never expose the URI to browsers.
4. Copy the Node.js connection string into `.env.local`; replace placeholders and URL-encode password special characters.
5. Use a nearby available region and run the index script.

**App hosting:** Render Free Web Service can run this Node app; check current plan eligibility/limits. Build: `npm ci && npm run build`; start: `npm start`. Render supplies PORT. Set env vars in its dashboard and set `BETTER_AUTH_URL` to the exact HTTPS app URL. Free services sleep when idle, so expect cold starts. User records remain in Atlas rather than the app server filesystem.

Vercel also supports Next.js, but Hobby is restricted to non-commercial personal use. Check eligibility before deploying an institutional/startup pilot on Hobby.

No cloud account or deployment has been created by this source package. You must configure your own account and secrets. Do not paste credentials into Codex/Gemini conversations. Run the index script from a trusted machine after production credentials are configured.

## Email and resource editing

Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM for a legitimate mail provider. With SMTP configured, verification is required and password recovery is enabled. Without SMTP, the app allows unverified email/password accounts for development/closed testing and disables reset emails. Enable verification before a public pilot. There is no claim that an unverified email belongs to its registrant.

Set CONTENT_EDITOR_EMAILS to a comma-separated list of your content reviewers. Editor status also requires the email to have been verified. Ordinary users can submit resources, but cannot publish them or read other users' unpublished submissions. No account can promote itself via a profile form.

## Optional AI

Set GEMINI_API_KEY and GEMINI_MODEL to a model available to your Google API project. A Gemini consumer subscription does not configure this API. Without these settings, DISHA is honestly unavailable. AI costs and provider data handling are separate from hosting/database.

The optional route sends the question, recent messages and relevant profile/plan to Google. It does not send account passwords or email. A notice is shown before use. Broader agent tools and retrieval are future work.

## Before public/student launch

This is a source foundation, not a certification of production readiness. No live Atlas connection was provided for verification.

- Set a real support contact, retention/deletion policy and mail delivery.
- Have the institution/operator review child-account and guardian-consent requirements before inviting minors. No guardian verification has been implemented; do not collect junior/minor data until it is ready. Initially test with consenting adults.
- Restrict access to pilot participants until these items are complete; do not advertise an unrestricted public service yet.
- Test signup → verification → login → create profile/task → logout → login from another browser.
- Test that two users cannot read, update or delete each other's private records; use docs/API.md.
- Configure backups, monitoring, provider budgets and incident/support ownership.
- The privacy page is a plain-language implementation summary. Replace its operator/support/retention gaps with reviewed policies before launch.

## Commands

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run db:indexes`

See docs/HANDOFF.md for team boundaries and docs/API.md for the backend contract.

Sources checked 2026-09-29:
- https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/
- https://render.com/docs/free
- https://vercel.com/docs/plans/hobby
- https://better-auth.com/docs/adapters/mongo
- https://better-auth.com/docs/authentication/email-password
