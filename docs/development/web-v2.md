# Playable-v2 browser adapter

Issue #24 · 키키 · assignment generation 2 · base `a9273ea3597fbfb9730ca3bd653fdf5241b27f28`.

## Checkpoint status

The schema3 API/data checkpoint `b753dbf6c37078fbe4eb17dd7ac96c25c3ddbad9` was independently reviewed by both consumers. It supersedes the schema2 XP/books/manual-merge model. This branch provides a typed injected-runtime session/controller/renderer but intentionally does not route a live v2 game until the real core engine is available. No fake successful purchase/combat fallback exists. Default URL still runs unchanged v1; `?screen=v2-layout` mounts only a disabled shell.

Local compile/test consumption uses that exact core checkpoint without modifying core files. The adapter commits contain only the allowed web files. Integration must include the reviewed core API before typechecking; the API is a dependency, not a web-owned implementation.

## Screen acceptance targets

- Mobile: 390×844 CSS pixels.
- Desktop: 1165×747 CSS pixels, matching the first actual play observations.
- Show the 4×4 board, circulating-enemy pressure, wave/boss timing, eight bench places, current shop/action and start/pause together without the old tall hero header.
- Desktop uses a board column and decision column. Narrow screens use a compact board and four-by-two bench. Extended help and replay records are secondary collapsible panels, not permanent above-board content.
- Board/bench/shop actions remain keyboard buttons with explicit labels; color is not the only role, selection, slow or danger signal. Keep focus stable across updates. Escape clears selection without modifying game state.
- Mark inherent rarity and individual star separately. Rarity uses a readable label as well as color. No character levels, XP, books or manual merge controls belong in the revised flow. Show coin sale return and why a transaction is unavailable.
- New art remains a separate reviewed deliverable. Placeholder role shapes must be labeled as placeholders, not presented as approved character art.

The leader measured the inert shell at head `5f5c0c10a24264aa8cc28194b8358c6073c5d48b` in Chromium 151 at both target sizes, with no page errors or overflow (PR #28 comment 6094621044). This establishes only that disabled, empty shell. Real data, selection panels, intermediate breakpoints and controller interactions must be measured again after integration.

## Ownership and dependencies

All costs, effective range/damage, rarity probabilities, sale return, automatic upgrade planning, synergy and combat results come from the reviewed `core-v2` API. This adapter does not replicate gameplay formulas, inspect future RNG, or define a guessed core interface outside the approved checkpoint.

The v1 scheduler is engine-independent: it accepts the core's public tick duration, a stable per-match owner, phase lookup and advance function. It remains the time adapter candidate for v2; v2 phase/API compatibility will be verified before connection. Rendering and animation never advance a game independently.

`latest-task.ts` protects asynchronous presentation work with both a request generation and stable match identity. Superseded success/failure, restarted matches and disposal cannot publish old data. Reusing an owner additionally requires explicit invalidation. This helper does not make authoritative state changes.

## Required integration checks

- Real core: automatic-location recruitment and upgrade chains, blank shop slots, reroll, board↔bench move/swap, sale preview and confirmation, start and terminal restart. Saturated-bench purchase planning comes directly from core previews and dispatch.
- Selection/staleness: cancel, occupied destinations, full bench, repeated clicks, rejected transactions, superseded async snapshots and old-match inputs.
- Time: pause, hidden tab, page lifecycle, stale/duplicate RAF and fatal-core failure. Preserve v1 regression tests.
- Visual: range and support adjacency, distinct two-shot/splash/single attacks, hit/slow feedback, result reasons and automatic-upgrade results. Effects only display actual accepted core events.
- Replay: actual UI-produced canonical bytes/hash/log compared with the matching Node engine.
- Re-check both target viewports in an actual browser. Test results and screenshots from the prior technical-v1 build do not establish v2 correctness or layout quality.

## Revised-contract boundary

Issue #21 contains the current proposals: no independent deployed-unit headcount limit; physical board occupancy controls placement; three matching character/star units automatically upgrade across board and bench; no XP system. Three-star 2×2 footprints remain an unresolved proposal. The five rarity labels are 일반, 고급, 희귀, 영웅, 전설; the eight neutral definitions and public weighted probabilities are explicitly unapproved technical fixture data. Do not silently treat the former proposal1 rules ID or its approved type shape as the revised game. Existing local adapter sketches must be reconciled only against an explicitly reviewed replacement API before they are connected.

## Generation2 adapter behavior

- Selecting an offer opens the exact observed preview. Explicit 영입 sends only recruit/offerSlot; a board or bench click never implicitly buys. Preview symbols are display-only and never command targets.
- Purchase success selects the final committed recruited-event result ID, including two-step chains. Full-bench affordability/placement/upgrade validity is never independently inferred by the adapter.
- Labels come from rule character/rarity definitions. Rarity labels and individual stars remain separate; no fixed character-name enum or hidden rarity damage formula exists in the web layer.
- Preparation unit selection supports move/swap/sale confirmation. Combat and result unit clicks are inspection only. Rejected commands preserve selections; stale previous-match inputs are ignored.
- The controller reuses the tested stable-owner scheduler. Hidden tabs and pause freeze progression; terminal outcomes announce once. Fatal core/render errors stop progression without recursively observing a broken engine.
- Restart archives the old replay/hash before replacing its owner. Browser SHA work uses an invalidated latest-request gate so old successes/errors cannot overwrite a new snapshot or restarted match.

Adapter unit tests use explicitly injected mock APIs to test wiring only. They do not establish engine gameplay correctness. Current-SHA actual browser layout, runtime purchase/upgrade/attack behavior, browser–Node parity and human play remain unverified until integration.
