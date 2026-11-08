# TokenLens E2E bug log, v2 (revamped build)

- Date: 2026-11-08
- Commit tested: `a669c39` (final build of main, Vite project, as stated by the coordinator), served by `vite preview` at http://localhost:4196/. The served bundle was `assets/index-Bb13VEXw.js`; I did not verify that hash against the repo's `git log`. Everything below was observed in the live DOM of that bundle. Source-line references (`file.js:line`) come from the repo `src/js/` working tree and may not match the served bundle exactly; they are marked "source" where I could not confirm in the browser.
- Browser: Playwright 1.65.0, headless Chromium, macOS. v1 log (commit `72a36fa`, 50 bugs) is kept in `BUGS-v1.md`; bug numbers BUG-001..050 below are the v1 numbers.
- Network handling as in v1: `/models` from a recorded OpenRouter payload, aborted (offline) or delayed; `/chat/completions` never reached the network (stubbed 401); only the fake key `sk-or-v1-test`.
- Machine was short on disk and memory during this pass, so the suite was run one spec file at a time with 30 s timeouts.

## Counts

Status of the 50 original bugs:

| Status | S1 | S2 | S3 | S4 | Total |
|---|---|---|---|---|---|
| Fixed | 1 | 5 | 0 | 1 | 7 |
| Changed (partly fixed or relabelled) | 0 | 1 | 5 | 0 | 6 |
| Open (same defect reproduced) | 0 | 6 | 23 | 5 | 34 |
| Not re-tested | 0 | 0 | 1 | 2 | 3 |
| Total | 1 | 12 | 29 | 8 | 50 |

New bugs in this build: 2 (S2 1, S3 1). By type: calculation 1, layout 1.

Verification level: every "Open" row was either reproduced by a spec assertion that failed on the new build, reproduced by a DOM probe, or both; the evidence column says which.

## How this pass was run

- Specs `tests/01`-`07` re-run against the new build (selectors adapted: currency is now `#currency-select`; dialog buttons are `.tl-btn`). Results: 01 6/11, 02 1/7, 03 6/21, 04 22/34, 05 9/18, 06 11/16, 07 4/9, 08 (new layout matrix) 26/48, 09 (new features) 4/8 = 89/172 passing. Most failures are open bugs; the rest are stale selectors listed under "Stale specs" at the end.
- Spec `08-layout-matrix` ran 8 viewports (360x740, 390x812, 768x1024, 1024x768, 1280x720, 1440x900, 1920x1080, 2560x1440) x light/dark x {compare + header + menus + matrix, Benchmarks / How it works / Analytics, 21 dialogs}. Numbers are in `viewport-report-v2.json`. I looked at two screenshots myself (1280x720 light, 360x740 dark) and used DOM probes for the rest.
- Spec `09-new-features` and hand probes covered the command palette, `?` sheet, `g`+letter, `/`, offline chip and retry, matrix sort, Analytics isolate and CSV export, Benchmarks compare-selected, and the currency regression check.

## Coverage

| Feature area | Tested | Result | Bugs |
|---|---|---|---|
| Welcome dialog | yes (open, focus, Esc) | focus lands inside; Esc does not close; Next/Skip/dots flow not fully driven (my script could not click Next after step 1) | 037 |
| Header, tabs, bottom nav | yes, 8 viewports x 2 themes | no overflow at any size; tabs `aria-selected` now updates | none new |
| Currency | yes (select at 1440 and 390) | sidebar total, pill, column totals convert (after a ~1 s number animation); existing turn cards stay in $ | 006 |
| Dark mode | yes | toggle works, persists | 039 |
| Sidebar / rail (search, chips, cap, green, region, collapse) | partly | cap, truncation, chip, empty-state defects remain; collapse not re-tested (rail redesigned) | 020, 021, 036 |
| Prompt box, Simulate/Send, multi-turn, 10 models | yes | works; numeric core formulas still match hand recomputation | 016, 023 |
| Turn cards, column totals, context bar | yes | layout fixed; Output-per-$ still wrong; context overflow not warned | 001 (fixed), 015, 022 |
| Matrix | yes | sort works; not refreshed when models change | 017 |
| Tools dialogs (21 incl. palette, about) | yes: open, fit viewport, focus in, role=dialog, Esc closes | all pass at 768+; Finder and Forecast overflow at 360/390 | 052 |
| Tools: numerics (Projection, FinCalc, Router, Optimizer, Recommender, Scenario, A/B, ESG, Usage, Budget) | yes | several old defects remain | 012, 025-029, 041, 051 |
| Command palette, `?` sheet, `g`+c/b/h/a, `/`, `d` | yes | all work; shortcuts ignored while typing | none |
| Offline chip + Retry | yes | chip says "Offline - built-in list of 47 models"; Retry swaps in the live list | 014 (toast still says live) |
| Matrix sort, Analytics isolate + export CSV, Benchmarks compare-selected | yes | all work (isolate sets `aria-pressed`, CSV downloads with consistent columns, compare table renders) | none |
| Benchmarks / How it works / Analytics pages | yes at 8 viewports x 2 themes | no NaN, no console errors, no page overflow; HIW contents TOC is a horizontal scroller on mobile (by design) | 039 |
| Pricing cache paths (fresh, stale, offline, corrupt) | yes | pass | 014, 046 |
| Share URL | yes | defects remain | 019 |
| localStorage persistence | yes | defects remain | 032, 042, 049 |
| Print stylesheet | spec ran, screenshots not re-viewed | no regression seen | not re-tested visually |
| Keyboard focus rings | partly | 8 of 11 probed controls show a ring; Send, Templates and the prompt box inconclusive (probe method) | none |

## Status of the 50 original bugs

| Bug | Sev | v2 status | Evidence |
|---|---|---|---|
| BUG-001 turn cards collapse to a 20 px strip | S1 | Fixed | Turn list is 414-780 px tall at all 8 viewports; page scrolls normally (doc scrollHeight 2.3-3.3 k px). Screenshot checked at 1280x720. |
| BUG-002 Tools menu taller than viewport | S2 | Fixed | `#tools-dropdown` has `max-height` (644 px at 720 high) with an inner scrolling `.tools-list`; bottom always inside viewport. |
| BUG-003 header clipped at 1280 | S2 | Fixed | Header is 52 px tall, no child outside viewport at 360-2560, both themes. |
| BUG-004 Templates dropdown above viewport | S2 | Fixed | Dropdown spans y 215-708 at 1280x720, scrollable, inside viewport at every size. |
| BUG-005 mobile header overlap, panels overflow | S2 | Fixed | No page horizontal overflow at 360/390/768; bottom nav added; Benchmarks and Analytics fit. Model columns become a horizontal carousel on phones (second column peeks at x=340 of 360): a design choice, but see BUG-052 for new overflow. |
| BUG-006 currency leaves turn cards / Analytics in old currency | S2 | Open | After EUR the turn card still reads `$0.0011` while sidebar, pill and column total read EUR. Analytics not re-checked. |
| BUG-007 failed key shown as real response | S2 | Open | Fake key: card header is "Response 68 tokens" with no Simulated mark, no error toast, 2 chat calls. |
| BUG-008 negative price gives negative cost | S2 | Open | Injected `-1` model: session cost `$-106.999706`; spec 01 and 04 fail; Router still ranks Auto first. |
| BUG-009 deselect leaves stale totals | S2 | Open | After deselecting GPT-4o: sidebar `$0.0011` vs true `$0.000139`, 2 op cards, verdict still visible. |
| BUG-010 slow /models: controls dead | S2 | Open | Spec 01 "tab click before fetch resolves" still fails. Returning-user welcome flash assertion did not fail, so that half may be fixed (not separately probed). |
| BUG-011 Analytics donuts NaN | S2 | Fixed | 1, 2, 3 models and 12 turns: 0 NaN, 0 console errors; the donut charts were replaced by bar/row charts. |
| BUG-012 ESG JSON `power_kWh` holds Wh | S2 | Open | JSON still has `power_kWh: 0.3552` for a session whose power is 0.3552 Wh (source esg.js:81). |
| BUG-013 fabricated Shadow/Policy/Key Vault data | S2 | Changed | Shadow AI, Key Vault, Webhooks and Policy now say "Sample data"; Policy says rules are not applied to prompts. Policy still shows "87 triggers today" and still does not enforce; Live Bench and Forecast have no label. |
| BUG-014 offline toast says "live" | S3 | Open | Toast "47 models loaded live from OpenRouter" next to an "Offline" chip. |
| BUG-015 "0K tok/$" | S3 | Open | Column row reads "Output per $ 0K tok" for GPT-4o. |
| BUG-016 double submit in flight | S3 | Open | 1 click + Ctrl+Enter gave 2 turns and 2 chat calls. |
| BUG-017 Matrix stale on model change | S3 | Open | Added a model in Matrix view: header unchanged until next send. |
| BUG-018 Clear leaves Latest responses; bookmarks carry over | S3 | Open | Specs 03 and 04 fail both assertions. |
| BUG-019 share link fragile | S3 | Open | Malformed escape drops models; unknown id counts toward cap; clipboard rejection toasts success (3 failing assertions). |
| BUG-020 cap bypass by keyboard | S3 | Open | Spec 03: checkbox stays ticked after rejection. |
| BUG-021 Meta chip, 100-row cap, no empty state | S3 | Open | Three spec 03 assertions fail. |
| BUG-022 context overflow unwarned | S3 | Open | 21,993 input tokens to a 16,385 window still billed; label clamped at 100%. |
| BUG-023 tokenizer and intent regexes | S3 | Open | Emoji 50 tokens, whitespace 1, quicksort->brief, step-by-step->list, summarize->brief all still fail. |
| BUG-024 explainer ignores cache | S3 | Open | Spec 05 assertion fails (no cache mention in explainer). |
| BUG-025 "km driven" uses 404 g/mile | S3 | Open | Usage shows 0.0009 km for 0.3527 g CO2; 0.3527/251 = 0.0014. |
| BUG-026 ESG methodology text | S3 | Open | Still says 436 gCO2/kWh and 0.001 to 0.01 kWh per 1M tokens. |
| BUG-027 Optimizer destroys code indentation | S3 | Open | Probe: result no longer contains `    if x:\n        return 1`. |
| BUG-028 FinCalc ignores inputs, 0 becomes default | S3 | Open | Changing volume and tokens leaves results identical; spend 0 still shows Month 5 / 114%. |
| BUG-029 Router prices | S3 | Open | Auto Router ranked first with a -1 price; estimates stay in `$`. |
| BUG-030 tools see only first 60/200 models | S3 | Open (source) | `v6.js` slices 200 / 60 / 60; offline Scenario select has 48 options. Not measured on the live catalogue. |
| BUG-031 Budget guard toast spam, inert | S3 | Changed | Toast spam fixed (1 toast -> 1 after typing); in simulated mode the budget bar still never moves ("Simulated"). |
| BUG-032 Notes not persisted; Copy throws | S3 | Open | Notes empty after reload; Session Notes tool spec still sees `writeText` pageerror. |
| BUG-033 Quality bar | S3 | Changed | After-send stale state no longer fails; template insert still does not update the score. |
| BUG-034 CSV formula injection | S3 | Open | Spec 04 assertion fails. |
| BUG-035 unescaped API metadata | S3 | Changed | Script injection via model name no longer fires; an id containing `'` still causes `pageerror: missing ) after argument list`. |
| BUG-036 sidebar collapse | S3 | Not re-tested | Rail redesigned; spec 03 collapse test timed out on a click I did not diagnose. |
| BUG-037 keyboard/ARIA state | S3 | Changed | Fixed: tabs `aria-selected`, Tools menu arrow keys (spec passes), mobile drawer Esc, focus enters the welcome dialog. Open: Esc does not close the welcome dialog. |
| BUG-038 dialogs and controls without names | S3 | Changed | All 21 dialogs have `role=dialog` + `aria-modal`, focus moves in, Esc closes. Icon-only buttons check still fails in spec 05; field labels not re-counted. |
| BUG-039 dark-mode contrast | S3 | Open | Provider chips 2.40:1, Retry 1.92:1, Benchmarks "Copy" labels 1.92:1 (spec 05). |
| BUG-040 mobile tap targets, input zoom | S3 | Open | At 360/390: header controls are 36x36 (was 23x19), toast close 28x28; 16 controls <44 px; API-key input 11.4 px, prompt 14 px. The "Models" button is now 119x44. |
| BUG-041 A/B Test random noise | S3 | Open | Output variance is still random per run (CV 8.3% in one run, 0.5% in another for the same prompt). |
| BUG-042 localStorage growth | S3 | Open | `lti_sessions_v1` is 1,016,823 characters after 3 models x 40 turns. |
| BUG-043 gpt-4o regex | S4 | Open | Spec 02 still fails. |
| BUG-044 dark toggle icon swap | S4 | Fixed | Toggle spec passes. |
| BUG-045 freshness bar | S4 | Not re-tested | Footer redesigned (`#footer-status`); not measured. |
| BUG-046 About "30 curated" | S4 | Open | Spec 01 still fails. |
| BUG-047 literal `&nbsp;` | S4 | Open | Screenshot: "Turn 2 &nbsp;·&nbsp; 3 models" under Latest responses, at 1280 and 360 widths. |
| BUG-048 cache-write premium hidden | S4 | Open | claude-3-haiku turn 1 cost `0.00015` vs no-cache `0.000149`. |
| BUG-049 settings not persisted | S4 | Open | Currency still resets to USD after reload (spec 07). |
| BUG-050 static green data | S4 | Not re-tested | Green filter data not re-examined. |

## New bugs

### BUG-051 | S2 | calculation | Usage panel "This session" tiles disagree with the session totals and go negative
- Area: Usage and caching dialog, "This session" KPI tiles.
- Viewport: 1440x900 (not size dependent).
- Repro: Offline fallback list. (A) Select GPT-4o, send "Explain RAG in detail.", open Tools > Usage and caching. (B) Select GPT-4o + Claude 3 Haiku, send three prompts, open Usage.
- Expected: tiles equal the totals shown in the sidebar and `STATE.globalTotals()`.
- Actual: (A) after turn 1 the Cost tile reads `$0.0008` and Tokens `84` while the session total is `$0.0010` and 105 tokens; after turn 2 Cost `$0.0017` and Tokens `238` against `$0.0022` and 313. (B) the tiles show Cost `$-0.0000`, Cache saved `$-0.000002`, Tokens `-0.01k`, CO2 `-0.002g`, Water `-0.1mL`, Power `-0.0073 Wh` while the breakdown table in the same dialog shows `$0.0040` of spend.
- Evidence: probe output (kept in this log); the "Session budget" row in the same dialog shows the correct `$0.0040`.
- Suspected cause: the revamped Usage tiles compute a derived value (looks like a difference between two aggregates) rather than the plain total; `usage.js` `gather()` itself sums correctly in the repo source, so the defect is in the tile construction in the served bundle.

### BUG-052 | S3 | layout | Finder and Forecast dialogs overflow horizontally on phones
- Area: Smart model finder (provider chips), Cost forecast (scenario button).
- Viewport: 360x740 and 390x812, light and dark.
- Repro: open Tools > Smart model finder; open Tools > Cost forecast.
- Expected: dialog contents wrap or scroll inside the dialog.
- Actual: the `Meta` and `Mistral` chips (`#fchip-meta`, `#fchip-mistral`) and the `.fc2-scenario-btn` sit past the right edge of the 360 px dialog. All other 19 dialogs fit at every size.
- Evidence: `viewport-report-v2.json` keys `360x740/light/dialog-finder` and `.../dialog-forecast`.
- Suspected cause: non-wrapping flex row in the Finder chip bar and the Forecast scenario button group.

## Logic bugs reported by the UI agents

| Reported item | Mark | Note |
|---|---|---|
| `donutSVG` receives a formatted label string instead of a numeric total (NaN paths) | reported, not reproduced | No NaN and no console errors in Analytics with 1-3 models and 12 turns; the donut charts are no longer in the page. |
| Literal `&nbsp;` in Latest responses meta | reproduced | See BUG-047. |
| "Output per $" labelled K tok but value is in millions | reproduced | Shows `0K tok` for GPT-4o; the unit mismatch is the same factor as BUG-015. |
| Currency change does not refresh existing turn cards or Analytics | reproduced (turn cards); Analytics not re-tested | See BUG-006. |
| Policy rules never evaluated | reproduced | Prompt with SSN and card number sent unflagged with all rules on; dialog now says rules are not applied. |
| Shadow AI / Key Vault / Webhooks / Policy use hard-coded demo data | reproduced, now labelled | Each says "Sample data"; Live Bench and Forecast carry no label. |
| Live bench values are random | reported, not reproduced | Not measured in this pass. |
| Fine-tune ROI ignores monthly requests and tokens inputs | reproduced | See BUG-028. |
| ESG JSON `power_kWh` holds Wh | reproduced | See BUG-012. |
| -1/0-priced models give negative or zero cost; a free model flagged best | reproduced for -1 (negative cost, Router ranks it first); reproduced for 0 (Recommender top 3 at a $10 budget were all `$0.000000/mo` free models) | See BUG-008, BUG-029. |
| Recommender / Scenario / A-B only see the first 60/200 models | reported, not reproduced in the browser | Slices confirmed in `v6.js` source; see BUG-030. |
| Init toast says "loaded live" when the offline fallback is used | reproduced | See BUG-014. |
| Break-even savings shows 0% when one model costs $0 | reported, not reproduced | Not tested. |
| Water WUE / Wh figures inconsistent between Benchmarks and How it works | reported, not reproduced | Not compared. |
| Analytics projection "% of avg US daily" computed on Wh | reported, not reproduced | The "Scale projections" section exists; values not checked. |
| KPI "Turns" is max, not total | reproduced as described | 3 turns on 2 models shows Turns `3`, not 6 turn cards. |

## Stale specs (markup moved, behaviour not shown broken)

- `02-compare-math` turn-card and column-total readers still use the old markup; the core STATE-based cost, cache, CO2, water and power assertions pass.
- `03-sidebar-prompt` collapse/templates and history tests time out on a click (new rail and dialog markup; cause not diagnosed). Welcome-dialog test clicks the removed `.onboard-start-btn`.
- `05-tabs-misc` Analytics "8 charts" count (the page now has 6 chart sections).
- `06-viewports` is superseded by `08-layout-matrix`.
- `09-new-features` shortcut test needed a 250 ms wait after `/` (focus is deferred 60 ms); fixed in the file but 09 was not fully re-run afterwards.

## Not tested or unverified

- Real chat-completion success path (no real key); only the 401 stub.
- Safari, Firefox, physical devices, screen readers.
- Print stylesheet was not re-viewed after the revamp.
- Analytics currency, break-even with a $0 model, WUE consistency, Analytics projection percentages, Live Bench numbers, Green data, sidebar collapse, footer bar, welcome Next/Skip/dots flow.
- Spec 09 and the stale specs were not all re-run after the last selector fixes, so their pass counts above are from the run before those fixes.
- I did not diff the served bundle against repo source; source-line references may differ from what the browser runs.
