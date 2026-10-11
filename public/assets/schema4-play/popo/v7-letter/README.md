# Popo letter readability: ART-POPO-03

Review candidate only. Recommend testing the unchanged v6 envelope at 10px and 12px effect width in the actual 100ms flight. No new generated variant is claimed to improve envelope identity. At 8px all options remain tiny bars; 10/12px improve cream rectangle, flap and red seal separation. Actual movement readability and final selection are pending.

Assignment: https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6100065723 . Base candidate PR45 head 1dd70826a5c05fe0283a96af8fdd59d4931a9036.

## Inspect
- comparison-8-10-12.png: 32px body above 36px body, each at independent 8/10/12px strong-alpha effect widths. Actual-size samples plus 4× nearest-neighbor inspection crop.
- detached-flight-comparison.png: same effects separated from hands; actual size and full 4× inspection. A symmetric envelope does not prove rightward travel. Generated left trailing ticks weaken after reduction; direction is uncertain in these static specimens.
- effects/: exact RGBA review assets. Sizes mean measured alpha >127 bounds, not canvas size or alpha >0 fringe. All three bounds and scale adjustments are in measurements.json.

## Preservation and method
references/v6-letter.png is an unchanged copy of v6's letter. v6 release body/previews are unchanged, as is the native fingertip anchor (688,365). Body preview transform is height/563 with common y phase 0.375px. Effect size is independent of body height: its leftmost strong pixel is placed one output pixel past the rounded transformed fingertip; its vertical strong-bounds center is rounded to fingertip y. This is a comparison attachment convention, not adapter implementation or changed core origin.

Built-in image generation edited only the separate letter. Both attempts and full prompts are preserved. Attempt1 sought larger seal and small left trailing ticks; attempt2 simplified highlights and shortened ticks. Neither convincingly resolves static rightward-direction readability at tiny size, and both trade envelope area for trailing marks. They are retained as unsuccessful alternatives, not accepted upgrades. No body regeneration, mirroring, alpha threshold deletion, procedural art repaint or runtime code change occurred.

Resampling preserves the full raw image, adds transparent padding, and uses Lanczos. A small recorded scale adjustment makes measured alpha >127 width exactly 8/10/12px. Alpha >0 includes normal resampling fringe. This is technical sizing, not a cleanup or painted outline. Original baseline strong dimensions are 8×4, 10×6 and 12×7px; canvas sizes are 14×14,16×16,19×19px. New variants' exact dimensions are recorded separately.

Beige is median RGB sampled from clear region (260,460)-(300,480) of references/pr49-32px-0019.jpg, provided by the leader's actual PR49 capture (32px body, flight). The comparison's uniform beige field is a sampled-background specimen, not a new game capture. Light/dark fields are explicit synthetic backgrounds. Original screenshot is preserved for context.

Reproduce comparisons: python compare.py (Pillow, NumPy). SHA-256 integrity is recorded in manifest.json. Static comparisons cannot establish 100ms travel, interpolation, impact synchronization or game adoption; those remain leader-owned tests.
