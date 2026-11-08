# TokenLens

See what a prompt costs, and what it emits, before you pick a model.

TokenLens compares LLM cost, tokens, prompt-caching savings, CO₂, water and power across the 460+ models on OpenRouter. It runs entirely in your browser. No signup, no backend, no telemetry.

**Live demo:** https://eshaanjain26.github.io/tokenlens/

![GitHub stars](https://img.shields.io/github/stars/eshaanjain26/tokenlens?style=flat)

## What you can do

- **Compare up to 10 models side by side.** Type one prompt, get per-turn tokens, cost, CO₂, water and power for every model, in columns or in a sortable matrix.
- **Follow a model through the page.** Click a model name and it highlights across the columns, the verdict, the matrix and the charts.
- **Price prompt caching.** Switch caching on, set a hit rate, and see the cost and footprint with and without it.
- **Read the session verdict.** The cheapest, lowest-carbon, lowest-water and lowest-power model after each turn.
- **Analyse a session.** A KPI row, a metric chart with crosshair and keyboard tooltips, four share tables, CSV export, and scale projections.
- **Check the benchmarks.** Training footprints and inference impact tables you can sort, filter and compare, with the sources next to each number.
- **Use the Tools menu.** Usage and caching, model finder, recommender, prompt optimizer, scenario builder, A/B test, router, fine-tune ROI, ESG report with a print view, cost projection and forecast.
- **Work from the keyboard.** Cmd/Ctrl+K opens a command palette. Press `?` for the shortcut sheet.
- **Use it on any screen.** The layout is built for phones (bottom navigation, one column), tablets (icon rail) and desktops up to ultrawide, in light and dark.

## Quick start

```bash
git clone https://github.com/eshaanjain26/tokenlens.git
cd tokenlens
npm ci
npm run dev
```

Open the URL Vite prints. Pick three models in the left rail, type a prompt, press Cmd/Ctrl+Enter.

Build and test:

```bash
npm run build
npm run preview
npx playwright install chromium
npm test
```

## Privacy

- The only network calls go to `openrouter.ai` (the public model list, and chat completions if you add a key) and Google Fonts.
- An OpenRouter API key you paste is held in page memory and is not written to localStorage.
- Without a key, responses are simulated and labelled as simulated. Token counts, costs and footprints are still calculated from the live price list.
- Preferences (theme, view, sort order, cache settings) are stored in your browser.

## How the numbers are made

- **Cost** is tokens multiplied by the per-million price OpenRouter lists for the model.
- **Power, CO₂ and water** are estimates built from published per-model energy figures (anchored to Luccioni et al., 2023), each provider's grid carbon intensity and water use per kWh. They are directional, not audited measurements.
- **Caching** uses the provider's cache-read and cache-write multipliers when OpenRouter lists them, and provider defaults otherwise. A cache-read token is assumed to use 10% of a fresh token's energy. That factor is an assumption, not a published figure.
- The How it works tab shows every formula and source.

## Known issues

An end-to-end test pass on the original build found 50 bugs. After the interface rebuild, 7 are fixed, 34 are still open, and 2 new ones turned up. Each is logged with severity, steps to reproduce and evidence in [BUGS.md](BUGS.md). The open ones are in calculations (for example, models priced at -1 give a negative cost), in state that goes stale after you change models or currency, and in screens that show sample data (Policy, Shadow AI, Key Vault, Webhooks, Live bench). Those screens carry a "Sample data" label. Read BUGS.md before you rely on a number.

## Roadmap

- Fix the bugs in BUGS.md, starting with the S1 and S2 items.
- Organisation profiles: presets for enterprise, government, healthcare and education, with policy packs, a data-residency filter and an offline mode.
- Real streaming for live responses.
- A server-side option for accounts, SSO and audit logs.

## Contributing

Issues and pull requests are welcome. Open an issue first for anything large. Run `npm test` before you open a pull request.

## Project layout

```
index.html          markup
src/js/             one module per feature, each attached to window
src/styles/         tokens, shell and one stylesheet per area
tests/              Playwright smoke, responsive and per-area specs
docs/qa/            screenshots from the test runs
HANDOFF.md          state of the project for the next session
```
