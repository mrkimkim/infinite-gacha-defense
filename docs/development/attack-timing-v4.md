# Opt-in attack timing schema4, r1

Status: experimental implementation awaiting independent exact-SHA review. This document covers only the newly requested attack timing experiment. It does not publish unrelated design material, approve original-IP abilities, change production balance, replace the schema1/3 default, or authorize deployment.

Base: `8140bda52445c348d1c9dde6fc3265c0962af010`; Issue24 generation5, `MVP-AM-ATTACK-TIMING-01`, owner lead, branch `leader/timing-core-v4`.
Contract sources: [proposal](https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6099469454), [Momo review A–K](https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6099517610), [r1 decisions](https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6099537967), [Kiki consumer review](https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6099548911), [generation5 assignment](https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6099564808).

## Isolated entry point and exact exports

Import explicitly from `src/core-timing/index.ts`. No default route imports it. This module preserves the baseline economy, purchase planner, command validation, observations and replay format conventions by taking an isolated source snapshot of the schema3 module at the stated base, then changing schema/rules and combat timing here only. The duplicated internals are intentionally not a new shared dependency of the baseline. Later fixes must be reviewed for both modules separately.

All types in `src/core-timing/types.ts` are exported. Runtime exports:

```ts
SCHEMA_VERSION // literal 4
EXPERIMENT_RULES_ID // 'attack-timing-v4-r1-count40'
RULES_PROPOSALS; RULES_DIGESTS; CANONICAL_STATE_KEYS;
createMatch(seed: unknown, rulesId: unknown): CreateMatchResult;
previewRecruit(state: MatchState, offerSlot: unknown): RecruitPreview;
dispatch(state: MatchState, command: unknown): DispatchResult;
advance(state: MatchState, count: unknown): AdvanceResult;
observe(state: MatchState): Observation;
getRules(rulesId: unknown): PublicRules | null;
canonicalState(state: MatchState): string;
stateHash(state: MatchState): string;
replay(header: unknown, entries: unknown, expectedFinalHash?: unknown): ReplayResult;
boardPosition(col: unknown, row: unknown): Point | null;
pathPosition(totalDistance: unknown): Point | null;
```

Everything is synchronous and host-independent. Successful state/events are detached and deeply frozen. Failed dispatch/advance returns the identical input state; failed advance returns executedTicks0 and no events. The engine-owned diagnostic `MatchState` is not an external save/import format. Use replay for untrusted persisted input. Commands and replay trees require exact plain, data-only shapes and reject accessors/extra keys/unsupported commands. Replay input contains commands with committed command events and executed advance counts; combat events are regenerated, never accepted as a trusted log input.

Only these immutable profiles are accepted:

| rulesId | Full RuleData canonical UTF-8 SHA-256 |
|---|---|
| `attack-timing-v4-r1-count40` | `50b9506a8dda1d5710db1efb54c51d886a4dbcc95b5b97fa16e6f971cc8f7088` |
| `attack-timing-v4-r1-count80` | `de5b21fe483b59ac324c672577110f95c7e44bd30f5b1071e581331a233026cb` |

The digest includes all fixed baseline data plus the full r1 timing/ordering semantics. Constants are computed from frozen profiles and checked against pinned hashes in tests. No rule overrides, delayed slow/multi extensions, or schema1/3 auto-conversion. Cross-version schema/rules/digest combinations fail. Schema3's existing17 canonical keys, golden bytes, rules and APIs are untouched.

## Canonical state and pending contract

Exactly20 root keys, ordinal order:

```text
enemies flights gold nextAttackId nextEntityId offers outcome outcomeReason
phase rngState rulesDigest rulesId schemaVersion seed spawnCursor tick units wave waveTick windups
```

Offers sort by slot; units/enemies by ID; windups/flights by attackId. Nested objects use ordinal UTF-16 key order, arrays retain specified order, numbers are safe integers, negative zero encodes0. `acceptedLog` is excluded so batch granularity does not change hash. `nextAttackId` is included even when both pending arrays are empty. It is a separate allocator from entity IDs and is used for immediate attacks as well as delayed attacks within schema4.

`AttackSnapshot`: `damage`, `bossDamage`, `range`, `period`, `behavior: 'single'|'splash'`, `radius`, `effect: null`, `windupTicks`, `minFlightTicks`, `distancePerFlightTick`.

`AttackIdentity`: `attackId`, `unitId`, `targetId`, `startTick`, `releaseTick`, `sourcePosition`, `snapshot`.

`Windup`: identity plus `kind:'windup'`.

`Flight`: identity plus `kind:'flight'`, `arrivalTick`, `previousPosition`, `position`, `previousPositionTick`, `positionTick`.

All coordinates are core integer world coordinates. Renderer hand/shell anchors, owner tokens, first-shown tick, asset generation and event cursor are outside state/hash. Observation adds detached readonly `windups`/`flights` and exposes public timing rules; it omits seed, RNG, entity/attack allocators and acceptedLog. At release both position stamps equal releaseTick. A moved flight's positionTick equals the current simulation tick.

## Delayed roles and exact tick order

The two delayed behaviors are single letter and target-centered water splash. Neutral fixture01/07 share single,02/08 share splash. This is role coverage, not a final character-name mapping. Multi, slow, support and bossFirst retain explicitly immediate attacks and their existing effect semantics. A delayed snapshot with any other behavior or non-null effect is rejected.

Each tick: increment global/wave clocks → expire effects → spawn → existing flights move/impact by attackId → existing windups release/cancel by attackId → board units decrement cooldown and eligible start/immediate attack by unitId → move live enemies → accumulation loss → deadline loss → success/reward.

A start fixes target ID, source and the entire snapshot. Single windup W=3; splash W=4. Start at S schedules release S+W and sets cooldown to snapshotted period. At most one windup per unit; earlier flights may overlap newer starts. A resolving release/cancel blocks that unit's new start for this tick. Cancellation does not refund cooldown. No target leaves zero cooldown. Period below W waits for windup resolution; period below flight length allows overlap.

Windup target disappearance cancels `targetMissing`. At release, disappearance takes priority over inclusive Euclidean range failure (`outOfRange`). No retarget. Released attacks follow the same live target after it leaves caster range; they cancel on target disappearance.

At release:

```text
F = max(2, ceil(max(abs(target.x-source.x), abs(target.y-source.y)) / 600))
arrivalTick = releaseTick + F
```

First movement is release+1. Each step has `remainingTicks = arrivalTick-currentTick+1`; each coordinate adds `Math.trunc((liveTarget-currentPosition)/remainingTicks)`, including negative deltas. The final step reaches the target exactly. Arrival time never changes. This is fixed-deadline homing, not constant-speed physics. World target coordinates are sampled before that tick's enemy movement, including corners/path seam, not a path-index shortcut.

At arrival only, live primary position freezes center. Single hits that primary; splash freezes all living enemies within inclusive radius1100, including those outside caster range, sorted enemyId. Positions and clamped damages are captured once; own primary lethal does not cancel the remaining hits. Earlier attack removal affects later attack snapshots. Already-dead primary cancels the whole later flight. Current delayed roles have no slow; immediate slow remains the original behavior.

## Events, phase boundaries and numeric failure

All combat events include `{tick,wave,waveTick}`. Added variants:

- `attackStarted {attackId,unitId,targetId,windup}`: no actual hits or HP reduction.
- `attackReleased {attackId,unitId,targetId,flight}`: no actual hits or HP reduction.
- `attackCancelled {attackId,unitId,targetId,reason}`; reason is targetMissing/outOfRange/phaseTransition.
- `attackImpacted {attackId,unitId,targetId,sourcePosition,center,hits}`: actual `{enemyId,damage,position}` hits; defeat events follow in hit order.

Immediate `attack` retains its existing source/center/hits shape with an added schema4 attackId. A delayed attack has exactly one terminal impacted/cancelled event. Phase cleanup sorts only remaining pending by attackId and cancels them before waveCompleted/shopRefreshed/matchEnded; already-terminal attacks are absent. Accumulation retains priority. Wave5/20 deadline600 uses waveTick, so a due impact at T+600 runs before the deadline check; T+601 gains no grace. General400/early success also clears pending, which never delays a valid clear or crosses preparation. Composition remains preparation-only; no allied death or combat move/sell is introduced.

Seeds are integers1..4294967295. Counts and allocators are positive safe integers; clocks, HP, distances, cooldowns and radius are nonnegative safe integers. Signed world coordinates are safe integers. Board col/row0..3, bench0..7. All arithmetic that could exceed safe integer (additions, target deltas, squared distances/range, damage arithmetic and allocators) is checked. Invalid command/count/tree rejects with the existing typed error; schema/digest crossing has explicit errors. IntegerOverflow anywhere, including after earlier ticks damaged HP/spawned/consumed IDs, discards the whole working copy: identical input state/reference/log/RNG/HP/pending, executedTicks0, no leaked events.

## Consumer boundary (not production rendering)

Use match-owner+attackId identity; individual hits also use enemyId. Same unit/tick can have multiple different attacks impacting the same enemy. De-duplicate repeated delivery by identity, not tick. A current observation is authoritative: interpolate only still-pending flights; any completed impact outranks previous/current position interpolation. An impact-containing batch displays its actual current HP and impact/terminal state together, never replays past flight on top of reduced HP. A late attachment restores only current pending and current positions; absent pending is not a fabricated historical impact.

The generation5 choice is bounded frozen final impact aftermath until explicit restart/scene change, even when the same advance enters preparation/result. This does not add simulation ticks or postpone HP. A fresh attachment cannot reconstruct past aftermath without receiving committed events. Pause/hidden means no advance call, not cancellation. Reset invalidates old owner/RAF/image/event callbacks even if numeric IDs repeat. These are consumer requirements; no production UI adapter is added in this core-only PR.

`tests/core-timing/consumer.ts` is a test-only projection illustrating pending-only interpolation, identity de-duplication and at-most32 frozen aftermath attacks. `browser-harness.html` renders diagnostic shapes at32/36px and checks50/150/250ms update intervals; it is not finished attack art or an actual game UI integration. Actual RAF/hidden/image integration of the future game adapter remains its own acceptance gate.

## Verification map

| Cases | Evidence |
|---|---|
| A | exact S/S+W/S+W+F HP and replay; 3/4tick snapshots |
| B | release boundary, no retarget, missing target/reacquire, earlier impact cancellation |
| C | signed homing, four directions/diagonal/zero, fixed arrival, corners/seam |
| D | period<W diagnostic pending, no duplicate windup, release blocking, flight overlap |
| E |1100/1101, outside-range splash, own lethal primary, earlier lethal cancellation, clamp |
| F/G | wave5/20 global vs waveTick600/601, accumulation priority,400 carry, future spawn, phase cleanup, BAD_PHASE |
| H | canonical/hash/concatenated events for1 vs3/4/5/17tick, legal replay at pending boundaries |
| I | late batch allocator/movement overflow and clock/arrival/coordinate/distance rollback |
| J | pinned new digests, unchanged schema3 digests/17keys, cross-version/malformed rejection, pending/allocator hashing |
| K | core observation/consumer boundary tests and Node/Chromium parity with diagnostic32/36px render; production art/UI gate remains open |

Boundary tests explicitly use synthetic engine-owned diagnostic states; they are not legal-match replay evidence. Replay/batching tests separately use accepted commands. No final character power, balance, animation quality, merge or deployment approval follows from these tests.

Run `npm run typecheck:core-timing`, `npm run test:core-timing`, then the existing full checks. Browser harness is available only by explicitly opening `/tests/core-timing/browser-harness.html` on the development server.
