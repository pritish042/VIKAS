# Topic checks and resource suggestions

Branch: `feature/topic-assessments`. Uses the existing Next.js route handlers, MongoDB driver, Better Auth session and theme styles. No new dependencies or AI calls.

## Publication policy

The operator explicitly removed the manual review requirement during implementation. The import therefore publishes structurally valid catalogue resources and activates usable checks directly. It records `publicationBasis: operator_requested_no_review` and `validated: false`; it does not invent educator approval. Existing community resource submission/editor permissions remain unchanged. Checks are optional, described as **unvalidated short topic checks**, and never measure intelligence, career suitability or overall ability.

Only `published` resources and `active` assessment versions are served for new suggestions. Draft/inactive versions are not returned. Existing resource editors can unpublish catalogue resources through the existing API; re-import does not override that decision. There is no new assessment review UI. Operators can disable a version by setting its status to `inactive` in MongoDB. Historical attempts retain their original interpretation.

## Content and import

`data/catalogue/research.json` contains the two supplied structured JSON blocks, as inert data. `data/catalogue/routing.json` contains explicit profile applicability, language choices and excluded question IDs. No imported prose is executed or rendered as HTML. Import validation bounds strings, checks question/answer structure and mappings, rejects duplicate identifiers, and permits public HTTPS links without credentials. It makes **no external content requests** and does not verify that a link is still live or that provider claims are accurate.

The initial batch contains eight structured resources and forty original draft questions. Thirty-five questions are enabled. Exclusions:

- `PHY-Q4`: ambiguous relative versus percentage error wording.
- `ACC-Q4`: conflates equity with liability without enough context.
- `POL-Q5`, `CS-Q5`, `STAT-Q5`: provider/book orientation rather than a useful topic concept check.

No replacement questions were invented. Four table-only entries were not imported because they were absent from the structured resource block; one also lacked a direct URL. Some accepted links are provider landing pages requiring further navigation, as disclosed in their limitations.

School applicability is Class 11, CBSE, and the **actual selected subject**. No Class 12 or other-board equivalence is inferred. Bachelor's programme/discipline matches are conservative and editable in routing.json. Where the source explicitly says first-year, Year 1 / Semesters 1–2 are required. Legacy profiles without structured education show an empty state until the student supplies the missing facts. No subjects are inferred from streams.

```sh
# Validate only; no database connection or writes.
node --import tsx scripts/import-catalogue.ts

# Import using existing server environment. Publishes catalogue content without review.
node --env-file=.env.local --import tsx scripts/import-catalogue.ts --write
npm run db:indexes
```

Requires `MONGODB_URI`; `MONGODB_DB` defaults to `vikas`, as elsewhere in the app. Authentication continues to require `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`. No new environment variables are required. Never copy credentials into source or browser settings.

Re-run is idempotent. Resources use source identifiers and a unique index; exact legacy title/URL matches are extended without rewriting their title, ownership or publication state. Shared NCERT landing URLs are intentionally separate resources for different topics. Catalogue routing metadata can be refreshed by re-importing; initial resource titles/URLs/status are preserved. To correct one of those fields on an existing entry, the operator must update that document explicitly. Assessment IDs are hashes of complete content/routing versions; edits create a new immutable version and old versions remain available for in-flight checks unless explicitly disabled. Attempt snapshots preserve the original questions, submitted answers and explanations. No import creates users, attempts, tasks or progress.

## Deterministic routing

Each answer is interpreted against its specific question's objective: matched key, revisit, or Not sure. No aggregate placement score is generated. Revisit and uncertain prerequisite objectives receive priority, then other matching objectives. Resource language and profile applicability are hard filters. Up to three published resources are returned. This batch currently has one resource per topic, so it does not claim to offer an advanced alternative.

Available time is a **study session budget**, separate from the supplied full-resource effort. Revisit/Not sure or saved Too difficult feedback halves the proposed session, with a five-minute minimum. Too easy suggests using the resource's practice if available; About right keeps a similar approach. Skipping produces an introductory suggestion without an inference about understanding. All checks are in English; resource languages are separately selected and sourced from the research. Hindi access and general university curriculum equivalence have not been independently verified.

## Collections and ownership

- Existing `resources`: additive `catalogue` metadata (source, provider, effort, access, limitations, topic applicability, objectives and prerequisites). Existing resources need no migration.
- New `topic_assessments`: immutable version, topic, server-only answer keys, explanations, objective mappings, active status, source publication basis, created/updated times.
- New `topic_attempts`: authenticated user, assessment ID/version/snapshot, answers, per-concept results, preferences, recommendation snapshot, optional acceptance/goal/task references, feedback, timestamps.
- Existing `tasks`: optional `resourceRef`, `resourceUrl`, `topicAttemptRef`, plus existing goal reference/title. Accepted tasks start `todo`. Opening an external link does not update status.

All private operations use the verified session ID and retain origin checks and throttling. Strict request schemas reject user IDs, scores and extra properties. The question set must match the submitted version exactly, with no duplicates or foreign IDs. Questions returned before submission contain no answer keys, objectives or scoring implementation. Historical responses omit server snapshots and ownership fields.

Acceptance conditionally claims one resource per attempt and saves a single task ID before insertion. Concurrent clicks reuse that ID; interrupted insertion can be retried. Once materialized, repeating acceptance does not recreate a deleted task. There is no cross-collection transaction: an interrupted request can temporarily leave an acceptance awaiting task creation until retried. Resource feedback updates future checks; it does not change old results or silently edit tasks/goals.

## Verification

Automated tests use in-memory collection doubles, **not student records in the configured database**. They cover per-objective interpretation, unsupported profiles, no stream inference, language/time/feedback routing, key redaction, strict validation, inactive/pending visibility, import repeatability, legacy resource preservation, two-user service isolation, concurrent acceptance, interrupted-write recovery, task deletion, and immutable history. Existing profile/auth/progress tests remain in place. Run `npm test`, `npm run typecheck`, `npm run build`.

Implementation verification on 1 October 2026: 48 tests passed; typecheck and production build passed. Live MongoDB import inserted 8 resources and 8 versions; the second run inserted 0/0. Index creation succeeded. No synthetic student data was inserted. Safari automation failed with `cgWindowNotFound`, so authenticated end-to-end interactions and mobile/desktop appearance in both themes remain unverified.

Manual checks using authorized test accounts:

1. Save a Class 11 CBSE profile with Physics actually selected and a personal goal. Open Home → Find a resource for a topic. A different board/class or omitted Physics must not offer this topic. Repeat with a supported bachelor's programme and discipline.
2. Choose topic, resource language and session minutes. Skip the check and confirm a resource remains available. Retry with the check, answer one question at a time, use Not sure, and inspect concept explanations after submission. Network responses before submission must contain no keys.
3. Accept a suggestion twice quickly. Exactly one `todo` task should appear, linked to the saved goal. Opening its resource must not complete it. Give each feedback choice and repeat the topic flow; compare the explained approach/session duration.
4. Sign out and back in. Confirm task, attempt history and feedback restore from MongoDB. Save another profile and confirm dependent topic availability changes.
5. In account B, submit A's attempt ID to acceptance and feedback routes. Both must return 404. B's attempt list must exclude A's history. Unauthenticated calls must return 401; cross-origin mutations and extra userId/score fields must fail.
6. Confirm pending resources and inactive checks are unavailable. Re-import must not republish an unpublished resource. Change a question in the source and re-import; old attempts must retain their original version/explanations.
7. Test at 390px and desktop widths, light/dark/system themes, keyboard only, and reduced motion. Check question labels, visible focus, wrapping of long answers, primary actions and external links.

No merge or application deployment is performed by this feature.
