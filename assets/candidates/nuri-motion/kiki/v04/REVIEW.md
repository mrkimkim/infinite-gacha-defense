# Nuri v04: down-right bubble attack candidate

**Status: preserved review candidate, not completed attack-art quality and not production-approved.**

Assignment: MVP-AM-ART-NURI-02, owner 키키, assignment_generation4.
- [Leader assignment](https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6099402579)
- [Full composition proposal](https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6099386666)

This new v04 candidate directory is the only repository-file change at this checkpoint. v01/v02/v03, repository runtime/core/production mapping, main and deployment are unchanged. Preservation does not approve the artwork.

## Open first

- `nuri-v04-portable-review.html`: self-contained HTML, 2,911,129 bytes, four unchanged PNG assets embedded. Actual CSS32/36px, light/dark, manual step, pause, two preview sequences, near/far geometric targets, lethal proxy, source anchors and idle individual-foot guides.
- `nuri-v04-contact-review.png`: static native Canvas contact review. Includes32/36px,2× pose inspection and4× scene inspection. This is **not browser playback evidence**.
- `nuri-five-poses-final-raw-v04.png`: selected unchanged generated atlas,2172×724 RGBA.
- `manifest.json`, `measurements.json`, `viewer-data.json`, `artifact-checks.json`: coordinates, provenance, dimensions, hashes and limitations.

Selected atlas SHA-256: `2c65e3deeabf77145e99fcdd813a68fc999678aca5beb8213efa3643f94a7e32`.

## Delivered pixels

Five separately measurable generated poses: idle, preparation, release, recoil, recovery. Preparation cups the shell with the opposite hand; release extends the shell hand and opens the other palm; recoil folds the arms; recovery lowers the opposite hand. The idle/recovery distinction is weak at board size and must not be called a passed five-silhouette result.

Original identity reference and v03 were inspected before generation: brown otter, cream muzzle/belly, three freckles on each cheek, blue scarf knot on viewer right, mint sprout apron, peach shell in the same viewer-right hand. Broad identity survives, but the generated head/face/apron/body contours are not identical copied drawings.

Separate selected VFX PNGs:
- `bubble-emission-raw-v04.png`: three-bubble emission cluster,1254×1254.
- `water-impact-simple-raw-v04.png`: four disconnected blue drops around an empty center,1254×1254. The central16% square is verified alpha0.
- `ground-ripple-raw-v04.png`: thin broken elliptical rings,2172×724. Decorative only.

The connection trace is currently too faint/sparse in the actual32/36px sample, especially on the light background. Source assets and valid coordinates do not establish a readable attack. The shell remains a flat scallop silhouette; the sample suggests emission through separate bubbles but does not prove the shell mouth/anatomy or aiming is convincing.

## Geometry, without per-pose rescaling

All frames use one common scale:32/476 or36/476. Each is translated to its measured sole midpoint and alpha≥128 baseline612. No per-pose resizing, whole-character reflection, synthetic in-between painting or raw raster cleanup was performed.

Source bounds are x0/y0 inclusive and x1/y1 exclusive. Foot runs were measured at y604, eight source pixels above the common lower boundary. These measurements do not prove identical feet.

| Pose | Source height | Sole centers x | Sole separation | Each-foot separation drift at36px | Rim anchor x,y |
|---|---:|---|---:|---:|---|
| idle |476|94.5,270|175.5|0|(254,331)|
| preparation |476|511,687.5|176.5|±0.037815|(597,320)|
| release |474|970.5,1148.5|178|±0.094538|(1351,431)|
| recoil |476|1454,1631|177|±0.056723|(1618,328)|
| recovery |473|1868.5,2041.5|173|∓0.094538|(2051,332)|

Max per-foot displacement from idle after midpoint alignment is0.084034px at32px or0.094538px at36px by this scanline method. Foot contours and widths still differ. Common36px body heights are36,36,35.848739,36,35.773109. Equal baselines and small numeric drift are not fixed-rig acceptance.

Anchors are individually inspected outer shell-rim candidate landmarks in original atlas coordinates, not a reused offset. Only the release anchor is used for the one attack illustration. Coordinates are inside their respective source rectangles, but emitter orientation and attachment must be reviewed visually before runtime use.

Final useful alpha≥8 bounds end at x2152 on a2172px canvas, leaving20px on the right. This removes the prior useful-alpha edge contact. Low-alpha noise persists:16,009 pixels have alpha1–7; interiors are often alpha253. Strict alpha>0 artifacts are not cleaned or used to claim padding success.

The low tail correction improves separation, but independent inspection finds diagonally adjacent shell/tail edge pixels at actual32px, failing the robust minimum1px background-gap goal. Source pixel-center distance does not equal empty-pixel clearance. See [independent review](INDEPENDENT_REVIEW.md) for the measured coordinates and remaining art gates.

## Presentation semantics

The default sequence is idle → release → recoil → recovery → original idle. On the release sample, shell emission, a sparse instantaneous bubble trace, impact, proxy target tint and simulated HP reduction appear together. There is no delayed projectile arriving after damage. The enemy and HP bar are clearly labeled geometric presentation stand-ins, not production enemy art or real state.

A separate five-pose sequence exposes preparation for artwork review. It does not assert engine-supported anticipation. Current pre-attack intent/cancel and projectile-flight contracts remain unsupported; no core time or damage changes were made.

Preview holds are authored inspection settings. Each phase is shown before advancing, rather than claiming to reproduce real engine clock/event behavior. Pause/hidden-tab/restart controls operate only in this viewer. No50/150/250ms game rendering, committed hits[].position, lethal/moving targets, repeated combat, replacement lifetime, PR47 timing fix or actual AoE validation was performed here. Decorative ripple is not a radius or multi-hit contract.

## Attempts preserved

Every character, effect and edit call used the built-in imagegen tool. Exact prompts are in `prompt-*.txt`; raw files are untouched.
- `nuri-five-poses-raw-v04.png`: initial result. Release head tilted; preparation/release horizontal extents interleaved, unsuitable for simple rectangular atlas slicing.
- `nuri-five-poses-refined-raw-v04.png`: leveled head and five separated x-ranges; shell/tail gap still marginal.
- `nuri-five-poses-gap-raw-v04.png`: lower tail; rightmost useful tail alpha reached canvas edge. Not selected.
- `nuri-five-poses-final-raw-v04.png`: final bounded padding attempt; selected for review, remaining morphology drift disclosed.
- `water-impact-raw-v04.png` and `water-impact-clear-raw-v04.png`: more complex splash attempts retaining unwanted diffuse-looking halo. Not selected; the filename “clear” names the attempted edit, not a passed result.
- `water-impact-simple-raw-v04.png`: selected sparse four-droplet result.
- `raw-attempts.json`: complete preserved raw hash/provenance list.

The [original identity sheet](../../../../../docs/reference/characters/nuri/sheet.png) and [v03 raw PNG](../v03/raw.png) already exist in the repository and are referenced without duplication. No private reference inputs are included. No new third-party license or rights conclusion is asserted.

## Checks actually run

13/13 structural and read-only pixel checks passed: five measured frames; raw hash match; embedded bytes match; self-contained viewer without network loads; script parsing; anchor bounds; no useful-alpha canvas clipping; selected impact center alpha0; identical measured sole baselines; common idle scale; manifest/embedded fixture consistency; renderer near/far target coordinates.

Static contact sheet was rendered with native Canvas and visually inspected. Browser playback, actual engine tests, production art approval and full-direction coverage were not run or claimed. Independent static review evidence is preserved separately; it does not establish browser playback or production acceptance.

Rebuild locally with Node and the already available `pngjs` / `@napi-rs/canvas` modules: `prepare-review.cjs`, `build-viewer.cjs`, `render-contact.cjs`, then `check-artifacts.cjs`. Scripts read existing raw assets and write review artifacts; they do not retouch source pixels.

Independent review found stale initial fixture metadata. It was corrected before packaging: character ground(54,60); hit far(142,87), near(103,87); proxy bottom y95; preview holds500/180/180/230/500ms with preparation350ms in art mode. Renderer and viewer now consume the shared fixture data.

## Publication portability

Helper scripts use standard module names and a candidate-local CommonJS scope. The identity-reference hash is read from the existing repository reference asset. Local generated-output paths are omitted from provenance; all nine raw-file hashes and exact prompts remain. Rebuilds require Node, pngjs and @napi-rs/canvas already available in the reviewer environment. No dependency installation or repository-root package change is included.

[Independent review](INDEPENDENT_REVIEW.md) and [measurements](independent-review-measurements.json) preserve the explicit 32px gap failure, faint trace, weak idle/recovery distinction and remaining head/foot drift. This is an independent local validation pass, not a review by the separate leader or Momo dots.
