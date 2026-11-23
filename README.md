# Cosmos Pilot Engine (mock-data demo)

A static, browser-only demo of the Pilot Engine: from a first bank conversation to a pilot package the whole team has reviewed.

**Everything in it is mock data.** Every institution, person, note and number is invented. There is no server, no database, no API key and no model call. State is saved in the visitor's own browser (localStorage) and never leaves it.

## Run locally

Requires Node.js 20 or newer.

```bash
git clone https://github.com/kaneian/cts-pilot-engine.git
cd cts-pilot-engine
npm install
npm run dev
```

Open http://localhost:3000. The mock data loads itself on first visit. **Reset data** (top right) restores it at any time.

## Host on GitHub Pages

This repository is set up to deploy itself.

1. In the repository on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. This is a one-time switch.
2. The included workflow (`.github/workflows/pages.yml`) builds and deploys on every push to `main`. You can also start it by hand from **Actions → Deploy to GitHub Pages → Run workflow**.
3. The site appears at `https://kaneian.github.io/cts-pilot-engine/`.

The workflow sets the base path for you, so it works for a project site (`/<repo>/`), a user site (`<your-user>.github.io`) and a custom domain without changes.

GitHub Pages sites are public on free plans, including from a private repo on paid plans unless you restrict them. That is why this build contains only invented data.

To build the static site yourself: `npm run build` writes it to `out/`. For a sub-path, set `NEXT_PUBLIC_BASE_PATH=/<repo>` first.

## What you can do in it

- **Overview**: animated on load (dial sweep, count-up numbers, staggered bars and rows; disabled when the system asks for reduced motion). Readiness dial, four headline numbers, criteria coverage chart, opportunity table (filter and sort), recent activity, open blockers by owner, knowledge sources. All computed from the mock records.
- **Opportunity workspace**
  - *Discovery*: notes with version conflict checks, source documents with approval labels, confirmed facts.
  - *Readiness*: completeness score with "How this was determined", disagreement panel (a person decides, with a required rationale; another role approves), editable blockers, facts / assumptions / unknowns, re-run with a "what changed" diff.
  - *Team Review*: simulated role selector, approve / reject / needs-evidence on findings, comments, audit trail.
  - *Pilot Package*: draft brief (edit, revisions, copy, `.md` / `.txt` export) and a template-gated MOU with `[TO CONFIRM]` fields.
- **Pipeline Intake**: load the mock attendee list or import a CSV (read in the browser only), rule-based scoring with sources, promote to an opportunity.
- **Demo Guide**: the five-minute walkthrough with links.
- **Search** (⌘K / Ctrl+K) across opportunities and pages.

Two tabs in the same browser share the data and refresh each other, so you can play two team members side by side.

## What is simulated

| In this demo | In a real deployment |
|---|---|
| "Analyze" replays a fixed fixture per opportunity; the four reviewer passes are a short animation | Three model calls plus a reconciler, server-side |
| Human decisions are applied to the fixture by rule on re-run | The model re-evaluates with the decisions as sources |
| Brief is assembled from the reviewed analysis by a template | Model-written prose with the same guards |
| Role selector, no sign-in | Real identity and permissions |
| localStorage in one browser | Shared database |
| CTS knowledge files are unfilled placeholders | Approved, dated references from Product, Engineering, Commercial and Legal |

The grounding guards are real code and run on every analysis: excerpts are checked against their source, demo-only material never counts as support, unsourced currency amounts become `[TO CONFIRM]`, the score is computed from ten criteria, and a disagreement can only be resolved by a person.

## Layout

```
src/app/                 Pages (static export)
src/components/          UI primitives, shell, workspace tabs
src/lib/types.ts         PilotAnalysis contract (Zod) and shared constants
src/lib/demo-data.ts     All mock content: notes, fixtures, template, attendee list
src/lib/knowledge.ts     Embedded placeholder CTS references
src/lib/analysis.ts      Guards, decision carry-forward, run diff
src/lib/brief.ts         Brief composer
src/lib/mou.ts           Template population (clauses kept byte-for-byte)
src/lib/pipeline.ts      CSV parser and scoring rules
src/lib/store.ts         All reads and writes, seed data, audit trail
src/lib/db.ts            localStorage persistence
src/lib/local-api.ts     In-browser stand-in for the REST API
```

Checks: `npm run typecheck`, `npm run lint`, `npm run build`.

See `PROGRESS.md` for decisions and gaps, and `CLAIMS_TO_VERIFY.md` before any real CTS claim is added.
