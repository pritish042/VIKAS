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

### Local Atlas DNS troubleshooting

If the network resolver fails MongoDB SRV queries, an explicit server-only `MONGODB_DNS_SERVERS` setting can override Node's process resolver, for example `1.1.1.1,8.8.8.8`. It accepts one to three resolver IP addresses and must be applied before the first MongoClient is created; restart the app after editing `.env.local`. This changes `dns.resolve*` lookups throughout this Node process, not macOS settings or `dns.lookup`/HTTP hostname lookup. Leave it unset on networks where normal DNS works. The original Atlas SRV URI, dynamic node discovery, TLS verification and credentials remain intact. Do not set `NEXT_PUBLIC_MONGODB_DNS_SERVERS`.

On 2 October 2026 the local default resolver returned `EBADRESP` for Atlas SRV records. Both Cloudflare and Google returned three nodes and valid TXT records, and MongoDB ping succeeded with the explicit process resolver. The ignored local environment file now supplies that override. No macOS VPN service reported connected; tunnel interfaces alone do not prove a VPN caused the fault. No system network settings were changed. If you prefer fixing the network itself, ask its operator to repair SRV responses, or manually choose a working resolver in macOS System Settings → Wi-Fi → Details → DNS, then remove the app override and restart. Corporate/VPN DNS policies should be handled by that network's operator. See [Atlas troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/) and [Node process DNS settings](https://nodejs.org/api/dns.html#dnssetserversservers).

## Included

- Question-by-question onboarding, editable education details and personal home.
- Responsive desktop/mobile navigation; Light / Dark / System themes and reduced-motion support.
- Email/password registration, login, logout, database sessions using Better Auth.
- Password hashing managed by Better Auth, not handwritten cryptography.
- Optional SMTP-backed verification and password-reset screens.
- Editable student profile, board/class/subjects or degree/program/branch/year, goal, interests and available time.
- Personal task creation, completion/reopen, and deletion.
- Student-reviewed step feedback and deterministic next-step suggestions that require explicit acceptance, editing, or rejection.
- Optional unvalidated topic checks and deterministic resource suggestions, with explicit task acceptance and saved resource feedback. The supplied catalogue is imported without a manual review gate at the operator's request; see docs/TOPIC-LEARNING.md for supported topics and limitations.
- Personal skills/projects/certifications/achievements journal.
- Shared resource submission and verified-editor publication queue.
- Empty states throughout; data appears when people add it.
- DISHA mentor workflow with saved-context provenance, reviewed prerequisite checks, approved-text retrieval and optional Gemini explanations. Memory and task changes require explicit student confirmation; this is not an autonomous agent system.
- YouTube Data API v3 educational video discovery for Class 11–12 streams, Diploma branches/semesters and ITI trades/years, with a verified reviewer queue and approved-only student recommendations.
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

Set server-only `GEMINI_API_KEY` and `GEMINI_MODEL` in `.env.local` to a model available to your Google API project, then restart the local server. Google currently documents `gemini-3.5-flash-lite` as a stable, fast text model suitable for this initial conversation (checked 2 October 2026); project availability and quota still need testing with your key. A Gemini consumer subscription does not configure this API. Without these settings, AI conversation is unavailable, but saved context and matching approved excerpts remain accessible. AI costs and provider data handling are separate from hosting/database.

The authenticated mentor route sends the question and bounded, allowlisted profile, goal and recent progress to Google. Matching approved passages are included only when actually retrieved. Without them, a reply is explicitly labelled general AI guidance, not a source-checked explanation. Account passwords, email, auth secrets and past chat history are excluded. Sending a turn saves only owned conversation messages; it never updates a profile, goal or task. A notice is shown before use. See [docs/DISHA.md](docs/DISHA.md) for setup, failure handling and retrieval limitations.

## Optional YouTube discovery

Enable **YouTube Data API v3** in a Google Cloud project, create a restricted API key and set `YOUTUBE_API_KEY` in `.env.local` or the server's secret environment. This value is server-only; never prefix it with `NEXT_PUBLIC_` or commit it. Configure verified reviewers through `CONTENT_EDITOR_EMAILS`, run `npm run db:indexes`, and schedule `npm run youtube:refresh` at least daily. Search runs only after an explicit student request, and candidates remain hidden until an authorized reviewer approves them. See [docs/YOUTUBE-DISCOVERY.md](docs/YOUTUBE-DISCOVERY.md) for the complete workflow, API limits, privacy disclosure and live-key verification steps.

## Before public/student launch

This is a source foundation, not a certification of production readiness. Database connectivity and indexes have been checked; full authenticated pilot journeys still need verification with authorized accounts.

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
See [docs/TOPIC-LEARNING.md](docs/TOPIC-LEARNING.md) for the catalogue importer, routing rules, publication policy and manual verification steps.

Sources checked 2026-09-29:
- https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/
- https://render.com/docs/free
- https://vercel.com/docs/plans/hobby
- https://better-auth.com/docs/adapters/mongo
- https://better-auth.com/docs/authentication/email-password
