# Codex / Gemini team handoff

## Agreed scope
Use the supplied interfaces as a foundation. Keep pages simple: one dominant action, short descriptions, contextual detail. No synthetic users, progress, content counts, or fake AI replies. Empty collections must render useful empty states.

## Ownership
- Frontend: components/vikas-app.tsx, components/study-form.tsx, app/globals.css, app/layout.tsx, public.
- Backend: app/api, lib/auth.ts, lib/api.ts, lib/db.ts, scripts.
- Shared contract: lib/types.ts, lib/education.ts, lib/profile-update.ts and lib/validation.ts. Coordinate changes in one PR.

The first frontend file is intentionally self-contained for handoff speed. Extract screens into separate components as you extend them; retain shared primitives/styles.

## Instructions for coding agents
1. Read README.md and docs/API.md before changing behavior.
2. Work on one issue and one short-lived feature branch.
3. Do not add seed data or silently fall back to localStorage for user information.
4. Never commit .env.local, passwords, database URIs or model keys.
5. Reuse Better Auth; do not invent a replacement password/session system.
6. Do not change an API shape without updating the frontend, schemas and docs together.
7. Retain ownership filters, Origin checks, server validation and editor verification.
8. Run typecheck, tests and build before the PR.
9. Mark unconnected features honestly. Do not make a UI button claim an operation that did not complete.
10. Keep the product independent of any coding assistant or hosting plugin.

## Next work, in order
- Connect a real Atlas test database and SMTP; execute auth/persistence/isolation tests.
- Add operator contact and reviewed student/guardian flows before collecting minors' data.
- Add self-service account export/deletion and retention enforcement.
- Add pagination and richer editing if real usage needs it.
- Add reviewed knowledge, bounded mentor tools, proposed plan revisions, and agent evaluations.

## Adaptive progress maintenance
The initial progress loop embeds feedback and proposal history on owned task documents. It uses deterministic rules in `lib/progress.ts`; no AI service changes plans. Keep proposal creation separate from task creation, and require a student decision before adding a follow-up. The additive API contract and retry behavior are in `docs/API.md`.
- Add external opportunities only with provenance, expiry and review.

## Education form maintenance
Onboarding and profile editing share `StudyForm`. Keep catalogs editable, preserve valid dependent answers, and never guess missing fields on legacy profiles. The additive education contract and legacy-write behavior are documented in docs/API.md. Subject suggestions are informed by the official [CBSE curriculum](https://cbseacademic.nic.in/curriculum_2027.html) and [CISCE curriculum](https://www.cisce.org/wp-content/uploads/2022/10/UpperPrimary.pdf); they are flexible suggestions, not enforced subject combinations. No school or program selection creates student data.
