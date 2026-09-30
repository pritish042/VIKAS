# API contract for the backend team

Next.js Node route handlers under app/api. All private calls use Better Auth session cookies (HttpOnly). JSON mutations must carry the matching browser Origin. Ownership comes from the session, never an incoming userId. No browser connects directly to MongoDB.

| Route | Methods | Behavior |
| --- | --- | --- |
| /api/status | GET | Accounts/email/mentor capability availability; no secrets |
| /api/auth/* | GET/POST | Better Auth endpoints, including sign-up/email, sign-in/email, sign-out, get-session |
| /api/profile | GET/PUT | Current student's profile; full validated profile on PUT |
| /api/tasks | GET/POST | Private task list/create |
| /api/tasks/:id | PATCH/DELETE | Set todo/done, or delete owned task |
| /api/records | GET/POST | Private journal list/create |
| /api/records/:id | PATCH/DELETE | Update/delete owned entry |
| /api/resources | GET/POST | Published resources and owned submissions; editors see pending queue |
| /api/resources/:id | PATCH/DELETE | Verified editors publish/unpublish; owner or editor can delete |
| /api/mentor | GET/POST/DELETE | Current user's history, optional real response, clear history |

Shapes live in lib/types.ts and validation rules in lib/validation.ts. Unknown input fields are rejected. URLs must use HTTP(S). Private responses are no-store.

Application collections: profiles, tasks, records, resources, messages, app_limits. Better Auth manages user, session, account, verification and rateLimit. Never return the account/session collections to clients. Password hashes are managed by Better Auth in account records.

Resource POST: {title,description,url,stage,stream,minutes}. Server supplies ownership and status. Task POST: {title,notes,minutes}. PATCH: {status:'todo'|'done'}. Journal POST/PATCH: {type,title,description,url}.

Integration tests to run with an actual test database: create two users, create A's task and attempt B's PATCH/DELETE, submit a userId override, attempt a status:'published' override, try cross-origin POST, verify session invalidation on logout, reconnect from a new browser and verify persistence. Run create-indexes before this test.

No mock login or mock storage is included. No future API should trust a userId/email supplied by the browser as identity.

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
