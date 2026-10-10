# Nuri timing adapter — independent draft

Base: PR48 `493590fba179c2c100f628fb9aeb3d5e0de37c0b`. PR49 and its separate surface-contact experiment are unchanged. Only this page, isolated modules, copied assets, and tests are added. Candidate PR43 HTML is neither executed nor hosted.

Run `npx vite --host 127.0.0.1 --port 4200 --strictPort --config src/web/nuri-timing/vite.config.ts`, then open `/nuri-timing.html`. Build with `npx vite build --config src/web/nuri-timing/vite.config.ts`. Browser tests use `REVIEW_URL`, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `EVIDENCE_DIR` environment variables. Run `node tests/nuri-timing/browser.mjs` and `node tests/nuri-timing/lifecycle.mjs` after starting the server. `npm test` discovers the 13 adapter tests (441 total at this base).

## Legal scenes

All are schema4 `attack-timing-v4-r2-count40` accepted recruit/move/startWave/advance logs; no browser state importer or HP injection. Replay JSON contains all commands from the seed and is verified by Node `core.replay` against the final hash.

| Scene | Seed | Attack | Start/release/terminal | Result |
|---|---:|---:|---|---|
| single |24|4|90 /94 /96|#2 HP6→1|
| lethal |24|26|652 /656 /658|#7 HP5→0; #10 HP4→0|
| multi |24|43|1060 /1064 /1066|#9 HP1→0; #14 HP18→13; #25 HP36→31|
| cancel |10|72|616 /620 /622 cancel|helper fixture07 attack73 kills #21 at621; no Nuri AoE|

Seed24 recruits offer0 and moves unit1 to board3,0. Seed10 recruits offer2→3,0 and offer0→3,1. All later wave starts are explicit legal commands. Timing is unchanged: windup4, existing flight arrival/homing, radius1100, target lock, ID order, cancellation, deadlines and hashes. Node-only diagnostic tests exercise same-tick ordering and are explicitly separate from legal browser evidence.

## Display contract

The independent consumer follows PR49's corrected bounded one-tick-forward display and owner/stamp lifecycle. Initial/late attachment and first high-alpha release stay at the current observation. Impact/cancel removes the flight immediately; stale RAF/reset callbacks cannot revive it. Catch-up batches retain every hit's event snapshot and ordered HP transition, including secondary hits after primary death. HP is tracked through ordered events, never reconstructed by adding one attack's damage to final HP. Labels follow actual displayed live enemies after the initial snapshot; corpses use immutable hit positions. Outside-range HP chips show unaffected enemies.

PR43 `3c3ec3d…` v05 originals are byte-identical; see `public/assets/nuri-timing/provenance.json`. Common body height480 and per-frame foot pivots preserve 32/36px scaling. Fixed release rim offset(292,-170) decays over flight; recoil never replaces the origin. Bubble is a separate original PNG, nominal8/9px visible width. Supported down-right cone only; no whole-character flip. Metadata's proposed holds are not runtime timing.

Rotation-invariant clearance uses the full alpha>0 bubble bounds and reserves36px size plus filter/stroke margins. Actual normal captures stop about24.45 canvas pixels from the target center before the real center-impact event. **This is the existing center-contact convention, not the separate Popo surface-contact experiment.** The residual gap remains visible; this adapter does not approve it. AoE ring is an exact transformed1100 radius, behind enemies. Reference ripple/impact textures have low opacity and transparent centers; each hit has its own HP/flash/death feedback.

## Evidence and limits

48 browser combinations:390×844 and1165×747, body32/36, normal RAF/150/250ms, four scenes. Captures are actual CDP frames with original timestamps and a normal-speed player, not reconstructed images. Every run includes its legal replay, audit, screenshot, hash and clearance assertions. Lifecycle captures cover decode rejection/retry, old success/failure races, late windup/flight/post-impact attachment, delayed real RAF, reset and paused resize with stable position/hash. No frame-loss promise: low FPS may skip short windup/release visuals; event effects appear once at the accepted observation without stretching combat time.

Art remains provisional: head/face, foot/pivot and recovery continuity, tiny bubble silhouette and residual center gap need independent review. The canvas intentionally zooms one battle segment, not the full4×4 game board. Closely spaced enemies can overlap; separate HP rows disambiguate committed hits. A pending flight whose target has disappeared can show the generic unsupported-pose suffix until next-tick cancellation. No new art generation, production gameplay UI, merge or deployment.
