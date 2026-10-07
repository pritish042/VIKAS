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

Branch `fix/disha-gemini-conversation` removes the approved-passage gate for ordinary Gemini conversation while preserving grounded retrieval. Context includes at most six recent owned tasks and ten allowlisted evidence entries. Conversation replies disclose absent approved sources and create only owned messages; generated memory suggestions are disabled, and task approval panels remain in the existing grounded flow. Provider timeout bounds headers and body, and safe notices cover configuration, quota and outages. Local Gemini configuration is now present in the ignored environment file, and a real generic provider response succeeded. MongoDB DNS currently blocks the authenticated persistence check. No credentials were added to source files and no student fixtures were written to MongoDB.

The DNS blocker was traced to the default resolver's malformed SRV response (`EBADRESP`). An explicit local `MONGODB_DNS_SERVERS` override now passes MongoDB ping and text search, using the unchanged Atlas URI and TLS. `lib/mongo-dns.ts` validates the opt-in setting before the shared MongoClient used by both application routes and Better Auth is created; the setup checker uses the same helper. It affects Node process `dns.resolve*` operations and never changes OS network configuration. Approved knowledge and reviewed resource counts remain zero. Live account round-trip/isolation verification needs two authorized existing accounts; no synthetic accounts or student data were created.

## Topic learning maintenance

See [TOPIC-LEARNING.md](TOPIC-LEARNING.md). The operator removed the manual content review requirement during implementation; the importer publishes validated-structure resources and activates unvalidated topic checks directly, without claiming educator approval. Keep student task acceptance explicit. The original resource editor permission rules remain unchanged. Catalogue source and editable applicability are in `data/catalogue/`; server logic is in `lib/topic-*` and `lib/catalogue-import.ts`; UI is in `components/topic-learning.tsx` and `components/resource-task.tsx`. Do not import answer-bearing source files or scoring functions into client components. Branch: `feature/topic-assessments`. No deploy/merge was performed.

## Education form maintenance
Senior selection is extracted to `components/subject-picker.tsx`, with board aliases in `lib/education-board.ts` and contextual suggestions/checks in `lib/senior-subjects.ts`. Coverage is an additive saved-profile summary on personalized resource GET; keep it separate from subject availability suggestions and suppress labels for unsaved drafts. Combination checks are scoped to the picker, preserving the custom-profile API. Review compares the draft with the saved profile. See [SENIOR-SUBJECTS.md](SENIOR-SUBJECTS.md) for source-year distinctions, boundaries and coverage limits.

Onboarding and profile editing share `StudyForm`. Keep catalogs editable, preserve valid dependent answers, and never guess missing fields on legacy profiles. The additive education contract and legacy-write behavior are documented in docs/API.md. Subject suggestions are informed by the official [CBSE curriculum](https://cbseacademic.nic.in/curriculum_2027.html) and [CISCE curriculum](https://www.cisce.org/wp-content/uploads/2022/10/UpperPrimary.pdf); they are flexible suggestions, not enforced subject combinations. No school or program selection creates student data.

## Public landing page and navigation

Branch `feature/public-landing-palette` adds `components/landing-page.tsx` and semantic linen/aquamist/sage/maroon variables in `app/globals.css`. Dark mode uses separate warm-charcoal surfaces and accessible light accents. The generic process illustration uses brief finite CSS motion, remains visible without animation and follows the existing reduced-motion override. No new dependencies, student records, API contracts or educational content changes.

`/` is public for everyone. Guests follow Get started to the existing onboarding at `/start` (`/onboarding` is an alias); signed-in visitors see Continue your journey linking directly to `/today`. There is no automatic landing redirect. Login success maps to Today through the shared navigation helper. `/home`, `/plan` and `/mentor` still work; `/today`, `/journey` and `/disha` are aliases for the same existing screens. Today / My Journey / DISHA are the leading navigation labels, with Explore and Profile retained. This does not consolidate or rebuild the existing plan/journal screens. The route and CTA mapping is centralized in `lib/navigation.ts` and tested.

Verification: typecheck, 62 tests and production build passed. Sampled body/link colours across shared light/dark surfaces have minimum contrast ratios 5.19:1 / 5.01:1; primary button text is 9.58:1 / 7.68:1. Theme controls and navigation retain visible focus; shared theme buttons have 44px touch targets. Browser automation was interrupted by concurrent user activity in Safari, so desktop/mobile screenshots, authenticated visual routing and live reduced-motion checks remain unverified. Manually check `/`, CTA → onboarding, Sign in → Today, legacy URLs, both themes/system mode and 320–390px navigation. No merge or deployment performed.

## CBSE Class 8 Mathematics chapters

Branch `feature/cbse8-math-chapter-resources` adds chapter-format dispatch to the existing import script, pending/inactive YouTube resources, versioned curriculum chapter records and exact-version reviewer approval. See [CBSE8-MATH-IMPORT.md](CBSE8-MATH-IMPORT.md). This format deliberately requires review, independently of the old operator-requested no-review catalogue policy. Preserve source review-depth/uncertainty; never promote appended mappings automatically. Optional saved session/textbook fields are additive. New resource task acceptance uses existing tasks and central session/profile eligibility. The operator subsequently authorised visibility without review: 14 new chapters/videos were imported, with videos published/active and an honest operator-requested-unreviewed basis. No synthetic student records, merge or deployment occurred. The optional --publish-new flag affects only new inserts and preserves existing human decisions.

### CBSE Class 8 additional catalogues
Science (13 chapters/13 videos), Social Science (7 chapters/8 videos), and English literature (15 chapters/12 videos) are supplied in `data/chapters/`. These use the same idempotent chapter importer as Mathematics. The operator explicitly requested publication without external review; original metadata-only review depth, missing metadata, source notes and catalogue headers are retained. No human approval is claimed. English chapters 5, 6, 8 and 11 have no supplied videos.

Eligibility remains server-side: saved CBSE Class 8 profile, actual enrolled subject, and session/textbook applicability when supplied. Social Studies matches Social Science; English Literature matches English. Separate Physics, Chemistry or Biology selections do not imply enrollment in integrated Science. Chapter lists are grouped by subject and ordered within each subject. Mathematics and other pathways remain unchanged.

Repeat import (dry-run by default): `node --env-file=.env.local --import tsx scripts/import-catalogue.ts --file data/chapters/cbse-class8-science-2026-27.json`. Explicit publication: append `--apply --publish-new --database vikas`; substitute the social-science or english-literature filename as needed. Existing editorial decisions are preserved. External videos were not inspected, and local verification commands were not rerun at the operator's request.

### CBSE Class 8 Hindi
The supplied Hindi Malhar 2026-27 catalogue is in `data/chapters/cbse-class8-hindi-2026-27.json`: 10 chapters and 10 video candidates. It uses the same importer and operator-requested publication without external review. Server-side eligibility requires the saved CBSE Class 8 profile and Hindi among actual subjects, respecting saved session/textbook applicability. Source uncertainty and metadata-only review status remain unchanged. Use the existing import command with this filename; no new subject aliases or broader language matching were introduced.

## CBSE Class 11/12 YouTube searches

The two supplied CBSE PDFs are extracted into `data/directories/` and integrated through `scripts/import-board-directory.ts`, `lib/board-directory.ts` and `components/board-directory.tsx`. ISC resources were inspected but excluded from this CBSE request. Links open search results, with source-page/session provenance and no fabricated direct-video metadata. See [CBSE-SENIOR-DIRECTORIES.md](CBSE-SENIOR-DIRECTORIES.md) for counts, repeat-safe publication, filtering and verification limits.

## ISC Class 11/12 search directories

The later operator request adds the two previously excluded ISC PDFs via the same MongoDB directory importer. Counts: 370 Class 11 / 360 unique Class 12 searches. Board headings are dynamic; source sessions remain honestly unspecified. CISCE senior subject suggestions include English components and History. Board/class query filtering precedes the record limit; old CBSE directory records still work. See [ISC-SENIOR-DIRECTORIES.md](ISC-SENIOR-DIRECTORIES.md). Typecheck, 93 tests and build passed.

## backend-vikash fixes

The YouTube backend fixes restrict feedback to profile-eligible, fresh videos; accept PCM/PCB/PCMB senior streams with exact class and known-board checks; bound provider JSON body reads; and preserve reviewer withdrawal during metadata recovery. Existing API shapes remain unchanged. `npm run typecheck` generates current Next.js route types first. See [YOUTUBE-DISCOVERY.md](YOUTUBE-DISCOVERY.md#backend-fixes-4-october-2026). Typecheck, 92 tests and build passed; no live student records or provider calls were used for regression tests.

DISHA floating onboarding is mounted in the persistent root layout, alongside the original onboarding. Its explicit panel phase, controlled study step and academic draft live in React memory and survive internal signup/sign-in navigation; a full refresh or closed tab discards the draft. Only the one-time welcome appearance preference is stored locally. The original secure Better Auth forms handle all credentials. Assistant handoff disables the original signup draft auto-save; verified authentication resumes at review (or asks about an existing profile), never auto-saves. Optional saved details survive guest-draft merging unless explicitly changed. Profile updates notify the existing app to reload.

The original short-haired girl avatar is inline SVG using VIKAS theme variables. The non-modal panel supports Escape, labelled minimise/close/reopen controls, keyboard focus, reduced motion and mobile navigation clearance. Gemini onboarding help is optional, rate limited and independent of saved mentor conversations. Requires the existing MongoDB/Better Auth configuration for real accounts and saves, and `GEMINI_API_KEY` / `GEMINI_MODEL` for live AI. Do not put credentials in the assistant. No deployment was performed.

Local DISHA validation continuation: configured MongoDB promise DNS explicitly alongside callback DNS, resolving local auth SRV EBADRESP / HTTP 503. MongoDB ping, guest auth status, 401 guest-profile gate, 403 origin gate and a live Gemini onboarding explanation passed. Guest-draft merges now retain saved session/textbooks. Save controls lock while submitting; timed-out profile requests retain drafts. See docs/DISHA-ONBOARDING.md for remaining live-account and browser checks.
