# Independent Nuri v05 review

## Bounded verdict

**Meaningful candidate improvement. The targeted shell–tail clearance and separate-bubble readability checks pass in the inspected native-Canvas samples. Ready for candidate preservation and actual playback review, not final animation or engine approval.**

Compared with v04, the selected release reaches outward instead of up, shows a cupped shell mouth toward down-right, lowers the tail, and emits one substantial blue droplet. The rejected high-arm attempt is correctly preserved but not selected. No dotted line substitutes for a projectile or hit.

This review uses original/reference pixels, source and metadata inspection, the supplied contact sheet, and independent read-only native-Canvas measurements. No browser playback, engine execution, image generation or source-raster edits were performed. Known browser restrictions were not retried or bypassed.

## Targeted visual results

### Actual 32px shell–tail background gap: improved and verified within scope

The provided contact sheet's actual-32px release has **24/24 exact background pixels** in rectangle `[548,159,560,161)`: two clear rows of RGB (245,240,230) between the shell and exposed tail. The previous v04 diagonal contact is gone. At 36px, the corresponding inspected patch is 25/26 exact background pixels, with the remaining pixel within two RGB levels of the background.

Independent in-memory rendering at **16 quarter-pixel ground placements for each size**, using alpha≥8 and alpha≥128, finds minimum pixel-square boundary gaps of:

- **32px: 1.0px**
- **36px: 1.414px**

The integer placement has a 2px boundary gap. These checks use explicitly bounded lower-shell/exposed-tail regions. They do not certify every possible fractional offset, browser rasterizer or another attack direction, but they do resolve the concrete native-Canvas clearance failure recorded for v04. Pixel-center distance alone was not used as proof.

### Separate visible bubble and down-right release: substantial improvement

The droplet has a coherent solid silhouette and a dark outline; its direction agrees with the shell opening and down-right path. It is clearly more legible on both light and dark boards than v04's disconnected specks. The character's same shell hand, scarf side and overall body orientation are retained. The arm is no longer raised like a celebration, and the lowered tail supplies the clearance without that wrong gesture.

Independent comparison of the actual rotated scene with and without its separate bubble finds **36 visibly changed pixels at 32px** in both launch and mid-flight, on both backgrounds. At 36px the result is 45–48 pixels. The threshold is a greater-than-10 change in any RGB channel; 34–36 of those 32px pixels also exceed 30. This is descriptive pixel evidence, not a universal perception threshold.

The advertised 8px/9px widths are nominal sprite dimensions before rotation. The measured mid-flight visible bounding boxes are 9×6px at 32px and 11×7px at 36px. The wording was clarified accordingly. One bubble is drawn in launch/flight; impact and ripple are separate assets, shown in the impact/recovery phases. No dotted connection is drawn.

## Identity, acting and feet

The five source drawings still read as Nuri: brown otter, cream face/belly, three cheek freckles, viewer-right blue scarf knot, mint sprout apron and peach shell in the same hand. Preparation visibly cups the shell and release clearly extends it. **Idle and recovery remain weakly distinct at board size**, so this is not a passed five-pose readability result.

Head movement is not itself a defect. An upper-head alpha-band diagnostic moves −0.426px in preparation and +0.279px in release relative to idle at 36px, roughly 0.705px between those two poses. This is smaller than v04's corresponding shift and may contribute to acting. The static atlas preserves recognizable identity; it does not establish whether all contour/face/scarf differences play as intentional motion or as flicker. A zero-head-motion rule is not imposed, and this centroid result is not an automatic failure. Actual temporal review is needed to distinguish those outcomes.

Each foot was checked separately after the documented common-scale pivot translation. The author's eight-pixels-above-baseline result is correct: maximum center displacement is **0.116667px at 32px / 0.13125px at 36px** in release, with opposite left/right signs. Another slice, 24 source pixels above the baseline, reaches 0.16875px at 36px on the release right foot. Therefore the single-row value must not be described as a bound on the whole foot shape. Recovery's source baseline is 614 versus 613 for the others; pivot translation aligns the displayed floor. Heights at common 36/480 scale are 36, 35.925, 35.925, 36 and 35.85px. This is small residual generated-shape variation, not proof of an identical fixed rig or a demonstrated playback foot-pop.

## Preview semantics and metadata

Manifest, viewer data and embedded fixture agree. The proposed art sequence is:

- Idle 450ms
- Preparation 260ms
- Launch 150ms
- Flight 400ms
- Impact 160ms
- Recovery 180ms
- Settled idle 450ms

Character ground is (48,60); fixed target centers are far (144,89) and near (108,89), with bottom y97. The separate bubble starts just outside the release rim and follows a straight interpolated path to the selected fixed target. Impact phase removes the bubble and shows tint/impact/ripple. Manual step shows the flight midpoint. Pause/hidden-tab logic resets wall-clock accumulation in this preview. Source inspection supports these authored semantics; it is not actual playback or low-FPS evidence.

No HP is simulated or changed. There is no connection to schema4, committed engine hits, damage, moving/dead targets, multiple hits or an AoE radius. This proposed flight study must not be represented as compatible with the old immediate-hit presentation merely because it is viewable. Runtime/RAF/reset behavior remains a separate integration gate.

## Exact reviewed artifacts and preservation

All four selected PNG hashes match the manifest and byte-for-byte embedded HTML assets:

- Character: `9e89cce33db28c8eda5bd66b81804a9c506941c1ec46ece829a57f1de59c736d`
- Bubble: `db8f367946be1d83b2c6b27a0ad7396ee745a33dcc22979a4c103a1556b4b684`
- Impact, reused unchanged from v04: `5765e53597267abd72a3ab147cb2f37e6e32b4f4d6d3c6e7cf1729041959f863`
- Ripple, reused unchanged from v04: `3eefc591750cc58ba0d16f73dd8c9cba15b45e8392abc6d7d32208477425fdb3`

Reviewed HTML: `3eb3a4715d2c2bfb40668cf2551e8142dedcd1a7fc52320326bab58e0ce4d77c`.
Reviewed contact sheet: `d45bad630ba532ea6b8193a6ba7a58e9984cea862b3ac27189453b1a0548555b`.

The v04 selected reference remains byte-identical to its preserved source (`2c65e3deeabf77145e99fcdd813a68fc999678aca5beb8213efa3643f94a7e32`). The original local review confirmed all 41 non-hidden candidate files in the author's before-edit snapshot. For public reproduction, the preservation inventory instead lists all 40 files in the published v04 package at commit44e54f91e6f81777f7e94ab12f02942cc2ddc39b; those files are unchanged. Private working-file inventories are not included. Both v05 character attempts remain present. Structural checks report 14/14; those checks are not animation-quality or engine acceptance.

Full evidence and scope: `independent-review-measurements.json` and `independent-review-check.cjs`. The check script writes only its measurement JSON. Native-Canvas scratch rendering stays in memory; no raw or review PNG is rewritten.
