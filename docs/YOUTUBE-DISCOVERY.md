# YouTube discovery and review

VIKAS searches the official YouTube Data API v3 only after a signed-in student explicitly selects **Search for reviewed videos**. Routine Explore page loads and approved-video recommendations read MongoDB only; they do not call YouTube. Search uses a bounded educational query derived from the verified student's structured education profile and the student's selected actual subject, topic, preferred language and difficulty. Available time is applied inside VIKAS as a duration filter and is not included in the YouTube query. Student names, email addresses, reflections, biography and raw profile text are never sent to YouTube. There is no LLM dependency for discovery; VIKAS constructs the query itself.

## Supported education pathways

- Class 11–12 Science
- Class 11–12 Commerce
- Class 11–12 Arts/Humanities
- Diploma/Polytechnic by branch and year/semester
- ITI by trade and year

Diploma and ITI are separate pathways from senior secondary streams. Profiles without a structured pathway, an actual subject, or a recognized Diploma/ITI program do not fall back to inferred education. The student selects a preferred language and available minutes at search time because the existing profile contract does not store a preferred video language. Topic-specific assessment results are read only from that authenticated student's own recent attempts; only a generic step-by-step search intent and VIKAS-side recommendation ordering can use those results. Assessment answers, reflections and scores are not sent to YouTube.

## Search, filtering and review

The YouTube `search.list` request is constrained to `type=video`, `safeSearch=strict`, embeddable and syndicated videos, the requested `relevanceLanguage`, region `IN`, relevance order and at most eight results. VIKAS then calls `videos.list` for `snippet`, `contentDetails` and `status`. A candidate must be public, embeddable, a recorded video, have sufficient metadata and a thumbnail, and be between 3 minutes and 3 hours. VIKAS also drops obvious unrelated and promotional results and deduplicates on YouTube ID. These checks are filters, not approval.

Candidates enter the reviewer-only queue with `reviewStatus=pending` and `isActive=false`. Only a verified email listed in `CONTENT_EDITOR_EMAILS` can read or change the queue. Reviewers can inspect the YouTube-sourced title, channel, thumbnail, direct URL, ID, duration, published date and description excerpt alongside VIKAS's search context, then approve, reject, edit the VIKAS subject/topic/difficulty tags, or mark a video inactive. Channel popularity is not a review signal. YouTube metadata is never editable as VIKAS metadata.

Students receive at most three videos whose VIKAS tags match their pathway, actual subject, topic, class/year/semester, branch/trade and board where specified; language must match and duration must fit the selected available time. Recent, authenticated topic-check evidence and the student's prior per-video usefulness/difficulty feedback affect VIKAS ranking and the clearly labelled VIKAS reason. No pending/rejected/inactive or stale (>30-day) video is returned to students. Opening a link does not change task status. A task is created only by **Add to my plan** and is owned by the current Better Auth session; repeated additions reuse the existing owned task.

If there is no suitable approved video, VIKAS offers an explicit search action. The API returns only a candidate count and a review notice to the student, never pending video recommendations. No scraping or fallback provider is used.

## Collections and operational limits

- `youtube_videos`: unique YouTube ID, canonical URL, refreshed YouTube metadata, VIKAS pathway/subject/topic/class-year/board/branch-trade tags, requested difficulty/language, review state and reviewer, discovery context/fingerprint, and fetch/refresh timestamps.
- `youtube_search_cache`: normalized discovery fingerprint and candidate YouTube IDs; cache reuse is 24 hours, with TTL cleanup after 48 hours.
- `youtube_video_feedback`: one current feedback value per authenticated user and video.
- `youtube_discovery_events`: failure category and a one-way discovery fingerprint; no user ID, key, raw IP or raw student query. Events expire after 90 days.
- `youtube_consents`: the authenticated user's acceptance timestamp and current YouTube terms version; a unique user index supports consent withdrawal.
- Existing `tasks`: optional YouTube reference fields. A compound unique index prevents duplicate user/video tasks.

Discovery allows at most three uncached API searches per user per day and twelve per IP per day, with smaller per-minute limits. The IP is hashed before it is used as a rate-limit key. The server has bounded provider timeouts and does not retry quota/provider failures. Rate limits and search caching protect the API quota; they do not guarantee a particular quota allocation. Configure billing/quota alerts in the Google Cloud project as appropriate.

The refresh job rechecks all stored YouTube video metadata in batches of at most 50 IDs. It updates YouTube fields without overwriting VIKAS review tags, deactivates missing/private/unavailable videos, and records a safe refresh failure category without removing previously reviewed tags. Schedule `npm run youtube:refresh` at least daily in the operator's environment; a failed run exits unsuccessfully so the scheduler can report it. Stale metadata is hidden from recommendations until a successful refresh. This repository has no automatic scheduler or deployment.

Run `npm run db:indexes` after configuring MongoDB to create the unique and query indexes. Run refresh only where `.env.local` and server environment variables are securely configured. The command makes real API calls.

## API configuration

1. Create a Google Cloud project and enable **YouTube Data API v3**.
2. Create an API key and, where supported by the deployment, restrict it to the YouTube Data API and known server egress addresses. Review project quota settings.
3. Put it in `.env.local` as `YOUTUBE_API_KEY=...` for local development and in the server's secret environment for production. Never use a `NEXT_PUBLIC_` variable, commit the key, put it in MongoDB, or include it in logs/responses. Restart the server after changing it.
4. Configure verified reviewer accounts through the existing `CONTENT_EDITOR_EMAILS` setting. A reviewer must also have verified their email through Better Auth.
5. Run `npm run db:indexes`. Search with an authorized test profile. Review a pending candidate before checking student recommendations.

Missing and invalid keys, quota exhaustion, timeouts, network failures and malformed provider responses have explicit safe errors. Discovery failure records contain only a category and a one-way query fingerprint.

## YouTube policies and privacy

The initial feature uses external YouTube links, not embedded players. VIKAS does not load an embedded player, autoplay or add custom playback controls. The UI requires and records the signed-in user's explicit acceptance before API-data access; the user can withdraw consent. Displaying YouTube-hosted thumbnails or opening a link may contact YouTube and disclose standard connection data; YouTube may use its own cookies, advertising and privacy controls. The UI links YouTube's Terms of Service and Google's Privacy Policy. VIKAS stores API-returned `status.madeForKids` and `status.selfDeclaredMadeForKids` as true, false or null when exposed. These flags are metadata, not a substitute for age or guardian-consent controls.

The operator must keep the VIKAS privacy notice accurate and review YouTube's current terms and developer policies before launch and when they change. Official references:

- [YouTube Data API `search.list`](https://developers.google.com/youtube/v3/docs/search/list)
- [YouTube Data API video resource](https://developers.google.com/youtube/v3/docs/videos)
- [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- [Guide to complying with YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies-guide)
- [YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service)
- [YouTube Terms of Service](https://www.youtube.com/t/terms)
- [Google Privacy Policy](https://policies.google.com/privacy)

API quotas, Google Cloud verification/restrictions, a live key, authorized reviewer account, actual scheduled refresh, and live public/deleted/private-video behavior require operator verification. No API key is included in this repository.
