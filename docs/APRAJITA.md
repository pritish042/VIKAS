# APRAJITA Code Lab

Open `/aprajita` from the workspace sidebar or mobile drawer. CodeMirror and its language modes load only when an eligible student opens the editor. C, Python, HTML and Java have starter templates. Reset replaces the editor with a starter; only explicit Save persists a file. Saved files are keyed by account, language and filename; opening the lab restores the most recently saved file. Changing filenames saves another file. Up to 20 files per account, 6,000 source characters per file. Unsaved edits are held in memory, with discard prompts for file/language/reset and a browser-unload warning; workspace navigation asks before leaving with unsaved edits.

## Access and storage

Existing Better Auth sessions and MongoDB are required. B.Tech/B.E. qualifies across all branches. School/senior students need a saved class from 8–12, board and an actual computing subject. CS, CA, IT, ICT, AI, IP and full names/custom computing equivalents are recognized; streams never imply enrollment. Update Profile to fix incomplete or unavailable access. Every status, readiness, files and run request reads the verified user's current saved profile. Removing computing eligibility revokes access without deleting files.

School students pass five basic questions with at least three correct. The questions and explanations were reviewed for internal consistency during implementation; this is not an externally validated assessment. Failure displays explanations and permits unlimited retries (30 submissions/minute safety limit). A pass is stored by account and `aprajita-basics-v1`; changing this version requires a new pass. A failed practice attempt cannot revoke an existing pass. No browser storage fallback is used.

MongoDB collections: `aprajita_files` (userId-scoped documents, deterministic account/language/name IDs), `aprajita_readiness` (account ID, version, score, pass timestamp), existing `app_limits` (per-account throttles). Run `npm run db:indexes` for the files listing index and existing TTL throttle index; the implementation does not seed data.

## Execution configuration

HTML previews need no runner. The sandboxed `srcdoc` iframe has no script or same-origin permission, so cannot access app cookies/storage. Preview sanitization removes active content, navigation attributes and external resources; an injected CSP blocks network connections, scripts, forms and frames. Only HTML, inline CSS and embedded raster data images are supported.

The default is zero-budget browser Python and sandboxed HTML. External execution is disabled unless the operator explicitly selects a provider with `APRAJITA_EXECUTION_PROVIDER`. Optional services are **JDoodle Compiler API** and **Judge0 CE**. The adapter creates a base64 submission with `wait=false`, then polls that submission at the same service until it finishes or the shared 12-second deadline expires. Synchronous results are no longer required. See [Judge0 API](https://ce.judge0.com/) and the [official configuration](https://github.com/judge0/judge0/blob/master/judge0.conf).

### Free browser Python

Python defaults to Pyodide **314.0.7**, downloaded from a pinned jsDelivr path only when Run is selected. No execution API key is needed, and Python code/stdin are not sent to an execution provider. The browser rechecks the verified APRAJITA status before each Run; MongoDB saves and all eligibility/readiness checks remain unchanged.

The controller creates a sandboxed iframe with `allow-scripts` and **without** `allow-same-origin`; a worker owned by that opaque-origin frame imports the Pyodide ES module dynamically. This keeps code away from the app DOM, cookies and storage. A MessageChannel carries only source/input, output and lifecycle events. The frame CSP permits the pinned runtime CDN path and blocks app/other network destinations. After initialization, common fetch/socket/nested-worker globals are disabled as defense in depth. This is network restriction, not a claim that every JS bridge or resource-abuse technique is impossible; the CDN path remains permitted for runtime modules. The app never sends credentials to the frame or worker.

A loading indicator and Stop are available while loading or running. A 45-second loading deadline, 10-second execution deadline and combined 16KB output limit are enforced from the parent page, so even an infinite Python loop cannot prevent termination. Stop, timeout, completion and leaving the lab dispose the frame/worker; the next Run gets fresh interpreter state. Browser cache may retain public runtime downloads, but programs and stdin are not stored there by VIKAS. This does not enforce a hard browser heap limit: very large allocations can still stress a device.

Standard-library examples and optional prefilled stdin are supported. No pip/micropip installation, automatic package loading, sockets, host files, GUI windows or interactive prompts are provided. The initial download requires internet access and can take time on mobile networks; failed downloads show an unavailable result. See [Pyodide workers](https://pyodide.org/en/stable/usage/webworker.html) and [standard streams](https://pyodide.org/en/stable/usage/streams.html).

C/Java still edit and save normally; their Run buttons show an honest execution-not-configured notice until an external provider is explicitly configured. HTML retains a scriptless sandbox and network-blocking CSP. Its sanitizer now uses an inert template so untrusted image/frame URLs do not fetch before sanitization.

### Optional JDoodle free Compiler API

No account or plan subscription is created automatically. Sign in to your own JDoodle account, open **Compiler API**, and use the Free API plan only. If the dashboard asks you to activate a plan, select Free yourself; do not select a paid tier or add paid internet/multifile/WebSocket features. Copy the real Client ID and Client secret privately from its API dashboard. Platform/IDE account allowances differ from API allowances.

Add to ignored `.env.local`, or the corresponding server-only Vercel environment scopes:

```dotenv
APRAJITA_EXECUTION_PROVIDER=jdoodle
JDOODLE_CLIENT_ID=<your-real-client-id>
JDOODLE_CLIENT_SECRET=<your-real-client-secret>
JDOODLE_DAILY_LIMIT=20
```

Restart local Next.js after changing variables. In Vercel mark the client secret sensitive and redeploy only when separately authorized. Never use `NEXT_PUBLIC_` variables, browser headers, or a Bearer token for these credentials. `APRAJITA_EXECUTION_URL/TOKEN` are unused by JDoodle. To return to browser-only mode, set `APRAJITA_EXECUTION_PROVIDER=none` (the default).

The adapter uses the official HTTPS REST endpoint `https://api.jdoodle.com/v1/execute`, with credentials in the request body, source as `script` and optional stdin. C, Python and Java are pinned to version indices 7, 6 and 6 respectively. The authenticated app API accepts only language/source/stdin, keeps the three-runs/account/minute gate, and caps the total provider deadline at 12 seconds, provider response at 64KB and displayed output at 16KB. Execution happens at JDoodle, never in Next.js/Vercel. JDoodle controls its sandbox runtime/memory limits; REST does not expose the Judge0 per-run limit parameters, so VIKAS does not claim to enforce them there.

The current [Free API allowance](https://www.jdoodle.com/docs/api/credits) is **20 executions/day**, shared by the provider account, resetting at **23:55 UTC**. VIKAS atomically reserves an attempt in `aprajita_execution_quota` before any provider call. Its unique counter key includes the account ID hash and provider reset period; all users/instances using that MongoDB share the same cap. The counter survives restarts. `JDOODLE_DAILY_LIMIT` may lower the cap (1–20), never raise it. Missing/invalid quota configuration fails closed. Only server credentials select the account; students cannot supply IDs or reset quota.

Each run also checks the provider's free `credit-spent` endpoint to catch executions outside this app. Unknown usage prevents submission. Credits consumed elsewhere can reduce availability further. Provider/local exhaustion returns 429, explaining the reset and retaining browser Python/editing/saving. Provider 429 closes the local day to avoid repeated execution attempts. Failed or timed-out reservations are not refunded because the provider may have run the code; the conservative app allowance can therefore be lower than remaining provider credits. No automatic retry, provider fallback, subscription or paid overage action is performed. Dedicate the same credentials and MongoDB quota collection across app environments if they share the provider account.

JDoodle's documented `statusCode=200` means the request completed, **not** that the program compiled or succeeded. Its REST `output` can contain stdout, compiler diagnostics or timeout text. APRAJITA displays it as **Provider output (stdout / errors combined)** and does not invent separated stderr or a successful-program status. `diagnosticsCombined=true` makes this limitation explicit; the initial response fields remain present. See [official REST reference](https://www.jdoodle.com/docs/api/rest), [errors](https://www.jdoodle.com/docs/api/errors) and [language indices](https://www.jdoodle.com/docs/api/languages).

Python keeps Browser Python selected by default even with JDoodle configured. Students can explicitly choose the server option; the interface explains that code/stdin leave the browser and consume the shared allowance. C/Java use the selected server provider when configured.

### Targeted verification

Run `node --import tsx --test tests/aprajita-jdoodle.test.ts tests/aprajita-runner.test.ts` for mocked provider/limits/quota checks. Run `npx playwright install chromium` once, then `npx playwright test --config playwright.aprajita.config.ts` for real browser Python stdin/stdout/stderr, infinite-loop Stop/restart, execution timeout and HTML isolation. These browser tests serve the actual modules in a local harness, use public Pyodide downloads only, and never create student accounts or consume JDoodle/Judge0 credits. Then run typecheck/build. Full authenticated UI acceptance still needs an existing authorized student account.

### Optional Judge0: provision a separate runner

Provision a dedicated Linux VM or a managed direct Judge0 CE endpoint. The runner must not share the VIKAS/Vercel process or have access to app/database credentials. No VM, provider subscription or credentials are provisioned by this repository. RapidAPI gateway credentials (`X-RapidAPI-Key`) are **not** supported by this direct `X-Auth-Token` adapter. The public documentation/demo URL is not the production runner.

For a self-hosted service, use a supported, security-patched Judge0 CE release. The current [official CE release procedure](https://github.com/judge0/judge0/releases/tag/v1.13.1) is for v1.13.1 on Linux with Docker Compose; follow its host/cgroup prerequisites. Download its release archive on the runner VM, extract it, and edit `judge0.conf` before starting. Generate different strong secrets locally for `AUTHN_TOKEN`, `REDIS_PASSWORD` and `POSTGRES_PASSWORD`; never commit the completed configuration. Preserve required bundled settings and add:

```ini
AUTHN_HEADER=X-Auth-Token
AUTHN_TOKEN=<private-runner-token>
REDIS_PASSWORD=<separate-redis-password>
POSTGRES_PASSWORD=<separate-postgres-password>
ENABLE_WAIT_RESULT=false
ENABLE_COMPILER_OPTIONS=false
ENABLE_COMMAND_LINE_ARGUMENTS=false
ENABLE_CALLBACKS=false
ENABLE_ADDITIONAL_FILES=false
ENABLE_SUBMISSION_DELETE=false
ALLOW_ENABLE_NETWORK=false
ENABLE_NETWORK=false
CPU_TIME_LIMIT=2
MAX_CPU_TIME_LIMIT=2
CPU_EXTRA_TIME=0.5
MAX_CPU_EXTRA_TIME=0.5
WALL_TIME_LIMIT=5
MAX_WALL_TIME_LIMIT=5
MEMORY_LIMIT=256000
MAX_MEMORY_LIMIT=256000
MAX_PROCESSES_AND_OR_THREADS=64
MAX_MAX_PROCESSES_AND_OR_THREADS=64
ENABLE_PER_PROCESS_AND_THREAD_TIME_LIMIT=false
ALLOW_ENABLE_PER_PROCESS_AND_THREAD_TIME_LIMIT=false
ENABLE_PER_PROCESS_AND_THREAD_MEMORY_LIMIT=false
ALLOW_ENABLE_PER_PROCESS_AND_THREAD_MEMORY_LIMIT=false
MAX_FILE_SIZE=16
MAX_MAX_FILE_SIZE=16
NUMBER_OF_RUNS=1
MAX_NUMBER_OF_RUNS=1
```

Start bundled PostgreSQL/Redis first, wait for them to be healthy, then start the API and workers (`docker compose up -d db redis`, then `docker compose up -d`). Keep PostgreSQL/Redis private. Bind the published API port to loopback (`127.0.0.1:2358:2358`) rather than exposing port 2358 publicly. Put an HTTPS reverse proxy in front of it, with a valid certificate and no redirects on the configured base URL. For example, a Caddy site on the same VM:

```caddyfile
runner.your-domain.example {
    reverse_proxy 127.0.0.1:2358
}
```

Point a domain you control to the VM, allow HTTPS, and set the URL below to that origin. Configure the runner's infrastructure to block submission network egress as well as the Judge0 settings. Maintain runner patches, queue capacity, isolation and submission retention. Do not mount VIKAS files, credentials or host home directories into workers. Check `/languages` with the authentication header: this adapter requires **C=50, Python=71, Java=62**; a different language catalog requires an explicit adapter mapping change. Java must define `public class Main`.

### Local VIKAS configuration

Add to the ignored `.env.local`:

```dotenv
APRAJITA_EXECUTION_URL=https://runner.your-domain.example
APRAJITA_EXECUTION_TOKEN=<same-private-token-as-AUTHN_TOKEN>
```

For direct Judge0 also set `APRAJITA_EXECUTION_PROVIDER=judge0`; credentials alone never enable external calls. The URL is the HTTPS base URL, not `/submissions`; it may include a reverse-proxy base path, but must not contain credentials, query parameters or a fragment. HTTP endpoints are rejected even for local development: local VIKAS can use the remote HTTPS runner. Keep the existing MongoDB and Better Auth configuration, and set `BETTER_AUTH_URL` to your exact local app origin so authenticated mutation origin checks pass. Restart `npm run dev` after updating variables. Run `npm run db:indexes` if the existing account-rate-limit index has not been created.

### Vercel configuration

In the existing VIKAS project's **Settings → Environment Variables**, add `APRAJITA_EXECUTION_URL` and `APRAJITA_EXECUTION_TOKEN` to the intended Production/Preview/Development scopes. Mark the token sensitive and never use a `NEXT_PUBLIC_` prefix. Preserve existing MongoDB/Better Auth values; Production `BETTER_AUTH_URL` must match the app's production origin. Use a separate restricted runner/token for preview environments if appropriate. Select the provider explicitly in Vercel with `APRAJITA_EXECUTION_PROVIDER`; a new deployment is required for updated variables to take effect; this implementation task does not deploy. The `/api/aprajita/run` route uses Node.js only to make HTTPS requests, with a 20-second route duration and a stricter 12-second runner deadline. It never invokes a compiler or interpreter in Vercel. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

### Verification and failure behavior

For an explicitly authorized future Judge0 verification, run **`npm run aprajita:verify -- --allow-external-execution`** locally (Node 22.12+). It submits one tiny real C, Python and Java program to the configured runner, each reading `42` from stdin and returning it on stdout. PASS is reported only for a completed successful result with the expected output and no errors/truncation. Missing settings explicitly report SKIPPED; provider or language/limit failures exit unsuccessfully. It does not create app users or run compilers locally. Then sign in as an eligible existing student and test Run in `/aprajita` to also verify the session/readiness/rate-limit boundary.

Run accepts `{language, source, stdin?}`; compiler options, callbacks, network flags and arbitrary provider parameters are rejected. The server enforces three runs/account/minute, 2-second CPU / 5-second wall execution limits, 256000KB memory, 16KB generated files and at most 64 processes/threads. The response is bounded to 64KB per provider request, with 16KB combined decoded stdout/compiler/stderr. The 12-second deadline covers submission, queueing, polling and body reads; queue time can cause an app timeout even before a program starts. A timed-out submission may still finish on the isolated runner, subject to its own limits; VIKAS never presents it as successful.

Responses retain the initial `output`/`error` fields and add `statusId`, `success`, `stdout`, `stderr` and `compilationErrors`. Failed programs return their real terminal status and diagnostics; the UI labels each channel separately and clears previous output when starting a run. HTTP/API/auth/queue failures return a safe unavailable notice; malformed results are rejected. Missing configuration preserves editing/saving and shows a setup notice. Credentials, internal service messages and submission tokens are not returned to the browser. No successful output is synthesized.

## API and extension points

- `GET /api/aprajita`: current access, public readiness questions and execution configuration boolean.
- `POST /api/aprajita/readiness`: `{version, answers}`; five a/b/c/d choices, reviewed score/explanations.
- `GET /api/aprajita/files`: current user's files, eligibility/readiness required.
- `POST /api/aprajita/files`: `{language, name, source}`; explicit authenticated save.
- `POST /api/aprajita/run`: `{language, source, stdin?}`; C/Python/Java only, eligibility/readiness required.

All mutations reuse existing same-origin checks, strict request validation and account throttles. Access, assessment, persistence, execution and preview have separate modules in `lib/aprajita/`; UI is under `components/aprajita/`. Future AI guidance and Q-SQOOL can use these contracts without mixing credentials or execution into the editor. Neither integration is implemented yet.
