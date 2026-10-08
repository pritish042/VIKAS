# APRAJITA Code Lab

Open `/aprajita` from the workspace sidebar or mobile drawer. CodeMirror and its language modes load only when an eligible student opens the editor. C, Python, HTML and Java have starter templates. Reset replaces the editor with a starter; only explicit Save persists a file. Saved files are keyed by account, language and filename; opening the lab restores the most recently saved file. Changing filenames saves another file. Up to 20 files per account, 6,000 source characters per file. Unsaved edits are held in memory, with discard prompts for file/language/reset and a browser-unload warning; workspace navigation asks before leaving with unsaved edits.

## Access and storage

Existing Better Auth sessions and MongoDB are required. B.Tech/B.E. qualifies across all branches. School/senior students need a saved class from 8–12, board and an actual computing subject. CS, CA, IT, ICT, AI, IP and full names/custom computing equivalents are recognized; streams never imply enrollment. Update Profile to fix incomplete or unavailable access. Every status, readiness, files and run request reads the verified user's current saved profile. Removing computing eligibility revokes access without deleting files.

School students pass five basic questions with at least three correct. The questions and explanations were reviewed for internal consistency during implementation; this is not an externally validated assessment. Failure displays explanations and permits unlimited retries (30 submissions/minute safety limit). A pass is stored by account and `aprajita-basics-v1`; changing this version requires a new pass. A failed practice attempt cannot revoke an existing pass. No browser storage fallback is used.

MongoDB collections: `aprajita_files` (userId-scoped documents, deterministic account/language/name IDs), `aprajita_readiness` (account ID, version, score, pass timestamp), existing `app_limits` (per-account throttles). Run `npm run db:indexes` for the files listing index and existing TTL throttle index; the implementation does not seed data.

## Execution configuration

HTML previews need no runner. The sandboxed `srcdoc` iframe has no script or same-origin permission, so cannot access app cookies/storage. Preview sanitization removes active content, navigation attributes and external resources; an injected CSP blocks network connections, scripts, forms and frames. Only HTML, inline CSS and embedded raster data images are supported.

Set **server-only** `APRAJITA_EXECUTION_URL` (HTTPS base URL) and `APRAJITA_EXECUTION_TOKEN` for an operator-managed, isolated [Judge0 CE-compatible service](https://ce.judge0.com/). It must support authenticated `X-Auth-Token` submissions, base64 input/output, synchronous `wait=true`, and language IDs C=50, Python=71, Java=62. Configure the runner's deployment isolation, outbound network prohibition and hard resource ceilings independently; VIKAS sends network=false, CPU=2s, wall=5s, memory=256000KB, file=16KB and process/thread=64 limits. Next.js only forwards requests; it never starts student processes. Java source must define `public class Main`.

VIKAS applies three runs/account/minute, a 12s provider deadline, 64KB response cap and combined 16KB decoded output cap. Credentials and provider internal messages are never returned to clients. An absent/invalid configuration leaves editing and saving available and shows an honest notice; provider failures do not synthesize output. Production execution requires independently verifying the chosen runner's isolation and supported limits. No runner is provisioned by this change.

## API and extension points

- `GET /api/aprajita`: current access, public readiness questions and execution configuration boolean.
- `POST /api/aprajita/readiness`: `{version, answers}`; five a/b/c/d choices, reviewed score/explanations.
- `GET /api/aprajita/files`: current user's files, eligibility/readiness required.
- `POST /api/aprajita/files`: `{language, name, source}`; explicit authenticated save.
- `POST /api/aprajita/run`: `{language, source, stdin?}`; C/Python/Java only, eligibility/readiness required.

All mutations reuse existing same-origin checks, strict request validation and account throttles. Access, assessment, persistence, execution and preview have separate modules in `lib/aprajita/`; UI is under `components/aprajita/`. Future AI guidance and Q-SQOOL can use these contracts without mixing credentials or execution into the editor. Neither integration is implemented yet.
