# MVP art integration boundary

Generation 3 / MVP-AM-ART-01 / base 412ddd2891655d96e7e9b0fff63e9ab7322699aa.

The manifest is deliberately empty. No production character art, approved roster mapping, or candidate art has been selected by this implementation. Synthetic metadata in tests is not a game asset. Browser decoder checks use a test-only routed pixel and do not add that pixel to this folder.

## Consumer API

Import functions from `src/web/v2-art.ts` and explicitly import `src/web/v2-art.css` in the browser consumer. Node tests can import the module without a CSS loader.

1. Fetch/parse `assets/mvp/manifest.json` relative to the deployment base, then call `createArtLibrary(json)`. Catch malformed manifests and retain current role icons. The default accepts only `status: production`; an explicit `allow: ['candidate']` is for a visibly labelled candidate review, not production adoption. `approvalRef` is a provenance label, not proof of approval.
2. `await library.resolve(assetId)` returns `{ok:true,sprite}` or `{ok:false,reason,fallback:'role-icon'}`. Preserve the accessible label and existing icon until success. Before applying an asynchronous response, check that match owner, entity/offer selection and renderer lifetime are still current. Library disposal invalidates in-flight results. Failed requests stay cached to prevent render-loop request storms; use `resolve(id, {retryFailed:true})` for an explicit retry after failure. Concurrent retries coalesce, and successful/pending entries are never invalidated by this option. A renderer reset does not need to flush successfully cached immutable images.
3. Create one `createSpritePlayer(sprite)` per rendered entity. Capture `const generation = player.reset(matchOwner, currentTick)` at initialization and phase transitions that clear combat feedback. `sample({owner:matchOwner,generation,tick,paused,attackTick?})` returns clip/frame/rect, or null for an old owner/generation/backward tick. Each callback must capture its generation when scheduled, not read the newest generation when it arrives. Reset returns a new generation even with the same owner object. Pass `paused=true` for pause/hidden/frozen display; call reset when restarting. Supply the latest committed attack event's tick after observing that event. Attack is hit feedback, not an invented pre-hit windup. Repeated event notifications do not retrigger. An attack delivered while paused is queued without changing the displayed pose; the latest valid attack begins on resume. Reset discards queued attacks. On resume, the delta from the last sampled tick is active time; the core must keep ticks frozen while paused, or the host must provide a final paused sample at its resume tick before an unpaused sample. Idle loops, attack and recovery play once, then idle resumes. No game clock or RNG is advanced.
4. `spriteLayout(sprite, pose.frame, {width,height}, {x,y})` returns CSS pixel size/position and atlas background size/offset. The target anchor is the foot point; the pivot is frame-local. Set backgroundImage from validated sprite.src and add `.v2-art-sprite` to a decorative element inside `.v2-art-host`. Existing labels, stars, selection and hit areas stay with the owning UI. This function fits the full frame canvas, not the visible body; transparent padding must be accounted for in art preparation.
5. `library.dispose()` on renderer destruction. Clip state and image caches never enter canonical state/replay data. Respect reduced-motion preference by selecting a static idle pose in the consumer; the CSS intentionally adds no animation of its own.

## Manifest version 1

Exact root keys: version=1, sprites. Exact sprite keys: id, src, status, approvalRef, width, height, pivot, frames, clips.

- id: unique ASCII asset identifier. Map explicit engine definition/type IDs to this identifier in the consumer; no fixture-to-IP mapping is implicit.
- src: deployment-relative `assets/mvp/...png` or `.webp`; no traversal/remote/encoded URL.
- status: production, candidate, synthetic-test. production requires nonempty approvalRef. Do not copy candidates here as approved without a real adoption decision.
- width/height: decoded atlas dimensions, verified by loader. Frames: x/y/width/height integer rectangles within atlas, all same canvas size. Pivot: integer x/y within one frame.
- clips.idle/attack/recovery: nonempty frame-index and positive tick-duration arrays of equal length. idle repeats; attack/recovery do not. Durations are display ticks and never change attack period or damage timing.

This first module consumes one raster atlas per sprite, not independently sized frame URLs. Multi-image clips, art packing/cropping, entity binding and actual screen rendering are not implemented here. Source hashes and human review evidence should accompany approved asset delivery; the loader checks dimensions and transport, not cryptographic byte integrity or rights.

Named exported types: ArtStatus, ArtClipName, ArtFrame, ArtClip, ArtSprite, ArtManifest, ImageDimensions, ArtLoader, ArtResolution, ArtPose, ArtLibrary, SpritePlayer, SpriteSample, SpriteLayout. No core type changes are required.

`loadArtImage` is a low-level browser adapter, not the manifest safety boundary: consumers should request validated IDs through `library.resolve`, not pass arbitrary URLs directly. Both the image request and inline background URL must resolve against the same deployment base. After awaiting resolve, check renderer generation as well as owner/entity before applying it; image cache entries are deliberately not tied to a match.
