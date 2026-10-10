# Playable-v2 browser adapter

Issue #24 · 키키 · assignment generation 1 · base `a9273ea3597fbfb9730ca3bd653fdf5241b27f28`.

## Checkpoint status

The v2 core API checkpoint has not yet been imported. The current work is an engine-independent screen shell and presentation-task isolation. It is not a working v2 game, and disabled shell controls do not simulate successful purchases or combat. The existing v1 game and its regression tests remain unchanged; `entry.ts` routes the default URL to it. Only `?screen=v2-layout` mounts the explicitly inert v2 screen.

## Screen acceptance targets

- Mobile: 390×844 CSS pixels.
- Desktop: 1165×747 CSS pixels, matching the first actual play observations.
- Show the 4×4 board, circulating-enemy pressure, wave/boss timing, eight bench places, current shop/action and start/pause together without the old tall hero header.
- Desktop uses a board column and decision column. Narrow screens use a compact board and four-by-two bench. Extended help and replay records are secondary collapsible panels, not permanent above-board content.
- Board/bench/shop actions remain keyboard buttons with explicit labels; color is not the only role, selection, slow or danger signal. Keep focus stable across updates. Escape clears selection without modifying game state.
- Mark star and level separately. Show selling coin/XP return and book target before commit. Show why a transaction is unavailable.
- New art remains a separate reviewed deliverable. Placeholder role shapes must be labeled as placeholders, not presented as approved character art.

These are acceptance targets, not measured layout results. Browser rendering and controller interactions must be checked after integration.

## Ownership and dependencies

All costs, effective range/damage, level thresholds, sale return, XP distribution, synergy and combat results come from the reviewed `core-v2` API. This adapter does not replicate gameplay formulas, inspect future RNG, or define a guessed core interface while that checkpoint is pending.

The v1 scheduler is engine-independent: it accepts the core's public tick duration, a stable per-match owner, phase lookup and advance function. It remains the time adapter candidate for v2; v2 phase/API compatibility will be verified before connection. Rendering and animation never advance a game independently.

`latest-task.ts` protects asynchronous presentation work with both a request generation and stable match identity. Superseded success/failure, restarted matches and disposal cannot publish old data. Reusing an owner additionally requires explicit invalidation. This helper does not make authoritative state changes.

## Required integration checks

- Real core: bench recruitment, blank shop slots, reroll, board↔bench move/swap, explicit three-unit merge, sale preview and confirmation, XP book application, start and terminal restart.
- Selection/staleness: cancel, occupied destinations, full bench, repeated clicks, rejected transactions, superseded async snapshots and old-match inputs.
- Time: pause, hidden tab, page lifecycle, stale/duplicate RAF and fatal-core failure. Preserve v1 regression tests.
- Visual: range and support adjacency, distinct two-shot/splash/single attacks, hit/slow feedback, result reasons and pending XP. Effects only display actual accepted core events.
- Replay: actual UI-produced canonical bytes/hash/log compared with the matching Node engine.
- Re-check both target viewports in an actual browser. Test results and screenshots from the prior technical-v1 build do not establish v2 correctness or layout quality.
