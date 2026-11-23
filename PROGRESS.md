# Progress and decisions

## Current build: static mock-data demo for GitHub Pages

The first version was a Next.js server app with SQLite and optional live model calls. It was rebuilt as a static site so it can be hosted from a personal GitHub account with mock data only.

### What changed in the rebuild

| Before | Now |
|---|---|
| Next.js server, API routes | Static export (`output: "export"`), no server |
| SQLite (`better-sqlite3`) | localStorage in the visitor's browser (`src/lib/db.ts`) |
| Anthropic / OpenAI calls, with fixtures as fallback | Fixtures only. `src/lib/llm.ts` and all prompts were removed |
| `/opportunities/[id]` | `/opportunity?id=…` (static hosting cannot serve unknown dynamic paths) |
| 5-second polling of a shared database | Same-browser tabs sync through the storage event plus a 4-second refresh |
| `/knowledge` files on disk | Embedded placeholders in `src/lib/knowledge.ts` |
| Two seeded opportunities, loaded on request | Five seeded on first visit; three arrive pre-analyzed with back-dated mock history |
| Navy and teal, sidebar on dark | Light, dense layout modeled on the reference dashboard: grey sidebar with counts and search, breadcrumb bar, hero card with dial + headline numbers + bar chart, gridded table with status chips, three summary cards |

### Kept from the original scope

P0 flow end to end (analyze → readiness → disagreement resolution → team review → brief → export), the template-gated MOU, Pipeline Intake, brief revisions, analysis history, the Demo Guide, and all grounding guards.

### Not included

- Live AI. Nothing calls a model. Reintroducing it needs a server; the UI already talks to an API-shaped router (`src/lib/local-api.ts`) that a real backend could replace.
- Real multi-user sharing. Data is per browser.
- Outreach drafts, PDF/DOCX export, auth, CRM integration.

## Decisions

| Decision | Why |
|---|---|
| Every opportunity, including ones a visitor creates, is flagged fictional. | The site is public; the New Opportunity form asks for invented data only. |
| "Analyze" shows four short simulated passes before the fixture loads. | It shows what a live run would do, and each step is labeled simulated. |
| Completeness score is computed (met × 10 + partial × 5). | Explainable and cannot be inflated. |
| In fixture mode, a recorded decision marks its criterion met and resolves the linked blocker on re-run. | A fixture cannot reason; the rule is stated in the UI. |
| A template whose text says FICTIONAL can only be approved "for demo only". | Stops it being mistaken for a real one. |
| Templates are approved only in the Legal role; commercial terms confirmed only in the Commercial role. | Mirrors the real approval path. It is a simulated check, not security. |
| The chart shows criteria coverage across analyzed opportunities, not a time series. | It is the only honest series the mock records support; no trend data is invented. |
| shadcn-style primitives are hand-written in `src/components/ui.tsx`. | No registry dependency. |

## Verified

- `npm run typecheck`, `npm run lint`, `npm run build` (static export) pass.
- The exported site was served from a sub-path (`/pilot-engine/`), as GitHub Pages serves a project site, and the full demo path was driven in headless Chrome: search, analyze, resolve as Engineering, approve as Commercial from a second tab, refresh persistence, re-run diff, finding review, brief export, MOU gating and population, term confirmation, pipeline import and promote, new opportunity, reset. No console errors.

## Not verified

- The GitHub Actions workflow has not been run; it was written but not executed against a real repository.
- Not run on macOS or Windows browsers; tested in Chrome on Linux.
- Tablet width was checked on the Overview only.

## Known gaps

- Clearing browser data clears the demo state (Reset data restores the mock set).
- If localStorage is blocked, the app works within one tab until reload.
- Conflict checks refuse a stale save; there is no merge UI.
- No delete or archive for opportunities.
