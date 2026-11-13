# Neural Cosmos / Neural Dawn landing motion

The existing VIKAS routes, content, anatomical asset, authentication and DISHA tutor remain. This revision is scoped to landing atmosphere, interaction, motion and theme adaptation.

## Unified motion

`lib/landing-motion.ts` supplies shared control (180ms), section (480ms), hero (640ms), theme (500ms), easing and damping values. The server-rendered landing root receives CSS variables from those constants, so CSS entrances start without waiting for hydration or the model. `app/landing-motion.css` consolidates the landing presentation after the existing application styles; superseded parent-headline/mount-time section entrances were removed from globals.

Hero lines have 0/70/140ms offsets and settle by 780ms. Supporting text, CTAs and the note settle by 800ms; the brain frame settles by 820ms. All initial opacity keyframes start at 0.76 or above, and the rest of the content is always visible. No overlay, splash, artificial loading wait, letter bouncing or layout-affecting entrance is used. Lower sections receive one short entrance when observed, then are unobserved; there is no scrolling/pinning controller.

## Art direction and theme continuity

Dark Cosmos uses midnight violet, subdued blue/violet lighting, warm ivory, faint grids and restrained luminous edges. Light Dawn uses warm ivory/pearl surfaces, aquamist/sage illumination, burgundy controls and delicate lavender. These landing tokens are scoped so unrelated application pages retain their existing styling.

Both gradient environments are present in the initial DOM and crossfade with opacity. Base surfaces, text, controls and borders transition over 500ms. The original persisted/system theme bootstrap still selects the initial environment before paint. Theme switching does not replace the root, canvas or anatomical model.

The Three.js scene observes only `html[data-theme]` and blends physical material color/roughness/metalness/clearcoat/iridescence, exposure, ambient/rim/key/fill lighting, network colors and pulse colors. Changes start from the current interpolated state, so rapid switching stays continuous. Geometry, camera interaction, elapsed animation and GLB request remain intact. Reduced motion applies the target immediately.

## Atmosphere and neural pulses

`LandingAtmosphere` damps fine-pointer illumination, sets bounded scroll progress for decorative drift, and manages hero/page visibility. CSS radial gradients move via small transforms without large animated blur filters. The hero field pauses offscreen/in hidden documents. Pointer work sleeps when settled and is disabled for touch/reduced motion. Scroll remains native and readable.

Up to three thin pulse paths follow connected triangle edges of actual cortical surfaces. They retain anatomical depth testing and low-opacity moving highlights, with no particles or proxy-sphere paths. A 5Hz energy signal from the brain clock gently modulates the halo. These are decorative visual pulses, not measurements or claims about actual neural activity.

## Verification

Run a local production preview and `node scripts/verify-landing-motion.mjs`. The script uses guest UI, installed Chrome and software WebGL, asserts canvas identity/one GLB fetch through theme changes, inspects surface-path availability, and checks immediate useful content, finite entrances, gradient convergence, preference persistence, system theme, responsive bounds, visibility state, reduced motion, keyboard/touch links and a delayed/failed-model fallback. It writes screenshots and isolated paint/CLS observations to `/tmp/vikas-motion-verification` by default. It does not seed data or mutate accounts.

Physical-device FPS, Safari/Firefox and production-network Core Web Vitals require separate measurements. Software-WebGL observations cannot establish a hardware 60 FPS guarantee. No commit, push or deployment is part of this revision.

## Results — 13 November 2026

`npm run typecheck`, all 183 tests, and `npm run build` passed. The production guest-browser script passed finite entrance timing, live cortical paths, no-remount/one-GLB-fetch theme switching, palette/world convergence, persisted/system themes, 1440/768/390/320px bounds, offscreen pause, reduced motion, keyboard/Escape links, touch Build navigation, and delayed/failed-model usability. No JavaScript, shader/console errors or broken static assets were recorded. Screenshots were inspected in both themes.

The GPU enhancement now observes first-contentful-paint and uses idle time afterward (with an animation-frame fallback when Paint Timing is unavailable), so useful content and CSS motion do not depend on graphics initialization. Reflection maps are capped at 64px desktop / 32px mobile. A final ordinary local Chrome sample recorded FCP 296ms, response start 32.5ms and enhancement start 325.4ms. The forced SwiftShader browser recorded FCP 7,832ms and enhancement start 8,300ms; its software graphics startup remains slow and is not a production speed measurement. Both confirm paint precedes enhancement. The full software-WebGL run recorded initial CLS 0. These are isolated, unthrottled localhost observations, not production Core Web Vitals, cross-browser certification, or a physical-device 60 FPS claim.
