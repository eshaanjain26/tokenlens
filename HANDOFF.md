# Handoff: TokenLens

**Date:** 2026-11-08
**Repo:** https://github.com/eshaanjain26/tokenlens (default branch `main`, never push to it directly; one branch and one PR per change)
**Live:** https://eshaanjain26.github.io/tokenlens/ (GitHub Pages, deployed by `.github/workflows/pages.yml` on every push to `main`)
**Tested commit:** `a669c39`

## Where things stand

The UI revamp is merged. Seven PRs went into `main` this session:

1. Migration from one 539 KB `index.html` to a Vite project (34 JS modules, one stylesheet per area).
2. Responsive shell: top bar, left model rail (full at 1100px and up, icon rail at 769 to 1099px, bottom sheet plus bottom navigation on phones), shared dialog shell, tokens, dark mode.
3. Compare tab: ledger columns, sortable matrix, session verdict row, follow-a-model highlighting, pin and remove columns.
4. UX layer: command palette (Cmd/Ctrl+K), shortcuts sheet (`?`, `g c/b/h/a`, `/`, `d`), 3-step welcome flow, Live/Cached/Offline status chip with retry, toasts, footer, PWA manifest and icons.
5. Benchmarks and How it works: sortable and filterable tables, compare-selected, hover and keyboard charts, editorial explainer with a table of contents.
6. Analytics: KPI row, one metric chart, four share tables, click-to-isolate, CSV export, range toggle.
7. Tools menu and every tool dialog: grouped and searchable menu, shared `TLUI` kit (`src/js/tool-ui.js`), live results, copy and export, "Sample data" labels on demo screens.

Design direction: an achromatic ledger. Ink on near-white, TokenLens emerald (`--data`, #0A6B3C) as the one data colour, Geist type, no gradients, glows, glass or emoji icons. Tokens live in `src/styles/tokens.css`. Use variables, never hard-coded colours.

Not done in this round: organisation profiles (enterprise, government, healthcare, education presets, policy packs, data-residency filter, offline mode), real response streaming, and every functional bug listed below.

## Bug log (read this first next session)

`BUGS.md` is the E2E bug log for the revamped build. `docs/qa/BUGS-v1.md` is the first pass on the original build.

Status of the 50 bugs from pass one: **7 fixed, 6 changed, 34 open, 3 not re-tested.** Pass two added **2 new** (BUG-051, BUG-052).

Fixed by the revamp: BUG-001 to 005 (the layout bugs: collapsed turn cards, unscrollable Tools menu, off-screen header buttons, Templates dropdown, phone overflow), BUG-011 (Analytics NaN charts), BUG-044.

Open, in the order I would fix them:

| ID | Sev | Problem |
|---|---|---|
| BUG-051 | S2 | Usage dialog "This session" tiles disagree with the session totals and go negative with 2 models |
| BUG-008 | S2 | Models priced at -1 (such as `openrouter/auto`) give negative cost and rank first in Smart Route |
| BUG-007 | S2 | A rejected API key shows "Response" with no Simulated mark and no error toast |
| BUG-009 | S2 | Deselecting a model leaves stale totals, Latest responses and Verdict banner |
| BUG-006 | S2 | Currency switch leaves existing turn cards in USD |
| BUG-012 | S2 | ESG JSON puts a Wh value in `power_kWh` |
| BUG-010 | S2 | A tab click does nothing while the model list is loading |
| BUG-016 | S3 | Send plus Ctrl+Enter while in flight creates two turns |
| BUG-017 | S3 | Matrix does not refresh when a model is added |
| BUG-015, 047, 014 | S3 | "Output per $" prints `0K tok` (value is in millions); literal `&nbsp;` in the Latest responses header; "loaded live" toast shown beside the Offline chip |
| BUG-052 | S3 | Finder chips and the Forecast scenario button overflow at 360 and 390px |

Logic bugs the UI agents reported while restyling (details in the last section of `BUGS.md`, each marked reproduced or not):

- `donutSVG(slices, title, total)` receives a formatted label string where it needs a number, so the fraction is NaN. The Analytics donuts now show a "Chart unavailable" placeholder instead of a broken drawing. Fix the call sites to pass the numeric total.
- Policy rules are never evaluated (`POLICY.evaluate` is never called). Shadow AI, Key Vault and Webhooks use hard-coded demo data, and Live bench uses random values. All are labelled "Sample data".
- Fine-tune ROI ignores the monthly requests and tokens-per-request inputs.
- The recommender, scenario builder and A/B test only see the first 60 or 200 models.
- Break-even savings shows 0% when one model costs $0.
- Water figures differ between Benchmarks (WUE about 0.5 to 2.0) and How it works (11.5 and 3.8).
- Analytics: the projection "% of avg US daily" is computed on Wh, the KPI "Turns" is the maximum rather than the total, and the tab does not re-render on a currency change.

## How to work in this repo

```bash
npm ci
npm run dev                 # development
npm run build && npm run preview -- --port 4173 --strictPort
npx playwright install chromium
BASE_URL=http://localhost:4173 npx playwright test
```

- Restart `vite preview` after every build. A running preview keeps serving deleted chunks and gives blank pages.
- Tests: `tests/smoke.spec.js`, `responsive.spec.js` (8 widths from 360 to 2560 on every tab), `ux`, `compare`, `learn`, `analytics`, `tools`. 140 passed on the final build. Test runs rewrite the screenshots under `docs/qa/shell`; run `git checkout -- docs/qa/shell` before committing.
- The bug-hunt suite is separate: `qa/e2e/` (its own `package.json`, see `qa/e2e/README-e2e.md`). Every spec asserts the expected behaviour, so a failing assertion means the bug is still there. Run it one spec file at a time with `./run1.sh <nn>`; the whole suite at once needs a lot of RAM.
- Modules are `window.NAME = (function(){...})()` and the markup calls them from inline `onclick`. Do not rename an element id or class without grepping `src/js` first.
- Each page's CSS is in its own file (`compare.css`, `analytics.css`, `benchmarks.css`, `howitworks.css`, `tool-modals.css`, and so on). `content-overrides.css` and `content-dark.css` are now empty headers; do not put new rules there and do not add `!important`.
- Dark mode is a variable swap. Express every colour as a token so it flows through.
- Shared UI helpers: `src/icons.js` (inline SVG set), `TLUI` (`src/js/tool-ui.js`), `CHARTS.scrub` and the delegated `data-tip` tooltip (`src/js/charts.js`), `PALETTE.register({...})` for command-palette actions (`src/js/palette.js`).
- Preferences use localStorage keys prefixed `tl_ui_`. The API key is held in memory only. The app's only network calls go to `openrouter.ai` and Google Fonts.

## Rules that still apply

- Never push to `main`. Open a PR per change.
- Do not fix calculation or logic bugs inside a styling PR. Fix them in their own PR with a test that fails first (the specs in `qa/e2e/tests` are ready-made).
- Verify against the production build and the deployed site, not only the dev server. After a Pages deploy, wait about a minute before judging.
- The CO₂, water and power numbers are estimates. The cache-read energy factor (10% of a fresh token) is an assumption, not a published figure. Say so wherever it is shown.

## Next steps

1. Fix the open S2 bugs above, one PR each, starting with BUG-051 and BUG-008. Re-run `qa/e2e` after each and update `BUGS.md`.
2. Add a LICENSE file. The repo has none, so it is not legally open source yet. This needs the owner's choice of licence.
3. Organisation profiles (the commercial roadmap): presets with default optimise-for weights (cost, accuracy, power, CO₂), policy packs, a region and data-residency filter, an offline mode with a bundled price snapshot, CSV, JSON and print-ready reports, and an importable `tokenlens.config.json`. Accounts, SSO and a server-side audit log need a backend.
4. Real streaming for `APP.send()` (still a placeholder). The success path of live chat completions was never tested because no real key was used.
5. Delete the dead code left behind: `radarSVG` and `radarLegend` in `charts.js` (Benchmarks now uses a scorecard table), the unused `.bench-grid` rules in `print.css`, and the old `#pricing-badge` colours in `api.js` (the status chip replaces them).
6. Test on Safari, Firefox, a physical phone, and with a screen reader. None of these were covered.

## Launch assets

The launch video is not in the repo. It is in the owner's workspace under `OUTPUT/TokenLens-Launch/` (`brag.mp4` landscape, `brag-vertical.mp4`, poster images, `share-copy.txt`). To use it on the README, upload `brag.mp4` through GitHub's file attach in the README editor or attach it to a release. Every number on screen is simulated, computed from the live OpenRouter prices, and the video shows "Output per $ 0K tok" faintly in the dark and phone frames (BUG-015).

## Environment notes for the next agent

- Agents started with worktree isolation get a worktree of the workspace repo, not of TokenLens. Clone TokenLens into your own folder and work there.
- The disk was almost full for much of this round (about 600 MB free). Keep clones to one, delete `dist`, `test-results` and `node_modules` of finished clones, and do not run the whole E2E suite and a video render at once.
