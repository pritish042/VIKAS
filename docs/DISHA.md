# Initial DISHA mentor workflow

Branch: `feature/disha-context-retrieval`. Reuses the existing MongoDB driver, Better Auth, Gemini REST integration, topic checks, task proposal validation and theme styles. No new dependencies, vector database, embeddings or autonomous agents.

## What it does

DISHA runs a fixed, server-owned sequence of four validated tools: read relevant student context, check reviewed prerequisites, retrieve approved knowledge, and propose a small step. Gemini can now answer conversationally when no approved passages match; these replies explicitly state that they are general AI guidance, not source-checked explanations. With retrieved passages, the existing cited explanation path remains. The model cannot select tools, supply a user ID or write data. Conversation mode shows saved evidence and uncertainty without a task-approval panel or generated memory suggestion. The existing grounded flow retains optional checks and explicitly accepted steps. Missing prerequisite evidence never blocks learning.

The workflow is read-only with respect to profiles, memories and plans. As in the existing mentor, an explicit chat request saves its question and response to owned conversation history. Neither a response nor a pending memory suggestion becomes a profile fact. Separate, authenticated confirmation endpoints save memories and accepted/edited tasks. Rejection creates no task. Confirmed tasks remain `todo` until the student records an outcome. No profile or goal is changed by DISHA.

## Student context and memory

All private reads and writes bind `userId` to the verified Better Auth session. Client and model input cannot override it. Context uses an allowlist of onboarding education, interests, available time, bio and goal; confirmed topic memories; recent relevant topic-check results; and relevant tasks marked done. Up to six recent owned tasks are also included even without a topic match: title, status, recorded outcome/difficulty, bounded reflection and date. These are activity records, not prerequisite mastery evidence. Task notes, account, session, password, token and authentication-secret collections are excluded from model context. No user email or account name is included. At most ten evidence entries are sent to Gemini and displayed as the evidence used.

Evidence records preserve source kind, source reference, topic, timestamp and assessment version where applicable:

- Profile and confirmed conversation memories are **self-reported**.
- Topic attempts are **unvalidated topic-check evidence**, interpreted against their saved version. They are not mastery certificates.
- Completed tasks record activity only. Watching/opening a video does not automatically complete a task and never establishes mastery.

Prerequisite mappings explicitly name the assessment topic and exact objective strings. For each objective, the most recent answer is considered. A recent matching answer for every required objective supports only a limited evidence statement. A recent incorrect answer suggests revisiting that concept. Missing, Not sure, undated, future-dated or older-than-window results remain uncertain. The reviewer sets the evidence freshness window (1–365 days, default 90). Completion and self-report alone never produce a supported assessment result. No missed-task or global ability label exists.

The “What DISHA remembers” panel supports student-entered preferences, confirming/editing a conversation suggestion, editing saved memories and forgetting them. Profile edits continue through the existing profile form. Forgetting removes the memory from future context; historical conversation text/evidence snapshots are distinct records and can be cleared using Clear conversation. Conversely, clearing conversation history does not delete confirmed memories. Up to eight recent owned messages (at most 6,000 characters) and the active learning topic, step and pending question are now sent to Gemini. Very large source/context payloads shorten this history further to fit the existing 24,000-character transport ceiling. Forgotten memory text can still occur in recent chat history until that conversation is cleared. Current saved profile context takes precedence over historical claims; previous replies are never rewritten.

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

This is lexical retrieval, without semantic matching, translation or full curriculum coverage. Topic selection honours explicit programming-language mentions ahead of an old picker selection or profile interests, then an explicit approved topic choice/title match, then saved learning state for follow-ups. Unknown topics use general guidance with a concise source limitation. C/C++ requested together gets a C-to-C++ comparison sequence. A source title match or a search hit alone does not certify that it fully answers the question. Citations are checked against actually retrieved passage IDs, but that is not a semantic factuality guarantee. Inspect the linked sources. General excerpts can be shown when AI is missing or unavailable.

There are four server tool calls and at most one Gemini request per turn. Tool arguments/results use strict bounded schemas. Database reads use short `maxTimeMS` limits and bounded result counts (up to 12 relevant recent attempts, 10 memories and 6 completed tasks); older or omitted evidence is not treated as failure. The tool sequence has a 12-second dispatch budget, the provider gets at most 15 seconds within a 25-second workflow budget, and the route declares a 35-second maximum duration. Network/auth overhead depends on the runtime. Provider input is capped at 24,000 characters and streamed response at 32,000 bytes. There are no retries or arbitrary model-dispatched loops. Mentor requests are limited to five per user/minute using the existing MongoDB limiter.

Gemini receives untrusted material as a JSON data payload, separate from system instructions. No function declarations, tools or credentials are exposed. Its output must be strict JSON with bounded text; grounded answers require valid retrieved citation IDs, while conversational answers reject URLs and numbered source claims. Tool calls, extra fields, malformed/oversized/truncated responses and provider errors produce approved excerpts or an honest unavailable-service reply. No generated memory suggestions are created by this iteration. Hostile source text cannot cross into a database write because no model-to-write dispatch path exists. Prompt instructions and conservative output checks help with quality but do not guarantee factual accuracy.

The provider timeout covers response headers and the entire streamed body, including when a caller supplies a deadline. Invalid configuration/access (400/401/403/404), request allowance (429), timeout and other provider failures map to safe notices. Upstream response bodies, request URLs, model IDs and keys are never returned in student-visible errors. Environment values are read only by the server route; the key is carried in `x-goog-api-key`, never a URL. JSON mode is requested with `responseMimeType: application/json`, with local validation of every output. No automatic retries spend extra quota.

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
- `GEMINI_API_KEY`, `GEMINI_MODEL` for Gemini conversation/explanations. Set them in `.env.local`, without `NEXT_PUBLIC_` prefixes, then restart the local server. A documented stable starting model is `gemini-3.5-flash-lite`; use an exact `generateContent` model available to your Google API project. A `models/` prefix is accepted. Never paste a key into chat or commit the environment file.
- `CONTENT_EDITOR_EMAILS` for verified content editors. The existing SMTP settings support normal email verification; do not bypass verification by promoting an unverified account.

```sh
npm run db:indexes
node --env-file=.env.local --import tsx scripts/check-mentor-setup.ts
npm run dev
```

The setup checker only reports setting presence, database/text-search availability and approved content counts. It reads no student records and prints no credentials.

Google references checked 2 October 2026: [REST generateContent endpoint](https://ai.google.dev/api/generate-content), [stable model catalogue](https://ai.google.dev/gemini-api/docs/models), [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [model availability API](https://ai.google.dev/api/models), and [provider error handling](https://ai.google.dev/gemini-api/docs/troubleshooting). The endpoint remains `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`. Documentation establishes model support; only a call with the configured project key establishes that project's actual access/quota.

For a real local test, sign in with an authorized existing account and ask a learning question in `/disha`. Check the AI reply, the evidence/progress disclosures and the honest source notice. Reload to see saved conversation history; confirm profile, goal and tasks did not change. Try another account and confirm the first account's conversation/context is absent. Missing configuration can be checked without contacting Google. Provider errors and isolation are covered with test-only fixtures; they do not create student records in MongoDB.

## Verification and limitations

Local conversation repair, 2 October 2026: typecheck, all 68 tests and production build passed. The running local `/disha` page returned 200; unauthenticated mentor GET/POST and context requests returned 401. New coverage checks conversational calls without an approved corpus, bounded profile/goal/recent-progress input, two-user context/message isolation, conversation-only writes, missing configuration/profile, safe configuration/quota errors, stalled headers/body, hostile tool output, truncation and oversized replies. These tests use fixtures only in the in-memory test database.

The operator subsequently supplied a local Gemini key. `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.5-flash-lite` are configured in the ignored local environment file. Google’s model metadata returned 200 with `generateContent` support, and generic no-student-data requests through the local provider returned real responses (`used`). The running local app reports Gemini configured. No credentials were printed or committed, and no deployment was performed.

The subsequent DNS repair diagnosed a valid loaded Atlas URI with no placeholders. The default resolver returned `EBADRESP` for SRV but resolved TXT; Cloudflare and Google resolved SRV/TXT and all three discovered node addresses. The SRV seed hostname itself has no A/AAAA records, which is not a connection failure when SRV discovery works. A process-only Cloudflare diagnostic passed MongoDB ping with the unchanged URI/TLS. The explicit local `MONGODB_DNS_SERVERS` setting now uses the same validated helper in both the app's shared MongoClient (including Better Auth) and the setup checker. MongoDB ping and text search pass; approved knowledge and reviewed resource counts are zero. Typecheck, all 71 tests and production build pass. Live authenticated conversation persistence and two-user isolation still require authorized account sign-ins; no test accounts or synthetic student records were inserted. See README for the optional network-operator/manual system DNS repair.

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

## Conversational learning repair — 8 October 2026

The supplied transcript showed repeated greetings after “yes”/“next”, permission questions instead of requested basics, C/C++ displaced by a saved Python interest, and provider outages described alongside retrieval gaps. The old workflow saved conversation messages but never included them in AI input and had no active topic/step/pending-question state. The generic prompt permitted optional next-step offers and profile-led suggestions. The server already read the owned saved profile for each new reply; the transcript's undergraduate-to-Class-8 change alone cannot prove stale context or account leakage. The client context panel, however, refreshed only on language/sign-in changes and is now refreshed on saved profile changes, with stale-read rejection and verified account-ID remounting.

`mentor-learning.ts` reads only the verified owner's latest eight messages, projects role/content plus internal learning state, and constructs the bounded provider dialogue. Learning state is stored on each new assistant message as `mentor.learning`, versioned for the beginner pack. Clearing the owned conversation also clears its learning state. No browser chat storage, profile writes, synthetic student records or autonomous actions were added. Historical replies and evidence snapshots remain unchanged.

“Basics”, “basis” and “bacis” start a small lesson immediately. A short “yes” with a pending practice question continues that same step; “next” advances without forcing an answer first. Simple numeric answers are checked against the reviewed pack question only, with explanations rather than mastery judgments. Other questions/answers are given to Gemini together with recent history and pending state. Ambiguous starts ask one topic question. The current pack has two steps per language; it is intentionally not a complete course.

`mentor-beginner-pack.ts` contains original app-authored beginner summaries, runnable examples and practice checks for output/arithmetic and variables in C, C++ and Python. Content was reviewed against primary documentation and the six examples compiled/executed locally with the expected output. Review is an implementation/content check, not a claimed teacher review, board approval or prerequisite assessment. The pack is bundled, with content hashes and review date, and needs no database seeding or editor-account impersonation. MongoDB reviewer gates for all other knowledge remain intact. Video metadata remains separate resource metadata.

Sources: [GNU C Reference Manual](https://www.gnu.org/software/gnu-c-manual/gnu-c-manual.html), [Microsoft C++ Hello World](https://devblogs.microsoft.com/cppblog/cpp-tutorial-hello-world/), [Microsoft C++ declarations](https://learn.microsoft.com/en-us/cpp/cpp/declarations-and-definitions-cpp?view=msvc-170), [Python tutorial](https://docs.python.org/3/tutorial/introduction.html). Summaries/examples are original writing rather than scraped or re-hosted source chapters. English pack lessons are rendered directly; other requested reply languages use the provider explanation path with these source passages.

Provider failure status, retry controls and safe diagnostic categories are separate from source gaps. A successful no-passage answer is labelled “General AI guidance”; limitations and source passages are expandable. Provider errors log only categories/status numbers (configuration, quota, upstream HTTP, timeout, invalid JSON/schema, unfinished/blocked/tool output, size limits or invalid citations), never credentials, prompts, student messages or upstream response bodies. Reviewed beginner practice remains available when AI fails. Retrying sends a new authenticated/rate-limited request with current profile context.

C and Python examples link to APRAJITA; C++ does not because the lab does not support it. Existing lab eligibility and execution configuration checks still apply. React renders code fences as plain code text without inserting model HTML.

Verification: typecheck/build and 34 targeted mentor/learning/onboarding checks passed. Five new learning tests cover the requested Python flow (including an incorrect attempt and corrected answer), C/C++ topic precedence, profile freshness with unchanged history, account isolation, history bounds, source gaps and safe provider-failure/retry metadata. A live Gemini four-turn Python flow (“Teach Python basics” → “yes” → “next” → “9”) returned `used` for every request and retained/advanced the expected state. It used only in-memory conversation records and no student profile or MongoDB writes. All six original C/C++/Python examples compiled/ran locally with expected output. No student code is executed by the deployed mentor. Authenticated browser interaction, live profile editing, and a real-account retry journey remain unverified; service tests cover those data paths with test doubles. Nothing was pushed or deployed.
