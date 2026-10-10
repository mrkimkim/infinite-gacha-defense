# Popo / Momo v5 combat candidate

**Candidate preservation only.** This PR does not select production art, map Popo to a fixture, alter runtime/core values, merge or deploy anything.

Task: [MVP-AM-ART-POPO-01, Issue24](https://github.com/mrkimkim/infinite-gacha-defense/issues/24), owner Momo, assignment generation3. Candidate-publication base: `8140bda52445c348d1c9dde6fc3265c0962af010`. Generation initially used reference base `412ddd2891655d96e7e9b0fff63e9ab7322699aa`; later main changes do not change the reference bytes.

## Review first
- [v5 contact sheet](v5/contact-sheet-32-36.png): measured32/36px body, cream/mint backgrounds.
- [Actual-board comparison](v5/board-contact-sheet-32-36.png): static320px-wide board crop with all16 slots occupied, no runtime claim.
- [Animated review GIF](v5/playback-36px.gif):36px body plus4x detail, lossy presentation.
- [Offline viewer](v5/viewer.html): download/open locally; all images embedded, no network dependency. Browser execution remains unverified in the author's environment.
- [Detailed limitations](v5/README.md), [measurements/provenance](v5/manifest.json).

V5 extends the same viewer-right empty paw beyond the ear in a directional strike, with no baked projectile. Single-button sprout apron and lavender heart-clasp bag remain recognizable. Idle and lowered recovery are distinct. Minor generated contour/bag/face drift remains for independent judgment. Existing Kiki candidate files were not changed.

## Reference and history
The authoritative [Popo original sheet](../../../../docs/reference/characters/popo/sheet.png) is already in the repository and is not duplicated here. SHA256: `324d5a44059328ec6e8219bb19f0f059275675c7a73a4c25fd7a01e7ea1be11b`. Actual sheet pixels and prior [PR34](https://github.com/mrkimkim/infinite-gacha-defense/pull/34) candidate pixels were inspected before generation. PR34 was reference/review context, not relabeled as new work.

Built-in image generation chain, exact raw bytes and prompts preserved:
1. `history/candidate-v1`: original sheet -> v1, rejected for wrong active arm/button drift.
2. `history/candidate-v2`: v1 -> same-arm correction, still extra button/weak recovery.
3. `history/candidate-v3`: original sheet + v2 -> single-button/lowered recovery correction.
4. `history/candidate-v4-alpha-attempt`: v3 -> attempted alpha-only edit. Not selected because it still had nearopaque interiors and slightly redrew contours; exact255-alpha is not a quality gate.
5. `v5`: v3 -> directional attack extension requested in independent review.

The board backdrop is a project leader's v02 assembled-board review image crop, not production art. Preserved local crop SHA is in the manifest; the full source presentation SHA256 was `9f412743535f6b8d19d562829cacf270ddf387295af18bdf7c76f2132c4d2920`. It is used only as a contrast test. The board's own seam/turn review remains separate.

Rights basis: project-owner-authorized original-character candidate preparation and project candidate publication. No new external license or final art acceptance is claimed.

## Timings and verified limits
The review loop is idle lead-in120ms -> attack100ms -> recovery140ms -> idle gap640ms. First and last frames are the **same idle image**, totaling760ms idle; no distinct anticipation pose exists. These are proposed visual-review timings, not core attack interval/damage/projectile values.

Native raw2172x724RGBA -> three896x768 frames with common foot pivot(448,704), translation only. Exact full RGBA reconstruction passes. Actual body heights are32/32/32 and36/36/36. Alpha was measured, never deleted/repainted: interiors are generally253/254, with22 of773650 eroded interior pixels below250. Nearopaque values and ordinary antialiasing are not automatic failures; light/dark/board target-size stills show no material body translucency.

GIF decoding and static DOM-stub controls/timing passed. Chromium here fails to start because `socket() failed: Operation not permitted`; attempted playback is explicitly blocked. Leader's working browser must verify live36px playback, transition quality and runtime source-to-hit synchronization. No actual playback or gameplay success is claimed here.

## Reproduce offline
Dependencies: Python3 with Pillow, NumPy and SciPy; Node for the static test. No package/dependency files outside this candidate scope are changed.

From this directory:

    python prepare_v5.py
    python inspect_alpha_v5.py
    python v5/build_playback.py
    node v5/verify_controls_static.cjs
    python verify_package.py

`prepare_v5.py` reconstructs the native extraction/previews and writes `v5/measurements.json`; it does not overwrite the publication manifest. Sources are never edited. `verify_package.py` checks hashes, raw/frame reconstruction, GIF durations/frame identity and local paths/embedded viewer inputs. It is not a browser test. `v5/verify_playback.cjs` can be run in a working environment with Playwright/Chromium, but is not part of the claimed passing checks.
