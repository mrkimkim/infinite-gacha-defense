# Nuri v05: targeted down-right shell / flight-bubble study

**Status: preserved review candidate. Bounded static clearance/bubble checks improved; no final animation, production or engine acceptance claimed.**

Assignment remains MVP-AM-ART-NURI-02, owner 키키, generation4. The leader’s refinement asks for actual32px shell–tail background space, readable emission direction, and a separate real bubble asset rather than two faint connection specks. Head motion should be judged as coherent acting versus changed-face flicker, not rejected merely for being nonzero.

- Refinement request: directly read Slack thread1791650166.225019 in channelC0C83AS1GE9.
- [Original assignment](https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6099402579)
- [Composition proposal](https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6099386666)

Only this new v05 directory is added. All existing repository files, including v04, remain unchanged. `v04-preservation.sha256` and `v04-preservation-check.txt` verify all 40 previously published v04 files at commit44e54f91e6f81777f7e94ab12f02942cc2ddc39b. This public inventory replaces the local working-file inventory; the original review separately checked 41 nonhidden local candidate files. No runtime/core/production mapping, main, merge or deployment is changed.

## Open first

- `nuri-v05-portable-review.html`: self-contained3,334,928-byte viewer; selected body/bubble/impact/ripple bytes embedded. Actual32/36 CSS-pixel views on light/dark backgrounds, manual step, pause, near/far targets, foot/rim guides and4× inspection.
- `nuri-v05-contact-review.png`: visually inspected native-Canvas static contact sheet. This is not browser playback evidence.
- `nuri-direction-correction-raw-v05.png`: selected unchanged2172×724 RGBA atlas, SHA-256 `9e89cce33db28c8eda5bd66b81804a9c506941c1ec46ece829a57f1de59c736d`.
- `flight-bubble-raw-v05.png`: new standalone one-connected-droplet flight sprite. No dots or path baked in.
- `manifest.json`, `measurements.json`, `clearance-and-bubble-measurements.json`, `artifact-checks.json`: source bounds, anchors, hashes and verification limits.

## Targeted changes

The selected release arm reaches horizontally/slightly down. The peach shell now has a visible cupped inner rim, with its opening aimed down-right. The release tail curves lower behind the body instead of nearly touching the shell. The shell stays in the same viewer-right hand; scarf knot remains viewer-right. Otter, cream muzzle/belly, three freckles per cheek and sprout apron identity remain recognizable.

The new flight bubble is a single dark-teal-outlined aqua shape with a trailing upper-left tip and rounded leading lower-right end. It is rendered at **nominal pre-rotation width8px for a32px character,9px for36px**. Its axis-aligned screen bounds vary with angle. It travels as one asset in the art preview; there is no dotted connection or faint two-speck path.

The first v05 edit lifted the shell far too high, making an up-right raised gesture. It is preserved as `nuri-gap-correction-raw-v05.png`, marked unsuccessful. The bounded second edit is the selected direction correction. No further generation was performed after that selected raw and the standalone bubble were available.

Impact and ripple are byte-identical copies of selected v04 assets, clearly named `water-impact-reference-v04.png` and `ground-ripple-reference-v04.png`; they are not new v05 generation claims.

## Source scale and anchors

All poses use one common scale32/480 or36/480, then translation to measured sole midpoint/baseline. No pose is resized separately, no whole character is mirrored, and no raw raster is hand-retouched. Source bounds use inclusive x0/y0, exclusive x1/y1.

| Pose | Source height | Sole centers x | Measured baseline | Per-foot spread drift at36px | Manual rim anchor |
|---|---:|---|---:|---:|---|
| idle |480|94,270.5|613|0|(253,332)|
| preparation |479|510,687.5|613|±0.0375|(596,321)|
| release |479|966,1146|613|±0.13125|(1348,443)|
| recoil |480|1448,1624.5|613|0|(1611,329)|
| recovery |478|1861,2037.5|614|0|(2043,333)|

These are one-scanline center-spread measurements. They do not prove identical foot contours. The recovery’s source baseline differs by1px; translation aligns its measured ground point, without changing body scale.

The release rim anchor is a visually inspected outer lip candidate. The viewer uses that fixed release anchor for flight launch, even while the body moves into recoil. The bubble origin is not incorrectly moved to the recoil hand. Other pose anchors are retained as individually inspected candidates, not engine bindings.

## Actual-size gap evidence

`measure-clearance.cjs` reads source pixels and renders diagnostics only in memory. It does not modify source PNGs.

- Localized source alpha≥128 shell/tail closest centers: (1270,476) and(1256,506),33.105891source-pixel distance.
- At integer ground placement, selected native-Canvas shell/tail pixel-square clearance is2px at both32px and36px, for alpha≥8 and≥128.
- A16-position quarter-pixel x/y placement sweep per size has minimum clearance1.0px at32px and1.414214px at36px, at both thresholds.
- These localized manually inspected ROIs cover the exposed release shell/tail area. They do not measure all body intersections, every browser resampler/device scale, or artistic continuity. Independent bright/dark static review and actual browser/runtime checks remain separate.

The standalone unrotated bubble diagnostic has38pixels at alpha≥8/≥128 at nominal8px width,46at9px. These are not exact rotated-flight screen-area measurements. They show the new asset has substantial pixel coverage compared with the v04 trace, without claiming a universal contrast/legibility threshold.

## Preview choreography, not a timing contract

The viewer is explicitly proposed flight-art choreography. Its phases are idle450ms, preparation260ms, launch150ms, flight400ms, impact160ms, recovery180ms, settled idle450ms. These durations are authored review holds and animation timing, not approved gameplay values.

One bubble begins outside the release rim, travels to a fixed geometric target, then disappears when the separate impact/ripple phase appears. No HP is shown and no game state is simulated. Target is a geometric art stand-in, not production enemy art. The proposed travel is not represented as compatible with the old immediate-hit contract. Schema4 integration, actual intent/cancel/flight/hit timing and real engine state remain separate work.

The target and source are fixture-only values shared by manifest, renderer and embedded viewer: character ground(48,60); target far(144,89), near(108,89); target bottom y97. Restart and visibility/pause controls affect this page only. They are not runtime lifecycle or low-FPS verification.

## Remaining art gates

- Idle/recovery silhouettes remain weakly distinct. v05 intentionally targets release clearance/direction and the separate bubble; it does not complete all five-pose quality requirements.
- Foot contours still vary. Small source height and face/head differences remain. Head motion should be assessed for coherent body acting versus changed-face flicker, without imposing a blanket zero-motion rule.
- The lower release-tail posture differs from the other poses. Whether that transition reads naturally still needs playback review.
- The new cupped shell is more legible, but target gaze, mouth direction, launch attachment and motion continuity need independent review of the exact files.
- Browser playback, actual engine/schema4 linkage, low-FPS50/150/250ms, moving/dead targets, repeated attacks, replacement lifetime, multi-hit/AoE and all-direction coverage were not run or claimed.

## Checks and reproduction

14/14 structural/read-only checks pass: raw hashes and exact embedded PNG bytes, self-contained viewer, script parsing, source anchor bounds, useful-alpha padding, transparent impact center, reported baselines, common body scale, shared fixture consistency, near/far renderer targets and exactly one bubble in launch/flight with impact only in the arrival phase.

All three new raw outputs are byte-identical to built-in imagegen outputs. Exact prompts and raw output hash provenance are recorded in `prompt-*.txt` and `raw-attempts.json`. No new rights/license or production-adoption conclusion is asserted.

Rebuild with already available Node modules: `prepare-review.cjs`, `build-viewer.cjs`, `render-contact.cjs`, `measure-clearance.cjs`, `check-artifacts.cjs`. Native Canvas static rendering is kept distinct from browser evidence. The [published v04 comparison](../v04/nuri-five-poses-final-raw-v04.png) and [original identity sheet](../../../../../docs/reference/characters/nuri/sheet.png) are referenced in place; private reference copies are excluded.

## Independent review and portability

[Independent static review](INDEPENDENT_REVIEW.md) confirms bounded release-gap and bubble-readability improvements. Idle/recovery distinction, acting/face continuity and per-foot continuity remain temporal-review gates. This local independent pass is not an approval by the separate leader or Momo dots.

Run the listed scripts from this directory with the required Node modules already available. Standard module imports and a local CommonJS scope replace executor-specific paths. No repository-root dependency change is included. The reviewed HTML/contact and all generated raw PNG bytes are unchanged by packaging.
