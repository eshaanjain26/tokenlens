# Handoff — TokenLens: LLM Cost & Sustainability Intelligence Platform

**Date:** 2026-07-08 (session 2)
**Branch:** git initialized this session (see note below on persistence)
**Primary file:** `llm-token-intelligence.html` (505,220 bytes · 9,086 lines · single-file, all inline)

---

## What changed this session

Started from the 2026-07-08 (session 1) handoff. Ran a code-level audit against the "What Didn't Work" / "Open Questions" list and fixed five real bugs, all verified with `node -e "new Function(...)"` (brace balance 0, no syntax errors) after each change:

1. **GREEN badge and Green-Only filter were both dead code.** `renderModelList()` never called `GREEN.getBadgeHtml(m)` or `GREEN.shouldShow(m)` — confirmed by reading the function directly. Worse, `GREEN.onToggle()` and `GREEN.onRegion()` called `APP._renderModelList()`, but `APP`'s returned object never exposed `_renderModelList` in the first place, so toggling "Green Only" silently did nothing at all, even before this session. Fixed: `renderModelList()` now filters on `GREEN.shouldShow(m)` and injects `GREEN.getBadgeHtml(m)` next to each model name; `APP`'s return object now exposes `_renderModelList`; `onRegion()` also re-renders the list since region shifts the renewable % threshold.
2. **LIVEBENCH had no per-model stability.** `_baseTTFT()` called `Math.random()` fresh on every 30s tick, so TTFT/P50/P95/sparklines jumped wildly per the "Open Questions" note. Fixed: added a deterministic hash of `m.id` to seed a stable per-model baseline (cached in `_baseCache`), and changed `_variance()` from a single uniform draw to a 3-sample average (cheap gaussian approximation) so ticks drift smoothly around that baseline instead of snapping.
3. **ESG print view printed the whole page.** `ESG.printReport()` just called `window.print()`. Added a `body.printing-report` scoped `@media print` block that hides `#app` and lets `#esg-modal` render as a static, full-width block; `printReport()` now toggles the class around `window.print()` with an `afterprint` listener (plus a 2s fallback) to clean up.
4. **shareURL length.** Audited empirically: worst case (10 models + 200-char prompt, encoded) lands around 1,100–1,200 chars, safely under the ~2,048 char limit some browsers/proxies impose. No structural fix needed; added a defensive `TOAST.warning` if a generated link ever exceeds 1,900 chars.
5. **Analytics tab cost-over-time chart — already done.** Read through `UI_ANALYTICS.render()` in full: it already has 8 SVG charts including `costLineSVG` (cost per turn) and `cumCostSVG` (cumulative cost over turns), same inline-SVG pattern as FINECALC. The "Next Steps" note in the prior handoff was stale on this point — no changes made here.
6. **Live pricing fetch — already existed, added the missing caching.** `API.fetchModels()` already fetched `https://openrouter.ai/api/v1/models` on init with a graceful fallback to `DATA.FALLBACK_MODELS` and a Live/Offline badge in the freshness bar. What was missing: the 24-hour `localStorage` TTL cache called for in the prior Next Steps. Added `_readCache()`/`_writeCache()` against `tl_pricing_cache_v1`: fresh cache (<24h) is served without a network call; a failed fetch falls back to a stale cache before falling back to the hardcoded list; the freshness-bar badge now shows Live/Cached/Offline plus a relative timestamp (`title` attribute has the exact fetch time).

Verified after all changes: single `<script>` block, `new Function()` parses clean, brace balance 0, 9,086 lines (up from 8,966), 505 KB (up from 474.5 KB).

---

## Git

Initialized git and made two commits reflecting the state before/after this session's fixes:

- `c9f2272` — Initial commit: TokenLens baseline (8,966 lines)
- (fixes commit) — GREEN/LIVEBENCH/ESG/shareURL/pricing-cache fixes (138 insertions, 18 deletions)

**Known constraint:** the Cowork sandbox's mounted output folder intermittently rejects `git`'s lock-file writes/deletes (`Operation not permitted` on `.git/index.lock`, `.git/HEAD.lock`) — the same class of issue the prior session flagged for file reads on mounted paths. Git commands worked reliably in `/tmp` inside the sandbox but that directory doesn't persist across sessions. **Recommendation:** run `git init` once directly on your Mac (on the real Desktop or wherever the working file lives) rather than relying on this environment to carry git history forward — that removes the mount/lock problem entirely.

---

## Do Not Repeat (still applies)

- Do not split the file into multiple files or introduce a build system.
- Do not use `const` or `let` at module scope.
- Do not use `fetch()` without a fallback — preserved; the pricing cache adds a third fallback tier (live → cache → hardcoded) without removing the offline path.
- Do not duplicate `esc()` at global scope — no new IIFEs were added this session, so this wasn't at risk.

---

## Remaining from the original Next Steps list (not touched this session)

- Real API streaming (SSE/EventSource) for `APP.send()` — still a placeholder.
- Publishing/distribution (GitHub Pages, Vercel, etc.) — no decision made.
- A live browser smoke test (actually clicking through the UI) wasn't run — this session's verification was static/code-level (Node syntax parsing + manual trace of the render/filter logic for GREEN, LIVEBENCH, ESG, shareURL). If you want a true rendered-DOM check, that needs a real browser session against the file.
