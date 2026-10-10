/** Approved readonly generation2/schema3 engine contract. */
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type RulesId = 'playable-v2-gen2-fixture1-count40' | 'playable-v2-gen2-fixture1-count80';
/** Registry data defines the roster; this is deliberately not a six-character union. */
export type DefinitionId = string;
export type RarityId = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type EnemyTypeId = 'basic' | 'swift' | 'sturdy' | 'boss';
export type SynergyTag = 'focus' | 'cooperation';
export type Phase = 'preparation' | 'combat' | 'result';
export type Outcome = 'win' | 'loss' | null;
export type OutcomeReason = 'accumulation' | 'bossTimeout' | 'finalTimeout' | 'cleared' | null;
export type Point = Readonly<{ x: number; y: number }>;
export type Location =
  | Readonly<{ kind: 'board'; col: number; row: number }>
  | Readonly<{ kind: 'bench'; slot: number }>;
export type Command = DeepReadonly<
  | { type: 'recruit'; offerSlot: number }
  | { type: 'reroll' }
  | { type: 'move'; unitId: number; to: Location }
  | { type: 'swap'; aId: number; bId: number }
  | { type: 'sell'; unitId: number }
  | { type: 'startWave' }
>;
export type Unit = DeepReadonly<{
  id: number; definitionId: DefinitionId; star: 1 | 2 | 3; location: Location; cooldown: number;
}>;
export type Offer = Readonly<{ slot: number; definitionId: DefinitionId | null }>;
export type SlowEffect = Readonly<{ type: 'slow'; percent: number; expireAt: number }>;
export type Enemy = DeepReadonly<{
  id: number; typeId: EnemyTypeId; hp: number; maxHp: number;
  totalDistance: number; spawnTick: number; slow: SlowEffect | null;
}>;
export type Stamp = Readonly<{ tick: number; wave: number; waveTick: number }>;
/** Existing public IDs or transaction-local symbols, NEVER future allocated IDs. */
export type PlanRef =
  | Readonly<{ kind: 'existing'; unitId: number }>
  | Readonly<{ kind: 'created'; creationIndex: number }>;
export type PlannedUnit = DeepReadonly<{
  ref: PlanRef; definitionId: DefinitionId; star: 1 | 2 | 3; location: Location; cooldown: number;
}>;
/** The fresh purchase has no physical slot until stabilization determines it. */
export type PlannedArrival = Readonly<{
  ref: Readonly<{ kind: 'created'; creationIndex: 0 }>;
  definitionId: DefinitionId; star: 1; cooldown: 0; location: null;
}>;
export type PlannedUpgrade = DeepReadonly<{
  consumed: [PlanRef, PlanRef, PlanRef]; result: PlannedUnit;
}>;
export type RecruitErrorCode = 'BAD_FORMAT' | 'BAD_PHASE' | 'BAD_SLOT' | 'OFFER_EMPTY'
  | 'INSUFFICIENT_GOLD' | 'NO_RECRUIT_SPACE' | 'INTEGER_OVERFLOW';
export type RecruitPreview = DeepReadonly<
  | { ok: true; offerSlot: number; price: number; goldAfter: number;
      arrival: PlannedArrival; upgrades: PlannedUpgrade[]; result: PlannedUnit;
      finalUnits: PlannedUnit[]; boardCountAfter: number; benchCountAfter: number }
  | { ok: false; error: { code: RecruitErrorCode } }
>;
export type CommittedArrival = Readonly<{
  id: number; definitionId: DefinitionId; star: 1; cooldown: 0; location: null;
}>;
export type CommittedUpgrade = DeepReadonly<{
  consumedIds: [number, number, number]; result: Unit;
}>;
/** One atomic recruited event contains every intermediate upgrade in order. */
export type CommandEvent = DeepReadonly<Stamp & (
  | { type: 'recruited'; offerSlot: number; goldDelta: number; arrival: CommittedArrival;
      upgrades: CommittedUpgrade[]; result: Unit }
  | { type: 'rerolled'; offers: Offer[]; goldDelta: number }
  | { type: 'moved'; unitId: number; from: Location; to: Location }
  | { type: 'swapped'; aId: number; bId: number; aFrom: Location; bFrom: Location }
  | { type: 'sold'; unitId: number; goldDelta: number }
  | { type: 'waveStarted' }
)>;
export type Hit = Readonly<{ enemyId: number; damage: number; position: Point }>;
export type CombatEvent = DeepReadonly<Stamp & (
  | { type: 'effectExpired'; enemyId: number; effect: SlowEffect }
  | { type: 'enemySpawned'; enemy: Enemy }
  | { type: 'attack'; unitId: number; targetId: number; sourcePosition: Point; center: Point; hits: Hit[] }
  | { type: 'effectApplied'; enemyId: number; effect: SlowEffect }
  | { type: 'enemyDefeated'; enemyId: number }
  | { type: 'waveCompleted'; goldDelta: number; carriedEnemyIds: number[] }
  | { type: 'shopRefreshed'; offers: Offer[] }
  | { type: 'matchEnded'; outcome: 'win' | 'loss'; reason: Exclude<OutcomeReason, null> }
)>;
export type ReplayHeader = Readonly<{
  schemaVersion: 3; rulesId: RulesId; rulesDigest: string; seed: number;
}>;
export type ReplayEntry = DeepReadonly<
  | { type: 'command'; seq: number; atTick: number; command: Command; events: CommandEvent[] }
  | { type: 'advance'; seq: number; startTick: number; executedTicks: number }
>;
export type ReplayDocument = DeepReadonly<{
  header: ReplayHeader; entries: ReplayEntry[]; finalHash: string;
}>;
/** Engine-owned diagnostic state, never policy input or an external import format. */
export type MatchState = DeepReadonly<{
  schemaVersion: 3; rulesId: RulesId; rulesDigest: string; seed: number;
  rngState: number; nextEntityId: number; tick: number; phase: Phase;
  outcome: Outcome; outcomeReason: OutcomeReason; wave: number; waveTick: number;
  spawnCursor: number; gold: number; offers: Offer[]; units: Unit[];
  enemies: Enemy[]; acceptedLog: ReplayEntry[];
}>;
export type RarityDefinition = DeepReadonly<{
  id: RarityId; label: string; offerWeight: number; recruitPrice: number;
  sellGoldByStar: [number, number, number];
}>;
export type CharacterDefinition = Readonly<{
  id: DefinitionId; label: string; rarityId: RarityId; tag: SynergyTag;
  damage: number; cooldownTicks: number; range: number;
  behavior: 'single' | 'splash' | 'multi' | 'slow' | 'support' | 'bossFirst';
  maxTargets: number | null; splashRadius: number; bossDamagePercent: number;
}>;
export type Spawn = Readonly<{ atWaveTick: number; typeId: EnemyTypeId; hp: number }>;
export type WaveDefinition = DeepReadonly<{
  wave: number; durationTicks: number; bossDeadlineWaveTick: number | null; spawns: Spawn[];
}>;
export type RuleData = DeepReadonly<{
  schemaVersion: 3; rulesId: RulesId; status: 'unapproved-fixture';
  tickMs: 50; waveCount: number; startingGold: number; rerollCost: number; waveReward: number;
  offerCount: 3; board: { columns: 4; rows: 4; tileSize: 1000 };
  benchCapacity: number; footprintByStar: [{ width: 1; height: 1 }, { width: 1; height: 1 }, { width: 1; height: 1 }];
  countLimit: number; warningCount: number;
  rarities: RarityDefinition[]; characters: CharacterDefinition[];
  starDamagePercent: [number, number, number]; synergyPercentByDistinctCount: [0, 0, number, number];
  slow: { percent: number; durationTicks: number }; supportPeriodPercent: number;
  path: { length: number; vertices: Point[] }; enemySpeed: Record<EnemyTypeId, number>; waves: WaveDefinition[];
  shopSampling: { algorithm: 'rarity-weight-then-uniform-definition'; weightTotal: number;
    rarityOrder: RarityId[]; withinRarityOrder: 'profile-character-order'; drawsForSingleton: true };
  autoUpgrade: { materialCount: 3; maxStar: 3; starOrder: [1, 2];
    materialOrder: 'ascending-identity'; placement: 'oldest-board-else-lowest-material-bench';
    newRecruitPlacement: 'transient-until-stable'; loneRecruitPlacement: 'lowest-empty-bench';
    cooldown: 'max-material-remainder' };
  prng: { algorithm: 'xorshift32'; shifts: [13, 17, 5]; seedMin: 1;
    seedMax: 4294967295; sampling: 'nonzero-domain-rejection-uniform' };
  semantics: { revision: string; tickOrder: string[]; targetOrder: string[];
    hitOrder: string; rangeBoundary: string; slowRounding: string };
}>;
/** Public odds and complete fixed roster/schedules; no PRNG machinery/state. */
export type PublicRules = DeepReadonly<Omit<RuleData, 'prng'> & { rulesDigest: string }>;
export type Synergy = DeepReadonly<{
  tag: SynergyTag; distinctDefinitions: DefinitionId[]; affectedUnitIds: number[];
  tier: 0 | 2 | 3; percent: number;
}>;
export type ObservedUnit = DeepReadonly<Unit & {
  rarityId: RarityId; damage: number; bossDamage: number; range: number; nextAttackCooldown: number;
  supportActive: boolean; supportSourceIds: number[]; sellGold: number;
}>;
export type ObservedOffer = DeepReadonly<Offer & {
  rarityId: RarityId | null; price: number | null; recruitPreview: RecruitPreview;
}>;
export type ObservedEnemy = DeepReadonly<Enemy & { boss: boolean; position: Point; speed: number }>;
/** Detached readonly policy/UI snapshot: no seed/RNG/nextID/future offers/log. */
export type Observation = DeepReadonly<{
  rules: PublicRules; tick: number; phase: Phase; outcome: Outcome;
  outcomeReason: OutcomeReason; wave: number; waveTick: number; gold: number;
  offers: ObservedOffer[]; units: ObservedUnit[]; enemies: ObservedEnemy[];
  synergies: Synergy[]; boardCount: number; benchCount: number;
  remainingCount: number; countLimit: number; warningCount: number; warning: boolean;
  segmentRemainingTicks: number; bossDeadlineWaveTick: number | null;
  bossRemainingTicks: number | null; nextWave: WaveDefinition | null; canStartWave: boolean;
}>;
export type CoreErrorCode = RecruitErrorCode | 'BAD_SEED' | 'UNKNOWN_RULES' | 'UNSUPPORTED_COMMAND'
  | 'BAD_LOCATION' | 'UNIT_NOT_FOUND' | 'DUPLICATE_ID' | 'SAME_LOCATION' | 'LOCATION_OCCUPIED'
  | 'NO_BOARD_UNITS' | 'BAD_COUNT';
export type CoreError = Readonly<{ code: CoreErrorCode }>;
export type CreateMatchResult =
  | Readonly<{ ok: true; state: MatchState }>
  | Readonly<{ ok: false; error: CoreError }>;
export type DispatchResult =
  | Readonly<{ ok: true; state: MatchState; events: readonly CommandEvent[] }>
  | Readonly<{ ok: false; state: MatchState; error: CoreError }>;
export type AdvanceResult =
  | Readonly<{ ok: true; state: MatchState; events: readonly CombatEvent[]; executedTicks: number }>
  | Readonly<{ ok: false; state: MatchState; error: CoreError; executedTicks: 0 }>;
export type ReplayErrorCode = 'BAD_FORMAT' | 'UNSUPPORTED_SCHEMA' | 'UNKNOWN_RULES' | 'RULES_DIGEST_MISMATCH'
  | 'BAD_SEED' | 'BAD_SEQUENCE' | 'TICK_MISMATCH' | 'COMMAND_REJECTED'
  | 'ADVANCE_MISMATCH' | 'EVENT_MISMATCH' | 'FINAL_HASH_MISMATCH';
export type ReplayResult =
  | Readonly<{ ok: true; state: MatchState }>
  | Readonly<{ ok: false; error: Readonly<{ code: ReplayErrorCode; entryIndex: number | null }> }>;
/** Synchronous contract implemented by the schema3 entry point. */
export interface CoreApi {
  createMatch(seed: unknown, rulesId: unknown): CreateMatchResult;
  previewRecruit(state: MatchState, offerSlot: unknown): RecruitPreview;
  dispatch(state: MatchState, command: unknown): DispatchResult;
  advance(state: MatchState, count: unknown): AdvanceResult;
  observe(state: MatchState): Observation;
  getRules(rulesId: unknown): PublicRules | null;
  canonicalState(state: MatchState): string;
  stateHash(state: MatchState): string;
  replay(header: unknown, entries: unknown, expectedFinalHash?: unknown): ReplayResult;
  pathPosition(totalDistance: unknown): Point | null;
  boardPosition(col: unknown, row: unknown): Point | null;
}
