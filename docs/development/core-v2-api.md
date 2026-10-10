# Generation2 API/data checkpoint: schema3 automatic upgrades

Owner 모모, Issue #23 assignment_generation2; base
`361ed54339daab180cd8dfc1cc2526fee479eded`. Input contract: PR #36
`19c4dac` (full contract read from the leader's generation2 checkpoint).
Assignment: [6094839654](https://github.com/mrkimkim/infinite-gacha-defense/issues/23#issuecomment-6094839654);
resume: [6095709433](https://github.com/mrkimkim/infinite-gacha-defense/issues/23#issuecomment-6095709433).

**API/data review only. No schema3 engine, purchase planner, replay implementation
or throwing stub is exported.** `CoreApi` in `src/core-v2/types.ts` is the exact
planned synchronous interface. `index.ts` exports types and fixed fixture data
only. Adapters must wait for both independent DOTs' exact-SHA API review before
implementing against it. Previous schema2 approvals do not approve this model.

Generation1's unmerged implementation is not part of this checkpoint. This clean
branch removes XP, levels, books, manual merge, XP participants and the eight-unit
deployment cap. It introduces schema3 and wholly new rules IDs. Historical v1
`src/core/index.ts`, schema1 canonical17, bytes/hashes and replay remain unchanged.
The new engine will explicitly reject schema2 with UNSUPPORTED_SCHEMA. Old
proposal1 rules IDs are not registered and must not be reinterpreted under schema3.

## 1. Fixed data and unfinished content decisions

The TypeScript model uses data-defined `DefinitionId` strings, not an enum fixing
the roster to six characters. Eight **neutral technical definitions**, fixture-01
through fixture-08, exercise six behavior roles and all five user-approved rarity
names: 일반/common, 고급/uncommon, 희귀/rare, 영웅/epic, 전설/legendary.
This is neither a final IP roster nor approved rarity assignments/art/content.

| Fixture ID | Full-data SHA-256 digest |
|---|---|
| playable-v2-gen2-fixture1-count40 | 83462afeda2fe1756f130669f4b77af45c518390c04248d1d006909fb911c886 |
| playable-v2-gen2-fixture1-count80 | f4f82d384a0a0774eefb75b9b7428cee45564749d815f0df3d3964ba64ba63d2 |

`EXPERIMENT_RULES_ID` names count40 for explicit test wiring only. createMatch
requires a rules ID; no production default exists. Only registry-owned profiles
are accepted, with no runtime data overrides. `status: 'unapproved-fixture'` is
hashed immutable metadata: review approval must not mutate it under an existing
ID. Future data, semantic or footprint changes require new IDs/digests.

The digest is SHA-256 of UTF-8 canonical JSON of the entire RuleData (including
schema, ID, status, five rarity entries, public odds, all character definitions,
expanded wave schedules, footprint, autoUpgrade, PRNG and semantic revision).
The digest itself is not in the preimage. Sort object keys ordinal UTF-16 (schema
keys ASCII), retain array order, no whitespace, safe integer decimal numbers,
JSON-escaped strings, negative zero encoded as0, lowercase64 hexadecimal output.
All exported profile trees and digest maps are deeply frozen.

Explicitly unapproved fixture choices:
- Starting12 coins, reroll1, successful-wave reward6; count40/warning32 or80/64.
- Rarity weights500/250/150/75/25 (total1000), prices2/3/4/5/6. Sell values by
  star: common/uncommon1/3/9; rare/epic2/6/18; legendary3/9/27.
- Eight neutral definitions reuse six previous role parameter sets; fixture-07
  repeats single and fixture-08 splash. Rarity alone adds no hidden damage factor.
- Star damage100/220/484%; synergy5/10%; one cell for every star; bench8.
- 20 waves, bosses5/10/15/20, ordinary400 ticks/boss600 ticks at50ms. This is a
  comparison schedule, not final content length or difficulty.
- Ordinary count6+w; basicHP12+4w+floor(w²/4). Cycle basic/swift/sturdy; swift HP70%
  floored and speed110, sturdy HP160% floored and speed45, basic speed70.
  Ordinary spawn i at waveTick1+12i. Boss at tick1 before the ordinary tie spawn,
  additional to ordinary count, HP120+40w, speed55. No spawn RNG.
- Geometry: board tile1000, centers(500+1000col,500+1000row); clockwise path
  (-500,-500)→(4500,-500)→(4500,4500)→(-500,4500)→start, length20000.

All these choices remain fixtures, not inherited economic/balance approvals.
Both profiles share all data except identity and count/warning threshold.
3-star2×2 is **not supported or decided** by this checkpoint. It requires a new
footprint/anchor/collision/placement contract, not a runtime flag flip.

## 2. Purchase plan and symbolic preview

`recruit` has exactly type and offerSlot. No destination, keepId or merge command.
The same pure internal planner must produce `previewRecruit(state, offerSlot)`
and dispatch's checked purchase plan. observe includes its result on each shop
slot as `ObservedOffer.recruitPreview`; empty slots still exist with null
rarityId/price and OFFER_EMPTY in preparation. There is no preview implementation
in this checkpoint; the following is the reviewable planner contract.

Plan references:
- `{kind:'existing',unitId}` refers only to an already public existing unit ID.
- `{kind:'created',creationIndex}` is transaction-local, zero-based.0 is the fresh
  arrival,1 is the first upgrade output,2 the next. These are symbols, not real
  IDs, not offsets disclosed to the policy, and never valid command targets.
- Order existing refs by unitId, then all created refs by creationIndex. All
  existing IDs predate every created ref. This matches eventual allocation order
  without revealing nextEntityId, RNG, seed or future random candidates.

The arrival has star1, cooldown0, **location:null always**, including when a free
bench slot exists. It is a planner-only transient, never a persistent Unit. Do
not provisionally give it an empty bench slot before checking upgrades: an
unrelated lower empty slot must not change the preserved material location.

For valid stabilized input, add the arrival and repeatedly:
1. Select same-definition/same-star triples across board and bench, using the
   three oldest live identities. Exhaust star1 upgrades before star2, never
   upgrade star3. Normal input has no existing eligible triple; therefore only
   the purchased definition can change, with at most two upgrade steps.
2. If any material is on board, use the oldest **board** material's location
   (even if an older overall material is on bench). Otherwise preserve the
   minimum occupied bench slot among the materials. Exclude null arrival from
   location candidates. Remove all three materials before placing the result.
3. Create a new identity at that location, star+1, maximum immediate-material
   remaining cooldown. Every step reevaluates placement independently; the
   second step can move the purchased lineage to another material's location.
4. If no upgrade consumed arrival, place it at the lowest empty bench. Never
   place it on board, displace another unit or leave it in temporary storage.
5. Validate final locations/collisions, safe arithmetic/identity allocation and
   stabilized inventory. Any failed plan rejects the complete purchase.

No extra board-cap8 check exists. The one-cell fixture can physically occupy all
16 cells. Bench remains8 slots. Full bench is not itself an error: if arrival is
consumed and the result occupies a freed material location, purchase succeeds.
With stable one-cell input, every upgrade inherits a freed material location;
there is no invented late 2×2 placement behavior. Keep defensive final checks.

Preview success contains price, goldAfter, arrival, upgrades, result, finalUnits,
boardCountAfter and benchCountAfter. Each upgrade exposes ordered consumed refs
and a full placed result. Consumed refs must be distinct and currently live;
  a step cannot consume its own output, a future creationIndex or an earlier
  consumed ref. `finalUnits` means **all surviving post-purchase units**,
including unchanged ones, ordered by reference order; it has no null locations
or consumed refs. `result` is the full surviving purchased-lineage unit and equals
its finalUnits entry. UI does not reconstruct placement, affordability or chains.
Failure contains only error, no partial chain or stale successful result.
Repeated previews must be identical and mutate/allocate/draw/log nothing.

Preview is an ephemeral view of the current state, not a reservable authorization
or input token. dispatch recomputes the same planner on its actual state; after
any intervening action a caller must refresh preview. IDs/costs/selection cannot
be injected from an earlier preview.

### Examples to pin material order and placement

- Full bench + no matching pair: NO_RECRUIT_SPACE, even if the board is empty.
- Two matching bench units at slots4 and6, lowest empty bench slot0: an upgrade
  still appears at slot4; arrival never claims slot0 first.
- Full bench + matching board IDs7 at(3,3),11 at(0,0): arrival created0 is consumed
  with7/11, created1 appears at(3,3), cooldown max(materials), unrelated bench
  units remain untouched.
- A ★1 step creates created1 at board(3,3). Existing ★2 IDs3 at board(0,1) and9
  at bench2 then combine with created1: created2/★3 appears at(0,1), inheriting
  max(ID3,ID9,created1 cooldown). Both steps remain visible in the plan/event.
- Same rarity/label/behavior is insufficient: definitionId and star must both
  match. Different definitions never upgrade together.

## 3. Commit and event shapes

Only after a complete valid plan does dispatch atomically deduct price, empty
one shop slot, allocate arrival and intermediate IDs, apply all replacements and
append one accepted command log entry. Purchase consumes zero RNG. IDs are
positive safe integers from one shared unit/enemy allocator, initially1; allocate
arrival first and every upgrade output next, even when those identities are
consumed before the transaction finishes. Preview never exposes that allocator.

One `recruited` command event contains the complete atomic trace: offerSlot,
goldDelta, committed arrival (real ID, location:null), ordered upgrades (three
actual consumed IDs plus the full new Unit/location/cooldown) and final result.
Nested upgrades are not independent commands or partially committed states.
Only the final returned state is observable. The final result uses the arrival
ID if there was no upgrade, or the last output ID otherwise. All consumed tuples
are numerically ascending. This aggregate event avoids an orphan null-location
unit or a forward-reference event that an adapter might treat as persistent.

All other commands emit one event: rerolled, moved, swapped, sold or waveStarted.
waveStarted contains only its stamp, no XP-era participant list. Sold removes the
unit and credits coins; it does not stabilize unrelated groups, draw RNG or make
books. Rerolled replaces all three slots in slot order. No kill coins.

Combat event sequence retains effectExpired → enemySpawned → per-unit attack and
its effects/deaths → outcome/transition. Attack includes sourcePosition, primary
center and each actual hit's position/damage, frozen before enemy movement;
killed targets can be rendered without reconstructing missing observation data.
On success emit waveCompleted (positive goldDelta, sorted carriedEnemyIds), then
shopRefreshed or final matchEnded(win,cleared). No XP or level events. Final win
gets exactly one coin reward and no refresh. Failure emits matchEnded with no
reward/refresh. All events in a transition, including shopRefreshed, are stamped
with the completed wave/global tick/waveTick; returned preparation state has the
upcoming wave. Command waveStarted uses newly reset waveTick0.

## 4. Input validation and exact error precedence

No coercion or hidden defaults. External structures must be acyclic JSON-data
objects (Object.prototype or null), enumerable own string data properties only,
exact keys, dense ordinary arrays, no extras/accessors/symbols/unsafe numbers/
NaN/infinity/undefined/functions/bigint/exotic prototypes. Reject accessors without
calling them. Catch hostile trap failures as BAD_FORMAT; arbitrary changing proxy
behavior is outside the JSON-data contract. IDs positive safe integers; command
slots/coordinates safe signed integers before semantic bounds. Unknown string
type gives UNSUPPORTED_COMMAND after whole-tree checking; missing/non-string type
or malformed known union gives BAD_FORMAT. Removed merge/useBook are unsupported,
not aliases. `recruit{offerSlot,benchSlot}` fails BAD_FORMAT due to extra keys.

createMatch: non-string rulesId BAD_FORMAT → unregistered ID UNKNOWN_RULES → seed
outside integer1..4294967295 BAD_SEED. No state on failure. getRules returns null
for unrecognized/non-string IDs. No arbitrary registration or data injection API.

previewRecruit validates offerSlot as a safe signed integer (otherwise BAD_FORMAT),
then uses the exact shared semantic ordering below. dispatch validates whole
command shape first, then uses the same plan and ordering:

| Command | Ordered semantic checks after shape |
|---|---|
| recruit / previewRecruit | BAD_PHASE → BAD_SLOT(0..2) → OFFER_EMPTY → INSUFFICIENT_GOLD → NO_RECRUIT_SPACE → INTEGER_OVERFLOW |
| reroll | BAD_PHASE → INSUFFICIENT_GOLD → INTEGER_OVERFLOW |
| move | BAD_PHASE → UNIT_NOT_FOUND → BAD_LOCATION → SAME_LOCATION → LOCATION_OCCUPIED → INTEGER_OVERFLOW |
| swap | BAD_PHASE → DUPLICATE_ID → UNIT_NOT_FOUND(aId then bId) → SAME_LOCATION → INTEGER_OVERFLOW |
| sell | BAD_PHASE → UNIT_NOT_FOUND → INTEGER_OVERFLOW |
| startWave | BAD_PHASE → NO_BOARD_UNITS → INTEGER_OVERFLOW |

All commands require preparation. Destination board bounds0..3 and bench bounds
0..7 apply only after valid location union shape. Moving into a free physical
cell succeeds regardless of already having8 units on board. No implicit swap.
Swaps exchange occupied positions; existing collision/footprint constraints still
apply. current fixture has a single-cell footprint for every star.

Reject returns the identical input state reference, no events/log append, and
unchanged coins/slots/units/IDs/RNG. Checked arithmetic includes every intermediate
integer product/sum and ID increment, even if later division would reduce it.
A completed plan that would overflow rolls back the whole purchase, never draws
RNG or allocates an ID speculatively into authoritative state.

advance: count must be a safe integer>=1, else BAD_COUNT before phase validation;
then require combat, else BAD_PHASE. No arbitrary batch cap, but stop at the first
preparation/result transition. Return actual executedTicks; never auto-start a
wave. Overflow on any later tick rolls back the entire call to the original state,
executedTicks0, no events/log entries. Pause/restart/wall time are adapter concerns.
createMatch makes a new match; no restart command.

## 5. State, observation and deterministic combat

Initial state: schema3, registered ID/digest, seed/RNG, nextEntityId1, tick0,
preparation/wave1/waveTick0/spawnCursor0, gold from fixture, empty units/enemies,
null outcome/reason, exactly one free full shop. Shop always contains three slots;
purchase empties one definitionId to null and does not refill it.

Persistent units hold only ID/definitionId/star/location/cooldown. Rarity is
immutable definition data; observation adds rarityId for display. It also adds
effective damage/bossDamage/range/nextAttackCooldown, supportActive/supportSourceIds,
sellGold, active synergies with affectedUnitIds and distinctDefinitions, inventory
counts, warning/limit, separate segment/boss timing and per-offer purchase preview.
No XP/level/book/merge-button fields remain. Policies receive only detached readonly
Observation, excluding seed, rngState, nextEntityId, acceptedLog or future offers.
PublicRules intentionally exposes fixed schedules, roster, prices and the complete
public rarity/conditional draw table; neither policy gets private RNG information.

In preparation wave identifies the upcoming wave, while waveTick/spawnCursor keep
the completed wave's values until startWave resets both to0. Global tick never
resets. segmentRemainingTicks is upcoming duration in preparation, duration minus
waveTick in combat,0 in result. bossDeadlineWaveTick is upcoming/active deadline
or null; bossRemainingTicks is full upcoming deadline in preparation, remaining
time while the scheduled/active boss remains in combat, null after defeat/result.
nextWave means upcoming in preparation, following the active one in combat,
otherwise null. canStartWave is preparation plus at least one board unit.

Clock/combat order: increment tick and waveTick → expire effects with expireAt<=tick
→ scheduled spawns → ascending board-unit ID cooldown/attacks, immediate deaths
→ surviving enemy movement → count>=limit loss → boss/final deadline loss → success.
Only board units tick cooldown/attack; bench cooldown freezes even during combat.
Returning to board resumes remainder. New arrival cooldown0; every upgrade carries
max material cooldown. Preparation/move/swap never reset it. Decrement to minimum0
before attacking; reset once after attack to the applicable period. No target
keeps0. Period12 attacking at tick1 next attacks tick13. Support affects only a
newly set cooldown, never existing remainder.

Target order is descending totalDistance then ascending ID, independent of path
modulo. Boss-first behavior partitions in-range bosses first. Range/splash use
inclusive checked Euclidean squared distance. Multi targets up to2 distinct
in-range enemies. Splash freezes the primary target position then includes all
enemies within radius, even outside attacker's range, sorted by general target
priority. Each attack freezes its target/hit snapshot immediately before applying
it; later units see deaths immediately removed.

Damage: floor(base × starPercent × (100+focusPercent) × bossPercent /100³), minimum1,
with no intermediate flooring; clamp actual hits to remainingHP. Rarity does not
multiply damage implicitly. Range floor(baseRange×(100+cooperationPercent)/100).
Star only affects damage. Distinct board definitions give tier0 below2, tier2 at2,
tier3 at3 **or more**; duplicate/star/bench adds no distinct count. Apply bonuses
only to board units of that tag. Support targets orthogonal board neighbors,
excluding self/bench, no stacking; identify support by behavior, never fixture ID.
New period max(1,floor(basePeriod×supportPeriodPercent/100)).

Slow applies only to surviving targets; general and boss strength30%/40ticks in
this fixture. max(oldExpiry,tick+duration), no stacking. Movement speed is floored
base×70/100. A hit at globalT slows movesT..T+39, expires before T+40 attacks/move;
preparation freezes both movement and expiry. totalDistance keeps increasing;
pathPosition applies modulo only for display/geometry. Board/path helper inputs
are unknown, require safe integers and valid bounds, else null.

Count loss wins all same-tick ties. At boss-wave600 the tick's attacks/deaths/move
happen first; living boss loses bossTimeout. At final600, dead boss but remaining
ordinary enemies loses finalTimeout. All scheduled spawns consumed plus no living
enemies permits early success. Otherwise ordinary400 can carry survivors; boss
5/10/15 at600 can carry only ordinary survivors if boss died. Final requires all
ordinary/bosses cleared. No future spawn may be skipped for early success.

## 6. Canonical state and replay

Schema3 has exactly17 canonical keys (not the schema1 set despite equal count):
enemies, gold, nextEntityId, offers, outcome, outcomeReason, phase, rngState,
rulesDigest, rulesId, schemaVersion, seed, spawnCursor, tick, units, wave, waveTick.
Exported CANONICAL_STATE_KEYS pins them. Exclude acceptedLog so batching granularity
does not affect state hashes. No preview symbols, rarity copies or derived combat
values persist in state. Sort units/enemies by numeric ID, offers by slot; nested
keys sort canonically. Include every lasting cooldown/effect/expireAt/distance.
Synchronous stateHash is SHA-256 of canonical UTF-8 bytes, lowercase hex64.

ReplayHeader exactly schemaVersion/rulesId/rulesDigest/seed. ReplayDocument is
{header,entries,finalHash}; adapter calls replay(header,entries,finalHash). Entries
record command/seq/atTick/events, or advance/seq/startTick/actual executedTicks.
Sequence starts1, contiguous. Each accepted call appends once; rejected calls and
previews append nothing. Recompute the planner/events on replay, never trust
recorded created IDs or consumedIds. Combat events are regenerated output, not
accepted replay input. Different batching can have different logs but must match
canonical/hash and concatenated combat events at equivalent progression boundaries.

Replay precedence:
1. Header whole-tree/exact shape (schema integer, ID/digest strings) BAD_FORMAT.
2. Any schema other than3, including1/2, UNSUPPORTED_SCHEMA. Caller must route
   schema1 to unchanged v1; schema2 explicitly has no decoder here.
3. Unknown ID UNKNOWN_RULES; mismatched digest RULES_DIGEST_MISMATCH; invalid seed
   BAD_SEED. Supplied expected final hash must be lowercase hex64, else BAD_FORMAT.
4. Validate whole dense entries array and every entry/known command/event shape,
   scanning indices ascending; malformed entry BAD_FORMAT at that index. Numeric
   IDs/seq/executedTicks positive; clocks/cooldowns nonnegative; star1..3;
   goldDelta and coordinates signed safe. Definition strings nonempty. An unknown
   but nonempty definitionId in a recorded arrival/result is structurally valid
   and fails EVENT_MISMATCH against regenerated events, never an obsolete fixed
   character enum. SlowEffect.percent has structural integer range0..100; a
   profile-inconsistent value in regenerated-output comparisons is a semantic
   mismatch. Combat slow events are output-only and not valid replay entries. Removed/unknown command
   union is BAD_FORMAT in replay, even though direct dispatch says unsupported.
   Command coordinate/slot bounds remain semantic, so out-of-range safe integers
   reach COMMAND_REJECTED; event location bounds are structural. Invalid array/
   tuple lengths and nullable/enum shapes are structural. Incorrect but structurally
   valid upgrade traces (including wrong order or IDs) reach EVENT_MISMATCH.
5. After complete structural preflight, validate all seq=index+1 → BAD_SEQUENCE.
6. Execute in order: wrong atTick/startTick TICK_MISMATCH; refused command
   COMMAND_REJECTED; regenerated command events differ canonically EVENT_MISMATCH;
   failed advance or different actual tick count ADVANCE_MISMATCH.
7. Final expected hash mismatch FINAL_HASH_MISMATCH.

No partial state on replay failure; error has code and entryIndex (null for header,
whole-array or final-hash errors). A malformed later entry outranks an earlier
sequence or execution error. All success values/events are detached readonly.

## 7. Weighted draw proposal and fixture verification

Rarity weights are public fixture data, not approvals. For each slot0→1→2:
1. Draw uniformly from integer[0,weightTotal−1], select rarity by cumulative weight
   in rarityOrder, intervals left-inclusive/right-exclusive.
2. Draw uniformly from that rarity's definitions in profile-character order;
   consume a second draw even for a singleton pool. Independent with replacement,
   so duplicates are allowed at first and later shops.

Each uniform draw uses xorshift32 shifts13,17,5 on nonzero state1..4294967295. For
pool sizeN, accept raw x <= floor(4294967295/N)×N, then choose(x−1)%N; otherwise
advance again. Do not assume the stream contains zero. Weighted pool sizes and
weights must be positive safe integers, totals bounded to the nonzero domain,
and every positive-weight rarity must have a nonempty pool. No wall-time RNG.
Buying draws nothing; free/paid refresh consumes complete three-slot sequences.

Review fixtures/tests verify deep freezing, full-data digest, five rarity entries,
eight definition data rows, public weighted table consistency, sell-price sanity,
no obsolete growth/cap fields, schedule validity, canonical17 and type-level
negative capabilities. These are not planner/engine correctness tests.

Commands: `node --test tests/core-v2/*.test.ts`,
`node_modules/.bin/tsc --noEmit -p tsconfig.core-v2.json`, `npm run check`,
`npm run typecheck:core`, `npm run build`. The lockfile equals the previous verified
install; ignored local dependency links reuse it without package edits.

Remaining reviews: this exact schema/API/events/placement/error contract and
fixture choices; then implementation with preview/commit parity, automatic
chains, full-bench success/rejection, board16, ID/RNG rollback, strict replay and
combat regression tests. Final roster/rarity assignments/odds/prices/schedule,
2×2 design, balance runs, integrated browser checks and human play remain open.
