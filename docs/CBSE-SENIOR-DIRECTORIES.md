# CBSE Class 11/12 supplied search directories

The four supplied PDFs were inspected, including hyperlink annotations. All links are YouTube searches, not direct videos. Only the two CBSE documents are imported for this request; ISC Class 11 (370 links) and ISC Class 12 (383 links) remain excluded.

Source files:
- `CBSE_Class11_2026_27_Master_Video_Directory.pdf`: 625 annotations; 624 valid searches. One malformed `https://.youtube.com/results` URL is retained under `rejectedLinks` and excluded from publication.
- `CBSE_Class12_Master_Board_Resource_Directory_2026_27.pdf`: 833 annotations; 740 unique searches after duplicate removal within each subject.

Extracted data lives in `data/directories/`. Subject attribution follows the positioned subject headers in each PDF and continues across pages. Titles display the actual supplied search query, rather than treating suggested video names as verified video metadata. Source page, file and session are retained. Class 11 contains 13 subjects; Class 12 adds English Core. No external videos or curriculum completeness were independently verified, and no diagnostic questions, video IDs, durations or student records were invented.

Explore groups these resources in expandable subject sections labelled **CBSE video searches**. The existing session-owned profile and central resource gate require CBSE, the exact class and actual enrolled subject. Stream-independent subject eligibility supports custom combinations. A known saved academic session must match 2026-27. English Core and English normalize to English. Search links do not claim task completion, verified teaching quality or approved DISHA lesson text. MongoDB is the source of published resources; there is no client-storage or static-data fallback.

The import publishes new records under `operator_requested_no_review`, with a server timestamp; it preserves existing records and editorial decisions on repeats. Deterministic IDs deduplicate each board/class/subject/search URL. Personalized resource retrieval remains bounded at 2,000 records to accommodate the supplied batch (the previous 300-record bound truncated these directories). Existing API fields remain compatible; `directory` is additive.

Dry run:
```sh
node --env-file=.env.local --import tsx scripts/import-board-directory.ts --file data/directories/cbse-class11-2026-27.json
```
Apply to the privately configured database:
```sh
node --env-file=.env.local --import tsx scripts/import-board-directory.ts --file data/directories/cbse-class11-2026-27.json --apply --database vikas
```
Substitute the Class 12 filename for that batch. No environment contents are logged. No deployment is configured or performed.

Validation: `npm run typecheck`, `npm test` (89 passing tests), and `npm run build` passed. Tests cover both extracted batches, duplicate IDs, malformed URLs, and board/class/subject/session exclusion. Authenticated browser display and live YouTube search availability remain unverified.
