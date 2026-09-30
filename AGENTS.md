# VIKAS contribution rules
Read README.md, docs/API.md and docs/HANDOFF.md. Preserve MongoDB and Better Auth. Do not introduce fabricated data or user-storage fallbacks. Keep secrets out of Git and client bundles. Scope all private queries to the verified session user. Ask before incompatible API changes. Run npm run typecheck, npm test and npm run build. No automatic deployment is configured.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
