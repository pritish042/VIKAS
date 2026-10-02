# Initial DISHA mentor workflow

Branch: `feature/disha-context-retrieval`. Reuses the existing MongoDB driver, Better Auth, Gemini REST integration, topic checks, task proposal validation and theme styles. No new dependencies, vector database, embeddings or autonomous agents.

## What it does

DISHA runs a fixed, server-owned sequence of four validated tools: read relevant student context, check reviewed prerequisites, retrieve approved knowledge, and propose a small step. Gemini may turn the retrieved evidence into short cited explanations; it cannot select arbitrary tools, supply a user ID or write data. The response shows prerequisites, the evidence used, uncertainty, sources and a pending step. Students can open the existing optional topic checks, ask for a refresher, or continue to the topic. Missing prerequisite evidence never blocks learning.

The workflow is read-only with respect to profiles, memories and plans. As in the existing mentor, an explicit chat request saves its question and response to owned conversation history. Neither a response nor a pending memory suggestion becomes a profile fact. Separate, authenticated confirmation endpoints save memories and accepted/edited tasks. Rejection creates no task. Confirmed tasks remain `todo` until the student records an outcome. No profile or goal is changed by DISHA.

## Student context and memory

All private reads and writes bind `userId` to the verified Better Auth session. Client and model input cannot override it. Context uses an allowlist of onboarding education, interests, available time, bio and goal; confirmed topic memories; recent relevant topic-check results; and relevant tasks marked done. Account, session, password, token and authentication-secret collections are never read for model context. No user email or account name is included.

Evidence records preserve source kind, source reference, topic, timestamp and assessment version where applicable:

- Profile and confirmed conversation memories are **self-reported**.
- Topic attempts are **unvalidated topic-check evidence**, interpreted against their saved version. They are not mastery certificates.
- Completed tasks record activity only. Watching/opening a video does not automatically complete a task and never establishes mastery.

Prerequisite mappings explicitly name the assessment topic and exact objective strings. For each objective, the most recent answer is considered. A recent matching answer for every required objective supports only a limited evidence statement. A recent incorrect answer suggests revisiting that concept. Missing, Not sure, undated, future-dated or older-than-window results remain uncertain. The reviewer sets the evidence freshness window (1–365 days, default 90). Completion and self-report alone never produce a supported assessment result. No missed-task or global ability label exists.

The “What DISHA remembers” panel supports student-entered preferences, confirming/editing a conversation suggestion, editing saved memories and forgetting them. Profile edits continue through the existing profile form. Forgetting removes the memory from future context; historical conversation text/evidence snapshots are distinct records and can be cleared using Clear conversation. Conversely, clearing conversation history does not delete confirmed memories. Prior chat history is deliberately not sent to Gemini, so forgotten facts cannot be reintroduced through old messages.

## Knowledge ingestion and approval

The previous catalogue import policy is unchanged: its resource links and optional questions were enabled without manual review at the operator's request. This DISHA feature follows the newer request for **reviewed knowledge**. It does not treat catalogue links as ingested lessons or retroactively invent approval.

1. Configure `CONTENT_EDITOR_EMAILS` and sign in with a matching **verified** email, using the existing content-editor permission check. Merely listing an unverified email does not grant permission.
2. Open Explore → Review queue → DISHA knowledge → Add a knowledge version for review.
3. Supply the topic key/title, subject, educational stage, language, explicit board applicability, source URL and authorship/license/permission. Use your own writing or appropriately licensed content. Confirm the right to store and use it. No scraping, external download or re-hosting job runs.
4. Paste plain text into meaningful sections, each with a heading (up to six sections, 1,800 characters each, 7,000 combined). Add source-supported prerequisite concepts and their exact assessment objective mappings. The form exposes current unvalidated assessment topic keys/objectives for mapping; answer keys are not shown there. General content must explicitly use general board applicability; specific content requires exact saved board names. The entire HTTP body is limited to the existing 12,000-character ceiling.
5. Save the draft. Inspect its full text, source, license, stage, board and mappings in the queue, then approve that exact version. The server checks verified-editor permission on both operations. Submitting does not approve it.
6. Approval materializes one text-search chunk per authored section, with source, title, heading, topic, subject, stage, language, version and review date. Retrieval also checks the parent document's current approval/version, preventing stale chunks from exposing withdrawn content.
7. Correct content by submitting a new draft version. Existing content versions are immutable through the API. Withdraw outdated versions explicitly; approving a new version does not silently withdraw a different approved source/version. Withdrawal removes the version from future retrieval. Historical conversation responses retain the sources that were approved at response time.

For resource-link fallback, a verified editor can use **Mark reviewed for DISHA** on a published resource in Explore. This reviews resource metadata only; it does not ingest lesson text. DISHA currently offers fallback links only where published, reviewed catalogue metadata supplies explicit topic/profile/language applicability. Ordinary untargeted resources are not guessed into topics. Existing submission publication/ownership permissions remain in place.

No real knowledge text or prerequisite map was supplied with this request. No fabricated “reviewed” corpus or synthetic students were inserted. The feature is operational plumbing with honest empty states until the operator supplies and approves content.

## Retrieval and provider boundaries

`KnowledgeRetriever` currently uses MongoDB `$text` over section heading, text and title, with `default_language: none` and an explicit language override field. Query tokens are bounded and stripped of search operators. Topic, student stage, requested language and board filters apply before return. The latest applicable approved topic entry supplies the prerequisite map; up to four relevant approved sections (at most 7,200 text characters) and three reviewed resource links are returned with source references. Search failures return a retrieval-unavailable notice, not invented passages.

This is lexical retrieval, without semantic matching, translation or full curriculum coverage. Topic selection uses an explicit approved topic choice or a case-insensitive topic title/key match in the request; unknown advanced topics produce uncertainty. A source title match or a search hit alone does not certify that it fully answers the question. Citations are checked against actually retrieved passage IDs, but that is not a semantic factuality guarantee. Inspect the linked sources. General excerpts can be shown when AI is missing or unavailable.

There are four server tool calls and at most one Gemini request per turn. Tool arguments/results use strict bounded schemas. Database reads use short `maxTimeMS` limits and bounded result counts (up to 12 relevant recent attempts, 10 memories and 6 completed tasks); older or omitted evidence is not treated as failure. The tool sequence has a 12-second dispatch budget, the provider gets at most 15 seconds within a 25-second workflow budget, and the route declares a 35-second maximum duration. Network/auth overhead depends on the runtime. Provider input is capped at 24,000 characters and streamed response at 32,000 bytes. There are no retries or arbitrary model-dispatched loops. Mentor requests are limited to five per user/minute using the existing MongoDB limiter.

Gemini receives untrusted material as a JSON data payload, separate from system instructions. No function declarations, tools or credentials are exposed. Its output must be strict JSON with bounded text and valid retrieved citation IDs. Tool calls, extra fields, invented citations, malformed/oversized responses and provider errors fall back to approved excerpts or an honest gap. A memory suggestion is displayed for confirmation only. Hostile source text cannot cross into a database write because no model-to-write dispatch path exists. Prompt instructions help with explanation quality; they are not the security boundary.

## Data and API

New collections:

- `mentor_knowledge`: immutable authored content versions, structured prerequisites, source/license/board metadata, draft/approved/withdrawn status and reviewer audit fields.
- `mentor_chunks`: derived section documents with MongoDB text index, parent/version references and approval metadata.
- `mentor_memories`: owned student-confirmed facts/preferences with topic, source/reference and created/updated dates.

Existing `messages` have optional `mentor` evidence/source/proposal metadata. Existing `tasks` gain optional `topicId` and `mentorMessageRef`; accepted steps retain the existing goal reference/title. Pending proposals stay in messages, not tasks. Atomic proposal claims reserve one task ID; repeated acceptance and interrupted-insert retries reuse it. There is no cross-collection transaction: an interrupted task insert requires retrying acceptance. Once materialized, a retry does not recreate a deleted task.

| Route | Contract |
| --- | --- |
| `POST /api/mentor` | Existing `{message}` remains valid; optional `topicId`, `language` (English default), `choice: consider/refresher/continue`. Returns existing `answer` plus `mentor` and message `id`. |
| `GET/DELETE /api/mentor` | Owned history / clear owned conversation. Server task-acceptance internals are omitted from GET. |
| `GET /api/mentor/context?language=English` | Allowlisted own context, confirmed memories and applicable approved topic choices. |
| `POST /api/mentor/memory` | `{topicId,text,confirmed:true,messageRef?}`. Optional conversation reference must belong to this user and contain a matching memory suggestion. |
| `PATCH /api/mentor/memory/:id` | `{text,confirmed:true}`; owned record only. |
| `DELETE /api/mentor/memory/:id` | Forget an owned memory. |
| `PATCH /api/mentor/proposals/:id` | Existing decision schema: `{decision:accept}`, `{decision:edit,title,notes,minutes}`, or `{decision:reject}`. Requires an owned assistant message; acceptance also needs a current personal goal. |
| `GET/POST /api/mentor/knowledge` | Verified editors only: inspect knowledge/mapping metadata / submit strict `KnowledgeInput` as a draft. |
| `PATCH /api/mentor/knowledge/:id` | Verified editors only: `{decision:approve/withdraw,version}`. |

All mutation routes retain Origin checks, session-derived identity, strict bodies and appropriate rate limits. No model-supplied user ID, score, approval, task status or goal change is accepted. Existing profiles, tasks, message history and topic-check APIs remain compatible. `status.mentor` continues to indicate Gemini configuration, while the deterministic mentor UI also works without Gemini.

## Environment and setup

Existing settings only; none are exposed to client bundles:

- `MONGODB_URI`, optional `MONGODB_DB` (default `vikas`).
- `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` for authenticated local/API use.
- `GEMINI_API_KEY`, `GEMINI_MODEL` for Gemini explanations.
- `CONTENT_EDITOR_EMAILS` for verified content editors. The existing SMTP settings support normal email verification; do not bypass verification by promoting an unverified account.

```sh
npm run db:indexes
node --env-file=.env.local --import tsx scripts/check-mentor-setup.ts
npm run dev
```

The setup checker only reports setting presence, database/text-search availability and approved content counts. It reads no student records and prints no credentials.

## Verification and limitations

On 2 October 2026: typecheck, 59 tests and production build passed. MongoDB connectivity and the real text-index query passed. `/mentor` returned 200; unauthenticated mentor/history/context/knowledge APIs returned 401. Tests cover ownership, explicit confirmation, draft/withdrawn exclusion, reviewer permissions, board/language/stage/topic filters, recent/stale/missing evidence, source/version attribution, no mastery inference, provider failure/malformed citations, hostile source tool attempts and duplicate proposal acceptance. Service tests use in-memory database doubles; no synthetic student records are written to the configured database.

Local environment: Gemini key/model and content-editor allowlist are missing. Approved knowledge versions and reviewed published resources both count zero. Live model behaviour, authenticated reviewer/student journeys and visual desktop/mobile/theme checks remain unverified. Safari automation returns `cgWindowNotFound`.

Manual verification with authorized accounts:

1. As a verified editor, submit licensed/authored source text as a draft. Confirm another student cannot GET/POST/PATCH the knowledge queue and DISHA cannot retrieve the draft. Approve it; inspect source URL, review date and version in a response. Withdraw it and ask again; it must not be retrieved.
2. Save a real profile. Compare a self-report, a completed task and an optional topic-check result. Only recent mapped assessment evidence can support a prerequisite. Try missing/dated evidence and Continue to topic; neither should block learning or change the goal.
3. Confirm a memory, edit it, sign out/in, then forget it and start another turn. Verify it is absent from future context. Clearing chat history is separate.
4. Ask DISHA for a step. Confirm no task exists until Accept or Save edited step. Double-click acceptance and verify one `todo` task. Reject another suggestion and verify no task appears. Account B must not mutate A's proposal or memory IDs.
5. With keys configured, inspect citations against the returned passages. Test provider outage and no search hits; expect approved excerpts or a clear gap. Review keyboard operation, narrow-screen wrapping, light/dark/system themes and reduced motion.

No merge, push, automatic content approval or deployment was performed for this feature.

Implementation references: [MongoDB text query](https://www.mongodb.com/docs/manual/reference/operator/query/text/) and [Gemini structured-output documentation](https://ai.google.dev/gemini-api/docs/structured-output). The existing GenerateContent transport is retained; application-level output validation does not depend on a particular provider-side schema mode.
