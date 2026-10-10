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

## Continuous-cycle evidence follow-up

The original end ticks104/666/1074 deliberately freeze at impact+8, while the pose is still recovery. Those captures are terminal-aftereffects evidence only, **not evidence of a completed recovery or repeated animation**.

Use the new `연속6초` checkbox then `장면 재생` to advance120 real50ms ticks from the scene start, without reset or pause at impact. The old default terminal freeze and lifecycle probe remain. `진단 숨기기` hides all review UI, entity-ID/death text and the radius outline; it preserves original actor/hit positions, HP bars, hit flash, corpse fade, ripple and contact effect. Reload to leave this capture-only clean view. This is the same provisional battle-segment canvas, not a production game UI or complete4×4 screen.

`tests/nuri-timing/continuous.mjs` captures three scenes × two viewports × two body sizes as clean views plus mobile32 diagnostic companions (15 runs). Each six-second trace contains five natural attack starts. Lethal and multi each show at least two full supported-direction cycles: preparation, release, visible flight, impact/recovery, idle after recovery and another natural attack start. Single has only one fully supported cycle: attack6 exits the supported cone at tick144, so its partial second visual cycle is not counted as complete. Other intervening attacks use unsupported directions; their missing poses/projectiles remain explicit limits rather than fabricated art. The core still commits their correct impacts. No new direction, timer adjustment, actor relocation, synthetic state or post-impact pause is used.

Every run stores full original CDP timestamp frames, full legal replay/hash, render audit, cycle tick table, and a VFR MP4 cropped only to the actual360×340 canvas at1:1 pixels. `normal-speed-player.html` replays original frames and offers the native-size video. The fixed six-second stop is after observed stable idle; it is not counted as an extra completed cycle. The MP4 is an encoded derivative, while original JPEGs/timestamps remain authoritative. Diagnostic companions contain labels/ledger; clean captures cannot establish individual enemy identity from text.

Observed unresolved display/art issues: lethal #7 at(4500,1365) and #10 at(4500,1450) have only5.95 canvas pixels between centers, so two22px enemy bodies/corpses and their HP bars overlap heavily. Clean frames confirm that removing diagnostic labels does not solve distinguishability. No enemy/hit position has been moved. Recovery is one held source pose through impact+8, followed by a discrete idle frame at+9; it is not a multi-frame settling motion. Small face/hand silhouette changes and tiny bubble readability still need art review at32/36px. The existing24.45px pre-contact center gap is unchanged.

## Capture completion barrier correction

Earlier `browser.mjs` stopped CDP when the simulation reached terminal+2, before waiting for frame delivery/ACK. In34a4a59 all32 low-FPS videos ended137.66–256.64ms before the first terminal render; final.png and audit proved state, not recorded impact pixels. The16 normal-RAF videos did include post-terminal frames. The earlier continuous recorder also lacked a final-frame delivery barrier. Preserve those archives as historical evidence with these limits.

The corrected harness awaits the actual first terminal render, receives and writes a CDP JPEG, reads its rendered `32px/36px · tick N` status using Tesseract (not the timeline's earlier tick text), and waits for that same frame's ACK before allowing stop. `terminal-frame.json` records the original filename/timestamp, first-render time, receive/ACK times and OCR text. It fails if the first displayed terminal tick is not found. `DELAYS=150,250` selects the32 missing cases without changing runtime cadence.

The continuous harness similarly keeps CDP active after its stopTick until a received/ACKed frame has a timestamp at/after the final render and its actual canvas pixels match an independent final browser screenshot within documented JPEG tolerances. `final-frame.json` separates the pixel comparison from the audit's final idle/tick. Original frames and timestamps remain unmodified; the video is generated only after this barrier. Capturing a later final.png alone does not satisfy either recorder.

These tests require Tesseract English and Python Pillow in addition to Chromium/Playwright/ffmpeg. No dependency or core/runtime files were changed for this capture repair. Original2b3a5d4 cycle evidence is retained separately; current captures identify their own source SHA and proof files.

### Clock validation and proof limits

Both capture barriers now reject missing, nonnumeric or nonfinite CDP timestamps and render times before comparing clocks. Receipt/ACK clocks must also be finite, with ACK no earlier than receipt. A bad clock fails the capture instead of producing a coverage-success record. Run the targeted harness regression with `node --test tests/nuri-timing/capture-clock.test.mjs` (12 tests; `.mjs` capture tests are separate from the application's `.test.ts` runner). Existing valid original timestamp evidence is preserved.

The final-canvas tolerance of36 strongly different pixels is an **endpoint similarity check** against the final screenshot. Together with the finite timestamp and ACK it confirms receipt of that endpoint frame; it does **not** prove that every intermediate pose, transition or simulation tick was recorded. The per-tick audit describes renderer state, not guaranteed CDP coverage. Continuous frame sequences must be inspected independently for intermediate visual coverage; no missing-frame reconstruction or stronger coverage claim is implied.

### Deadline regression correction

The1f0f4bd helpers still awaited frame write/ACK completion outside their deadline. Both now use one monotonic deadline for completion waits, polling and each subprocess; the subprocess receives only the remaining time and is killed on timeout. Deadline checks after completion/subprocess work and immediately before acceptance prevent a late result from succeeding. Race timers are cleared on every exit. Recorder failure closes its browser in `finally`; pending completion rejections are observed without converting them into success.

Run `node --test tests/nuri-timing/capture-clock.test.mjs tests/nuri-timing/capture-deadline.test.mjs`. The10ms regression supplies an unfinished first frame and an already-completed second frame; the request must reject before the first is released and remain rejected after late release. Additional cases cover subprocess termination and late otherwise-valid results.

Continuous cycle counts from `cycleEvidence` remain **render-audit coverage** pending independent inspection of the original intermediate pixels. One stored final idle frame, even with a valid timestamp/ACK and endpoint pixel match, cannot prove that preparation/release/flight/impact/recovery frames were recorded. This deadline correction adds no new recording coverage claim.

### Recorder stop/drain completion

The ababc3f proof helpers were bounded, but the recorders still drained all `frame.completed` promises without a deadline after a successful proof. A later unfinished frame could prevent the outer `finally` from running. Both recorders now use a separate10-second post-proof budget for proof-file output, waiting for the terminal end, CDP stop, frame drain, subsequent browser reads/screenshots, artifact writes, encoding and page close. Stop completion defines the intake cutoff: the listener is removed before the stable drain snapshot, and also on stop failure. Final manifest/player writes have their own10-second budget; browser close in the outer `finally` has a separate5-second budget. A stalled close is reported as failure, not as confirmed browser shutdown. Timeouts do not convert pending operations into success; late rejections remain observed. Filesystem operations already issued may still settle, so partial output from a failed run is not accepted evidence.

`node --test tests/nuri-timing/capture-clock.test.mjs tests/nuri-timing/capture-deadline.test.mjs tests/nuri-timing/recorder-end.test.mjs` checks25 cases. Stop/drain regressions include a valid proof followed by a new unfinished frame, a stalled/rejected stop, rejected drain, late stop completion, a post-drain output stall and stalled browser close. These are synthetic termination tests, not new recordings. Original evidence remains unchanged; continuous counts remain render-audit coverage and endpoint similarity does not prove intermediate pose capture.
