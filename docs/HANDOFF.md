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
- Use authorized accounts to execute live auth/persistence/isolation tests and configure SMTP.
- Add operator contact and reviewed student/guardian flows before collecting minors' data.
- Add self-service account export/deletion and retention enforcement.
- Add pagination and richer editing if real usage needs it.
- Expand approved knowledge coverage and evaluate the bounded mentor workflow with authorized users.

## Adaptive progress maintenance
The initial progress loop embeds feedback and proposal history on owned task documents. It uses deterministic rules in `lib/progress.ts`; no AI service changes plans. Keep proposal creation separate from task creation, and require a student decision before adding a follow-up. The additive API contract and retry behavior are in `docs/API.md`.
- Add external opportunities only with provenance, expiry and review.

## DISHA workflow maintenance

See [DISHA.md](DISHA.md) for the complete workflow, limits, ingestion/review steps, environment setup and manual verification. Server modules are `lib/mentor-*`; the UI lives in `components/mentor-workspace.tsx` and `components/knowledge-review.tsx`. The fixed four-tool workflow has no model-dispatched write tool. Student-confirmed memory changes and accepted steps use separate owned endpoints. Keep resource links distinct from approved lesson text, preserve source/version/date evidence and never equate completion with mastery. The newer DISHA request requires reviewed knowledge; it does not retroactively change the existing no-review catalogue importer. No approved corpus was fabricated.

## Topic learning maintenance

See [TOPIC-LEARNING.md](TOPIC-LEARNING.md). The operator removed the manual content review requirement during implementation; the importer publishes validated-structure resources and activates unvalidated topic checks directly, without claiming educator approval. Keep student task acceptance explicit. The original resource editor permission rules remain unchanged. Catalogue source and editable applicability are in `data/catalogue/`; server logic is in `lib/topic-*` and `lib/catalogue-import.ts`; UI is in `components/topic-learning.tsx` and `components/resource-task.tsx`. Do not import answer-bearing source files or scoring functions into client components. Branch: `feature/topic-assessments`. No deploy/merge was performed.

## Education form maintenance
Onboarding and profile editing share `StudyForm`. Keep catalogs editable, preserve valid dependent answers, and never guess missing fields on legacy profiles. The additive education contract and legacy-write behavior are documented in docs/API.md. Subject suggestions are informed by the official [CBSE curriculum](https://cbseacademic.nic.in/curriculum_2027.html) and [CISCE curriculum](https://www.cisce.org/wp-content/uploads/2022/10/UpperPrimary.pdf); they are flexible suggestions, not enforced subject combinations. No school or program selection creates student data.

## Public landing page and navigation

Branch `feature/public-landing-palette` adds `components/landing-page.tsx` and semantic linen/aquamist/sage/maroon variables in `app/globals.css`. Dark mode uses separate warm-charcoal surfaces and accessible light accents. The generic process illustration uses brief finite CSS motion, remains visible without animation and follows the existing reduced-motion override. No new dependencies, student records, API contracts or educational content changes.

`/` is public for everyone. Guests follow Get started to the existing onboarding at `/start` (`/onboarding` is an alias); signed-in visitors see Continue your journey linking directly to `/today`. There is no automatic landing redirect. Login success maps to Today through the shared navigation helper. `/home`, `/plan` and `/mentor` still work; `/today`, `/journey` and `/disha` are aliases for the same existing screens. Today / My Journey / DISHA are the leading navigation labels, with Explore and Profile retained. This does not consolidate or rebuild the existing plan/journal screens. The route and CTA mapping is centralized in `lib/navigation.ts` and tested.

Verification: typecheck, 62 tests and production build passed. Sampled body/link colours across shared light/dark surfaces have minimum contrast ratios 5.19:1 / 5.01:1; primary button text is 9.58:1 / 7.68:1. Theme controls and navigation retain visible focus; shared theme buttons have 44px touch targets. Browser automation was interrupted by concurrent user activity in Safari, so desktop/mobile screenshots, authenticated visual routing and live reduced-motion checks remain unverified. Manually check `/`, CTA → onboarding, Sign in → Today, legacy URLs, both themes/system mode and 320–390px navigation. No merge or deployment performed.
