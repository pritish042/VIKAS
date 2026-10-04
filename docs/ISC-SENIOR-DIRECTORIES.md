# ISC Class 11/12 supplied search directories

The operator requested extending the earlier CBSE integration with both supplied ISC PDFs. PDF hyperlink annotations and positioned subject headers were extracted as data; document instructions were not executed.

- `ISC_Class11_Master_Video_Directory.pdf`: 370 annotations and 370 unique YouTube searches, covering 13 subjects.
- `ISC_Class12_Master_Board_Resource_Directory.pdf`: 383 annotations and 360 unique searches within subjects, covering 15 subject components, including separate English Language and English Literature.

Neither PDF states an academic session. `academicSession` is therefore empty and the UI shows it as unspecified; a saved student session does not exclude resources whose source session is unknown. Source file and page are retained. Titles use the supplied search query. Individual videos, curriculum completeness and availability remain unverified. No direct-video IDs, durations, assessment questions or student records were fabricated.

Extracted inputs: `data/directories/isc-class11.json` and `isc-class12.json`. They share the validated, idempotent MongoDB importer with CBSE. New records are published at the operator's request under the existing honest unreviewed publication basis. Repeat imports retain existing status and metadata.

Audience eligibility requires senior school, exact Class 11/12 and an actual enrolled subject. The ISC audiences explicitly support the board labels `ISC`, `ICSE`, `CISCE`, and the site's existing `CISCE / ICSE / ISC` option only for these senior classes. CBSE remains isolated. English Language and Literature require their specific enrolled component; a general English selection allows both. The profile's CISCE senior subject suggestions now include those English components and History. No Class 10 ICSE content was supplied or imported.

Explore derives its board/class/session headings from each directory. Older CBSE records without the new optional `directory.board` field remain compatible. Directory board/class filtering now runs in MongoDB before the 2,000-record limit, preventing other directories from crowding out a student's results. Existing non-directory resources still pass through the central eligibility gate. Private queries remain scoped to the verified session user's saved profile.

Dry run:
```sh
node --env-file=.env.local --import tsx scripts/import-board-directory.ts --file data/directories/isc-class11.json
```
Import to the configured database:
```sh
node --env-file=.env.local --import tsx scripts/import-board-directory.ts --file data/directories/isc-class11.json --apply --database vikas
```
Substitute `isc-class12.json` for Class 12. The environment remains private; no credentials are logged or bundled.

Validation: typecheck, all 93 tests, and production build passed. Coverage includes alias/board/class/subject/session filtering, English component separation, MongoDB query selection, older CBSE metadata compatibility and preservation of withdrawal decisions on repeat imports. Live authenticated browser journeys and external video content remain unverified.
