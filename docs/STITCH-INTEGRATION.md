# Stitch UI integration

Checkpoint before project edits: `c5b66d0` on `feature/disha-living-companion`. No push or deployment.

## Source inventory and mapping

The supplied ZIP contains four standalone `code.html` exports, four `screen.png` references, and a `DESIGN.md`. It contains no React app, backend, font binaries, GLB/GLTF model, HDR environment, or standalone character artwork. Export scripts include CDN Tailwind, navigation/mock interactions, and a procedural Three.js sculpture. Exported confidence percentages, student achievements, quantum lessons, compiler telemetry, and research claims are design placeholders; none were copied into application data or represented as working capabilities.

| Stitch reference | Existing integration |
| --- | --- |
| Syvra cosmic experience | Existing public landing: editorial Syne hero, serif accent, violet-black grid, sculptural artwork, real onboarding/learning/lab/tutor links and actual feature descriptions |
| Academic discovery | `/learn` and `/explore`: real saved-study context, existing subject/chapter directories, resource search/filter controls and owned task acceptance |
| DISHA mentor | `/disha` and `/mentor`: existing conversation viewport, composer, sources/feedback and existing rendered companion identity; no fictional confidence/sidebar telemetry |
| APRAJITA laboratory | `/labs` and `/aprajita`: existing language/file controls, actual editor, Run/Stop/Save, provider notices and real output/errors |
| No dedicated screen | Today, Journey, Profile, auth, onboarding, settings, menus and dialogs inherit the same typography, tokens, panel, field, focus, error and navigation treatments |

`app/stitch.css` contains the shared system and responsive adaptations; `app/layout.tsx` loads it after existing styles. Existing light/system preferences remain. Syne, Inter and Space Mono are hosted locally with OFL licenses; compact Latin WOFF2 fonts are used with system fallback for other scripts. Body/metadata font display is optional; Syne is preloaded. Screenshots were visual references, not webpage-sized background substitutes.

## Sculpture enhancement

The hero now loads `public/stitch/anatomical-brain.glb`, derived from the anatomical atlas at https://github.com/itayinbarr/brainproject (Z-Anatomy / BodyParts3D, DBCLS). Asset license is CC BY-SA 4.0; the derived GLB and rendered preview retain that license. On-screen attribution links to `brain-CREDITS.txt`; `brain-LICENSE.txt` preserves the source licensing notice. The procedural spheres and artificial stem were removed entirely.

The retained cortex, cerebellum and brainstem comprise 191 named source structures. Hidden white matter, vessels, nerves and unrelated deep systems are excluded. Source geometry is conservatively simplified and Draco-compressed (approximately 1.2MB, 257,564 triangles), then normalized and merged into one brain mesh at runtime. Both cerebral hemispheres remain in their original anatomical relationship, with gyri/sulci and temporal/cerebellar/brainstem contours preserved. This is an anatomical illustration rather than a clinically validated model.

`InteractiveSculpture` progressively imports the scene; a lightweight transparent WebP rendered from the same model remains visible during model/decoder loading or WebGL failure. All model and decoder assets are local. Hover/tap or keyboard activation reveals connections around the intact brain, with working Learn, Build, Explore and My Journey links. Escape reconnects the view. DISHA temporarily yields while those links are open.

A restrained physical lavender/violet material, iridescence, roughness, room reflections and blue/pink rim lights provide depth without the former plastic gloss. A subtle emissive contour travels across the surface; it is decorative and does not represent measured neural activity. Slow 3D turning, float and damped cursor response remain, while reduced motion renders a static pose and immediate link reveal. DPR is capped/adaptive; visibility pauses rendering. Unmount aborts model fetches, cancels rAF, disposes decoder workers, geometry, materials, environment and renderer. Model failure stops the loop and keeps the preview visible.

Preparation is reproducible with `scripts/prepare-brain-model.py` followed by `scripts/optimize-brain-model.cjs`. The latter uses optional offline glTF-Transform/Draco/Meshoptimizer tooling installed outside the app, with a tools-directory argument; these are not runtime application dependencies. Local Draco binaries carry their Apache 2.0 license.

## Boundaries

API routes, Better Auth, ownership checks, MongoDB, execution providers, assessment scoring and real student records were not changed. No student fixtures or account records were created. Existing avatar tracking, expressions, speech events, study setup and tutor navigation remain. No new product modules or navigation destinations were invented.

The export's four screens are aspirational mockups rather than exact matches to VIKAS's feature set. Real resource availability, authentication gates, code-execution constraints, provenance and empty states take precedence. Authenticated saves, two-account isolation, live provider execution and actual student progress need existing authorized accounts for end-to-end browser validation. Software-rendered Chrome measurements cannot establish 60 FPS on physical mobile GPUs or production networks.

## Verification results

TypeScript checks, all 183 existing tests, and the production build passed. Chrome guest-route checks covered `/`, `/learn`, `/disha`, `/labs`, `/today`, `/journey`, `/profile`, `/login`, and `/start` at 1440/768/390/320px, without detected horizontal overflow, hydration exceptions or broken local assets. Light-theme persistence and reduced motion passed. Initial pre-optimization FCP was 488ms with CLS approximately 0.058 during a run that also resized the viewport; this is not a clean production performance benchmark. Fonts were subsequently reduced from approximately 447KB of TTF files to approximately 46KB of WOFF2, with the display face preloaded.

The enhanced Three.js production check confirmed changing canvas pixels over time/pointer movement, an identical still frame with reduced motion, mobile bounds, light mode, existing DISHA navigation, and canvas removal/recreation across navigation. No page JavaScript errors occurred. Hardware FPS, Safari/Firefox, context restoration on physical GPU loss and authenticated student mutations remain unverified. The fallback remains visible when WebGL cannot initialize.

Brain verification: typecheck, 183 tests and production build passed. Software-WebGL Chrome checked hover opening/reconnection, four real destination links, keyboard activation, reduced-motion expansion, mobile tap/bounds and Build navigation to the actual lab. Physical-device FPS and anatomical fidelity are not claimed.

Anatomical revision validation: production Chrome loaded and rendered the actual optimized atlas mesh and was visually inspected at its resting and network poses. Visible cortical folds, temporal contour, cerebellum and brainstem replace the procedural ovoids. Hover/reconnect, four live destination links, keyboard activation, reduced-motion expansion, mobile tap/bounds and Build routing passed without page errors. Typecheck, all 183 tests and production build passed. The roughly 1.2MB GLB is accompanied by a matching model-rendered WebP preview. No final commit, push or deployment occurred. Physical mobile GPU performance, Safari/Firefox, clinical anatomical validation, and full authenticated workflows remain outside these browser checks.
