# v02 review

Status: retain for peer review as a more distinct recovery candidate. This is one revision of v01 using the original Nuri sheet again as the identity reference. Independent peer approval and actual 32–36px runtime/animation QA remain pending.

## Difference from v01

The original otter face, freckles, viewer-right blue scarf, mint sprout apron, tan buttons, peach shell and curved tail remain recognizable. Idle and attack stay close to v01. Recovery now lowers the shell to the hip, lowers both arms and settles the torso, creating a visibly different ending silhouette at full size.

The settling pose is larger than requested: alpha ≥128 recovery height is 569px versus 625px idle, an **8.96% reduction**, while the prompt asked for about 3%. This is a silhouette-height measurement, not proof of uniform anatomical scaling. The attack stance remains wider, and per-frame foot positions are not fixed.

## Evidence

- Raw file: `raw.png`, 2156 × 729 RGBA, 1,299,339 bytes.
- SHA-256: `f8369b8b8d53b9ede88de05b53c267a360893aaf5132a62496a20aa51b289881`.
- Exact revision text: `prompt.txt`; unchanged raw output, no raster post-processing.
- `measurements.json` records threshold bounds, sole runs, proposed pivots and nine sampled interior pixels. See the [overview](../README.md) for source links and the coordinate convention.
- Proposed pivots: idle (358.5, 674), attack (1043.25, 675), recovery (1781.75, 675). These are review anchors only.
- At idle 36px under a common scale, heights are 36, 35.6544 and 32.7744px; at idle 34px they are 34, 33.6736 and 30.9536px. These arithmetic estimates are not a visual QA result.

## Alpha and remaining checks

Alpha extrema are 0–255: 829,331 transparent pixels, 1,168 fully opaque pixels and 741,225 partially transparent pixels. Alpha 253 dominates 646,601 pixels, including all nine sampled interiors. That is approximately **99.22% opacity**, so a claim of severe transparency is not supported by this statistic.

Fully opaque interiors were requested and not achieved. Alpha 1–7 pixels increased from 13,796 in v01 to 14,322 in v02. Strict nonzero bounds are [0, 25, 2126, 729], compared with alpha ≥8 bounds [141, 48, 2063, 676]. Faint pixels remain outside the useful silhouettes, and no cleanup was applied.

Full-size source inspection supports a more distinct recovery; it does not establish target-size readability or smooth playback. Actual 32–36px composited runtime QA, clipping, sole stability, pose consistency and animation timing still need review. No production manifest, fixture mapping, runtime integration, adoption or production approval is included.

## Open peer review, 2026-10-10 14:45:30 UTC

[Momo's reported source and 32/36px inspection](https://app.slack.com/archives/C0C83AS1GE9/p1791643530654379) finds the face, scarf, apron, shell, same-hand usage and attack silhouette recognizable. The lowered recovery reads as a crouched intermediate pose; at 32px the lowered shell appears to merge with the body. The near-opaque alpha did not appear severely transparent in that inspection. These are peer observations, not a completed runtime or motion approval.

Proposed playback review sequence: idle → attack → crouched intermediate (source recovery frame) → unchanged v02 idle frame for settlement. Use a common scale and explicit sole pivots. Do not uniformly enlarge the crouch frame to match idle height. Timing, settling transition, foot sliding, size jumps and hit synchronization remain pending repeated runtime playback. The 32px shell/body separation concern is still open. This proposal changes no image bytes and creates no production animation mapping.
