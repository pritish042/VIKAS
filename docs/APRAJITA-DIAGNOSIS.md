# APRAJITA production 503 diagnosis — 2026-10-08

## Finding and evidence

Production/main was verified at commit `b453954f5233a3c503e678656eddc4983ead64f5`. That revision of `app/api/aprajita/run/route.ts` always calls Judge0 through `runnerConfig()` in `lib/aprajita/api.ts`. It reads only `APRAJITA_EXECUTION_URL` and `APRAJITA_EXECUTION_TOKEN`; it does not support JDoodle or read `APRAJITA_EXECUTION_PROVIDER`/`JDOODLE_*`. The JDoodle implementation is present in the local working tree but has not been published.

The supplied production invocation traces identify deployment `dpl_Ckwq86bef8zPBsKLDN5taFyVTXrx`, main, Production, and no outgoing requests for both failing POSTs. This supports a failure before contacting an execution service, most likely the deployed Judge0 configuration check. It rules against an upstream execution failure for these invocations, but does not identify the precise branch: the JSON response and function error messages were not supplied. Database/authentication failures can also occur before a provider request.

Locally, the selected provider is JDoodle and both credentials are present. A single real, non-execution `/v1/credit-spent` request accepted those credentials and returned valid usage below the free daily allowance. No student program was submitted. This verifies the local credentials only; it does not verify Vercel credentials or their environment scope.

## Smallest fix

Publish the existing JDoodle implementation, then deploy that new revision with these variables assigned to **Vercel Production**:

| Variable | Value/requirement |
| --- | --- |
| `APRAJITA_EXECUTION_PROVIDER` | `jdoodle` |
| `JDOODLE_CLIENT_ID` | Actual private Compiler API client ID |
| `JDOODLE_CLIENT_SECRET` | Actual private Compiler API client secret |
| `JDOODLE_DAILY_LIMIT` | `20`, or a lower integer from 1 through 20; defaults to 20 |

A redeployment of the old commit will still ignore these variables. `.env.local` does not configure Vercel. Never put JDoodle credentials into the Judge0 token variable or a `NEXT_PUBLIC_*` variable. No push or deployment was performed during this diagnosis.

The current JDoodle adapter posts JSON to `https://api.jdoodle.com/v1/execute` with `clientId`, `clientSecret`, `script`, `stdin`, `language`, and `versionIndex`; credentials are not Bearer tokens. It first checks `/v1/credit-spent`, reserves an app-wide MongoDB daily allowance atomically, and preserves reservations on uncertain failures. Exhaustion returns 429, not successful output. See `lib/aprajita/jdoodle.ts` and `docs/APRAJITA.md` for limits and setup.

## Every 503 path

### Shared route infrastructure — deployed and local

- `lib/api.ts:identity`: missing account/database/auth configuration returns 503, “Accounts are not available yet.”
- `lib/api.ts:failure`: unexpected exceptions from session lookup, MongoDB rate limiting, access/profile/readiness lookup, or other route operations return generic 503. Its safe log contains the exception name, not credentials.

Successful lab/file requests make a global account configuration failure less likely, but do not rule out a transient database failure on a later POST.

### Deployed Judge0-only revision

`lib/aprajita/execution.ts` at the production revision returns 503 for:

- Invalid/missing HTTPS runner URL or missing token, before any outgoing request.
- Any non-success upstream HTTP response, including rejected authentication or upstream rate limiting.
- A response without a readable body.
- Missing/invalid/non-final execution status, including queued/running results: this revision requires synchronous Judge0 results.
- Unexpected network/response-processing exceptions.

Its deadline returns 504; oversized/invalid JSON/output returns 502. Origin/access rejection returns 403, missing login 401, local rate limiting 429, and invalid input 400/413. These do not explain a 503.

### Current local implementation

- `lib/aprajita/provider-config.ts:assertExecutionConfiguration`: unset, disabled, or invalid provider; missing JDoodle credentials; invalid JDoodle daily limit; missing Judge0 URL/token; invalid Judge0 HTTPS URL. Responses now include specific safe codes and missing variable names, never their values.
- `lib/aprajita/jdoodle.ts`: direct adapter configuration failure; invalid quota configuration; upstream authentication rejection (401/403); other non-success HTTP responses except 429; an execution response reporting rejection; unexpected network/processing exceptions. Authentication, HTTP, rejection and network errors now have distinct safe codes.
- `lib/aprajita/execution.ts`: invalid direct adapter configuration, upstream non-success HTTP response, or unexpected network/processing exception. Upstream Judge0 429 is currently translated to 503 with a service-busy explanation. Unlike the old deployment, missing/invalid results return 502 and async polling expiration returns 504.
- `app/api/aprajita/run/route.ts`: defensive unconfigured-provider fallback; configuration assertion currently rejects before this fallback.
- Unexpected MongoDB exceptions can still reach the shared generic failure handler, including a failure while marking provider credits exhausted.

`lib/aprajita/api.ts:labFailure` logs only diagnostic code and status for coded errors. It returns that code alongside the safe error message for production troubleshooting after deployment.

## Verification and limitations

Typecheck and seven targeted configuration/JDoodle tests passed. Production build passed. Tests cover missing/invalid configuration, request formatting, shared atomic quota, exhaustion, failed authentication/services, output limits and deadlines.

Blocked: direct inspection of Vercel Production variable scopes and runtime error messages requires Vercel access that is not available in this workspace. The supplied traces confirm the deployment environment is Production, but do not confirm variable scope. The authenticated failing response body also remains unavailable. No paid subscription, execution request, push or deployment was performed.
