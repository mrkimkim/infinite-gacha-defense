# Nuri v03: candidate requiring leader playback recheck

Recommendation: preserve this candidate for actual playback comparison. The measured height loss is corrected, but individual foot drift and shell/tail contact remain unresolved. Equal measured heights alone do not prove a smooth transition.

## Files

- `raw.png`: unchanged generated output, 2158×729 RGBA, 1,344,822 bytes.
- SHA-256: `c53d340bcb53386dfd0a2424a0d24a853b32ba12b732e6c5434c52969599727f`.
- `nuri-v03-portable-playback-review.html`: self-contained embedded-PNG viewer; no neighboring file needed.
- `measurements.json`, `foot-comparison.json`: bounds, both feet and limitations. Provenance and reference links are in the main README.
- `prompt.txt`: exact v03 edit prompt.
- `portable-playback-checks.json`: structural/model/mock-UI checks, separate from visual browser review.

v01 and v02 remain unchanged. No raster post-processing, crop export, resampling or alpha cleanup was performed.

## What changed

The original Nuri face/outfit identity is retained: brown otter, cream muzzle/belly, freckles, blue side-tied scarf, mint sprout apron, peach shell in the same hand and broad tail. The third pose stands at the same measured height as idle instead of crouching. The shell is raised above the feet. Head/face/clothing pixels are not identical copied stamps, despite that generation request.

The recovery shell still touches or overlaps the brown tail contour at full size. Its32/36px separation cannot be approved from this inspection. The requested fully separated outboard silhouette was not completely achieved.

## Exact geometry

Alpha≥128 body heights: idle625px, attack625px, recovery625px. With common36/625 scaling, all three heights are36px; no whole-frame normalization was used. The prior recovery-to-idle height difference3.2256px becomes0 by this measurement. Pose/shape changes can still cause motion discontinuity.

Bounds are x0/y0 inclusive, x1/y1 exclusive. No regular grid is assumed.

| Pose | Alpha≥8 bounds | Alpha≥128 bounds | Proposed sole midpoint/baseline |
|---|---|---|---|
| Idle | [136,45,627,673] | [137,46,626,671] | (354.5,671) |
| Attack | [778,47,1418,674] | [779,48,1417,673] | (1051,673) |
| Recovery | [1546,47,2063,674] | [1547,48,2062,673] | (1770.5,673) |

Both sole runs are measured eight pixels above each alpha≥128 bottom boundary:

| Pose | Measurement y | Left sole run → center | Right sole run → center | Center separation |
|---|---:|---|---|---:|
| Idle | 663 | [194,286) →240 | [422,516) →469 | 229px |
| Attack | 665 | [884,966) →925 | [1131,1223) →1177 | 252px |
| Recovery | 665 | [1602,1687) →1644.5 | [1849,1944) →1896.5 | 252px |

After midpoint alignment, idle feet are at±114.5 source pixels while attack/recovery feet are at±126. The remaining outward shift is0.6624px per foot at36px and0.5888px at32px. This improves on v02 attack's1.0224px, but does not satisfy identical individual foot positions. Sole widths/shapes also vary; matching midpoint or height is not sufficient approval.

## Alpha

Actual alpha extrema0–255; dominant alpha253 covers659,326 pixels. There are15,568 alpha1–7 pixels. Most interiors remain near-opaque rather than exactly opaque. Strict nonzero bounds[133,21,2134,707] are wider than useful alpha≥8 bounds[136,45,2063,674]. No cleanup was applied. Render windows clip at measured alpha≥8 bounds plus4px; the full unchanged raw strip is available in the viewer.

## Portable viewer

The file defaults paused at common36px idle-body height and also supports32px, dark/light backgrounds, Pause/Step/Loop, editable inspection holds, and4× inspection. Sequence: idle→attack→arm recovery→unchanged original idle settlement. Hold times are arbitrary visual-review settings, not core timing, anticipation proof or hit-event validation.

Guides show fixed midpoint plus the idle sole-center x positions so the remaining foot spread can be compared. All poses use one scale and measured per-frame sole pivots. No per-pose resizing, raster retouching or synthetic intermediate was performed.

The embedded PNG bytes match the raw output. Structural/model/mock-UI checks pass; this is not actual rendering or playback evidence. Actual v03 browser playback has not been performed. Leader playback recheck remains required.

## Reviewed feedback

- Slack: https://app.slack.com/archives/C0C83AS1GE9/p1791644519710509
- PR43: https://github.com/mrkimkim/infinite-gacha-defense/pull/43#issuecomment-6098844273
- Reviewed v02 head: `bc36481fb221ffbb3b5ca97e8e8bd48b15b9038a`

The leader's v02 Chromium feedback identified individual foot spread, the crouch-to-idle jump and low-shell merging. This v03 report distinguishes numerical improvements from remaining defects; it does not supersede actual browser review or claim production approval.
