# Board v03 opt-in integration review

This is the bounded MVP-AM-BOARD-INTEGRATION-01 experiment from [Issue 24](https://github.com/mrkimkim/infinite-gacha-defense/issues/24), assignment generation 4. It is not production adoption or permission to merge/deploy.

- Runtime base: `8140bda52445c348d1c9dde6fc3265c0962af010`
- Candidate: [PR 44](https://github.com/mrkimkim/infinite-gacha-defense/pull/44), exact head `761df8c30fd07b719b6e1d046d1d0d33df38e257`
- Atlas, sprites.json, generation prompt and REVIEW.md are byte-identical copies of that candidate. Their source hashes are enforced by tests. No source PNG crop, repaint, alpha cleanup or compression was performed.
- No character mapping, engine/rule/economy/RNG/log, shell, character-art module or existing stylesheet change is included.

## Routes

- Baseline: `?screen=v2&seed=2`
- Candidate: `?screen=v2&seed=2&boardSkin=v03`
- Explicit v1 regression: `?screen=v1&boardSkin=v03`
- Default URL remains v2 without the candidate. Unknown or repeated boardSkin values do not activate it. The inert `screen=v2-layout` route is unchanged.

The candidate route shows a visible Korean review marker below the arena. A decode error or unexpected atlas dimensions keeps the default board and shows a load-failure note. The adapter attempts one load per mount; render, pause and restart do not retry or recreate the tiles. Disposing before/after decoding prevents late activation.

## Display contract

Twenty road viewports form the 6×6 perimeter. The 4×4 buttons keep their nodes, roles, labels, disabled state and event handlers. Their zero-gap layout spans the inner four pitches, with a one-pixel decorative inset per cell. Hero normal/alternate/hover/selected faces use their original individual source rectangles, normalized only by CSS to square display regions.

The arena content maps world coordinates as `(world + 1000) / 6000 × contentSize`. At CSS arena widths 288 and 430, the two-pixel border produces content sizes 284 and 426, hence pitches 47.333… and 71. The board centers and road centerline agree with the core's public coordinates.

Decorations are aria-hidden and pointer-transparent. Layers are road 0, board 1 and existing enemy/effect SVG 2. The default path and placeholder label are hidden only after successful candidate activation. Button normal, hover and disabled backgrounds are transparent while retaining their real interactive state. Keyboard focus has a separate bright outline.

Labels use white on opaque `#142332`, a calculated contrast ratio of 15.95:1 independent of atlas translucency. At widths up to 700px, the board's full name is visually clipped but remains in the button accessible name/title and selected-unit panel. Rarity and star remain visible on the board; bench/shop text is unchanged. A 36px token plus 10px detail line uses 46px of the 47.333px mobile cell, without flex shrinking. The runtime currently retains its existing 32px character-art display API and neutral role icons; 34/36px budgets are structural calculations, not adoption of those assets.

Range, support, slow and splash receive skin-scoped lighter strokes. Attack lines retain their event-dependent color and add a light outline glow. No effect geometry or event payload changes.

## Verified locally

- `npm run check`: typecheck, 378 tests passed, zero failed/skipped, tooling build passed.
- `npm run typecheck:core`: passed.
- `npm run build`: passed; the built atlas retains the source SHA256.
- `git diff --check`: passed.
- Thirteen board-specific checks cover the explicit gate; raw file hashes and coordinates; all twenty ring locations; fractional and 1×/1.25×/2× viewport math; async error/disposal; decoration-only DOM mutation; state/focus CSS; default/v1 routing; public arena geometry; and real core recruitment/placement/combat/pause-display/restart projection parity with unchanged canonical state, replay and RNG.
- Additional display fixtures check unchanged range/support/HP/slow/attack SVG nodes and event data. These fixtures are not reachable gameplay evidence.
- Existing v1 tests and all other suites remain included and unchanged. Entry, v1 files, shell/art modules and core have no diff against the pinned base.

## Required browser review: not yet performed

Local Chromium execution is blocked by the environment's socket permission restriction; it was not retried or bypassed. No screenshot, actual DOM layout, pointer/keyboard browser input, or visual-play pass is claimed here. Automated DOM sinks and CSS calculations are not a browser substitute.

At exact integration head, collect paired baseline/candidate screenshots at 390×844 and 1165×747. Check:

1. Recruitment, all sixteen cell hit targets, placement, selection/cancel, range, combat/HP/slow/support/attack effects, pause/resume and restart.
2. Normal/hover/keyboard-focus/selected/disabled transitions, candidate-load failure and explicit v1.
3. Label backing and full information availability, character feet and 32–36px token budget, empty-cell states and lack of clipping/overlap.
4. Enemies crossing all four corners; ring continuity and effects remaining above the art.
5. 1×/2× display sampling and fractional-scale seams on light/dark surrounding backgrounds.

The source's detached inner-corner rail marks, guide endpoint/color offsets and partially transparent interiors/fringe remain intentionally unchanged. This integration cannot establish that those visual issues are fixed. The exact current SHA still needs independent peer review and the leader's browser evidence before any adoption decision.
