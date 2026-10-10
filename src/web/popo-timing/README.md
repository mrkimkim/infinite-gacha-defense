# Popo letter / schema4 review adapter

Separate route `/popo-timing.html`, based on PR48 exact493590fba179c2c100f628fb9aeb3d5e0de37c0b. Default game, core, package scripts and PR48 branch are unchanged. Owner:leader, Issue24 follow-up. File scope:this directory, tests/popo-timing/**, public/assets/popo-timing/** and popo-timing.html. No merge/deploy/production adoption.

Run `npx vite --config src/web/popo-timing/vite.config.ts --host 127.0.0.1`; build with `npx vite build --config src/web/popo-timing/vite.config.ts`. Existing dependencies only.

## Art and legal scenes

PR45 exact1dd70826a5c05fe0283a96af8fdd59d4931a9036 v6 body attempt2 original raster, four frames, separate letter and measurements are copied byte-for-byte; provenance.json contains hashes. Original raster/letter inspected directly. Blocked candidate viewer HTML was never opened, copied, hosted or retried. This route is new game source using schema4.

Only fixture-01 delayedDefinitions/pending use this candidate. Right-facing cone |dy|<=0.6dx (about31°); no character mirroring. Other directions show unsupported/idle. Nuri/other definitions and final IP mapping are not included. Bodies keep pivot360,640, body height32/36px; the original body-scaled letter mode preserves content crop110,335,1143,919 and width138 native pixels (7.84/8.82px at native size). New independent effect modes are documented below. Grip467,382 and release fingertip688,365 are source anchors. No art enlargement in the forward projection change.

Both scenes use seed1, recruit offer0, move unit1 to board3,0, startWave and advance. No arbitrary state import or artificial HP/target placement.
- Death:attach122, start123, release126, impact128, attack10/target5 HP4→0, stop136.
- Nonlethal:attach146, start147, release150, impact152, attack12/target4 HP19→13, stop160.

50ms/tick:150ms windup +100ms flight. Held windup letter is an attached prop, never a pending projectile. Actual impact alone authorizes contact letter/ring/damage/death. Contact imagery stays at committed hit coordinates for up to two presented ticks; aftermath remains8 simulation ticks and freezes when the review scene stops. Live enemies resume their observed position after the first contact frame. No damage or simulation tick is delayed for appearance.

## One-tick forward presentation

The old6f9794e previous→current interpolation held release at a zero-length segment, then left about50px at the terminal frame. This revision changes only the review consumer's display contract; PR48's reference consumer/core remain untouched.

For accepted tickT, observation contains the enemy's post-movement position, which is the next tick's pre-flight target position. One endpoint is computed with existing checked integer `home(currentFlight, observedTarget, arrivalTick-T)`. No enemy speed extrapolation, speculative advance or damage calculation. A currently pending, contiguous flight interpolates current→that endpoint with the scheduler's clamped fractional tick. Every accepted tick rebases. No more than one tick is projected.

First observed release always starts current even if incoming alpha is high; later fractions in that release interval rebase from its first-shown alpha. Initial attach or a discontinuous/gapped observation stays at current for that accepted stamp, then may forecast after a contiguous next observation. Missing target never forecasts and is not drawn. Stale owner/stamp is rejected, equal stamps use the accepted observation, and missing pending/impact/cancel always overrides a forecast. There is no replay of an abandoned path.

The hand offset decays with `(T-releaseTick+displayFraction)/(arrivalTick-releaseTick)`, not a changing target-distance denominator. Its endpoint is continuous across adjacent ticks and zero at arrival.

Projection cannot imply speculative contact. After applying the hand offset, the segment stops at its first intersection with any actually drawn enemy body's safety circle. The current radius reserves the maximum full alpha>0 corner radius of all effect options about their strong-bounds center (and the legacy36px body-scaled extent), plus11px body +0.75px stroke +sqrt(0.5) integer-placement allowance +1px filtering allowance +2px gap. The circle is rotation-invariant; actual rendering applies no rotation. All options reserve this same radius so paused body/effect resizing keeps the same safe center. This is conservative relative to the actual ellipse. If the current start already overlaps the safety region, suppress the pending letter rather than teleporting it outward or showing a false contact. Actual impact may then show contact at the committed center. A small terminal center jump is intentional; zero-jump is not promised.

## Lifecycle and evidence

Display owner/stamp/alpha/cache/first-shown/aftermath stay outside core canonical/hash. Pause/hidden stop advance and resume without hidden-time catch-up. Size-only repaint preserves both accepted alpha and already drawn flight center; body/envelope dimensions may change, center cannot advance. Terminal attacks clear cached flight centers.

Image decode failure clears the canvas/old labels, disables pause and shows an explicit retry for the same scene/autoplay request. Superseded success/failure never changes a newer owner. Actual Chromium lifecycle tests cover rejection/retry, old failure/new success, old success/new failure, stale RAF/reset and pause-mid-flight→36/32/36/32 with exact center/hash comparisons. Screenshots carry viewport, condition, tick and hash; verification.json pins the reviewed SHA.

`npm test`:444 PASS (baseline365 +timing63 +adapter16). Typecheck and adapter build pass. Projection tests include first release/high-alpha attach, missing target, gaps, four moving target corners/seam, earlier same-tick lethal cancelling another pending attack, pending absence, and guard/anchor continuity. Boundary states in Node tests are explicitly diagnostic; there is no diagnostic state importer in the browser.

Browser scripts:tests/popo-timing/record.mjs and lifecycle.mjs. Set PLAYWRIGHT_MODULE, CHROMIUM_PATH, REVIEW_URL, EVIDENCE_DIR as needed; no dependency added. Recording matrix is390×844/1165×747 ×32/36px ×normal/150/250ms ×lethal/nonlethal ×independent8/10/12px effects (72). Original CDP timestamps drive the evidence player. Per-frame audit includes real projected centers and actual canvas pixels changed by the letter (RGB change>=8), native raster width, contrast, conservative body gap, and first committed contact raster. This is browser capture/instrumentation, not human play or generated animation.

At150/250ms a flight can be skipped entirely; first post-impact frame shows terminal HP/contact instead of catch-up flight. This is distinct from normal-speed residual gap. The letter remains small; recovery art has about0.51px head drift at36px and foot variations. Final visual approval, other directions and human play remain pending independent Momo/Kiki exact-SHA review.

## Historical forward comparison at538d8ac

Eight normal-RAF combinations (two viewports ×two sizes ×two scenes) were compared with saved6f9794e captures/audits. Previous last-flight center→committed contact distances ranged42.40–65.55px (RAF sampling differs); forward presentation measured19.818px in every combination. Changed-raster bounding-box centers measured19.294–20.025px, so this does not claim zero jump. The pending letter intentionally stops outside the silhouette before committed contact. Conservative actual changed-pixel clearance was at least2.438px across normal captures. Letter raster widths were7–8px at body32 and9px at body36; terminal raster height4–5px. RGB-change threshold8 measures visibility bounds, not human readability/approval.

All24 playback cases preserved prior final core hashes.150/250ms may omit flight entirely and are reported separately; no normal-speed improvement claim is inferred from their omitted frames. Evidence comparison player uses original captured frames/timestamps from both SHAs, and comparison.json distinguishes old recorded-center distance from new actual raster measurements.


## Independent effect width comparison (PR45 ab00e389)

Source:ab00e389296cec5116710468a22657cb93f68454, v7-letter/effects/v6-baseline-{8,10,12}px.png. Copied original v6 variants byte-for-byte with source measurements, comparison images and provenance hashes. The two newly generated alternatives are not loaded/adopted. Original raw letter/body/anchors and previous comparison commits remain preserved. The select retains the earlier body-scaled renderer as `기존 몸체 연동` and defaults to the independent8px baseline, not to a final approved choice.

| Effect label (alpha>127) | Strong bounds | Strong dimensions | Full canvas | alpha>0 bounds |
| --- | --- | --- | --- | --- |
|8px|[3,5,11,9]|8×4|14×14|[0,2,13,12]|
|10px|[3,5,13,11]|10×6|16×16|[0,3,16,14]|
|12px|[3,6,15,13]|12×7|19×19|[1,3,18,15]|

These files are integer-position 1:1 RGBA blits, independent of32/36px body height; no canvas-size-as-width mistake and no second resampling/rotation. The browser validates decoded canvas, alpha>127 and alpha>0 bounds before accepting images. Source scale factors are retained in measurements.json. At first release, strong left=round(actual transformed fingertip x)+1. Body pose/pivot/anchor remain unchanged. The static source's preview y phase is not applied to the existing adapter body. Vertical placement follows round(center−strongHalfHeight); odd7px strong height can shift its optical bbox center by0.5px when changing options. The simulation/presentation anchor and accepted fraction do not advance.

The reserved guard is26.5589px from enemy center for all choices. This deliberately exceeds the prior538d8ac19.818px center distance: it protects the full transparent-edge footprint of12px plus integer alignment/filtering, including an8→12 switch while paused exactly at the guard. Actual alpha>0 fringe is preserved, not erased to reduce this gap. The center reserve is conservative for8/10px. Current terminal center jump is26.5589px; actual changed-RGB raster bbox center jump ranges26.52–27.78px. Minimum measured changed-pixel/body clearance is6.045px. These changed-RGB bounds are **not** alpha>127 dimensions: widths can be11–17px because low-alpha fringe changes the background.

All72 normal/delayed lethal/nonlethal cases keep the same core hashes and actual100ms flight/impact ticks. Browser lifecycle checks include first attach, stale reset/decode/RAF, body resize and effect8/10/12/legacy changes both mid-flight and at the pre-contact guard; anchors/hash stay fixed and pixel clearance remains safe. Low-frame skips remain a separate limitation.

Recommendation for the next independent art review:12px first,10px as the less prominent alternative. Native normal-speed captured flight/contact frames show the12px cream envelope/flap and seal separating better than8px;10px improves the outline but remains subtler in100ms.12px also occupies more of the small character's visual space and contact marker. This is an implementer's comparison recommendation, not a final art/readability approval or human-play result. No new generated image is adopted and no core timing is changed. The larger reserved contact gap is an explicit tradeoff, not a zero-jump claim.
