# Surface-contact experiment

Base: PR49 `c5ae0239bc0666a5fd7dbde10143f935d71a39c6`. Separate branch; no core, default route, Nuri, original raster or existing PR49 branch changes. This is a visual experiment, not final art approval.

## Failure cases fixed before implementation

- A letter stamped at the committed enemy center obscures normal/X eyes for two ticks.
- A last-flight center at the conservative safety circle jumps 26.5589px to that center.
- Late/first attachment must not invent a previous flight or replay flight after impact.
- Cancellation, missing pending, reset and stale callbacks must never produce speculative contact.
- Overlapping enemies, HP bars and unsupported directions must not receive a misplaced flash.
- Effect/body resizing during pause must not advance the accepted flight or alter core state.

## Proposed display contract and comparison gates

Keep the original impact target position and hit snapshot unchanged. Only an actual accepted impact can create a visual contact anchor. Choose the incoming-facing point on a 14×15px outer ellipse around the hit snapshot and a short 0.48-radian arc (3.5px dark outline, 1.5px cream core). The enemy body is 10×11px with a 1.5px stroke. Draw the arc on the first presented impact tick only, without a contact letter or full ring. This is a stationary surface response, never continued flight.

Use the last actually displayed pending position only when its target ID matches and its tick is exactly impact.tick−1. Otherwise use the event's sourcePosition→hit.position direction. A degenerate vector or unsupported right-facing cone suppresses the surface cue; no arbitrary direction is invented. Freeze the visual geometry when accepting the event. Test its conservative stroke bounds against all currently drawn enemy silhouettes and HP bars; suppress the cue if another body/HP bar occludes it, rather than shifting it to an unrelated face.

Acceptance compares c5ae023 actual normal-speed captures with the same new legal scenes at 390×844/1165×747, body32/36, effect8/10/12, lethal/nonlethal. Record pre-impact raster clearance separately from last-flight-center→visual-anchor distance and last-flight-center→unchanged-core-hit distance. Exact pixel comparison must find no cue pixels over any protected body/eyes/HP region. The visual-anchor transition should be shorter than the baseline center jump when unobstructed, not claimed to be zero. Check 150/250ms, late attachment, cancellation, pause/resize, stale reset/decode, canonical hash and event timing. Preserve failures as evidence; structural tests alone do not approve the art.

Flight12px remains the preferred comparison candidate. No new image generation is needed for this small procedural contact cue. Existing default effect selection and all original assets are preserved.

## Contrast decision

The first cream-only 2px arc was difficult to distinguish against the beige board in native-size captures. The reviewed variant adds the dark 3.5px outline with a 1.5px cream core; geometry and protected-pixel checks were rerun for the larger stroke. This improves the small cue boundary without restoring the face-covering envelope or full ring. The brief cue remains quieter than the previous ring and requires independent visual review.
