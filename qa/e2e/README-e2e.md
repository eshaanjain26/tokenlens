# TokenLens E2E suite

Playwright specs for the single-page app. Every spec asserts the expected behaviour, so a failing assertion means the defect is present.

## Run

```
cd <this folder>
npm i -D @playwright/test && npx playwright install chromium   # once; already done here
# serve the build (do not rebuild the product from here), e.g. the Vite preview on 4196
TL_URL=http://localhost:4196/ ./run1.sh 03        # one spec file at a time (prefix 01..09)
TL_URL=http://localhost:4196/ ./run08.sh          # layout matrix, light then dark (slow)
TL_URL=http://localhost:4196/ npx playwright test # everything (needs RAM and disk)
```

`run1.sh` prints a compact failure list and any `test.info().annotations` (measured values). `TL_URL` defaults to `http://localhost:8791/index.html` (the single-file v1 build); for the Vite build pass the origin with a trailing slash.

## Layout

- `tests/helpers.js`: `open()` (mode `fixture` | `offline` | `slow` | `real`), `selectModel(s)`, `send`, `setCur` (uses `#currency-select`), `openTool`. `/chat/completions` is always stubbed to a 401; fonts and other hosts are aborted.
- `01` boot, onboarding, pricing cache paths. `02` numeric correctness. `03` sidebar, prompt, views, share URL. `04` tools and exports. `05` Benchmarks, Analytics, explainer, a11y, contrast. `06` older viewport checks (superseded by 08). `07` extras (XSS, persistence, perf, focus rings). `08` layout matrix, 8 viewports x light/dark x pages and 21 dialogs, writes `viewport-report-v2.json`. `09` new revamp features (command palette, shortcuts, offline chip, matrix sort, Analytics isolate/export, Benchmarks compare, currency check).
- `fixtures/live-models.json`: recorded OpenRouter `/models` payload (460 models).
- `BUGS.md` (v2, revamped build) and `BUGS-v1.md` (v1 build). `shots/` holds screenshots (v1 evidence plus two v2 images); delete them freely, specs recreate what they need.

## Known stale spots

See "Stale specs" in `BUGS.md`: spec 02 turn-card readers, spec 03 collapse/templates/history clicks, spec 05 Analytics chart count, spec 06.
