# Independent Nuri v04 review

## Decision

**Ready to preserve as a candid, unapproved candidate. Not ready for attack-art acceptance or production mapping.**

The corrected package is internally consistent and preserves useful progress over v03. The actual 32px shell–tail clearance, sparse emission trace, pose differentiation and fixed-rig identity still need work. Passing structural checks must not be presented as an art-quality pass.

Reviewed assignment: [generation 4](https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6099402579) and [composition proposal](https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6099386666).

Method: direct inspection of the selected raw PNG, original reference, unchanged v03 and provided native-Canvas contact sheet; independent PNG/pixel measurements; manifest, embedded asset and viewer-source inspection. **No actual browser playback, engine run, new generation or source-raster editing was performed.** Known browser access restrictions were not retried or bypassed.

## Concrete art gates

### 1. The closest release shell–tail corner does not have a full background-pixel gap at 32px

In `nuri-v04-contact-review.png` (1120×1170), the actual-32px release sample has a shell edge pixel at **(552,158), RGB (84,47,22)** and a tail edge pixel at **(551,159), RGB (116,85,61)**. They are diagonal neighbors. The background is RGB (245,240,230). Their pixel-square corners meet without a full intervening background pixel. This is a specific failure of the robust ≥1px negative-space goal in the supplied static sample, not merely missing approval paperwork.

A localized alpha≥128 source-edge check finds shell/tail pixel centers at (1266,480) and (1255,491), distance 15.556 source pixels: 1.046px at 32px or 1.177px at 36px. Center distance is **not** empty-pixel clearance; it excludes pixel area and resampling effects. The 36px sample looks better, but cannot rescue the 32px requirement. The v03 recovery's obvious shell/tail overlap is visibly improved.

### 2. Down-right direction exists, but the attack connection is too faint at board size

The corrected release anchor and far target make a genuine down-right geometric connection. The shell emission, two trace samples and hit effect are separate from the character art and appear in the same illustrative phase.

At actual 32px, each intervening trace sample contributes only **2–3 pixels** with an RGB-channel difference greater than 10 from the flat background; at 36px, each contributes four. On the light board, the weaker sample peaks at approximately 1.40:1 contrast at 32px and 1.36:1 at 36px. These are descriptive pixel measurements, not an accessibility threshold. Visually the action reads as disconnected cyan specks, especially on the light background. Dark-background contrast helps but the very small area remains easy to miss. The target body stays visible; hiding it under a larger opaque effect is not needed to explain this failure.

The shell is still a flat scallop silhouette with a manually chosen rim point. The extended hand reads more clearly than the shell's emitting mouth or directed gaze. The face remains substantially forward-facing. Coordinates alone do not establish convincing emitter anatomy or down-right aim.

### 3. Five separated drawings are not five clearly readable poses

Preparation visibly brings the second hand to the shell, and release is unmistakably extended. Recoil is subtler. **Idle and recovery are almost the same small silhouette.** Five independently measurable frames and different pixels are confirmed; a passed five-pose readability result is not.

### 4. Foot placement is much improved, but the fixed rig is still not achieved

The author's y604 scanline result is correct. After midpoint alignment, maximum per-foot center shift is 0.084034px at 32px / 0.094538px at 36px, versus v03's 0.5888px / 0.6624px. Left/right shift signs are opposite; recovery moves inward. Both baselines are 612 source pixels.

This is a particular scanline measurement, not a maximum over all foot contours. Independent slices at y588/596 show up to **0.132353px at 36px** for the release left-foot center. Foot shapes and widths still differ.

The upper-head alpha band (source rows 135–299, excluding arms) moves about **−0.491px in preparation and +0.577px in release**, horizontally relative to the idle foot pivot at 36px. That is roughly a 1.07px preparation-to-release shift in this diagnostic. It is not a full anatomical measurement, but independently confirms visible head/face drift. Body heights remain 36, 36, 35.849, 36 and 35.773px under the common 36/476 scale. No large crouch jump is present; exact head/body identity is still absent.

## Identity and packaging checks

- Original identifying features survive: brown otter, cream muzzle/belly, three freckles on each cheek, viewer-right blue scarf knot, mint sprout apron, peach shell in the same hand and broad tail. The finish is smoother/glossier than the original textured reference. This is recognizable continuity, not an identical drawing/style claim.
- Bubble, impact and ripple are separate selected PNG assets; the unchanged raw character does not bake those effects into its body. The ripple is decorative and proves no AoE contract.
- All four selected raw asset SHA-256 values match the manifest and the exact bytes embedded in the portable HTML.
- Original reference SHA-256: `8ec7b3cc8e16db5f0252eba82ab243ad5c7005f1b121734bfa49f609f0c488f1`.
- v03 reference is byte-identical to the preserved v03 raw atlas: `c53d340bcb53386dfd0a2424a0d24a853b32ba12b732e6c5434c52969599727f`.
- Final selected raw atlas: `2c65e3deeabf77145e99fcdd813a68fc999678aca5beb8213efa3643f94a7e32`.
- Reviewed corrected HTML: `32e87d7bafa4831631dff9cf7614b96a9400ba206d454e1d222ba63b02bbf3bf`.
- Reviewed contact sheet: `47cc6b3617acee94bd2d3c8ac40abd82f194c328d6543faae73f1ed3bd274444`.

The initial fixture metadata/renderer mismatch was reported and corrected before this final review. Manifest and embedded fixture now agree: character (54,60); hit far (142,87), near (103,87); target bottom y95; holds 500/180/180/230/500ms, with preparation 350ms in art mode. Source inspection confirms the renderer and viewer consume the shared values. The author's 13 structural checks pass after correction.

## What preservation does and does not establish

The portable HTML is self-contained, has five-pose and committed-hit illustrations, and clearly identifies its geometric enemy and simulated HP. Source inspection shows simultaneous release/emission/contact in the illustrative release state, with no delayed travelling projectile. Preparation is isolated to the art-pose sequence.

Actual browser playback, engine `hits[].position` linkage, 50/150/250ms render behavior, real lethal/moving targets, pause/reset/replacement integration, multiple hits, AoE and all-direction coverage remain unverified. They cannot be inferred from this contact sheet or structural tests. Future engine timing work does not retroactively validate this immediate-hit art-only viewer.

For preservation, retain the raw attempts, selected hashes, candid review and reproducible measurement evidence. For art acceptance, the specific blockers above must be addressed and the resulting exact candidate re-reviewed at both board sizes and backgrounds.

Evidence: `independent-review-measurements.json` and `independent-review-check.cjs`. The script reads artifacts and writes only its JSON measurement report; it never edits source PNGs.
