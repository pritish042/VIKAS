# DISHA living companion

The persistent onboarding surface owns the companion. Clicking the character navigates to the existing `/disha` workspace, preserving its authentication, owned conversation history and in-memory draft. APRAJITA's unsaved-file guard is respected. Study setup remains a separate action.

## Local interaction contract

`lib/companion-events.ts` exports typed `notifyCompanion(type, options)` and a centralized deterministic response registry. Optional metadata contains only a source category; `targetY` is an optional viewport coordinate. Do not include student text, server errors, credentials or IDs. Events never call an LLM, write records, or establish success themselves.

Navigation uses the resolved pathname and shared route aliases, not global click interception. Topic checks emit after opening a real check or receiving an actual submission response. Profile, resource feedback, task feedback and lab saves emit only after successful responses. Opening an external learning resource means an attempted opening, never completion. Errors have their own reassuring expression; no success celebration is emitted from error handlers.

Each registry entry specifies text, expression, priority and duration. Routine messages have a 10-second cooldown; the same event has a 20-second deduplication window. Higher-priority messages replace lower-priority messages; lower-priority events cannot replace an active important message. There is one dismissible, polite bubble with finite entrance/exit motion. Events suppressed during typing, fullscreen, hidden tabs, setup or silence are dropped rather than replayed later.

Only mute/minimize appearance preferences are stored locally. Student information stays in the existing MongoDB/Better Auth flow. Sign-out/account-change events clear companion messages and deduplication state.

## Position and motion

The character uses a fixed right rail and transform-based eased vertical movement. Debounced scroll/resize/content changes find space outside visible learning controls, text, media and footer regions. When a full portrait cannot fit, the compact form is used. Mobile uses compact sizing and navigation/visual-viewport clearance. Hover/focus pauses repositioning; viewport resize can still enforce safety. Modals, guide tours and fullscreen suppress the character; typing reduces activity and hides the mobile companion. No cursor-driven vertical chasing occurs.

Head and eye transforms are separate. Pointer input updates CSS variables through requestAnimationFrame rather than pointer-driven React renders. Blink timers check visibility, and reduced motion disables tracking/idle animation. Keep rendered artwork, eye geometry, eyelids and head pivot aligned when replacing the character.

## Verification

Pure tests cover cooldown, deduplication, priority, route aliases and placement bounds/obstacles. Browser checks use a local production build and installed Chrome, with guest navigation only; they do not seed accounts or records. Real authenticated saves and cross-account behavior require existing authorized accounts. No API contracts, database schema, auth implementation or deployment configuration changed.

## Character artwork

The former vector face is replaced by generated transparent artwork, with defined cheekbones, temple contours, a tapered jaw/chin, naturally sized almond eyes, detailed nose/lips, black layered bob and cinematic skin shading. Source, optimized runtime WebP, generation prompt and registration notes are in `public/disha/`. `disha-avatar.tsx` uses separate torso/head masks and registered iris/eyelid layers; it does not rotate the entire portrait to imitate facial tracking. The same component is used in chat, onboarding and tours.

This is a 2.5D cutout rig, not a full 3D model. Head movement is intentionally limited; pronounced expression morphing, lip sync, and individually rigged hair strands would require additional matching artwork or a full rig. Current expression states use subtle head/eye changes and preserve the rendered facial identity.

Final verification (13 November 2026): `npm run typecheck`, `npm test` (183 passing) and `npm run build` passed. Guest Chrome production checks passed for desktop/mobile placement, priority suppression, minimize persistence, reduced motion, gaze/head variables and tutor routing. Authenticated mutations and other browser engines were not exercised.
