# VIKAS redesign route/feature map

| Destination | Canonical route | Existing aliases retained | Main action |
| --- | --- | --- | --- |
| Home | /today | /home | Review next step / set goal |
| Learn | /learn | /explore | Explore lessons |
| Labs | /labs | /aprajita | Run / Preview after existing access checks |
| My Journey | /journey | /plan | Add a step |
| DISHA | /disha | /mentor | Send a message |
| Profile | /profile | unchanged | Review/save profile |
| Setup | /start | /onboarding | Answer next question / confirm save |

Home exposes lessons, chapter directories, topic checks, DISHA, APRAJITA, goals/tasks/reflections, journal and profile setup. Sharing/review queues remain under Learn. Account controls own Profile, theme and Sign out. No Q-SQOOL integration was found in the app, so no new external lab is advertised. The existing process illustration, short-haired DISHA SVG and APRAJITA image are reused; no separate Stitch export assets were found.

## Implemented

- Four shared workspace destinations on a compact desktop sidebar / mobile bottom navigation; aliases continue to resolve without changing API paths. DISHA remains a dedicated chat reached from Home/Learn. Profile, appearance and verified sign-out are in the account menu.
- Home keeps its real goal/next step as the focal action and uses varied Learning, DISHA, Journey and APRAJITA cards. Journal activity opens Journey; no statistics are invented.
- Learn starts with current saved study context, a main Explore lessons link, subject/chapter/resource search, collapsed topic checks and collapsed subject/chapter groups. A search removes unmatched empty chapters. Existing publication/review, applicability and source limitations remain visible.
- Journey includes the existing goal/time, tasks, reflections, actual progress and growth journal. Profile retains education review/save and account privacy information. Setup remains the existing one-question workflow.
- Midnight/slate dark is the first-visit fallback; existing light/dark/system preference is applied by a static head script before body rendering. Light retains linen, maroon, aquamist and sage. Theme preferences are the only theme data in localStorage. Glass has solid fallbacks, an 8px desktop-only blur and no mobile blur.
- Shared DISHA guidance stays mounted across routes, validates a strict tour-only action contract, uses fixed target IDs and routes, respects unsaved lab work, waits up to three seconds for missing targets, clamps desktop placement and avoids the mobile composer/keyboard. Navigation tours make no provider requests or consequential writes. Dismissal is an appearance preference. Escape/Skip/Finish return focus; account changes cancel guidance. On dedicated chat, Guide is in the header and the dock is absent.
- Existing editor, authentication, eligibility/readiness, ownership, persistence and provider APIs are reused. No Q-SQOOL integration or new service configuration was added.

## Changed files

`app/layout.tsx`, `app/globals.css`; `components/vikas-app.tsx`, `landing-page.tsx`, `home-features.tsx`, `account-menu.tsx`, `chapter-resources.tsx`, `disha-guide.tsx`, `disha-onboarding.tsx`, `disha-avatar.tsx`, `mentor-workspace.tsx`, `study-form.tsx`, `aprajita/lab.tsx`; `lib/navigation.ts`, `theme.ts`, `guide-actions.ts`, `chapter-presentation.ts`; `tests/navigation.test.ts`, `redesign.test.ts`; this document.

The branch also carries the previously requested presentation motion work in `components/motion-presence.tsx`, `components/motion-progress.tsx`, `tests/motion.test.ts` and `docs/MOTION.md`. The supplied untracked `public/image/` folder is untouched.

## Verification and limits

32 targeted checks passed across navigation, strict guide validation/viewport placement (including the mobile composer and missing-target positioning), first-paint theme/storage failure, chapter filtering/session separation, profile refresh/account switching, auth, onboarding and presentation motion. `npm run typecheck` and `npm run build` passed. These are unit/static checks; they do not claim live account-switch or authenticated browser coverage.

A bounded native Safari check was attempted against local Home but concurrent browser activity changed the address before the local page was reached. Desktop/mobile visual layout, dark/light/reduced-motion rendering, overlay focus, live target waiting/missing-target fallback and authenticated navigation/profile persistence remain unverified in the browser. The code has no new animation library; blur is limited and decorative movement is finite, but device performance was not measured. No push, merge or deployment.
