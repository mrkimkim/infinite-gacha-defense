# ART-POPO-02: rightward letter-release art candidate

Status: revised candidate for independent review; continuity and combat quality NOT passed. PR45/v5 and all earlier sources remain unchanged.

Authorization/assignment: Issue24 comment6099384809, owner Momo, assignment generation4. Public source: https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6099384809 . This is original-art quality work only, no core/production mapping/main/deployment change.

## Review artifacts
- body-attempt-2/initial-contact-32-36.png: native-source body/letter review at actual32/36px, with3x inspection enlargement.
- body-attempt-2/art-cycle-32-36.gif: art-only board cycle with32px left/36px right; lossy presentation, not source art.
- body-attempt-2/art-cycle-viewer.html: self-contained offline cycle with pause/next; not game runtime.
- body-attempt-2/frames/: four native960x768 body frames with common foot midpoint(360,640).
- letter/raw-generated.png: separate transparent envelope source. Body raw images contain no baked envelope.
- body-attempt-2/measurements.json: source partitions/anchors, actual body sizes and disclosed pose drift.

## Generation and preservation
Built-in image generation was used. Original Popo sheet and v5 were visible inputs to body-attempt-1. Its tubular arm and near-idle recovery were rejected as weak; exact raw/prompt preserved. Body-attempt-2 is a targeted arm-continuity edit of attempt1, preserving the original face/apron/bag identity as an explicit goal, not a pixel-equality guarantee. The independent letter generation uses body-attempt-1 for style only.

Raw2 SHA256: f8a54a21fa4402faf82a5843bb0057d5bc2a22b386b82904878d9fb0c39d32d5. All raw PNGs/prompts remain unmodified. No procedural art redraw, hard alpha deletion, whole-body flip or per-pose rescaling was used.

Source bodies overlap in horizontal bounding-box extent, so a naive vertical seam would cut release fingers/recovery ears. Technical extraction assigns every source pixel to the nearest of the four strong connected body components and translates it onto the common canvas. Every full RGBA source pixel reconstructs exactly; no source pixel is repainted or dropped. Ownership of faint fringe is an extraction convention, not evidence of a perfectly clean artist-created boundary.

## Letter and anchors
Only one letter layer is composited in any frame: idle0, anticipation1, release1, recovery0. The same raw envelope is reused; its display width is approximately7.84/8.82px at32/36 body scale. It reads as a pale rectangular envelope with a dark contour; heart detail is small.

Anticipation grip point is a manually inspected raised-paw contact/overlay placement, not a proven anatomical fingertip: source(903,370), translated frame(467,382). Release anchor is measured from the rightmost alpha>127 fingertip contour in sourceROI: last occupied x1645, y347..361; outer-edge anchor(1646,354), translated frame(688,365). At36px body the latter is approximately(44.0,23.0) in the preview after common sampling phase. The release letter starts12nativepixels beyond the fingertip; this is a visual gap, not hit range.

Letter dimensions/scale and overlay positions are recorded; the raw remains separate. Precomposed preview images are review-only and do not replace the separate source layers.

## Sizes and consistency limits
One common scale based on maximum native body height563px is applied to all poses. Common y sampling phase0.375output pixels produces alpha>127 measured body heights[32,32,32,32] and[36,36,36,36]. This is preview sampling only, no individual resize.

Height alignment does NOT prove pose consistency. After foot-midpoint alignment, head top is85/84/83/77nativepixels: recovery differs8nativepixels (~0.51px at36). Individual lower-foot edges vary up to4nativepixels (~0.26px at36). Faces/bags/heads are not pixel-identical. The refined release has a curved/tapered arm and open fingers; the halfway recovery is now visibly distinct in still comparison. Abrupt arm length/pose change and face/bag drift need actual playback judgment before any pass.

## Art-only timing and engine boundary
Proposed inspection loop: idle500ms, anticipation180ms, release100ms, recovery180ms, total960ms. Idle and anticipation are genuinely different body images. One envelope appears beside the raised hand then at the release fingertip; no slow moving flight is depicted. GIF decoding and static script controls are checked separately from live playback.

The current engine has no pre-attack intention/cancel or moving-projectile contract. This loop is non-engine choreography only. It does not claim real pre-hit preparation, damage timing, projectile travel, combat approval or final IP ability mapping. Runtime release/hit synchronization remains the leader's separate work.

Actual browser playback has not been verified by this author. Independent peer playback review is pending. These are review candidates, with no production adoption.

## Reproduction and provenance
Run `python verify_package.py` for SHA-256, complete raw RGBA reconstruction, GIF timings, native heights, and self-contained viewer checks. Run `node verify_cycle_static.cjs` for static control checks. Rebuild attempt previews with `python prepare_attempt1.py` / `python prepare_attempt2.py`, then `python build_art_cycle.py` (Python, Pillow, NumPy, SciPy; Node for the static control check). The detailed existing measurements include manual inspection findings; preview rebuilding produces the script's baseline measurements and must not silently replace reviewed annotations.

All inputs needed by these scripts are included under `references/`. Original Popo sheet: repository `docs/reference/characters/popo/sheet.png` at main `412ddd2891655d96e7e9b0fff63e9ab7322699aa`; SHA-256 `324d5a44059328ec6e8219bb19f0f059275675c7a73a4c25fd7a01e7ea1be11b`. V5 raw: PR45 candidate, SHA-256 `714bb468681ed355de94a85f384c4719a809ee0f4022b8e2ce52dcabd372343d`. Board review background is the preserved v5 320px crop of the leader's board-v02 preview, not a game capture; original preview SHA-256 `9f412743535f6b8d19d562829cacf270ddf387295af18bdf7c76f2132c4d2920`. Source crop (58,195)-(490,628) was resized to 320×320. Inputs, failed attempt, final raw, prompts and inspection artifacts are all preserved. Public assignment and proposal are Issue24 comments 6099384809 and 6099373777.
