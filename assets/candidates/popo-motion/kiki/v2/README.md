# Popo / Kiki v2: three generated keyposes

Issue #26, generation 1. Base `44bad8b2370e4f7086dfb3ea86586dccac527772`. This variant preserves the original candidate files unchanged. **Candidate only; not production-ready.**

## Review files

- `raw-generated.png`: unchanged 2172×724 RGBA generation output; SHA-256 `b0a6dbe2f66847f9b718769634bd509ba78251839e544a87c066eba9963bfb36`.
- `frames/01.png` through `03.png`: native-pixel crops translated onto a common 896×704 transparent canvas; no rescaling, recoloring, alpha cleanup, redraw or interpolation.
- `contact-sheet.png`: cream/mint comparison at measured **44px and 56px body height** for all three poses. Padded preview canvases are 71×56 and 91×71 pixels, respectively. Width of the detached envelope's alpha>127 bounds is approximately 12.4px / 15.8px at these scales.
- `viewer.html`: standalone embedded-image viewer. Previous/next, slider, play/pause, body size and cream/mint controls change actual pose images. Default paused. The embedded previews use the same exact uniform sampling as the contact sheet.
- `preview.gif`: three-frame animated review presentation, four panels (44/56px body on cream/mint), 740×290px. Order 1 → 2 → 3, 250ms each, repeating. This GIF is flattened and palette-quantized, therefore lossy. It is **not source art** and its timing is not approved gameplay timing.
- `manifest.json`: all coordinates, hashes, alpha/component measurements, body bounds, preview scale and provenance.

## Measurement and preservation

Columns x=650 and x=1500 are entirely alpha-zero. These measured seams replace assumptions about equal-width cells. The release envelope is a separate component fully inside partition 2, with strict bounds [1284,284,1451,414] and alpha>127 bounds [1292,288,1449,408]. A three-column fully transparent gap separates its strict component bounds from the body. It is not assigned to the recovery frame.

Body means the largest 8-connected alpha>127 component in each partition; that threshold is **measurement only**. Native body bounds have heights 556, 557, 557. A geometric foot anchor uses the horizontal midpoint of the body's last five occupied rows and its exclusive bottom edge. Integer translations align all frames to pivot (448,640). Faint remote isolates, including far-left frame-1 pixels, are kept; this explains the wide native canvas.

Every original alpha value and every nontransparent RGBA pixel reconstruct exactly from the extracted frames. All **626,457 nonzero-alpha pixels** occur exactly once. No component is clipped by a partition or output canvas. Fully transparent outer margins become transparent black padding; the unchanged raw preserves the complete original bytes.

Preview scale is common across all poses: 44/557 or 56/557, based on body height rather than canvas/outliers. Nearest-neighbor affine sampling applies a common 0.25 output-pixel vertical sampling phase; this avoids a one-pixel raster-height loss in recovery at 44px. There is no per-pose scaling. The measured preview body heights are [44,44,44] and [56,56,56]. The phase affects presentation sampling only; native frames remain unchanged.

## What improved and what remains

The three images communicate preparation holding a letter, release with a clearly detached letter, and recovery. Head and facial placement are visibly more consistent than the eight-pose v1 sheet. This is still three keyposes, **not a fully smooth animation cycle**. The green apron top/strap changes in the release pose remain a visible consistency defect. Faint fringe and isolated pixels remain unedited. No independent DOT approval or production acceptance is claimed.

The detached envelope is currently baked into frame 2. A separate engine projectile would require future authorized work; none is implemented here. No runtime changes, action synchronization or game-play validation are included.

## Reproduce and verification

`python prepare.py` uses the preserved raw; it requires Pillow, NumPy and SciPy. `python presentation.py` builds the embedded viewer and lossy GIF. `node verify_controls.cjs` tests control logic in a minimal DOM stub. Run these in that order; prompt.txt provenance is included when rebuilding the manifest.

Integrity assertions passed, the cream/mint contact sheet was visually inspected, and GIF decoding confirms exactly three frames at 250ms each. Static viewer control tests passed. These tests do not establish browser rendering. Live browser inspection of this variant remains pending. Technical extraction does not redraw the generated image.

Reference provenance: project-authorized [Popo reference at eb95229](https://github.com/mrkimkim/infinite-gacha-defense/blob/eb95229d0ba9176c6f4bd396ae8acb34f717d3a8/docs/reference/characters/popo/sheet.png), SHA-256 `324d5a44059328ec6e8219bb19f0f059275675c7a73a4c25fd7a01e7ea1be11b`. Exact generation prompt is preserved in `prompt.txt`, with its SHA-256 recorded in the manifest. The original user concept is not copied here. Project-specific candidate preparation is authorized; no separate license or production selection is invented.
