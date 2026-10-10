# Popo motion: Kiki generated candidate

Issue [#26](https://github.com/mrkimkim/infinite-gacha-defense/issues/26), assignment generation 1; base `5d69aacad292156de563f8c737e169a38687cb4c`.

**Candidate only. Not production-ready or approved.** This folder does not change runtime assets or code. It contains one built-in image-generation result, technical extraction, and inspection material. Independent DOT review remains pending.

## Inspect

- `raw-generated.png`: unchanged 1774×887 RGBA generation output; SHA-256 `ce074d432bdfe8ec52015411d7cb433d666d90b20cbc703d269bd4ead5e21d61`.
- `frames/01.png`–`08.png`: eight transparent 512×512 PNGs in source reading order.
- `contact-sheet.png`: all eight frames on cream and mint, at 44px and 56px **whole-canvas** display size.
- `viewer.html`: standalone offline inspection viewer with embedded images, play/pause, previous/next, frame selection, frame-rate control, background and size controls. The image itself changes each frame; this is not a CSS bob of one image. Default paused, 56px; 44px and enlarged inspection modes available. Its optional pivot guides describe normalization, not gameplay targeting.
- `manifest.json`: source/candidate hashes, exact crop rectangles, source anchors, integer translations, alpha counts, dimensions, pivot, provenance and limitations.
- `prepare_candidate.py`: repeatable extraction/contact-sheet generator; needs Python, Pillow, NumPy, SciPy. Running with no argument uses the preserved raw input. `build_viewer.py` rebuilds the standalone viewer.

## Extraction and validation

The layout was **measured, not assumed to be a regular 4×2 grid**. Strict alpha>0 analysis finds 733 connected components including eight large character components and many faint small isolates. Vertical cuts x=425, 908, 1328 are fully transparent columns. Horizontal boundary y=450 cuts no alpha>0 8-connected component, but **there is no completely transparent horizontal row separating the two pose rows**. Non-visible/faint contamination exists in those gaps; its semantic association is uncertain. Spatial partitions retain that contamination rather than deleting it or pretending it is clean background.

Each partition is cropped to its strict alpha>0 bounding box. A geometric foot anchor uses the midpoint of the alpha>127 footprint in the last five occupied rows, rounded to an integer, and its exclusive bottom edge. Each crop is translated, without scaling, onto a 512×512 canvas at shared anchor (256, 464). The threshold is used **only for measuring the anchor**; alpha values are never thresholded or changed. The padding is deliberately large enough to retain faint outliers. Every one of the source's 733,374 nonzero-alpha pixels is represented exactly once across the output frames, with matching RGBA values. Fully transparent empty margins are not meaningful sprite pixels and are replaced by transparent black padding.

The script asserts seam safety, no canvas clipping, byte-exact cropped RGBA preservation, and conservation of all nonzero pixels. Preview downscaling uses nearest-neighbor at a common scale. At 44/56px canvas size the body is only approximately 32/41px tall; see the 256px viewer mode to inspect fringes. The output frames themselves have no resampling.

## Motion and visual limitations

- This is a generated pose sequence, not a deliberately authored idle/attack cycle. Frames 1 and 2 have little idle distinction; later images include head tilt, an envelope, closed eyes, an extended envelope, a wave, and a return pose.
- Head angle, facial placement, clothing, bag and silhouette vary between frames. A common foot baseline does not fix shape or proportion drift.
- Faint alpha isolates and fringe pixels are retained, including marks in the spaces between poses. Spatial attribution can include contamination from an adjacent pose. No cleanup has been performed.
- Default 4fps playback is only an inspection loop. No motion names, gameplay semantics, loop smoothness or timing have been approved.
- Flat cream/mint backgrounds are inspection backgrounds. No game integration, browser gameplay validation, human playtest, or independent peer approval is claimed.

## Source and rights

Project-authorized Popo reference: [PR #30 source at eb95229](https://github.com/mrkimkim/infinite-gacha-defense/blob/eb95229d0ba9176c6f4bd396ae8acb34f717d3a8/docs/reference/characters/popo/sheet.png), SHA-256 `324d5a44059328ec6e8219bb19f0f059275675c7a73a4c25fd7a01e7ea1be11b`. The original user-provided 4×4 style concept informed generation upstream; it is not copied into this folder. This package does not reuse the damaged repository copy of that concept. Public project candidate preparation was authorized; production selection and independent art review remain pending. No separate license grant is invented here.

## Verification performed

Extraction assertions and a separate reconstruction test passed: all original alpha values and all nontransparent RGBA pixels reconstruct exactly. All eight PNG SHA-256 values match the manifest. The contact sheet was visually inspected on cream/mint at 44/56px.

`node verify_controls.cjs` passed frame selection, previous/next, wraparound, image-source change, play/pause timer, slider, size and background checks in a minimal DOM stub. This validates control logic, **not browser rendering**. Actual browser replay inspection remains blocked: Playwright's bundled executable is absent, and installed system Chromium cannot start within the environment's socket restrictions. `verify_viewer.cjs` is provided for an authorized browser environment. No browser screenshot or successful playback is claimed. See `verification.json`.
