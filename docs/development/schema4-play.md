# Opt-in schema4 playable graphics integration (draft)

This is one game session and scheduler with a common4×4 arena, not juxtaposed scene apps. It is an unapproved fixture experiment, not final IP/art/balance adoption or a deployment. The default index/site, core-v1/core-v2, CLI and build entry are untouched. Source/base references and byte-identical imports are in schema4-play-provenance.json.

## Run and build

- `npx vite --host 127.0.0.1 --port 4201 --strictPort --config src/web/schema4-play/vite.config.ts`
- Open `/schema4-play.html`. It starts seed5 in preparation with an empty army and real shop; recruit and choose a board/bench cell, swap occupied cells, sell or reroll using core commands. Start each wave explicitly. Pause/resume and new-game reset remain available. New-game seed1 offers a short real automatic-upgrade example: recruit0, recruit1, reroll, recruit2.
- `npx vite build --config src/web/schema4-play/vite.config.ts` must output `dist-schema4-play/schema4-play.html`, hashed JS/CSS and imported assets. Default `npm run build` only builds index.html; its success does not validate this route.
- `npx vite preview --host 127.0.0.1 --port 4202 --strictPort --config src/web/schema4-play/vite.config.ts` serves that dedicated built output.

## Runtime contract

The timing core and its63 tests are byte-identical to PR48 at493590f. `attack-timing-v4-r2-count40` and its digest are preserved. Only fixture01/02 have delayed attacks;03–08 retain their immediate meanings, including multi/slow/support/boss-first. Candidate mapping is fixture01→Popo and02→Nuri;03–08 use labeled generic bodies. This makes no expanded roster/IP claim.

Main's existing input-session contract is connected to schema4. Purchases use real previews and committed automatic-upgrade survivor IDs. Combat editing is rejected by core. Existing scheduler.ts supplies the single50ms timeline: pause/hidden discard elapsed time, old epoch/owner callbacks remain inert, and boundary time does not leak into the next wave. Display callbacks use the same scheduler RAF. Core observations/events are never mutated for graphics.

All board cells, enemy path, attack sources, flight samples and immutable hit positions share `x=60+.06*worldX,y=90+.06*worldY`. Each tile is60×60px. Previous scene-specific projections are absent. PR46 board art was deliberately not imported, to avoid adding projection/interaction risk.

PR49/51 Popo body/letter/forward-flight concepts and source-facing surface contact, and PR50 Nuri atlas/rim/bubble/AoE ledger are adapted into one multi-unit display. Geometry helpers keep enemy protections; Popo contact is suppressed if it intersects protected enemies. Effects are keyed by owner + attack ID and per-hit target ID; binding a new owner clears all display histories. Actual committed HP/order/positions, primary-lethal splash continuation and earlier-kill cancellation are preserved. A supported flight uses its hand/rim offset decaying into the shared arena; bodies are never flipped. Unsupported directions retain the true core trajectory using a distinct generic purple projectile and `기본 방향` label. Generic fallback is explicit, not fabricated directional art.

Last impacts/HP/corpses remain in the first preparation/result frame without replaying flight or advancing extra ticks. They stay in that frozen aftermath until gameplay advances or the user explicitly starts the next wave/new game. Late attachment restores current pending only. Source assets decode before gameplay can start; failure holds progression and offers retry, and owner/generation rejects stale completions. No candidate HTML is run or hosted.

## Verification boundaries

`npm run typecheck` and `npm test` cover440 TypeScript tests at this base (365 baseline +63 imported core timing +12 new integration tests). The integration suite includes real seed/command/replay purchase, upgrade, placement/swap/sale, multi-unit events and low-frame batches, legal progression to result and scheduler pause/owner guards. Final-result impact and same-tick lethal splash/cancel tests use explicitly marked diagnostic core states; they are not claimed as normal play.

Capture tests are `.test.mjs` and **are not included by npm test**. Explicit command: `node --test tests/schema4-play/capture/*.test.mjs` (25 tests). The normal-play script is `node tests/schema4-play/browser.mjs`; lifecycle/built-entry/accelerated-result checks are `node tests/schema4-play/lifecycle.mjs`. Set `PLAYWRIGHT_MODULE` to the installed Playwright module path when it is outside node resolution. Scripts use the execution environment's external Playwright/Chromium, Python Pillow, Tesseract and ffmpeg; these are not added runtime dependencies. The existing CLI routes only schemas1/3 and rejects4. Exported schema4 replays are verified directly with `src/core-timing/index.ts` `replay(header,entries,finalHash)`, never claimed to work in the default CLI.

Normal captures use real RAF and actual UI commands at390×844/1165×747: recruit/board placement, pause/resume with stable hash/flight, wave boundary last impact, next wave and reset, plus real seed1 automatic upgrade. Fixture03 immediate hits and01/02 supported and fallback pending are checked in the render audit. Original timestamp CDP frames, native360×390 arena VFR videos, legal replay and endpoint proof are retained separately from PR50/51 evidence. Pixel inspection is an implementer check; audit predicates are render-audit coverage, not proof every intermediate pose was captured. Endpoint comparison proves only endpoint similarity. Accelerated browser-clock progression to result is separately labeled and is not normal-speed footage.

Remaining art limits: tiny effects and residual pre-contact gap, held-pose recovery transitions, unsupported-direction fallback, overlapping enemy/corpse silhouettes and provisional12px letter/32px body. No enemy/hit positions are relocated to improve readability. Last-aftereffect freeze is a UI choice, not delayed damage. No merge, deployment, Library retry or final quality approval. Original failed capture attempts are preserved outside this branch's accepted evidence bundle.

### Preparation snapshot correction

The original 82be2fe consumer froze preparation units at the first accepted clock stamp. A successful command now submits the authoritative preparation snapshot with acceptedLog.length as its monotonic command revision. Equal-stamp rendering still uses the accepted snapshot; old revisions, owners, clock stamps and combat command updates are rejected. Selection-only and rejected inputs do not submit snapshots. This path does not bind/reset the consumer or ledger, so wave-ending impacts remain.

`node tests/schema4-play/preparation-browser.mjs` starts with an empty bound canvas and checks 12 stages at each of 390/1165px widths. Actual RGBA cell crops verify visible bodies, vacant cells, movement and swapped artwork before any wave begins; committed IDs/stars and screenshots verify the upgrade. The previous 82be2fe recordings remain historical and did not prove preparation canvas correctness. New local evidence: schema4-preparation-fix-evidence (24 canvas PNGs and results.json). No artifact transfer was attempted.

### Input node identity correction

At 78b34ac, real Chromium input reproduced lost focus after preparation selection and lost board/bench clicks when three actual paints occurred between mouse down/up in combat (also after pause/resume). Both 390px and 1165px runs failed these checks; rapid three-purchase/placement input and stale-owner rejection passed. This confirms a browser input defect beyond the earlier source concern.

Interactive offer/bench/board buttons now persist for one match. Their text, disabled state and accessibility attributes update in place. New matches replace controls and keep the existing owner guard on retired nodes. No core, scheduler, presentation, asset or gameplay changes are involved.

Run `node tests/schema4-play/input-browser.mjs` with external `PLAYWRIGHT_MODULE` and optional `PLAY_URL`/`EVIDENCE_DIR`. This explicit browser suite is not included in `npm test`. It exercises Tab/Enter, focus across RAF, pointer down/up across three real paints, Space down/up across RAF, rapid purchase/placement, paused/resumed inputs and retired controls. Original 78b34ac evidence (22 checks, 18 failures) is separate from the expanded fixed run (26 checks); screenshots, source bytes/hash and JSON remain local. These are automated Chromium input checks, not human play or final art approval.
