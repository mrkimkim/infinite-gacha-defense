# Nuri motion review candidates

Task: **MVP-AM-ART-NURI-01**, owner: 키키, assignment generation 3. Preserve the three raw idle → attack → recovery candidates and the evidence needed to review them. **None of the variants is a production atlas or an approved character/fixture mapping.**

- Assignment: [Issue #24](https://github.com/mrkimkim/infinite-gacha-defense/issues/24) and [candidate-only scope confirmation](https://app.slack.com/archives/C0C83AS1GE9/p1791643303341089).
- Reference and PR base: `412ddd2891655d96e7e9b0fff63e9ab7322699aa`.
- Scope is only `assets/candidates/nuri-motion/kiki/**`. No production manifest, fixture mapping, runtime source, reference asset replacement, or deployment is included.
- Each variant contains `raw.png`, the exact `prompt.txt`, `measurements.json`, and a curated `REVIEW.md`. Raw generated PNG bytes are unchanged. Measurement JSON is review evidence, not a loader contract.

## Latest candidate: v03

[v03 raw PNG](v03/raw.png) revises v02 after the [leader's actual Chromium playback review](https://github.com/mrkimkim/infinite-gacha-defense/pull/43#issuecomment-6098844273). The review covered v02 source assets at head `bc36481fb221ffbb3b5ca97e8e8bd48b15b9038a` in a separate viewer, including 32/36px repeated RAF playback and Pause/Next/Resume. It identified about 1.02px outward movement per foot at 36px, a 3.23px crouch-to-idle height jump, and a recovery shell merging with body/feet at 32px. Production approval was withheld; game hit-event linkage was not reviewed.

v03 corrects the **measured height gap**, not every motion defect:

- All three alpha ≥128 silhouette heights are 625 source pixels. At the same 36/625 scale, the previous recovery-to-idle height difference of 3.2256px is now 0. No per-pose rescaling was used. Equal heights do not establish identical anatomy or smooth playback.
- Idle sole-center separation is 229px; attack and recovery are 252px. With midpoint alignment, each foot still shifts outward by **0.6624px at 36px** and **0.5888px at 32px**. Sole shapes also differ. Exact individual foot locking was requested but not achieved.
- The recovery shell is higher and clear of the feet, but its contour still touches/overlaps the tail in the full-size source. Actual-size separation remains unresolved.
- v03 actual browser playback, visual approval, independent motion approval and hit/timing review remain pending. v01/v02 files remain unchanged as comparison evidence.

Download the [v03 portable playback viewer](v03/nuri-v03-portable-playback-review.html) and open the saved HTML offline. It embeds the unchanged raw PNG, uses a common scale and measured midpoint anchors, and adds idle-sole guides to expose remaining foot spread. Sequence: idle → attack → standing arm recovery → unchanged idle settlement. Default holds of 600/140/180/400ms are editable inspection values, not game timings. Review backgrounds are flat slate/cream rather than the game board.

The [v03 structural report](v03/portable-playback-checks.json) records 21 passing structural/model/mock-UI checks against the final HTML; [foot-comparison.json](v03/foot-comparison.json) preserves both sole centers and their shifts. Complete PNG decoding, repeated alpha/frame measurements, embedded-byte identity and foot arithmetic were checked. These do not replace actual browser visual QA. Read the [v03 review](v03/REVIEW.md) for exact bounds and remaining limitations.

v03 was generated on 2026-10-10 at 15:05:37 UTC using unchanged v02 as the edit target and the original Nuri sheet as the identity reference. The same pinned reference base below applies. Main had advanced to `8140bda52445c348d1c9dde6fc3265c0962af010` when v03 was preserved; its changes were checked and do not overlap this candidate directory. This candidate branch continues its existing history without modifying those runtime changes.

## Earlier v01/v02 assessment and remaining work

Retain v01 as the comparison baseline and v02 as the more distinct recovery candidate. The brown otter, cream muzzle, freckles, viewer-right blue scarf, sprout apron and peach shell remain recognizable against the original identity reference at full size. v01 recovery returns almost to idle. v02 lowers the shell to the hip and visibly settles the body, but its silhouette height drops about **9%**, more than the requested 3%.

The frames are not uniformly aligned or identically proportioned. Foot positions and pose widths differ; do not split either strip into an assumed regular grid or use a single naive crop center. The measured sole pivots below are proposals, not validated animation anchors.

Both PNGs have predominantly alpha 253 interiors, equivalent to about **99.22% opacity / 0.78% transparency**. This falls short of the fully opaque-interior request, but does not establish severe visible transparency. Faint alpha 1–7 noise remains. No cleanup or thresholding was applied. Its visual effect and safe clip boundaries remain to be checked.

At the original v01/v02 preservation checkpoint, actual 32–36px repeated playback QA had not been performed. The later leader review described above now supplies v02 playback evidence and open defects. The static-size peer observations below remain distinct from that later review. Independent motion approval remains open, and production approval has not been granted. Adoption, fixture mapping and integration require separate review.

### Open peer findings and proposed review sequence

[Momo's v02 review, 2026-10-10 14:45:30 UTC](https://app.slack.com/archives/C0C83AS1GE9/p1791643530654379), reports inspecting the actual source and 32/36px views. The face, blue scarf, apron, shell and same-hand usage remain recognizable, and the attack silhouette reads. Recovery reads as a crouched intermediate pose rather than a completed return. At 32px, the lowered shell appears to merge with the body. Alpha 253 did not appear to be a severe transparency issue in that inspection.

For the next playback review, propose **idle → attack → crouched intermediate (the source frame named recovery) → the unchanged v02 idle frame** as a settling return. Keep one common scale and the measured sole anchors; do not enlarge the whole recovery frame to hide its height change. Frame duration, settling behavior and hit synchronization remain subject to actual repeated playback review. Reusing idle is a review proposal only; no extra raster frame or production runtime sequence is added here. Momo's foot sliding, size-pop, 32px shell separation and hit-connection findings remain unresolved.

## Portable playback review artifact

Download [the standalone v02 HTML](v02/nuri-v02-portable-playback-review.html) and open the saved file in a browser for offline review. GitHub's source view does not run it. The file embeds the unchanged v02 PNG bytes and contains no external resource or network dependency. It adds review controls only, without connecting to the game runtime or altering the images.

- Play, pause, step, reset and optional loop; playback starts paused and a single pass stops on the unchanged idle settlement.
- 32px/36px **idle-height** choices, fixed measured sole anchors and one common scale across poses. At the 32px choice, crouch is approximately 29.13px high; this is not normalization of every pose to 32px. The separate 4× view is for inspection only.
- Flat dark slate and light cream backgrounds, plus optional anchor guides. This does not reproduce the actual game board or validate in-game contrast.
- Editable holds of 40–5,000ms, with arbitrary inspection defaults of 600/140/180/400ms. These are not game-core timings, anticipation windows or hit-synchronization decisions.
- Source windows use alpha ≥8 bounds with 4px padding. Faint pixels outside these windows are clipped only during display; the complete original PNG remains embedded and expandable. No alpha cleanup or raster export occurs.

[The structural-check report](v02/portable-playback-checks.json) records **21 passing checks** against the exact HTML hash: embedded PNG byte equality and decoding, inline JavaScript compilation, phase/control behavior, scale/anchor arithmetic and mocked DOM/canvas events. These checks do not render a browser, inspect pixels at target size, or close the motion review. No browser visual QA or screenshot of this portable artifact has been performed. Foot sliding, size pops, low-shell separation and timing/hit review remain open.

## Raw image integrity

| Variant | Dimensions | Format | Bytes | SHA-256 |
|---|---|---|---:|---|
| [v01](v01/raw.png) | 2172 × 724 | RGBA PNG | 1,348,750 | `63f143c338173802f59352c63df69170d2b03364dd0245c08d09e129aedc848d` |
| [v02](v02/raw.png) | 2156 × 729 | RGBA PNG | 1,299,339 | `f8369b8b8d53b9ede88de05b53c267a360893aaf5132a62496a20aa51b289881` |
| [v03](v03/raw.png) | 2158 × 729 | RGBA PNG | 1,344,822 | `c53d340bcb53386dfd0a2424a0d24a853b32ba12b732e6c5434c52969599727f` |

v01 was generated on 2026-10-10 at 14:25:41 UTC. v02 was generated as a single revision of v01 on 2026-10-10 at 14:33:30 UTC. Transparency was requested for both. No raster edits, crop exports, resampling, recoloring or alpha repair were applied afterward.

## Measured bounds and proposed anchors

All coordinates are in the whole raw PNG. Bounds are `[x0, y0, x1, y1]`, left/top inclusive and right/bottom exclusive. Each pivot is `(x, y)` in source pixels. These are measured silhouettes, not a uniform frame layout.

| Variant / pose | Alpha ≥8 bounds | Alpha ≥128 bounds | Proposed sole pivot | Alpha ≥128 height |
|---|---|---|---|---:|
| v01 idle | [141, 50, 631, 679] | [142, 50, 630, 678] | (359.75, 678) | 628 |
| v01 attack | [772, 57, 1410, 679] | [772, 58, 1409, 679] | (1045.75, 679) | 621 |
| v01 recovery | [1585, 61, 2065, 681] | [1586, 62, 2064, 679] | (1796.75, 679) | 617 |
| v02 idle | [141, 48, 629, 675] | [142, 49, 628, 674] | (358.5, 674) | 625 |
| v02 attack | [768, 55, 1408, 676] | [771, 56, 1405, 675] | (1043.25, 675) | 619 |
| v02 recovery | [1563, 105, 2063, 676] | [1564, 106, 2062, 675] | (1781.75, 675) | 569 |
| v03 idle | [136, 45, 627, 673] | [137, 46, 626, 671] | (354.5, 671) | 625 |
| v03 attack | [778, 47, 1418, 674] | [779, 48, 1417, 673] | (1051, 673) | 625 |
| v03 recovery | [1546, 47, 2063, 674] | [1547, 48, 2062, 673] | (1770.5, 673) | 625 |

Measurements group columns containing alpha ≥8, joining adjacent runs only when separated by at most four empty columns. Each group's actual bounds are then measured at alpha thresholds 8, 128 and 250. For the proposed horizontal pivot, take the average centers of the two alpha ≥128 sole runs on the row eight pixels above the alpha ≥128 exclusive bottom boundary. The vertical pivot is that boundary. Full runs, samples and threshold bounds are preserved in each measurements file.

Global alpha >0 bounds are [0, 23, 2148, 724] for v01 and [0, 25, 2126, 729] for v02; they include faint stray pixels. Global alpha ≥8 bounds are [141, 50, 2065, 681] and [141, 48, 2063, 676], respectively. Alpha 1–7 pixel counts are 13,796 and 14,322. The v02 revision did not remove that noise.

v03 global alpha >0 bounds are [133, 21, 2134, 707], compared with alpha ≥8 bounds [136, 45, 2063, 674]. Alpha 253 dominates 659,326 pixels and remains near-opaque rather than exactly opaque. There are 15,568 alpha 1–7 pixels. No cleanup was applied; visual impact remains to be checked.

At a common scale making v02 idle 36px high, attack is 35.6544px and recovery 32.7744px. At idle 34px they are 33.6736px and 30.9536px. These are calculations only; no runtime readability or smoothness claim follows. The 8.96% recovery-height reduction describes the silhouette, not proof that the entire anatomy was uniformly scaled.

## Reference provenance

The original identity reference already exists in the repository and is linked rather than duplicated:

- [Nuri original sheet at the reference base](https://github.com/mrkimkim/infinite-gacha-defense/blob/412ddd2891655d96e7e9b0fff63e9ab7322699aa/docs/reference/characters/nuri/sheet.png), SHA-256 `8ec7b3cc8e16db5f0252eba82ab243ad5c7005f1b121734bfa49f609f0c488f1`.
- v01 inputs: original Nuri sheet plus the [board v02 review candidate](https://app.slack.com/archives/C0C83AS1GE9/p1791642208439499), SHA-256 `9f412743535f6b8d19d562829cacf270ddf387295af18bdf7c76f2132c4d2920`. The board was contrast/tonal context only and is not an approved production style. It is not copied here.
- v02 inputs: the unchanged [v01 raw strip](v01/raw.png) and the same original Nuri sheet.
- v03 inputs: the unchanged [v02 raw strip](v02/raw.png) and the same original Nuri sheet; feedback source is the [leader's v02 browser review](https://github.com/mrkimkim/infinite-gacha-defense/pull/43#issuecomment-6098844273).
- Initial art context: [Nuri motion request](https://app.slack.com/archives/C0C83AS1GE9/p1791641138025269).

The candidate-publication scope above does not determine a new license, production adoption, gameplay ability or final roster. Review preserves the original reference identity without modifying the reference files.
