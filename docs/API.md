# API contract for the backend team

Next.js Node route handlers under app/api. All private calls use Better Auth session cookies (HttpOnly). JSON mutations must carry the matching browser Origin. Ownership comes from the session, never an incoming userId. No browser connects directly to MongoDB.

| Route | Methods | Behavior |
| --- | --- | --- |
| /api/status | GET | Accounts/email/mentor capability availability; no secrets |
| /api/auth/* | GET/POST | Better Auth endpoints, including sign-up/email, sign-in/email, sign-out, get-session |
| /api/profile | GET/PUT | Current student's profile; full validated profile on PUT |
| /api/tasks | GET/POST | Private task list/create |
| /api/tasks/:id | PATCH/DELETE | Set todo/done, or delete owned task |
| /api/tasks/:id/feedback | POST | Save one owned step review and a pending deterministic suggestion |
| /api/tasks/:id/proposal | PATCH | Accept, edit and accept, or reject an owned pending suggestion |
| /api/records | GET/POST | Private journal list/create |
| /api/records/:id | PATCH/DELETE | Update/delete owned entry |
| /api/resources | GET/POST | Saved-profile eligible resources; explicit owned submissions/reviewer views |
| /api/resources/:id | PATCH/DELETE | Verified editors publish/unpublish; owner or editor can delete |
| /api/mentor | GET/POST/DELETE | Current user's history, optional real response, clear history |
| /api/youtube/recommendations | GET | At most three approved/active matches; never calls YouTube |
| /api/youtube/consent | GET/POST | Read or record the authenticated user's YouTube terms/privacy consent; false withdraws it |
| /api/youtube/discover | POST | Explicit authenticated search using the server-only YouTube Data API key; stores candidates as pending and returns only a count |
| /api/youtube/review | GET | Verified content-editor-only YouTube review queue |
| /api/youtube/review/:id | PATCH | Verified reviewer approves, rejects, edits VIKAS subject/topic/difficulty tags, or marks a candidate inactive |
| /api/youtube/videos/:id/feedback | POST | Save the current user's too-easy/about-right/too-difficult/not-useful feedback |
| /api/youtube/videos/:id/plan | POST | Explicitly add one approved video as an owned task; repeated requests reuse the existing task |

Shapes live in lib/types.ts and validation rules in lib/validation.ts. Unknown input fields are rejected. URLs must use HTTP(S). Private responses are no-store.

Application collections: profiles, tasks, records, resources, messages, app_limits, youtube_videos, youtube_search_cache, youtube_video_feedback, youtube_discovery_events, youtube_consents. Better Auth manages user, session, account, verification and rateLimit. Never return the account/session collections to clients. Password hashes are managed by Better Auth in account records.

Resource POST: {title,description,url,stage,stream,minutes}. Server supplies ownership and status. Task POST: {title,notes,minutes}. PATCH: {status:'todo'|'done'}. Journal POST/PATCH: {type,title,description,url}.

Integration tests to run with an actual test database: create two users, create A's task and attempt B's PATCH/DELETE, submit a userId override, attempt a status:'published' override, try cross-origin POST, verify session invalidation on logout, reconnect from a new browser and verify persistence. Run create-indexes before this test.

No mock login or mock storage is included. No future API should trust a userId/email supplied by the browser as identity.

## DISHA mentor extension

The existing `/api/mentor` history and `{message}` POST contract remain supported. Optional POST fields select a topic, language and refresher/continue choice; responses add evidence, cited passages and a pending task proposal. The model cannot write profiles, memories or plans. New owned memory and proposal-confirmation routes, verified-editor knowledge ingestion/review routes, collections and bounded contracts are documented in [DISHA.md](DISHA.md#data-and-api). No imported catalogue resource is automatically treated as approved lesson text.

The initial Gemini conversation now works without an approved corpus when server configuration is present. The response adds `mentor.mode` (`conversation` or `grounded`), `recentProgress` (up to six owned tasks with recorded outcomes/reflections), and safe `providerStatus` values: `used`, `missing_key`, `invalid_configuration`, `rate_limited`, `timed_out`, `unavailable` (legacy `insufficient_knowledge` remains compatible). Conversation replies carry an explicit source-availability notice; UI task approval panels are reserved for the existing grounded flow. Profile evidence passed to the model is capped at ten entries. The question and assistant result are stored in the existing owned `messages` collection, including honest unavailable-service replies. POST retains session identity, Origin checking, strict 2,000-character message validation and five requests/user/minute. No profile, goal or task is changed by POST. No request may supply credentials, a user ID, scores or tool calls.

## Topic checks and resources (additive)

| Route | Methods | Behavior |
| --- | --- | --- |
| /api/topics | GET | Matching topics from published catalogue resources; active check IDs where available |
| /api/topics/checks/:id | GET | Active version's prompts/options only, checked against the saved profile; no keys |
| /api/topics/attempts | GET/POST | Last 20 owned attempts; submit/skip a check and save concept results and up to 3 suggestions |
| /api/topics/attempts/:id | POST/PATCH | Accept one suggested resource as a goal-linked task / save resource feedback |

Attempt POST is exactly `{topicId,skipped:true,language,minutes}` or `{topicId,skipped:false,assessmentId,language,minutes,answers:[{questionId,answer}]}`. Answer values are `a`–`e`; `e` means Not sure. Session minutes are integers 5–120. The server validates exact question membership in the immutable version and derives all results. Keys are returned as explanations only after submission. Server-side version snapshots are not exposed. No userId, scores, supplied explanations or extra fields are accepted.

Acceptance POST is `{resourceId}`. It requires ownership of the attempt, a saved goal and a currently published, profile-matching resource from that attempt's recommendations. One task ID is reserved per attempt; repeated clicks return the same reference. Resource feedback PATCH is `{feeling:'too_easy'|'about_right'|'too_difficult'}` and requires an accepted resource. It does not complete a task. All mutations retain origin checks, session ownership and throttling.

New collections: `topic_assessments`, `topic_attempts`. Existing resources/tasks receive optional catalogue/resource references; old contracts are unchanged. At the operator's updated request, catalogue imports directly publish resources and activate **unvalidated** checks without a review workflow. Existing community submission/editor rules remain intact. See [TOPIC-LEARNING.md](TOPIC-LEARNING.md) for data fields, versioning, routing, idempotency and remaining verification limits.

## YouTube discovery (additive)

See [YOUTUBE-DISCOVERY.md](YOUTUBE-DISCOVERY.md) for pathway rules, filters, review, quotas, refresh, privacy and setup. Search accepts exactly `{subject,topic,language,difficulty,availableMinutes}`; discovery never accepts raw YouTube API parameters or returns pending video metadata to a student. Authenticated users must accept the current YouTube terms/privacy notice before reading or mutating YouTube data; consent can be withdrawn. Only verified `CONTENT_EDITOR_EMAILS` reviewers can access `/api/youtube/review*`. API data is refreshed within 30 days; `npm run youtube:refresh` must be scheduled by the operator. `YOUTUBE_API_KEY` is server-only.

Tasks added from approved videos receive server-created `youtubeVideoRef`, `youtubeVideoId` and `youtubeVideoUrl` fields. The `(userId,youtubeVideoRef)` unique index prevents duplicate video tasks without changing existing task endpoints. Feedback is one document per `(userId,youtubeId)` and is not shared with other students.

## Structured education (additive profile extension)

`Profile.education` is an optional strict object. New clients send all its keys:

```ts
{
  board: string,       // up to 150 characters; school/senior only
  className: string,   // Class 8–10 or Class 11–12 for the chosen stage; Other/Not sure allowed
  program: string,     // degree, diploma, ITI, postgraduate or research program
  discipline: string,  // branch, trade or specialization
  stream: string,      // senior school only; custom combinations allowed
  subjects: string[],  // up to 40 unique, nonempty names of up to 100 characters
  period: string      // year, semester, phase or internship label; up to 100 characters
}
```

Unused keys are empty strings; `subjects` is an array. Board/program/discipline/stream are editable suggestions, not closed enums. Students may use “Other” or “Not sure”; “Not sure” must be the only selected subject when used. No subjects are preselected. Combined/separate subjects and custom subjects are accepted. Lists are interface configuration, never student records or a claim about any individual's curriculum.

- `school`: requires board, class and subjects; no stream, program, discipline or period.
- `senior`: requires board, class, stream and subjects; no degree program, discipline or period.
- `undergraduate`, `vocational`, `postgraduate`: require program, discipline and period. Subjects are optional; no board, class or school stream. Recognized `Year N` / `Semester N` labels are bounded by program suggestions; institution-specific labels remain editable.
- New clients also send existing `level` and `stream` fields: level equals className for school/senior or period otherwise; stream equals the senior stream, higher-education discipline, or empty for Class 8–10. Validation rejects contradictory mirrors, unknown fields and ownership injection.

### Existing records and clients

GET continues to return the stored profile (or null) and verified session user. Existing documents need no bulk migration. The UI copies only known old class/year/stream values into its draft; it does not infer a board, program or subjects. Users review missing fields before saving structured education. Authentication reloads this full profile from MongoDB.

PUT still accepts the original profile shape without `education`. An atomic MongoDB aggregation update preserves an existing education object when the legacy stage/level/stream are unchanged; if a legacy client changes those fields, the now-stale education object is removed. All user strings use `$literal` in the update pipeline. Ownership remains `{userId: session.user.id}`. New client writes validate and persist the entire education object. No user data is stored in localStorage.

Changing stage clears incompatible class/program fields; related school stages retain the board and explicit subjects. Changing a program keeps a branch and period only when they remain valid suggestions for the new program, clearing incompatible subjects with the branch. Changing a board, class or senior stream retains explicitly selected subjects because custom combinations are supported. Choosing the same answer makes no changes.

Automated coverage includes every stage, legacy normalization, serialization, custom subjects, strict validation, dependent resets, preserved selections, and login restoration without overwriting persisted profiles. Live save/logout/login and two-user isolation still require configured MongoDB and authentication environment variables.

## Adaptive progress loop (additive task extension)

The current personal goal remains `profiles.goal`. A task created while that goal is set receives a server-generated `goalRef` (SHA-256 of the authenticated user ID and goal text) and a `goalTitle` snapshot. Existing tasks need no migration. An existing task without these fields receives them when its first feedback is saved. Changing the profile goal leaves old task history intact; the dashboard favors tasks for the current goal.

`POST /api/tasks/:id/feedback` accepts `{outcome:'completed'|'need_help'|'irrelevant',feeling:'easy'|'about_right'|'difficult',reflection:string}`. Reflection is optional and limited to 500 characters. It requires a current or attached personal goal and a `todo` task without prior feedback. The task embeds `feedback` with task and goal references, goal title, outcome, feeling, reflection, a pending proposal (title, notes, minutes, explanation, status), and created/updated timestamps. `completed` sets task status `done`; `need_help` and `irrelevant` use distinct statuses and never count as completed. The proposal is generated by deterministic rules; it is not a saved next task.

`PATCH /api/tasks/:id/proposal` accepts exactly `{decision:'accept'}`, `{decision:'edit',title,notes,minutes}`, or `{decision:'reject'}`. Accept/edit records the chosen `acceptedStep` with its task reference and creates an owned `todo` task. Reject only changes the proposal status. Approval uses a conditional update so concurrent decisions cannot both win; retrying an accepted request repairs an interrupted task insert. All reads and writes include the verified session `userId`; request bodies cannot provide identity, status, references or explanation. Existing `/api/tasks` and `/api/tasks/:id` requests remain valid.

The legacy `PATCH /api/tasks/:id` continues to mark or reopen tasks that have no feedback. Reviewed tasks return 409 for that legacy status change, preserving their recorded outcome and proposal decision.

To verify against a real database: sign in as A, set a goal, add a step, submit feedback, review/edit/accept, sign out and sign back in to see the accepted step. Sign in as B and confirm A's task, feedback and proposal cannot be fetched or changed through either new route. A malformed Origin or injected `userId` must fail. Do this in an authorized test account/database; do not seed student records for demonstrations.

## Profile-based resource filtering

`GET /api/resources` defaults to `view=personalized`; `topicId` optionally restricts to an exact classified topic or parent. It loads the verified session owner’s MongoDB profile and returns `{resources, missingFields, profileIncomplete}`. Profile/identity query overrides are rejected. `view=mine` is scoped to owned submissions; `view=review` requires the existing verified-editor permission. The old broad all-catalogue student view is removed.

Resource PATCH accepts optional bounded `audience`, `active` and `expiresAt` fields alongside its existing status. Audience review identity/date are assigned server-side. Legacy unclassified records remain stored but excluded from personalised results. See [RESOURCE-PERSONALIZATION.md](RESOURCE-PERSONALIZATION.md) for classification, compatibility and manual verification.

## Chapter video resources (additive)

`GET /api/resources` also returns `chapters` for matching saved school profiles. Video resources add allowlisted `video` metadata and approved `chapterMappings`; the editor view includes candidate mappings and their version IDs. Publication now requires an explicit `chapterReview` for resources with chapter mappings: `{versions:string[],notes:string,confirmed:true}` alongside `status:'published'`. Reviewer identity/date and audience classification are server-owned. Plain publishing cannot bypass chapter approval. Withdrawal uses the existing `status:'pending'` operation.

`POST /api/resources/:id/accept` accepts exactly `{minutes:5..120}` for an eligible approved chapter video. It derives the goal/user from the session profile and creates an owned existing-architecture task idempotently per user/resource/goal. Neither link opening nor acceptance completes the task.

`Education` optionally adds `academicSession` (YYYY-YY or empty) and `textbooks:[{subject,title,edition}]` (max 40). Missing values preserve existing-profile compatibility; known values restrict chapter session/book applicability. See [CBSE8-MATH-IMPORT.md](CBSE8-MATH-IMPORT.md) for imports, review permissions, preserved versions and coverage limits.

At the operator’s later request, explicitly imported new videos may instead use `publicationBasis:operator_requested_no_review`, server-stamped `audienceApprovedAt` and supplied approved mapping version IDs. The central eligibility gate permits this explicit basis without fabricating `audienceReviewedAt` or reviewer identity. Normal imports and student submissions remain pending.

## CBSE senior search directories

Resource GET adds optional `directory: {linkType:"youtube_search",sourceFile,sourcePage,academicSession,subject,classLevel}` metadata for the supplied CBSE Class 11/12 searches. Existing fields and mutation contracts remain compatible. Saved session/class/board/enrolled-subject filtering remains server-side. See [CBSE-SENIOR-DIRECTORIES.md](CBSE-SENIOR-DIRECTORIES.md).

## ISC senior search directories

The existing optional resource `directory` metadata now adds optional `board:"CBSE"|"ISC"`; older CBSE records may omit it. `academicSession` may be empty when the PDF does not specify one. Routes and mutation contracts are unchanged. ISC resources support the existing CISCE board selection and explicit ISC/ICSE/CISCE aliases for senior Class 11/12 only. See [ISC-SENIOR-DIRECTORIES.md](ISC-SENIOR-DIRECTORIES.md).
