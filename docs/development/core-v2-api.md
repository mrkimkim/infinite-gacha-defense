# playable-v2 first API / data checkpoint

Issue [#23](https://github.com/mrkimkim/infinite-gacha-defense/issues/23), owner 모모,
assignment_generation 1; base `a9273ea3597fbfb9730ca3bd653fdf5241b27f28`.
Contract reviewed as input: PR #22 head `a174fa7b3caa624b2b5a23d6f47fbd0a1067e283`.

**Review proposal, not an engine implementation or a playable release.**
The sole TypeScript type source is `src/core-v2/types.ts`. `CoreApi` declares the
exact planned synchronous function signatures. `src/core-v2/index.ts` currently
exports types and proposal constants only. There is deliberately no runtime
`createMatch`, `dispatch`, `advance`, `observe`, `getRules`, `replay`, coordinate
helper, or hashing function. Adapters may review/import types; they cannot run a
v2 game yet. No throwing stub is presented as a working implementation.

Both independent DOTs must review the exact checkpoint SHA before implementation.
This document closes API ambiguities as proposals; it does not turn unreviewed
spawn/balance hypotheses into final design. Existing `src/core` API, schema1,
canonical17 keys, fixtures, bytes, hashes and replay interpretation are untouched.
All new core source passes an ES2022-only, `types: []` portability compilation.

## 1. Entry point, data identities, and ownership

Use `src/core-v2/index.ts`, never substitute it for the v1 entry point. Engine
creation requires an explicit rules ID. `EXPERIMENT_RULES_ID` is the A/count40
functional-wiring experiment, not a production default. Profiles cannot accept
arbitrary overrides or caller-supplied data/digests. `RULES_PROPOSALS` and
`RULES_DIGESTS` are deeply frozen data, not a registry mutation API.

| Fixed proposal ID | SHA-256 rules digest |
|---|---|
| playable-v2-proposal1-economyA-count40 | 6ce864fd07b9b3892e3c2026dd8cdb6cb67cfbb49cb45518ee6aaeb9293fe4c9 |
| playable-v2-proposal1-economyA-count80 | db62325b9c2d19ea1c7a92fa90ba59c00d77b41bb168ed888696d215e54dacaa |
| playable-v2-proposal1-economyB-count40 | 694afd3527e21b283994b4659b9de2f997edaef7d1e59ded840d552cc5973a4e |
| playable-v2-proposal1-economyB-count80 | 0513956e1bd5bf2ae48b082d7ff640a821c037bcf644d0b7fd88debe2ff5c557 |

Each digest hashes UTF-8 canonical JSON of the **entire corresponding RuleData**,
including rulesId, all 20 expanded waves, PRNG, semantic revision and proposal
status; the digest itself is not in its preimage. Every object key is sorted by
ordinal UTF-16 code unit (all schema keys are ASCII); arrays retain their defined
order. No whitespace, safe integer decimal numbers, negative zero encoded as 0.
Strings use JSON escaping. Output is 64 lowercase hexadecimal characters.
Changing any gameplay data/semantics requires a new rules ID, semantic revision,
digest and review. Hashed status stays `review-proposal` even after approval; approval is external review metadata, never an in-place status mutation. Never rewrite the meaning of an ID used by a saved replay.

Engine-owned state is readonly and cannot be constructed/mutated by adapters.
`dispatch` and `advance` take only a valid state produced by this v2 engine;
untrusted saved state is not an import format. Use replay for untrusted input.
State exposed for diagnostics must never become policy input. `observe` and
`getRules` return detached deeply readonly snapshots with no aliased state arrays.

All IDs are positive safe integers. Units, enemies and books share one monotonic
`nextEntityId`, initially 1. IDs never recycle. Creating a match starts in
preparation/wave1, tick0, waveTick0, spawnCursor0, empty units/books/enemies and
participants, gold12, outcome/reason null. Exactly one free full shop draw occurs.
Recruit creates a 1-star, XP0, cooldown0 unit. Merge allocates one new unit ID,
removes all three inputs, sums their XP, increments star and takes the maximum
input cooldown. Books are allocated only when recovered XP > 0.

## 2. Strict input and error precedence

No coercion, defaults inside commands, ignored keys, partial successes or hidden
properties. All external structures must be acyclic JSON-data trees: plain
objects (Object.prototype or null prototype), exact enumerable own string keys,
data properties only; dense normal arrays with exact length/index keys. Reject
symbols, accessors without invoking them, sparse arrays, extra array properties,
non-plain prototypes, undefined, functions, bigint, NaN/infinity and unsafe
numbers. Hostile proxy/trap failures are caught as BAD_FORMAT; executing arbitrary
proxy behavior is outside the JSON-input contract. Canonical generation only
accepts valid engine state.

Command shape keys are exactly those in the discriminated union. `ids` has length
3. ID fields must be positive safe integers; slots/coordinates safe integers
(negative or out-of-range values reach the semantic slot/location checks).
Unknown string command type returns UNSUPPORTED_COMMAND once the data-tree check
passes, before checking variant-specific keys. Missing/non-string type is
BAD_FORMAT. `-0` is accepted as coordinate/slot0, never as a positive ID.

For `createMatch`, order is: non-string rulesId → BAD_FORMAT; unregistered string
→ UNKNOWN_RULES; seed not a safe integer in [1,4294967295] → BAD_SEED. No state is
returned on failure. `getRules` returns null for all unrecognized/non-string IDs.
Coordinate helpers return null for invalid integers/out-of-domain inputs, and do
not throw. `pathPosition` accepts every nonnegative safe totalDistance and applies
modulo; `boardPosition` requires col,row in 0..3.

For `dispatch`, run data-tree/type/shape validation first, then require
preparation (BAD_PHASE), then the command-specific list below **left to right**.
If several failures coexist, only the first error is returned.

| Command | Semantic error priority after shape and phase |
|---|---|
| recruit | offerSlot 0..2 (BAD_SLOT); benchSlot 0..7 (BAD_LOCATION); OFFER_EMPTY; LOCATION_OCCUPIED; CAPACITY_REACHED; INSUFFICIENT_GOLD; INTEGER_OVERFLOW |
| reroll | INSUFFICIENT_GOLD; INTEGER_OVERFLOW |
| move | UNIT_NOT_FOUND; destination bounds (BAD_LOCATION); SAME_LOCATION; LOCATION_OCCUPIED; destination capacity (CAPACITY_REACHED); INTEGER_OVERFLOW |
| swap | DUPLICATE_ID for aId=bId; UNIT_NOT_FOUND checking aId then bId; SAME_LOCATION; INTEGER_OVERFLOW |
| merge | DUPLICATE_ID; KEEP_ID_NOT_INCLUDED; UNIT_NOT_FOUND in input tuple order; MERGE_MISMATCH for character/star mismatch; MAX_STAR; INTEGER_OVERFLOW |
| sell | UNIT_NOT_FOUND; INTEGER_OVERFLOW |
| useBook | BOOK_NOT_FOUND; UNIT_NOT_FOUND; INTEGER_OVERFLOW |
| startWave | NO_BOARD_UNITS; INTEGER_OVERFLOW |

Location kind must be board or bench with its exact variant keys, otherwise
BAD_FORMAT. Capacity counts units, never star/level. Board/bench exchanges keep
both counts unchanged. Move to an occupied slot never implicitly swaps.
Recruits require the specified empty bench slot even if a merge would be possible.
Same-state guard checks such as capacity are defensive for engine invariants.

Every mutation is staged and checked before publication. All integer products,
sums, clock/distance/ID increments, XP and coins must stay safe integers. Unsafe
computed intermediates return INTEGER_OVERFLOW even if later division could
reduce them. Command rejection returns the **identical input state reference**, no
events/log append, no ID/gold/book/RNG consumption. No sequence number is spent.

`advance` validates count first: only safe integers >=1; otherwise BAD_COUNT,
including zero, fractions, strings and omitted count. Then BAD_PHASE outside
combat. A valid count has no artificial batch maximum; execution stops at the
first transition to preparation/result, returning executedTicks <= count. Tick
work is staged for the entire call: overflow at any later tick rolls back the
whole call, returns the original state and executedTicks0 without events/logs.
No advance in preparation or result, no implicit next-wave start, no partial
progress on error. Wall time, pause/restart, rendering and animations are absent
from this API; restart creates a separate match.

## 3. Observation meaning

`Observation` contains the current units (location distinguishes board/bench),
three stable shop slots including null purchased slots, all books, all living
remaining enemies/effects (also during preparation/result), gold, clocks and
outcome. IDs describe current public entities, never future IDs. It excludes
seed, rngState, nextEntityId, acceptedLog and future random offers. `PublicRules`
excludes PRNG internals; fixed wave schedules are deliberately public information
for both policies. No hidden schedule advantage for either policy.

Unit fields are core-derived: cumulative xp, level1..10, nextXpThreshold and xpToNext (both null at
level10), levelCapped, normal damage, bossDamage, effective range, nextAttackCooldown
(the period that would be set after the next attack), supportActive, plannedXp,
sellGold and recoverableXp. No cumulative XP is discarded at the level cap.
Bench damage/range are intrinsic star/level values without board-only synergy or
aura. Board units use current active tag synergy and orthogonal support; bench
plannedXp is always0. Merge reports its new full Unit; the subsequent observation
provides its new derived level.

Synergies list focus then cooperation, with distinctCharacters in the profile's
character order. Tier is 0/2/3; percent is 0/5/10. Only distinct board characters
with that tag contribute, and only board units of that tag receive its effect.
Focus boosts damage; cooperation boosts range. Aura excludes self and bench,
uses four orthogonal cells, and does not stack across multiple Momo units.
Each ObservedUnit exposes sorted supportSourceIds; supportActive is whether that
list is nonempty. Each Synergy exposes sorted affectedUnitIds (empty at tier0).
mergeGroups includes every character/star1-or2 group with at least3 units across
board and bench, sorted by profile character order then star, with unitIds
ascending. Any3 distinct listed IDs may be merged, with any one as keepId.
Groups remain informational during combat; all preparation commands stay locked.
The UI never reconstructs adjacency, tag eligibility or merge eligibility.

In preparation, plannedXp uses the current board IDs; in combat, the frozen
waveParticipants; in result it is0. Integer budget divides equally, leftovers to
ascending unit IDs. A defensive empty participant list discards the budget.
remainingCount includes bosses; warning is count >= warningCount, even in result.

State wave is the upcoming wave in preparation and the active/last wave in
combat/result. On success to preparation it increases by1; waveTick, spawnCursor
and waveParticipants retain the completed wave's values until startWave resets
waveTick/cursor to0 and captures the new participants. No preparation tick occurs.
Observation segmentRemainingTicks is the upcoming full duration in preparation,
max(0,duration-waveTick) in combat, and0 in result. bossDeadlineWaveTick is600 for
an upcoming/active boss wave, otherwise null (always null in result).
bossRemainingTicks is600 in preparation before a boss wave, remaining time in
combat while its scheduled/alive boss has not been defeated, and null otherwise.
nextWave is the upcoming wave in preparation, the wave after the active one in
combat, and null in result or after wave20. canStartWave is preparation plus at
least one board unit. UI does not duplicate formulas or grant itself transitions.

## 4. Exact combat and integer geometry proposal

Each processed tick increments both clocks first. First ever processing is tick1;
first processing of every wave is waveTick1. Effects expire by global tick;
spawns/durations/boss deadlines use waveTick. Processing order is expire → spawn
→ cooldown/attacks with immediate deaths → movement → count loss → deadline loss
→ success/rewards. Unit order is ascending unit ID. Every existing cooldown is
first reduced by1, floored at0. No target means it remains0. An attack resets it
to the currently applicable period once; no second decrement/attack that tick.
Period12 at tick1 therefore attacks next at tick13. Preparation never modifies
cooldown, enemy position, effects or clocks. Moving/swapping/books do not reset it.

Proposed geometry: tile1000, board centers (500+1000col,500+1000row), clockwise
square path (-500,-500)→(4500,-500)→(4500,4500)→(-500,4500)→start, length20000.
All spawns start at totalDistance0. Integer movement increases unbounded safe
cumulative distance; visible position uses modulo20000. Corners belong to the
outgoing segment; totalDistance20000 maps exactly to the starting point.
This explicitly proposes geometry matching v1; no v1 rule is imported implicitly.

All squared-distance comparisons are inclusive (distanceSquared <= radius²),
using visible positions, with checked integer intermediates. General target order
is totalDistance descending then enemy ID ascending. Tori partitions in-range
bosses ahead of other enemies, retaining that order within each group. For Ruru,
take the first up to2 **distinct** in-range enemies. For Nuri, select its primary
in-range target, freeze that visible center, then include every living enemy in
radius1100 of that center, even outside Nuri's own range. Splash hits are sorted
by the same general target priority. Attack sourcePosition (board center), center (primary target position), and each
hit.position (that enemy’s visible position) freeze immediately
before that unit attacks; the primary dying never changes center or hit order.
The next unit sees immediate removals and cannot target a dead enemy.

Damage uses one floor after the entire rational product:
base × starPercent × (100+8×(level−1)) × (100+focusPercent) × bossPercent / 100⁴,
minimum1. Non-boss targets use bossPercent100; only Tori has bossPercent200.
Check intermediate integer products. Hit damage is min(calculated, remainingHP).
Range is floor(baseRange×(100+cooperationPercent)/100); neither star nor level
changes range, slow or aura strength. Supported next period is
max(1,floor(basePeriod×90/100)); existing cooldown is never rescaled.

Dodo applies slow only to surviving hit targets. Slow expires at attack global
tick+40; refresh uses max(old,new expireAt), never adds strength. Both normal and
boss speed become floor(baseSpeed×70/100). Applied at tickT, it affects movement
at T..T+39 and expires before attacks/movement at T+40. A killed enemy has no
remaining slow to emit/apply. Effects persist frozen across preparation.

Count >= limit after movement loses immediately, before other outcomes. At
waveTick600 a still-living scheduled boss loses with bossTimeout; on wave20,
if the boss is dead but any ordinary enemy remains, finalTimeout. BossTimeout
wins that tie. The tick600 attack/death processing can avoid either timeout.
Future spawns must all be exhausted before early success. Otherwise ordinary
waves succeed at400 with remaining ordinary enemies carried; boss waves5/10/15
succeed at600 only if their boss is dead, carrying ordinary enemies. Wave20
requires all scheduled spawns exhausted and all enemies dead; no boss is carried.

## 5. Events and replay ordering

All event stamps are global tick, wave and waveTick. Command stamps use the
current clock; waveStarted uses the newly reset waveTick0. Events from an entire
success transition use the **completed wave's stamp**, including shopRefreshed;
the returned preparation state already identifies the next wave. No event clock
is renderer-local. Each event is a detached readonly object.

Dispatch emits exactly one primary event (recruited/rerolled/moved/swapped/merged/
sold/bookUsed/waveStarted). Only bookUsed may be followed by one levelChanged,
when the existing target level actually changes; merges create a new identity
and report its full XP in merged, without a fictitious prior level. consumedIds
and participants are sorted numerically, independently of input tuple ordering.
Sold reports the positive coin delta, new book or null, and xpLost = oldXP-bookXP.
No zero-XP book. Recruited/rerolled goldDelta is negative. Purchase RNG cost0;
paid reroll refreshes all3. Move/swap/merge/start cost0 and draw no random values.

Combat event order within a tick:
1. effectExpired in enemy-ID order, before all spawns.
2. enemySpawned in profile schedule order (tie order retained).
3. For each ascending unit ID: attack first, then per hit in hit-array order,
   enemyDefeated for lethal hits or effectApplied for a surviving slow target.
   Death is already removed before the next unit. Attack hits contain actual
   clamped damage and attack-time positions, including enemies already removed from
   the returned observation. These snapshots precede enemy movement in that tick.
   No speculative projectile impacts or overkill.
4. On loss: matchEnded only, no reward, free shop refresh or waveCompleted.
5. On success: xpGranted (allocations sorted IDs, sum exactly budget unless n0),
   levelChanged for changed participant IDs in ascending order, waveCompleted
   (one positive goldDelta and sorted carriedEnemyIds), then shopRefreshed if
   entering preparation, or matchEnded(win,cleared) if final. XP/gold are applied
   once, including final success. No kill coins. Final never refreshes the shop.

No movement event is necessary: observation exposes authoritative positions.
Initial free shop is visible in created state; it is not a command/log entry.
No separate support/synergy event: observation derives them after commands.

Accepted log seq starts1 with no gaps. Command entries contain exact accepted
command plus authoritative events; merge input tuple order is preserved in the
command. Advance entries record startTick and **actual executedTicks**, not the
requested count or combat events. One successful API call appends one entry.
Different legal batching may produce different logs but identical canonical
state/hash and concatenated combat events at matching progression boundaries.

ReplayHeader has exactly schemaVersion/rulesId/rulesDigest/seed. ReplayDocument
is a portable envelope with exactly header/entries/finalHash; adapters pass those
to CoreApi.replay. The engine does not accept a caller-supplied state or events as
authority. It regenerates command events and all combat from header and entries.

Replay precedence is fixed:
- Header data-tree and exact shape (schemaVersion safe integer, rulesId/digest
  strings; seed value then checked below) → BAD_FORMAT.
- Unsupported schema → UNSUPPORTED_SCHEMA; unknown rules ID → UNKNOWN_RULES;
  nonmatching digest → RULES_DIGEST_MISMATCH; invalid seed → BAD_SEED.
- Supplied expectedFinalHash must be lowercase hex64; else BAD_FORMAT.
- Validate the entire dense entries array and every exact entry/command/event
  structural shape, scanning entryIndex ascending, before executing anything.
  Any malformed entry → BAD_FORMAT with its index. All numbers must be safe
  integers: seq/executedTicks/IDs positive; clocks, counts, HP, XP and cooldown
  nonnegative; coordinates and goldDelta signed (recruit/reroll deltas negative).
  Event variant literals, slot/location bounds and nullable fields follow the
  types. Command slots/coordinates remain unrestricted safe integers at preflight,
  as in dispatch; out-of-range command values therefore reach COMMAND_REJECTED.
  Duplicate merge IDs/keep membership and other command semantic checks likewise
  remain execution-time. Replay requires a known Command union variant: an unknown
  command type is BAD_FORMAT here, rather than dispatch’s UNSUPPORTED_COMMAND.
  Events with structurally valid but incorrect values reach EVENT_MISMATCH.
- Then check every seq equals index+1 → BAD_SEQUENCE at first mismatch.
- Replay entries in order. atTick/startTick mismatch → TICK_MISMATCH; rejected
  command → COMMAND_REJECTED; generated command events not canonically equal to
  recorded events → EVENT_MISMATCH; unsuccessful advance or executed count
  mismatch → ADVANCE_MISMATCH.
- Finally expected hash mismatch → FINAL_HASH_MISMATCH.

Failure returns only {ok:false,error:{code,entryIndex}}, never partial state.
Header/whole-array/hash errors have entryIndex null; per-entry errors identify
that index. A malformed later entry outranks an earlier sequence/execution error
because structural preflight finishes before either pass. Replay never trusts
recorded ID creation or XP changes without reproducing the command.

## 6. Canonical state and hashing

Exactly19 top-level keys, exported as CANONICAL_STATE_KEYS:
books, enemies, gold, nextEntityId, offers, outcome, outcomeReason, phase,
rngState, rulesDigest, rulesId, schemaVersion, seed, spawnCursor, tick, units,
wave, waveParticipants, waveTick.

acceptedLog is excluded, enabling batching-equivalent hashes. No derived level,
synergy, modulo position or UI state is persisted. Every lasting effect is inside
enemy.slow (including expireAt); cooldown, cumulativeXP, totalDistance, spawnTick,
maxHp, and participants are persisted. Enemy type boss implies boss status;
there is no independently writable contradictory boss flag.

Before canonical serialization, offers sort by slot; units/books/enemies by
numeric ID; waveParticipants ascending. Nested Unit/Enemy/Book/Offer fields are
exactly their type definitions, null fields retained. Other keys sort as in the
rules preimage; no optional fields, undefined or extra keys. stateHash is the
same synchronous pure SHA-256/UTF-8 lowercase encoding. Canonical/hash operations
are specifications only in this checkpoint, not implemented or tested engines.

## 7. Explicit unresolved hypotheses for joint review

The agreed costs, capacity, roles, growth, synergy, slow and timing rules are copied
exactly from the contract. The following are **new, unbalanced hypotheses**:

- Ordinary count6+w; basicHP12+4w+floor(w²/4), adopting the leader's candidate as an
  experiment rather than a finalized difficulty decision.
- Spawn ordinary index i at waveTick1+12i. Cycle basic,swift,sturdy from index0.
  Swift HP floor(70% basic), speed110; sturdy HP floor(160% basic), speed45;
  basic speed70, all coordinate units per tick. No extra random spawn stream.
- Boss at tick1, inserted before the ordinary tick1 spawn; HP120+40w, speed55,
  at waves5/10/15/20. No boss resistance. Boss count is additional to6+w.
- Explicit square geometry above. Max ordinary spawn tick301 at wave20, leaving
  a finite cleanup window. Speeds span roughly one lap every182..445 ticks.
  Boss5 HP320 and boss20 HP920 are hypotheses, not proof of achievable deadlines.
- PRNG xorshift32 (13,17,5), seed1..4294967295. Each next state x is nonzero;
  reject x>4294967292, otherwise select (x−1)%6 in character order
  popo,nuri,ruru,dodo,momo,tori. Draw slot0→1→2 independently with replacement.
  This rejection mapping is unbiased over the nonzero32-bit cycle; do not use
  raw x%6 and call it uniform. A draw may consume more than one PRNG step;
  purchase consumes none. All rejected command draws roll back.
- Inclusive geometry/splash ordering, transition stamps, error precedence and
  observation meanings above require actual SHA review alongside the types.

All four profiles share spawn/role/geometry/RNG data; only economic costs/reward,
count/warning thresholds and identity differ. Changing several spawn values
across economic comparison profiles would confound the intended comparison.
PRNG proposal reference vectors (not engine execution): seed1 produces outputs
270369,67634689,2647435461,307599695,2398689233,745495504 and indices
2,0,2,4,4,3. Thus the initial shop is ruru,popo,ruru with rngState2647435461;
the next paid refresh is momo,momo,dodo with rngState745495504 (three steps each).
Seed1584200935 first produces4294967295, which is rejected, then253983, accepted
as index2/ruru; one offer consumed two steps. The highest accepted raw output is
4294967292 (index5);4294967293..4294967295 are rejected. The focused test validates
these reference equations. Future engine tests must assert rejected commands
leave the pre-command RNG unchanged (including when a staged refresh traverses
this rejection), while an accepted refresh retains its final consumed state.

Neither a balance simulation, engine correctness test, browser replay check nor
human fun evaluation has been performed by this checkpoint. Required next work:
resolve review decisions; implement engine/validation/canonical/replay; test
atomicity, strict malicious shapes, deadlines, XP conservation, targeting,
cooldowns, profile/hash/batching parity and v1 regressions; then integrate adapters.

## 8. Reproducible checkpoint verification

- `node --test tests/core-v2/profiles.test.ts`: proposal-data/digest checks only.
- `node_modules/.bin/tsc --noEmit -p tsconfig.core-v2.json`: ES2022/no DOM/Node
  source and compile-only positive/negative API tests.
- `npm run check`, `npm run typecheck:core`, `npm run build`: existing regression
  suites/build plus automatically discovered proposal tests; no v2 gameplay.

The supplied lockfile matches the existing verification install byte-for-byte;
local ignored node_modules links reuse it without package/lock changes. These
checks cannot establish implemented v2 gameplay, replay correctness or balance.
