# Popo letter / schema4 review adapter

Separate review route `/popo-timing.html`, based on PR48 exact `493590fba179c2c100f628fb9aeb3d5e0de37c0b`. Default game, core, package scripts and PR48 branch are unchanged. Owner: leader, delegated follow-up to Issue24 attack-timing experiment. New file scope: this directory, `tests/popo-timing/**`, `public/assets/popo-timing/**`, root `popo-timing.html` only. No merge/deployment or production adoption.

Run `npx vite --config src/web/popo-timing/vite.config.ts --host 127.0.0.1`, then open `/popo-timing.html`. Build using `npx vite build --config src/web/popo-timing/vite.config.ts`. This uses existing installed dependencies. No new dependency/authentication required.

## Source and decisions

PR45 `1dd70826a5c05fe0283a96af8fdd59d4931a9036` v6 body attempt2 original raster, four extracted frames, separate letter and measurements are copied byte-for-byte. `provenance.json` contains SHA256 values. Source original/letter were directly inspected. Candidate viewer HTML was not opened, served, copied or retried. This is newly written game source consuming the actual schema4 engine, not that blocked standalone art viewer.

Only fixture-01's actual pending attacks use this candidate. Eligibility checks `delayedDefinitions['fixture-01']`; compatibility behavior lists never select art. Other definitions/Nuri are not added. Character is never mirrored. The available right-facing pose supports an explicitly disclosed rightward cone with |dy| <= 0.6 dx (about31 degrees). Left, vertical and wider diagonal poses are unsupported and show idle with a status label. This is an experiment, not a formal IP roster mapping or approval.

Bodies use common pivot360,640 and max body height563: native body heights32/36px. The letter uses alpha-content crop110,335,1143,919 and width138 native pixels; visible letter width7.84/8.82px. Grip467,382 and release fingertip688,365 come from source anchors. The flight's display-only hand offset fades with observed traveled distance and reaches zero at contact. Core integer position, damage, range, RNG, replay, and hash are unchanged. No guide lines, estimated damage or decorative post-damage flight.

`consumer.ts` is the production review adapter's local copy of PR48's corrected reference consumer. Display owner, accepted stamp, monotonic alpha, terminal IDs, first-shown cursor and bounded aftermath are outside canonical state. First observation/new or discontinuous flight starts at current position; only a previously observed contiguous segment interpolates. Older callbacks return null before painting. Impact removes pending imagery regardless of alpha. Equal stamps reuse accepted HP/pending; reset invalidates old RAF and image generations. The image decode race accepts only current owner/generation.

## Legal scenes and timing

Both scenes use seed1, recruit offer0, move unit1 to board3,0, startWave, advance. No state import, artificial HP/target placement or alternate damage engine is exposed.

- Death: attach122; attack10 starts123, releases126, arrives128; enemy5 HP4→0 with actual damage4. Replay stops136.
- Nonlethal: attach146; attack12 starts147, releases150, arrives152; enemy4 loses actual6 HP. Replay stops160.

Normal speed is50ms/tick: 150ms preparation and100ms flight. Release pose lasts one tick. A contact-only letter/ring is stationary at exact hit coordinates for up to two presented ticks; it is not a flight. Neutral enemy silhouettes and HP bars show actual state. Death remains at the committed hit position with crossed eyes/fade. First-presented aftermath is retained8 simulation ticks and frozen when the review scene stops. No simulation tick or damage is delayed for appearance. At150/250ms frame intervals a whole flight can be skipped: the first post-impact frame shows terminal contact/HP, never a catch-up projectile. Background enemies continue to use real observation positions.

Pause/hidden stop advance; resume resets the wall-clock baseline without hidden-time catch-up. The review API can attach only to this legal replay at a selected tick; it does not import diagnostic MatchState.

## Validation and limits

`npm test`:433 PASS (baseline365 + timing63 + adapter5),0fail/skip. `npm run typecheck`, default build, tooling build and separate adapter build pass. Browser recording script in `tests/popo-timing/record.mjs` uses externally available Playwright/Chromium; no dependency added. Configure `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `REVIEW_URL`, `EVIDENCE_DIR` as needed.

Actual Chromium RAF:390×844 and1165×747;32/36px; normal/150/250ms death runs plus normal nonlethal runs. Tests cover first attach at124/127/128, real delayed same-owner RAF after impact, reset-stale RAF, pause hash stability, competing image decode reset generations, normal phase visibility, terminal non-resurrection, and identical final hashes across frame conditions. CDP JPEG frames preserve original timestamps in the evidence player; these are real captures rather than generated animation/video.

Functional evidence does not establish final visual approval. 100ms flight and sub9px letter are brief/small at native scale. Original candidate recovery has about0.51px head-height drift at36px and foot variations. The pose/cone, contact readability and native-scale feel still need Momo/Kiki exact-SHA independent review. Full gameplay, all directions, Nuri, human play and final art acceptance are not claimed.

## Lifecycle follow-up and remaining normal-speed gap

Decode rejection is caught for the current owner/generation. Reset immediately clears canvas, previous damage/phase labels and asset references; loading/error states disable pause, and failure exposes an explicit retry button preserving that reset's scene and autoplay choice. Superseded decode success or failure returns without changing the new scene/error. `tests/popo-timing/lifecycle.mjs` injects rejected/held native Image.decode promises in Chromium to test initial failure, replacement of painted flight, retry, stale failure after new success, stale success after new failure, and no unhandled rejection.

A size-only repaint preserves the last presentation alpha and the already drawn flight center. Only image/body size changes; no implicit alpha1 advancement. The actual RAF regression pauses during tick127, changes36→32→36→32, and asserts identical projectile canvas coordinates and core hash, then resumes. Display-only cached centers reset with owner and drop with terminal attacks.

The independently reported ~50px last jump is **not fixed** by these lifecycle changes and is distinct from honest150/250ms frame skipping. At126 attack10 is at3500,500. At127 it is at4000,650 but the consumer interpolates3500,500→4000,650 during that interval. At128 it impacts4500,870 and immediately loses its flight. Even alpha1 at127 draws roughly167.7,143.2 after hand offset, while contact is210,169.6 in canvas coordinates: about50px remains. The release interval also holds a zero-length previous/current segment. This is a one-tick visual lag, not a core damage-timing defect.

Proposed separate experiment (not implemented): for a currently pending flight, interpolate its **current** position toward the next deadline-homing display position computed from the latest observed living target and remaining ticks. The final segment approaches that observed target during the interval before arrival. First attach must start exactly at current position; projected imagery never authorizes damage/contact, and a terminal event/cancellation immediately wins. Hand offset decays over this forward visual segment. Core tick/arrival/damage/log/hash remain unchanged. This changes the presenter's interpolation contract and needs its own comparison/review, including cancellation by earlier attacks, target turns, first attach/reset, and maximum last-frame pixel gap at normal RAF. Low-frame skipped flights remain separately disclosed. No post-damage flight or delayed damage is proposed.
