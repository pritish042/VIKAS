# CBSE Class 8 Mathematics chapter catalogue

Branch: `feature/cbse8-math-chapter-resources`. The operator subsequently authorised making this supplied batch visible without link/content review. The configured database import was applied; no merge or deployment was performed.

## Attachment findings

The attachment has two arrays, `chapters` and `videos`. It is not the older catalogue/checks format. The original supplied JSON is preserved in `data/chapters/cbse-class8-mathematics-2026-27.json`.

Scope: CBSE, Class 8, Mathematics, academic session 2026–27, stated curriculum NCERT Ganita Prakash 2026–27, stated textbook editions 2026–27. There are 14 ordered chapters, 14 videos and 14 unique YouTube IDs. All 14 videos pass structural/URL/mapping validation; there are zero attachment duplicates and zero rejected records. The read-only database inventory found zero existing matches, 14 proposed inserts and zero conflicting existing IDs in database **vikas**. The later explicit apply inserted 14 chapter definitions and 14 published/active video resources. No student records were created or changed.

| Order | Part | Chapter | Supplied video sequence | Role |
| --- | --- | --- | --- | --- |
| 1 | I | A Square and A Cube | 1 | Explanation |
| 2 | I | Power Play | 1 | Explanation |
| 3 | I | A Story of Numbers | 1 | Explanation |
| 4 | I | Quadrilaterals | 1 | Explanation/overview |
| 5 | I | Number Play | 8 | Explanation, isolated part |
| 6 | I | We Distribute, Yet Things Multiply | 1 | Explanation |
| 7 | I | Proportional Reasoning-1 | 1 | Explanation, part 1 |
| 8 | II | Fractions in Disguise | 10 | Explanation, isolated part |
| 9 | II | The Baudhāyana-Pythagoras Theorem | 1 | Explanation, part 1 |
| 10 | II | Proportional Reasoning-2 | 2 | Explanation, isolated part |
| 11 | II | Exploring Some Geometric Themes | 1 | Worked exercise |
| 12 | II | Tales by Dots and Lines | 1 | Explanation/overview |
| 13 | II | Algebra Play | 1 | Explanation/one-shot |
| 14 | II | Area | 1 | Explanation |

Every chapter is `partial_unverified` with an empty `requiredSubtopics` checklist. All 14 videos are supplied `metadata_only`; language is unverified for all. Nine durations and three channel URLs are null. Existing supplied durations, source URLs, mapping evidence and uncertainty notes are preserved, not independently endorsed. Metadata says chapter 11 is a specific exercise, not a complete lesson sequence; isolated parts in chapters 5, 8 and 10 are especially incomplete.

The shared supplied source `https://ncert.nic.in/textbook.php?gegp1=4-4` opens NCERT's textbook selector. It did not expose a verifiable Class 8 chapter checklist or edition in the available page text. Reviewers must resolve its applicability, obtain/check the actual official contents and examine video availability and fit before publication. No replacement source URL was guessed. No video/transcript was watched, downloaded or re-hosted during this integration. YouTube URL validation is syntax/host/video-ID agreement, not a live availability or teaching-quality endorsement. Full syllabus, subtopic and exercise coverage remain unresolved.

## Import commands

Run from the repository root with the existing server environment. Environment-file contents and credentials are never printed.

Default dry run (validates the file; no database connection or writes):

```sh
node --env-file=.env.local --import tsx scripts/import-catalogue.ts --file data/chapters/cbse-class8-mathematics-2026-27.json
```

Read-only database inventory (no indexes or document writes):

```sh
node --env-file=.env.local --import tsx scripts/import-catalogue.ts --file data/chapters/cbse-class8-mathematics-2026-27.json --inspect-db
```

Explicit apply, only after the operator chooses the target environment and authorises its writes:

```sh
node --env-file=.env.local --import tsx scripts/import-catalogue.ts --file data/chapters/cbse-class8-mathematics-2026-27.json --apply --database vikas
```

The explicit database name must match `MONGODB_DB` (default `vikas`). Database name alone does not identify a production environment; choose the correct `MONGODB_URI` privately before applying. The pending-mode apply command above remains available. At the operator’s later request, this batch was applied with the explicit `--publish-new` flag: 
```sh
node --env-file=.env.local --import tsx scripts/import-catalogue.ts --file data/chapters/cbse-class8-mathematics-2026-27.json --apply --database vikas --publish-new
```

This optional flag publishes only newly inserted videos with `publicationBasis: operator_requested_no_review`, server-stamped `audienceApprovedAt`, and the supplied mapping versions. It never invents a human review or overwrites existing publication decisions. Without this flag new resources remain pending.

Do not use the older `--write` switch for this chapter format; the chapter mode rejects it. The older catalogue importer retains its separate existing policy.

Invalid chapter structure/order/session combinations fail the batch. Invalid video records are reported; the CLI refuses apply until corrected. Chapter references must exist in this supplied checklist. Duplicate video IDs in the attachment merge candidate mappings; multiple existing MongoDB resources for the same video ID block apply rather than choosing one arbitrarily.

## Data and repeat safety

The existing `resources` collection stores videos. A partial unique `youtubeId` index and deterministic new resource IDs prevent repeated insertion; existing YouTube URLs are matched by video ID, including short links. Legacy resources retain their IDs, URLs, titles, status and review decisions. `$setOnInsert` initialises only new videos as `pending`, inactive and not audience-reviewed. `$addToSet` merges research snapshots and versioned chapter mappings without overwriting editor-maintained metadata. Stored chapter definitions use versioned deterministic IDs in `curriculum_chapters`.

Review approval is separate from imported review-depth claims. Each mapping's version hashes its mapping and chapter definition. Newly appended or changed mappings do not inherit previous approval, even when a video is already published. Existing approved versions remain unchanged by import. Repeated imports preserve inactive/withdrawn/published decisions. New unapproved mappings remain in the editor queue. No imported text is executed or rendered as raw HTML.

## Approving videos

1. Configure `CONTENT_EDITOR_EMAILS` server-side for existing reviewer emails. The signed-in reviewer must also have `emailVerified=true`; a normal student cannot grant themselves editor permission. Restart locally after changing environment settings.
2. Run the explicit import only in an authorised environment.
3. Sign in as that verified editor, open **Explore → Review queue**.
4. Open the video's YouTube link and **Review video and chapter applicability**. Check the actual curriculum source, session, edition, sequence and metadata; preserve uncertainty in your notes.
5. Select only chapter mappings you checked, enter review notes, confirm the review statement and choose **Approve selected mappings and publish**.
6. To remove it from student results, choose **Withdraw publication**. Republishing requires explicit mapping approval again.

The existing PATCH route enforces editor verification and rejects publication of a chapter video without `chapterReview: {versions, notes, confirmed:true}`. It checks exact version membership and applies server-side reviewer identity/timestamps, active state and audience classification. General resource publishing remains unchanged. Approval never imports lesson transcripts into DISHA or claims complete coverage.

## Student behaviour

Eligibility is derived from the authenticated session and saved MongoDB profile through the existing central gate. Students need school stage, CBSE, Class 8 and explicitly enrolled Mathematics. Other boards, classes, subjects and pending/inactive videos remain excluded. Optional saved `education.academicSession` and `education.textbooks` restrict session/title/edition where known; unknown values are not guessed. These optional fields are editable under Profile → Optional session and textbook details, then saved with the existing Save profile action. Existing profiles work without them. Students see the resource's stated session/book/edition so they can compare it to their actual textbook.

Explore groups matching chapter definitions by chapter order and approved videos by supplied learning sequence. Unapproved mapping versions never reach student cards. Chapters without approved videos show an honest empty state. Cards display channel, language and duration (or explicit unknown labels), research limits and a canonical YouTube link. Add to my plan requires a saved personal goal and an explicit 5–120-minute session; server validation repeats eligibility and ownership. A deterministic task ID prevents duplicate-click tasks and never overwrites existing task progress. The task uses the existing task/progress architecture. Opening a link never changes status. Ask DISHA opens the existing mentor screen; no transcript ingestion or chapter-specific RAG capability is claimed.

## Verification

Typecheck, the full 86-test suite and production build passed. Focused tests use the isolated in-memory MongoDB double only: attachment/order/URL validation, invalid references and identity injection, repeat/deduplicated imports, legacy URL matching, preserved human decisions, read-only dry runs, pending visibility, exact mapping approvals, reviewer permissions, two-user filtering, class/board/subject/session/book matching, optional-profile compatibility and duplicate task acceptance.

The real read-only database dry run succeeded. The operator explicitly requested and authorised importing/publishing these new candidates without review. Human review and deployment were not performed. Authenticated browser approval, Class 8 profile → video → plan → logout/login persistence, mobile/theme visual checks and live YouTube availability remain unverified. Use existing authorised accounts in an isolated test environment for those manual checks; never seed synthetic production student records.
