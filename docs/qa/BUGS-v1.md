# TokenLens E2E bug log

- Date: 2026-11-07
- Commit tested: `72a36fa` (Add usage panel and prompt-caching model; GitHub Pages workflow). The test copy was taken at the start of the run and verified byte-identical to `git show 72a36fa:index.html` (9,635 lines). The repo HEAD moved to `803c8ee` (Vite migration, working-tree edits to `index.html`) while I was testing; none of that is covered here.
- Browser: Playwright 1.65.0, headless Chromium, macOS. Specs: `/private/tmp/claude-501/-Users-mohini-Downloads-Claude-Code/3efc6eab-ba2c-4e0a-8faf-740941b17611/scratchpad/tl-e2e/tests/` (target from `TL_URL`, default `http://localhost:8791/index.html`). Screenshots: `.../tl-e2e/shots/`. Line numbers below refer to `site/index.html` (the 72a36fa copy).
- Network handling: `/api/v1/models` served from a recorded OpenRouter payload (460 models, `fixtures/live-models.json`), aborted (offline fallback), delayed, or real. `/chat/completions` was never allowed out; it was stubbed to a 401. Only the fake key `sk-or-v1-test` was used.
- Totals: 116 Playwright tests run, 52 pass, 64 contain at least one failing assertion. Many tests assert several things, so failing tests map to the bugs below, not 1:1.

## Counts

- By severity: S1 1, S2 12, S3 29, S4 8 (total 50).
- By type: functional 27, layout 9, calculation 8, a11y 4, console-error 1, performance 1.

## Re-running

`cd .../tl-e2e && TL_URL=http://localhost:<port>/index.html npx playwright test` (serve the build with `python3 -m http.server <port>`). Every spec asserts the expected behaviour, so a failing assertion means the bug is still present; fixed builds should go green. `viewport-report.json` and `results.json` are rewritten on each run. `TL_NO_NET=1` skips the one test that touches the real OpenRouter endpoint.

## Coverage

| Feature area | Tested | Passed | Bugs |
|---|---|---|---|
| Welcome/onboarding modal | yes | partial (shows, dismisses, persists) | BUG-010, BUG-037 |
| Header tabs (Compare / Benchmarks / How It Works / Analytics) | yes | partial (switch works, content renders) | BUG-005, BUG-037 |
| Currency toggle USD/EUR/GBP/INR | yes | partial (columns, sidebar, pill, projection OK) | BUG-006, BUG-049 |
| Dark mode + persistence | yes | yes (persists, Ctrl+Shift+D works) | BUG-039, BUG-044 |
| Sidebar: API key field | yes (fake key) | partial | BUG-007, BUG-031 |
| Sidebar: search / provider chips / 10-cap / green-only / region / collapse / templates / tips / totals | yes | partial | BUG-004, BUG-009, BUG-020, BUG-021, BUG-036, BUG-050 |
| Prompt box (preview chips, Cmd/Ctrl+Enter, empty, 540k chars, unicode, code, injection text) | yes | mostly (HTML always escaped) | BUG-016, BUG-023, BUG-033 |
| Simulate/Send with 1, 3, 10 models; multi-turn | yes | yes (10 models x 2 turns < 1.2 s; 3 models x 40 turns 0.7 s) | BUG-001, BUG-042 |
| Numeric correctness (cost, CO2, water, power, cache math, totals) | yes (hand-recomputed, gpt-4o / claude-3-haiku / gpt-3.5-turbo) | yes for core formulas | BUG-008, BUG-015, BUG-024, BUG-025, BUG-043 |
| Context bar warn/crit thresholds | yes | yes (>60 warn, >80 crit) | BUG-022 |
| Per-turn cards, column totals | yes | totals = sum of turns | BUG-001, BUG-006 |
| Columns vs Matrix | yes | partial | BUG-017 |
| Tools: Usage & Caching | yes | yes (math, cache toggle, hit slider, scope, copy) | BUG-025, BUG-048 |
| Tools: Recommender, Optimizer, Scenario, A/B, Finder, Router, Fine-Tune ROI | yes | open/close/no errors; Scenario math OK | BUG-027, BUG-028, BUG-029, BUG-030, BUG-041 |
| Tools: ESG report + print view | yes | print CSS works | BUG-012, BUG-026 |
| Tools: Shadow AI/PII, Policy, Key Vault (RBAC) | yes | open/close only | BUG-013 |
| Tools: Live Bench, Projection, History, Forecast, Bookmarks, Webhooks, Notes | yes | partial | BUG-018, BUG-031, BUG-032, BUG-035 |
| Budget guard, Verdict banner, Quality bar | yes | Verdict OK | BUG-031, BUG-033 |
| Share URL generate + reload | yes | round-trip with special chars OK | BUG-020 |
| localStorage persistence | yes | theme, cache settings, history, onboarding OK | BUG-032, BUG-042, BUG-049 |
| Pricing cache `tl_pricing_cache_v1` fresh / stale / offline / corrupt | yes | yes | BUG-014, BUG-046 |
| Benchmarks tab content + charts | yes | renders, no NaN | BUG-039, BUG-035 |
| Analytics tab (8 charts) 0 / 1 / 12 turns | yes | 0 turns clean | BUG-006, BUG-011 |
| How It Works tab + turn explainer | yes | renders, links have rel=noopener | BUG-024 |
| Keyboard nav / focus order / Esc | yes | focus rings present, tab order sane | BUG-037, BUG-038 |
| Viewports 390x812, 768x1024, 1280x720, 1440x900, 1920x1080 | yes | 768 and 1920 mostly clean | BUG-001..005, BUG-040, BUG-045 |
| Print stylesheet (main page + ESG) | yes | works | BUG-026 (close button printed) |
| Console / page errors | watched throughout | see bugs | BUG-011, BUG-032, BUG-035 |

Not tested: real `/chat/completions` success path (no real key allowed, so the live-response branch of `API.callModel` was only exercised through the 401 stub); Safari/Firefox; a physical touch device (mobile checks used Chromium device emulation); screen-reader output; the Vite migration in the working tree.

---

## S1

### BUG-001 | S1 | layout | Compare: per-turn cards collapse to a 20 px strip
- Area: Compare tab, column turn list (`#col-*-turns`), "Latest Responses" panel, Verdict banner.
- Viewport: 1280x720, 1440x900, 1920x1080 (768x1024 and 390x812 stack and are fine).
- Repro: load app, select GPT-4o and Claude 3 Haiku, send "Explain transformers in detail." (Simulate). Look at the columns.
- Expected: each model column shows the turn card (prompt, response, input/output tokens, cost, CO2, water, power, cached/savings) at a readable height, or the page scrolls.
- Actual: `#compare-panel` has `overflow:hidden` and does not scroll; the prompt bar (135 px) + Latest Responses panel (324 px, shown automatically after the first send) + Verdict banner take the height, so `#col-*-turns` ends up 20 px tall at 1440x900 and 1920x1080 and 20 px at 1280x720 even after clicking "Hide" (the column itself is 2 px tall with the panel open). Tokens, cost, CO2, the "How was this calculated?" button, rating and bookmark buttons are unreachable except by scrolling inside a 20 px box. With the Latest Responses panel hidden at 1440x900 the list is 103 px tall.
- Evidence: `shots/layout-turns-1440x900.png`, `shots/layout-turns-1280x720.png`, `shots/layout-turns-hidden-1280x720.png`, `shots/column-one-turn-1440x900.png`; `shots/viewport-report.json` ("turnvis"). Playwright cannot click `.turn-annotation-btn` (element is outside the viewport, 1338 px at a 900 px viewport).
- Suspected cause: flex column layout of `#compare-panel` with a non-scrolling parent (`#main{overflow:hidden}`) and `.col-turns` as the only shrinkable child; `UI_COMPARE.updateOutputPanel` (line 5137) adds a 324 px block.

---

## S2

### BUG-002 | S2 | layout | Tools menu is taller than the viewport and cannot scroll
- Area: header Tools dropdown (`#tools-dropdown`).
- Viewport: 1280x720 (bottom 933 px of 720), 1440x900 (bottom 933 px of 900), 390x812 (bottom 1030 px of 812). Fine at 1920x1080.
- Repro: open Tools at 1280x720.
- Expected: all 26 items reachable (scroll or max-height).
- Actual: dropdown is 881 px tall, `overflow:visible`, page does not scroll. At 1280x720 everything from "Key Vault & Teams" down (Shadow AI, Policy, Cost Forecast, Bookmarked Turns, Alert Webhooks, Session Notes) is off-screen and unreachable with the mouse; at 1440x900 the last item is cut off.
- Evidence: `shots/vp-1280x720-tools-menu.png`, `shots/vp-390x812-tools-menu.png`. (The tools specs reach those items only because Playwright force-scrolls the hidden-overflow container.)
- Suspected cause: `#tools-dropdown` has no `max-height` / `overflow-y:auto`.

### BUG-003 | S2 | layout | Header controls pushed off-screen at 1280 px
- Area: header.
- Viewport: 1280x720 (any 1280-wide).
- Repro: load at 1280x720, with or without models.
- Expected: Tools button and dark-mode toggle visible.
- Actual: `tools-wrap` spans x=1199..1284 and `dark-toggle` x=1292..1326 in a 1280 px viewport; header content is 1326 px wide. After one send the Usage pill grows ("$0.0032 · 77% cached") and the overflow is worse (Tools x=1295..1380).
- Evidence: `shots/vp-1280x720-compare.png`, `shots/viewport-report.json`.
- Suspected cause: fixed-width header children with no wrap/shrink below ~1330 px.

### BUG-004 | S2 | layout | "Templates" dropdown opens upward and is clipped by the header
- Area: prompt bar, `#tpl-dropdown`.
- Viewport: all desktop sizes (1280x720, 1440x900, 1920x1080); 390/768 not clipped horizontally but same vertical position.
- Repro: click "Templates".
- Expected: eight templates visible and clickable.
- Actual: dropdown top is at y = -283 px; only the last two or three items are on screen, the other five (Code Review, Summarization, Chain-of-Thought, Essay, Translation) cannot be clicked (Playwright: "element is outside of the viewport" forever).
- Evidence: `shots/templates-dropdown-1440x900.png`, `shots/vp-1280x720-templates.png`.
- Suspected cause: dropdown positioned `bottom:100%` of a button that sits near the top of the page.

### BUG-005 | S2 | layout | Mobile (390 px): header tabs overlap the prompt bar; Benchmarks and Analytics scroll sideways
- Area: header, Benchmarks panel, Analytics panel.
- Viewport: 390x812.
- Repro: load at 390x812, open the Benchmarks and Analytics tabs.
- Expected: tabs reachable, content within 390 px.
- Actual: header wraps to three rows but its height is fixed, so the prompt chips draw on top of the tab strip ("Benchmarks" is overlapped; "How It Works" and "Analytics" are at x=280..525, partly off-screen). Benchmarks panel content is 544 px wide in a 390 px panel, Analytics 460 px.
- Evidence: `shots/vp-390x812-compare.png`, `shots/vp-390x812-benchmarks.png`, `shots/vp-390x812-analytics.png`.
- Suspected cause: header `height` fixed with `flex-wrap`; fixed-width SVG/table content in benchmark and analytics panels.

### BUG-006 | S2 | functional | Currency switch does not update existing turn cards, Latest Responses or Analytics
- Area: turn cards, Latest Responses panel header, Analytics tab.
- Viewport: any.
- Repro: select GPT-4o + Claude 3 Haiku, send two prompts, click EUR (or GBP, INR).
- Expected: every cost figure re-rendered in the selected currency.
- Actual: sidebar totals, column totals, usage pill, Matrix, Verdict, Projection convert, but each already-rendered turn card keeps "$0.0013 / saved $0.000144", the Latest Responses header still reads "$0.0010", and Analytics keeps USD ("Cost per Turn (USD)") until re-rendered. The budget bar label is hard-coded `$` (lines 7192, 7200).
- Evidence: Playwright "currency toggle converts every visible figure", "Latest Responses meta currency"; `shots/currency-inr.png`.
- Suspected cause: `UI_COMPARE.refreshAllCurrencies` (line 5189) only calls `refreshMeta` and `updateGlobalStats`; turn-card HTML is built once in `appendTurn` with `CALC.fmtCost` baked in.

### BUG-007 | S2 | functional | A rejected/invalid API key silently turns into "real" responses
- Area: API key field, `UI_COMPARE.appendTurn`, Usage panel, Budget.
- Viewport: any.
- Repro: type `sk-or-v1-test` in the key field (13 chars counts as a key), pick GPT-4o mini, send "hello key" (request answered 401 by the stub).
- Expected: error toast ("key rejected"), turn labelled simulated, mode stays Simulated.
- Actual: no error feedback anywhere. The turn text is the simulated stub but the card says "MODEL RESPONSE" (not "Simulated Response", no `simulated` class) because `appendTurn` tests `API.hasKey()` (line 5151/4932) instead of `turn.isSimulated`. Usage panel shows Mode "Live API". Budget treats simulated spend as real and fires "budget exceeded" toasts and webhooks.
- Evidence: `shots/fake-key-fallback.png`; `turn.isSimulated` is true while the label says model response. `API.hasKey()` is `length > 10`, so any 11-char string "enables" live mode.
- Suspected cause: lines 4932, 5151, `USAGE.render` (`sim = !API.hasKey()`), `BUDGET.update`.

### BUG-008 | S2 | calculation | Negative-priced router models produce negative cost
- Area: model list, cost math, Router.
- Viewport: any, live catalogue.
- Repro: with the live OpenRouter payload, search `openrouter/auto`, select it, send "hello world".
- Expected: no negative spend (these models have price `-1` meaning "variable").
- Actual: turn cost and session total show `$-109.00`; column header reads `$-1000000.000 in`. Eight models in the live list have price -1 (`openrouter/auto`, `auto-code`, `auto-beta`, `fusion`, `pareto-code`, `bodybuilder`, `typesafe/jev-router`, `nvidia/switchyard`). Totals, Verdict "Lowest cost", Usage and Budget all inherit the negative number.
- Evidence: `shots/negative-price-model.png`; fixture `fixtures/live-models.json`.
- Suspected cause: `API.fetchModels` filter (line 4399) only checks that `pricing.prompt` is truthy; `CALC.cost` multiplies it through.

### BUG-009 | S2 | functional | Deselecting a model leaves stale totals everywhere
- Area: sidebar totals, Usage pill, Latest Responses, Verdict banner, Matrix.
- Viewport: any.
- Repro: select GPT-4o and Claude 3 Haiku, send once, then untick GPT-4o.
- Expected: session cost, usage pill, Latest Responses, Verdict, Matrix reflect only the remaining model.
- Actual: `#sess-cost` still shows both models' cost, the usage pill still shows `$0.0010` (true total `$0.000093`), Latest Responses still lists two cards, Verdict banner stays visible with one model, Matrix keeps old columns.
- Evidence: Playwright "deselecting a model updates totals" (4 failed assertions); `shots/matrix-view.png`.
- Suspected cause: `APP.toggleModel` (line 6310) only re-renders the list and columns; it never calls `UI_COMPARE.updateGlobalStats` / `updateOutputPanel`.

### BUG-010 | S2 | functional | Slow `/models` response: controls dead and welcome modal shown to returning users
- Area: `APP.init`.
- Viewport: any.
- Repro: mark onboarding seen (`lti_onboarded_v1=1`), delay `https://openrouter.ai/api/v1/models` by 4 s (no pricing cache), reload, immediately click a tab, a currency button, type in the prompt box.
- Expected: UI works at once; offline fallback after a timeout.
- Actual: the Welcome overlay is visible to a returning user until the fetch finishes; tab, currency, API-key, prompt, send, search and chip handlers are not attached yet, so clicks do nothing (DOM `click()` on the tab leaves Compare active, currency stays USD). There is no fetch timeout, so a hung request keeps the app dead.
- Evidence: `shots/slow-network-controls.png`; Playwright "controls work while /models is still loading" (3 assertions fail).
- Suspected cause: `await API.fetchModels()` at line 6154 precedes all `addEventListener` calls (6163-6260) and `TOAST._initOnboarding()` (6263); `fetch` has no `AbortController`.

### BUG-011 | S2 | console-error | Analytics donut charts render NaN paths (Token Share, CO2 Share)
- Area: Analytics tab.
- Viewport: any.
- Repro: select 1-3 models, send one prompt, open Analytics.
- Expected: two donuts drawn, no console errors.
- Actual: "Token Share" and "CO₂ Share" draw only the legend and centre label; the ring is missing. Console: `Error: <path> attribute d: Expected number, "….0 A68,68 0 0,1 NaN,NaN LNaN,NaN…"` and `"MNaN,NaN LNaN,NaN…"` (4 on 1 model/1 turn, 14 NaN occurrences on 2 models, 48 on 3 models x 12 turns). 0 turns is clean.
- Evidence: `shots/analytics-3-models-12-turns.png`; console text above.
- Suspected cause: donut arc generator in `UI_ANALYTICS.render` (line 6672+) dividing by zero on single-slice / zero-angle segments.

### BUG-012 | S2 | calculation | ESG JSON export labels Wh as kWh (1000x too large)
- Area: Tools > ESG Report > Download JSON.
- Viewport: any.
- Repro: GPT-4o, send an essay prompt, open ESG Report, click "Download JSON".
- Expected: `power_kWh` = Wh / 1000 (0.000432).
- Actual: `per_model[0].power_kWh = 0.432` (the Wh value). Audit-ready report ships a value 1000x off.
- Evidence: Playwright "ESG JSON export units"; `STATE.globalTotals().power` = 0.432 Wh.
- Suspected cause: line 7864 `power_kWh: mPower`.

### BUG-013 | S2 | functional | Shadow AI, Policy, Key Vault and Webhook panels show fabricated data; Policy does not enforce anything
- Area: Tools > Shadow AI Discovery, Policy Enforcement, Key Vault & Teams, Alert Webhooks.
- Viewport: any.
- Repro: open each panel; enable every Policy rule; send a prompt containing `123-45-6789`, `4111 1111 1111 1111`, `jane@acme.com`.
- Expected: either real detection/enforcement or a clear "sample data" label.
- Actual: Shadow AI lists hard-coded traffic (`_FAKE_TRAFFIC`, line 8330) and PII counts (4 SSNs, 2 card numbers); Policy shows "87 Triggers Today" and per-rule trigger counts that are constants. No code path calls POLICY/SHADOW from send; the PII prompt is sent and billed unflagged with all rules on. Nothing in the UI says demo or sample. Only the budget thresholds ever fire a webhook.
- Evidence: Playwright "Policy engine / PII" (1 turn sent, 0 flags); `shots/tool-shadow.png`, `shots/tool-policy.png`.
- Suspected cause: demo modules shipped without labelling or hooks (grep shows `POLICY.`/`SHADOW.` never invoked outside their own module).

---

## S3

### BUG-014 | S3 | functional | Offline fallback toast claims "live from OpenRouter"
- Area: boot toast.
- Repro: block `/api/v1/models`, reload.
- Expected: "47 models loaded (offline fallback)".
- Actual: toast reads "47 models loaded live from OpenRouter" while the badge says "Offline fallback".
- Evidence: `shots/offline-fallback.png`. Cause: line 6157 tests `models.length > 30`, and the bundled list has 47.

### BUG-015 | S3 | calculation | Column chip "tok/$" is 1000x too small ("0K tok/$")
- Area: every model column header.
- Repro: select GPT-4o ($10/1M output).
- Expected: 100K tok/$ (1,000,000 / $10 = 100,000).
- Actual: `💎 0K tok/$`; cheaper models show "1K" or "2K" instead of thousands.
- Evidence: `shots/column-one-turn-1440x900.png`. Cause: line 4848 `1 / (completion * 1e6)` is dollars-per-million inverted, not tokens per dollar.

### BUG-016 | S3 | functional | Ctrl/Cmd+Enter while a request is in flight sends the same prompt again
- Area: prompt box.
- Repro: with a key set and `/chat/completions` taking 800 ms, press Send, then Ctrl+Enter.
- Expected: second trigger ignored (Send button is disabled).
- Actual: two turns are created from one prompt (the keydown handler calls `send()` without checking `#send-btn.disabled`, and the textarea is only cleared after the await).
- Evidence: Playwright "fake API key" (turn count 2). Cause: line 6208/6266.

### BUG-017 | S3 | functional | Matrix view is not refreshed when models are added or removed
- Area: Matrix view.
- Repro: Matrix view, send a prompt with two models, add a third model.
- Expected: new model column appears.
- Actual: still two models until the next send (`APP.toggleModel` never calls `MATRIX.render`).
- Evidence: Playwright "Columns vs Matrix view" (3 header cells instead of 4).

### BUG-018 | S3 | functional | "Clear" on a model leaves Latest Responses and re-attaches old bookmarks/notes to the next conversation
- Area: column Clear button, Latest Responses, Bookmarks.
- Repro: send one prompt to GPT-4o, bookmark the turn, click Clear, send another prompt.
- Expected: panel empties; new turn 1 starts un-bookmarked.
- Actual: `updateOutputPanel` returns early when no turns remain (`if (!html) return;` line 5164), so the old response cards stay on screen; bookmark/note store is keyed `modelId::turnNum` and is never cleared, so the new turn 1 inherits it and appears in "Bookmarked Turns".
- Evidence: Playwright "Clear a model" and "bookmark / rating of a cleared turn" (the latter could only be exercised through DOM click because of BUG-001).

### BUG-019 | S3 | functional | Share link is fragile
- Area: `APP.shareURL` / `applyURLHash`.
- Repro / Actual (three cases):
  1. Hash `#m=openai%2Fgpt-4o&p=%E0%A4%A` (one malformed escape): `decodeURIComponent` throws inside the shared try/catch (line 6025), the valid model is dropped as well ("0 of 10 selected"), no message.
  2. Hash containing an id that is not in the catalogue (`nope/ghost`): `STATE.toggleModel` activates it, counts toward the 10 cap ("2 of 10 selected" with one visible column), and 12 ghost ids fill the cap.
  3. Clipboard write rejected (permission denied): `navigator.clipboard.writeText(url)` is not awaited (line 6017); toast still says "Link copied to clipboard!" and the rejection is unhandled.
- Expected: invalid params skipped individually; unknown ids ignored; success toast only after the write resolves.
- Evidence: Playwright "share URL: ..." tests. Round-trip of a prompt with `& % # = "` works.

### BUG-020 | S3 | functional | At 10 models the cap can be bypassed visually; tooltip and warning are dead code
- Area: model list.
- Repro: select 10 models; focus an unticked checkbox with Tab and press Space.
- Expected: row stays unticked, warning shown.
- Actual: with a mouse the disabled rows are `pointer-events:none` so the "Maximum 10" toast and the "Deselect a model first" title can never appear; by keyboard the checkbox ticks, `STATE.toggleModel` rejects it and the list is not re-rendered, so the box stays ticked while the model is not active ("10 of 10 selected" with 11 ticks).
- Evidence: `shots/cap-10-reached.png`; Playwright "10-model cap".

### BUG-021 | S3 | functional | Provider chips and list truncation
- Area: model list.
- Repro: with the live catalogue (460 models) click "Meta"; scroll the list; search for a non-existent model.
- Actual: "Meta" matches only `meta-llama/`, hiding the 9 live `meta/` models (Muse family); the list silently shows the first 100 of 460 with no "showing 100 of N" hint (line 6289); searching for `zzzz` shows a blank list with no empty-state text (empty-state exists only for Green Only).
- Evidence: Playwright "model search + provider chips" (2 assertions).

### BUG-022 | S3 | functional | Context overflow is billed without any warning
- Area: context bar, cost math.
- Repro: GPT-3.5 Turbo (16,385 ctx); send prompts of ~9k, 2k, 2.5k, 8k tokens.
- Expected: warn when input would exceed the window (or truncate).
- Actual: threshold classes work (warn at >60%, crit at >80%), but the fourth turn sends 21,993 input tokens to a 16,385 window; the label is clamped to "100.0%" and cost/CO2 keep growing.
- Evidence: `shots/ctx-warn.png`, `shots/ctx-overflow.png`.

### BUG-023 | S3 | calculation | Token estimator and intent detection
- Area: `TOKEN_ENGINE`.
- Actual:
  - 100 emoji count as 50 tokens (surrogate pairs counted as 2 chars at 4 chars/token); any BPE gives >=100.
  - Whitespace-only text shows "1 input token" in the live preview (`count('   ') = 1`), while the output estimate is 0.
  - `detectIntent`: `/\bbrief|concise|short answer|quick|.../` is unanchored, so "Write a Python quicksort" is classified `brief`; the built-in Summarize template ("3 concise bullet points") is `brief`, never `summarize`; "Step by step, how do I..." matches `\bsteps?\b` first and becomes `list`, so `tutorial` is unreachable for step-by-step prompts (lines 4163, 4168).
- Impact: output estimates and the whole simulated cost change with the misclassification.
- Evidence: Playwright "token counting", "intent detection regressions".

### BUG-024 | S3 | calculation | Turn explainer cost ignores prompt caching
- Area: "How was this calculated?" modal.
- Repro: GPT-4o, two turns, open the explainer for turn 2.
- Expected: explainer shows the cache-read discount used for the card.
- Actual: lines show `inputCost = 122/1e6 x $2.50 = $0.000305` and `outputCost = $0.001170` (sum $0.001475) but `totalCost = $0.001345` (the discounted number from the card). No mention of cache anywhere in the modal.
- Evidence: Playwright "turn explainer modal" and probe output (`cost 0.001345, noCache 0.001475`).

### BUG-025 | S3 | calculation | "km driven" equivalents use 404 g per mile
- Area: Usage panel footprint (line 9312), Analytics (line 7094, `/0.404`), explainer (line 6426).
- Repro: any session; compare "≈ X km driven" with CO2 / 251 (EPA 404 g/mile = 251 g/km).
- Actual: figures are ~1.6x too low (0.0009 vs 0.0015 km in the test session).
- Evidence: Playwright "Usage panel".

### BUG-026 | S3 | calculation | ESG methodology text contradicts the engine
- Area: ESG modal.
- Actual: "global avg 436 gCO2/kWh" and "power draw estimates (0.001-0.01 kWh/1M tokens)"; the app uses per-provider intensities of 90-600 g/kWh and 90-24,000 Wh per 1M tokens (0.09-24 kWh). The printed report also keeps the close "x" button.
- Evidence: `shots/esg-print-view.png`; line 7833.

### BUG-027 | S3 | functional | Prompt Optimizer destroys code indentation
- Area: Tools > Prompt Optimizer.
- Repro: paste `Please fix this:\n```python\ndef f(x):\n    if x:\n        return 1\n    return 2\n```\nThank you.` and click Optimize.
- Expected: indentation inside the code block preserved.
- Actual: rule `/[ \t]{2,}/g -> ' '` (line 5760) collapses every indent to one space, changing Python semantics. Per-model savings column prints the token reduction percentage next to a currency value, which reads as a cost reduction.
- Evidence: Playwright "Prompt Optimizer keeps code indentation intact".

### BUG-028 | S3 | functional | Fine-Tune ROI ignores two inputs and silently replaces 0
- Area: Tools > Fine-Tune ROI.
- Repro: change "Monthly Request Volume" and "Avg Tokens / Request"; set Monthly API Spend to 0.
- Expected: results change; 0 handled.
- Actual: results HTML is byte-identical after changing volume/tokens (variables read but unused, lines 7690-7692); spend `0` becomes $2,000 (`|| 2000`). Defaults (Mo. 5, 114% at 12 months) are arithmetically correct.
- Evidence: Playwright "FinCalc".

### BUG-029 | S3 | functional | Smart Route mis-prices free and negative-priced models, ignores currency
- Area: Tools > Smart Route.
- Repro: select `openrouter/auto` (price -1) and GPT-4o mini with EUR active; analyze "Hello?".
- Actual: Auto Router ranks #1; free models (price 0) are treated as $5/1M (`if (!pIn ...) pIn = 5`, lines 7474, 7494); estimate chip is "~$0.0300/1K prompts" even with EUR; only input price is used; token count is `length/4`, not `TOKEN_ENGINE.count`.
- Evidence: Playwright "Smart Route" (2 tests).

### BUG-030 | S3 | functional | Scenario Builder, A/B Test and Recommender only see a slice of the catalogue
- Area: V6 tools.
- Actual (code): `STATE.getModels().slice(0,60)` for Scenario/A-B selects (lines 5812, 5888) and `.slice(0,200)` for the Recommender (line 5629). The live list is unsorted (newest first), so with 460 models most popular ones (e.g. `openai/gpt-4o`) can be missing from the dropdowns. Not asserted in a spec; found by reading, option count not measured in-browser.
- Also: Recommender results show unformatted CO2 such as `57600000.0g CO2/mo` (S4 cosmetic).

### BUG-031 | S3 | functional | Budget guard: repeated toasts and webhooks; inert in default mode
- Area: sidebar Session Budget.
- Repro: key set, cap 0.0001, send, then type in the cap field.
- Actual: "Session budget exceeded" toast fires on every `BUDGET.update()` call (each keystroke in the cap field; 1 toast became 5), each also fires the `budget-100` webhook; the 70-72% warning only fires if the spend lands in a 2-point window (line 7205). Without a key the bar is permanently 0 ("Simulated, no real spend"), so the Session Budget cap never does anything in the default mode.
- Evidence: Playwright "Budget guard" (toasts 1 -> 5).

### BUG-032 | S3 | functional | Session Notes say "Auto-saved" but are memory-only; Copy throws when clipboard is blocked
- Area: Notes panel (also per-turn notes, ratings, bookmarks).
- Repro: type notes, reload.
- Actual: notes are empty after reload (`_content` is a JS variable, lines 8901+); bookmarks/ratings/turn notes are also in-memory. `NOTES.copyAll` calls `navigator.clipboard.writeText` unguarded: with permission denied, `pageerror: Failed to execute 'writeText' on 'Clipboard': Write permission denied`. `NOTES.clear` uses native `confirm()` while the file states dialogs were replaced by toasts.
- Evidence: Playwright "Bookmarks / ratings / notes" and tool-notes pageerror.

### BUG-033 | S3 | functional | Prompt Quality bar is stale after send and ignores template inserts
- Area: `QUALITY`.
- Repro: click a sidebar template (e.g. "Code"), or type a prompt, press Send.
- Actual: after Send the textarea is emptied programmatically, no `input` event fires, so the quality score of the sent prompt stays on screen; applying a template, a Share-URL prompt or Cmd+K flows sets `.value` without an `input` event, so no score appears. Also the listener is attached by a `setTimeout(800)`, so typing in the first 0.8 s is not scored.
- Evidence: Playwright "quality bar follows template insert"; probe (visible true after send).

### BUG-034 | S3 | functional | CSV export is open to formula injection
- Area: per-column CSV (`UI_COMPARE.exportCSV`) and APP CSV.
- Repro: send `=HYPERLINK("http://evil","x")`, click "CSV" on the column.
- Actual: the prompt cell is written as `"=HYPERLINK(...)"`; spreadsheet apps evaluate it. No leading-apostrophe/tab guard.
- Evidence: Playwright "Export CSV / JSON".

### BUG-035 | S3 | functional | Unescaped API metadata is injected as HTML; quote in a model id breaks inline handlers
- Area: Benchmarks calculator (lines 5523-5550), Live Bench card (line 8102), Scenario/A-B `<option>` labels (5814, 5890).
- Repro: serve `/models` with a model named `<img src=x onerror=window.__pwn=1>Evil & Co`; select it; open Benchmarks.
- Actual: script runs (`window.__pwn === 1`); Live Bench throws `SyntaxError: Invalid regular expression: missing /`. A model id containing `'` yields `APP.toggleModel('evil/o'neil')` and cannot be selected. The OpenRouter payload today has no such names, so exposure depends on the upstream API.
- Evidence: probe run output; Playwright "hostile model metadata".

### BUG-036 | S3 | layout | Collapsed sidebar keeps a 264 px empty column; collapse button scrolls away
- Area: sidebar.
- Viewport: 1440x900 (all desktop).
- Repro: click the collapse arrow; scroll the expanded sidebar to the bottom.
- Actual: collapsed sidebar is still 264 px wide and blank; content gains no space. The collapse button is inside the scroll container (at scrollTop 600 it is at y=-532), so it cannot be used when the sidebar is scrolled.
- Evidence: `shots/sidebar-collapsed.png`.

### BUG-037 | S3 | a11y | Keyboard and ARIA state
- Actual:
  - Welcome modal: no initial focus inside the dialog; Esc does not close it (the global Esc handler at line 6246 never touches it).
  - Mobile sidebar drawer does not close on Esc.
  - `aria-pressed` on currency buttons and `aria-selected` on tabs are never updated (always the initial values), so EUR can be active while USD reports `aria-pressed=true`.
  - Tools menu: Enter opens it, but ArrowDown does not move focus into the `role=menu`; no roving focus.
- Evidence: Playwright "onboarding", "keyboard: tools menu", "a11y: aria-pressed / aria-selected".

### BUG-038 | S3 | a11y | Dialogs and controls without names
- Actual: 17 modal overlays (`history`, `projection`, `rec`, `optimizer`, `scenario`, `abtest`, `router`, `finecalc`, `esg`, `livebench`, `rbac`, `shadow`, `policy`, `bookmarks`, `forecast`, `notes`, `webhooks`) lack `role="dialog"` / `aria-modal` (only onboarding, about, usage, finder and explainer have them); 15 icon-only buttons (the "x" close buttons) have no `aria-label` or title; 25 form fields (`proj-runs`, `proj-in`, `proj-out`, all `rec-*`, `scenario-model-*`, `ab-*`, `budget-input`, `hiw-provider`, ...) have no programmatically associated label, aria-label or placeholder. No focus trap in any modal. (Counts measured in-browser at load.)
- Evidence: Playwright "a11y" test output.

### BUG-039 | S3 | a11y | Dark-mode contrast below 3:1
- Area: dark mode.
- Actual: provider chips 1.73:1; "Open usage details" 2.25:1; green provider percentages 2.7:1; Benchmarks page title 2.89:1, section headings 2.70:1, value cells 2.90:1. Several sidebar elements become illegible.
- Evidence: `shots/dark-compare-two-models.png`, `shots/benchmarks-dark-inr.png`.

### BUG-040 | S3 | a11y | Mobile tap targets and input zoom
- Viewport: 390x812 and 768x1024.
- Actual: 47 controls under 44 px at 390 (currency buttons 23x19, toast close 11x16, Tools 85x34, Usage pill 34 px high, "Models" button 27 px high); 60 at 768. Prompt, search and API-key inputs are 13/12/11 px font, which makes iOS Safari zoom on focus.
- Evidence: `shots/viewport-report.json`; Playwright "mobile drawer".

### BUG-041 | S3 | functional | A/B Test Mode reports random noise as measured variance
- Area: Tools > A/B Test Mode.
- Actual: "Run the same prompt multiple times ... to measure output variance" but each run is `baseOut * (0.85 + Math.random()*0.3)` (line 5909); the "Consistency rating" is therefore always about 8-9% CV regardless of prompt or model, even with a real key. Not labelled as synthetic.
- Evidence: Playwright "Scenario builder math = sum of turns; A/B test" (CV 9.0%).

### BUG-042 | S3 | performance | localStorage growth
- Area: `STATE.saveHistory`, `API._writeCache`.
- Actual: after 3 models x 40 turns, `lti_sessions_v1` is 1,015,980 characters (10 sessions x whole turn history re-serialised on every send); the pricing cache adds another 827 K characters. Both are best-effort `try/catch`, so a quota failure is silent and history stops saving. Send latency stayed low (40 sends x 3 models in 0.7 s, 10,108 DOM nodes).
- Evidence: Playwright "perf: 3 models x 40 turns".

---

## S4

### BUG-043 | S4 | calculation | `gpt-4o[^-]` regexes never match the plain `openai/gpt-4o` id
- Area: simulated output multiplier (line 5056), Recommender affinity regexes (5653, 5656, 5657).
- Actual: the 1.15x frontier multiplier is skipped for GPT-4o (output/raw ratio 1.0 measured), as the id ends right after `gpt-4o`.

### BUG-044 | S4 | layout | Dark-mode toggle replaces its SVG icons with an emoji text node
- Actual: first click runs `textContent = ...` (line 5990) which deletes both SVGs; icon style differs from the page-load state after a reload (SVG with CSS).
- Evidence: Playwright "dark mode toggle" (SVG count 2 -> 0).

### BUG-045 | S4 | layout | Freshness footer bar is 11 px high with 10 px text
- Area: `#freshness-bar`.
- Actual: text is barely legible and clipped at the bottom edge, and gets covered by toasts (all viewports).
- Evidence: `shots/column-one-turn-1440x900.png`, `shots/viewport-report.json` (h=11).

### BUG-046 | S4 | functional | About copy: "30 curated hardcoded models" vs 47 in `FALLBACK_MODELS`
- Evidence: Playwright "about copy" (line 3076).

### BUG-047 | S4 | layout | Literal `&nbsp;` in the Latest Responses meta line
- Actual: header reads `Turn 1 &nbsp;·&nbsp; 1 model` (set via `textContent`, line 5166). Recommender also prints CO2 as `57600000.0g`.
- Evidence: `shots/column-one-turn-1440x900.png`.

### BUG-048 | S4 | functional | Cache-write premium is hidden by clamping
- Actual: on Anthropic-style models turn 1 costs slightly more than no-cache (claude-3-haiku `0.000145` vs `0.000144`) because the prompt is written at 1.25x; `USAGE` and the turn card clamp savings to zero (`Math.max(0, ...)`), so the "with caching" bar can exceed "without caching" while the text says "No cache savings".
- Evidence: annotation "haiku-turn1" in `results.json`.

### BUG-049 | S4 | functional | Currency, budget cap, green filter and region are not persisted
- Actual: after selecting INR, cap $5, Green Only and reloading, all reset (USD, $1.00, off). Selected models and conversations also reset; only theme, cache settings, history list and onboarding persist.
- Evidence: annotation "persist-after-reload".

### BUG-050 | S4 | functional | Sidebar "Green Only" badges and region adjustments are static constants
- Actual: the renewable percentage per provider (Google 90, Anthropic 85, ...) and region offsets (+8, +12, -5) are hard-coded guesses (lines 7903+); models from providers not in the table (including the live `meta/` namespace) get a default 50%. Presented as data with a leaf badge and used by the Green Only filter.
- Evidence: `shots/green-only-us-east.png`.
