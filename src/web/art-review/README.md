# Committed-hit instrumentation scene (generation 4, PR47)

This is event instrumentation and an enemy visibility/lifetime review, **not finished attack art**. Base main `8140bda52445c348d1c9dde6fc3265c0962af010`. Run `npm run dev` then `/art-review.html`. Separate build: `node node_modules/vite/bin/vite.js build --config src/web/art-review/vite.config.ts`; serve `dist-art-review/`. Default game, core/rules/seed/RNG/log/production manifest are unchanged.

## Actual data and visible feedback

Scenes use fixed legal recruit/move commands and real core advance, no patched state or fabricated events. The two candidate panels mirror the selected neutral fixture attacker, not separate character abilities. `scenes.ts` lists reproducible checkpoints: near diagonal tick1, up13, far diagonal1, horizontal66, down109, multiple18, original lethal25. Direction buckets use a 0.25 minor/major-axis tolerance; near means <=1500 distance. These are review categories, not approved melee/ranged character definitions.

Enemy silhouette is a neutral inspection graphic, not new final enemy artwork. It has eyes, body and HP bar; hit flash colors the body without covering its face. HP before/after comes from the pre-batch enemy snapshot and ordered committed spawn/attack events, including multiple attacks on one enemy. No rule-based damage recomputation. Killed enemies retain the actual hit coordinates and maxHP, receive crossed eyes/death label, then collapse and fade; they are already absent from engine state. Beside the board, before/after silhouettes and numeric HP make overlapping targets distinguishable without moving their actual positions. Recent rows are historical records, not still-active enemies.

Presentation time is separate from event time. Every received attack starts its inspection hold on the first presentation tick, so an attack at tick1 in a 3/4/5tick batch cannot disappear before its first frame. The damage/event timestamp and current engine HP remain unchanged; the UI discloses event tick and first-presentation tick. Holds are two presented core ticks for attack/flash, three for recovery, eight for impact/death retention; paused/hidden core freezes them. Preparation/result intentionally freezes the last frame. Reset, new scene, next wave and selected-entity replacement clear presentation history; owner/generation guards reject stale image callbacks. No wall-clock animation advances gameplay.

Horizontal three-pose samples are supported only in the horizontal bucket; up/down/diagonal aiming is explicitly unsupported and remains idle, while actual enemy impact is still displayed. There is no character teleport or invented melee reach. Optional thin dashed connectors and splash boundaries are diagnostic guides, disabled by default; they are not energy beams or completed attack art.

## Existing attack intent and contract boundary

Read directly: `docs/design/playable-v2-contract.md` sections2–3 at base8140; [Issue19 proposed kits](https://github.com/mrkimkim/infinite-gacha-defense/issues/19#issuecomment-6094376405); [Popo art brief](https://github.com/mrkimkim/infinite-gacha-defense/issues/19#issuecomment-6094427437). Popo's historical experiment is single letter projectile (6/12tick/3200); Nuri is primary-target-centered water splash (5/24tick/3000, radius1100). These are experimental integration definitions, not final balance or original-IP power approval. Popo's extended release arm is not evidence of melee gameplay. The current fixture registry uses neutral IDs; this scene does not silently approve name mapping.

The current core's attack event commits damage immediately, removes dead enemies before later units attack, and gives immutable source/center/hits. Nuri's target-centered simultaneous splash can use those exact center/hits for same-tick impact art. Popo can show only an immediate launch/impact trace under this contract, not a visibly traveling projectile whose impact comes after death. No letter/water final effect is fabricated here.

A visibly traveling letter that damages on arrival requires an explicit core proposal: separate launch and impact events; versioned pending-projectile state/IDs; arrival tick and speed/trajectory semantics; target movement/death/retarget rules; damage snapshot timing; multi-target order; cooldown/spawn/phase/deadline behavior; canonical state/hash/replay and batching tests. A preparation animation before a known attack also requires an engine signal or approved predictive presentation contract. This PR does not change any of those contracts.

Still needed: directional original aiming/release frames (up/down/diagonal), actual anticipation if wanted, approved letter/water effect art, enemy final hit/death art, and independent normal-speed pixel review. Current success is instrumentation/lifetime readability, not production quality or satisfying the final attack-contact requirement.

## Provenance and checks

Candidate source pixels/prompts and hashes remain in `public/assets/art-review/provenance.json` (Nuri PR43v03, Popo PR45v5). No source raster changes. Nuri common-height raw clips and Popo author-native frames retain their existing pivots and limitations.

Regression tests cover actual replay, ordered HP across batches, same-tick lethal removal with retained silhouette data, 3/4/5tick first presentation, pause/expiry, entity/owner reset, stale image leases and all scene geometry. Browser evidence separately records real Chromium normal-speed screencast frames (actual timestamps), single-tick before/hit/after views, actual low-frequency RAF callbacks, and replay checks. Test success does not replace independent visual review.
