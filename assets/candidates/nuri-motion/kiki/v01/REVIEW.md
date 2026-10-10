# v01 review

Status: retain as a comparison candidate; revise before production. This review covers full-size source inspection and decoded PNG measurements. Independent peer approval and actual 32–36px runtime/animation QA remain pending.

The original brown otter identity, cream muzzle and belly, cheek freckles, blue side-tied scarf, mint sprout apron, tan buttons, peach shell and curved tail remain recognizable. The attack extends the shell to viewer-right and opens the other paw, giving a readable full-size gesture. The recovery is weakly differentiated: shell and hands return almost to the idle chest pose. Body and head proportions vary slightly, and the attack stance is wider.

## Evidence

- Raw file: `raw.png`, 2172 × 724 RGBA, 1,348,750 bytes.
- SHA-256: `63f143c338173802f59352c63df69170d2b03364dd0245c08d09e129aedc848d`.
- Exact generation text: `prompt.txt`; unchanged raw output, no raster post-processing.
- `measurements.json` records alpha thresholds, sole runs, proposed pivots and pixel samples. See the [overview](../README.md) for source links and the coordinate convention.
- Alpha ≥128 body heights: 628, 621, 617px. Recovery is 1.75% lower than idle by silhouette height.
- Proposed pivots: idle (359.75, 678), attack (1045.75, 679), recovery (1796.75, 679). Baselines are within one source pixel; horizontal alignment requires separate anchors.

The requested 1536 × 512 canvas was not returned. Neither frame boundaries nor identical foot placements can be assumed from the prompt. The actual strip is not a production grid.

## Alpha and target-size limitations

Alpha extrema are 0–255: 820,284 transparent pixels, 1,481 fully opaque pixels, and 750,763 partially transparent pixels. Alpha 253 is dominant across 614,034 pixels. It is near-opaque, with about 0.78% transparency, and is not itself evidence of severe visual degradation. There are 13,796 alpha 1–7 pixels and the strict nonzero bounds extend beyond the useful silhouettes. No threshold cleanup was performed.

Warm colors may separate from the dark slate-gray board, based on full-size source inspection. This remains a hypothesis until actual 32–36px composited playback verifies identity readability, crop safety, foot stability and timing. No screenshot, target-size pass, animation pass, gameplay integration, fixture mapping or production approval is claimed.
