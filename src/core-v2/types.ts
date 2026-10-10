/** Schema 2 review checkpoint. Engine operations below are TYPES ONLY. */
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type RulesId =
  | 'playable-v2-proposal1-economyA-count40'
  | 'playable-v2-proposal1-economyA-count80'
  | 'playable-v2-proposal1-economyB-count40'
  | 'playable-v2-proposal1-economyB-count80';
export type CharacterId = 'popo' | 'nuri' | 'ruru' | 'dodo' | 'momo' | 'tori';
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
  | { type: 'recruit'; offerSlot: number; benchSlot: number }
  | { type: 'reroll' }
  | { type: 'move'; unitId: number; to: Location }
  | { type: 'swap'; aId: number; bId: number }
  | { type: 'merge'; ids: [number, number, number]; keepId: number }
  | { type: 'sell'; unitId: number }
  | { type: 'useBook'; bookId: number; unitId: number }
  | { type: 'startWave' }
>;
export type Unit = DeepReadonly<{
  id: number; characterId: CharacterId; star: 1 | 2 | 3; xp: number;
  location: Location; cooldown: number;
}>;
export type Book = Readonly<{ id: number; xp: number }>;
export type Offer = Readonly<{ slot: number; characterId: CharacterId | null }>;
export type SlowEffect = Readonly<{ type: 'slow'; percent: 30; expireAt: number }>;
export type Enemy = DeepReadonly<{
  id: number; typeId: EnemyTypeId; hp: number; maxHp: number;
  totalDistance: number; spawnTick: number; slow: SlowEffect | null;
}>;
export type Stamp = Readonly<{ tick: number; wave: number; waveTick: number }>;
export type XpAllocation = Readonly<{ unitId: number; xpDelta: number }>;
export type LevelChange = Readonly<{ unitId: number; before: number; after: number }>;
export type CommandEvent = DeepReadonly<Stamp & (
  | { type: 'recruited'; unit: Unit; offerSlot: number; goldDelta: number }
  | { type: 'rerolled'; offers: Offer[]; goldDelta: number }
  | { type: 'moved'; unitId: number; from: Location; to: Location }
  | { type: 'swapped'; aId: number; bId: number; aFrom: Location; bFrom: Location }
  | { type: 'merged'; consumedIds: [number, number, number]; newUnit: Unit }
  | { type: 'sold'; unitId: number; goldDelta: number; book: Book | null; xpLost: number }
  | { type: 'bookUsed'; bookId: number; unitId: number; xpDelta: number }
  | { type: 'levelChanged'; change: LevelChange }
  | { type: 'waveStarted'; participants: number[] }
)>;
export type Hit = Readonly<{ enemyId: number; damage: number; position: Point }>;
export type CombatEvent = DeepReadonly<Stamp & (
  | { type: 'effectExpired'; enemyId: number; effect: SlowEffect }
  | { type: 'enemySpawned'; enemy: Enemy }
  | { type: 'attack'; unitId: number; targetId: number; sourcePosition: Point; center: Point; hits: Hit[] }
  | { type: 'effectApplied'; enemyId: number; effect: SlowEffect }
  | { type: 'enemyDefeated'; enemyId: number }
  | { type: 'xpGranted'; budget: number; allocations: XpAllocation[] }
  | { type: 'levelChanged'; change: LevelChange }
  | { type: 'waveCompleted'; goldDelta: number; carriedEnemyIds: number[] }
  | { type: 'shopRefreshed'; offers: Offer[] }
  | { type: 'matchEnded'; outcome: 'win' | 'loss'; reason: Exclude<OutcomeReason, null> }
)>;
export type ReplayHeader = Readonly<{
  schemaVersion: 2; rulesId: RulesId; rulesDigest: string; seed: number;
}>;
export type ReplayEntry = DeepReadonly<
  | { type: 'command'; seq: number; atTick: number; command: Command; events: CommandEvent[] }
  | { type: 'advance'; seq: number; startTick: number; executedTicks: number }
>;
export type ReplayDocument = DeepReadonly<{
  header: ReplayHeader; entries: ReplayEntry[]; finalHash: string;
}>;
/** Engine-owned values only. Public shape is for diagnostics, never policy input. */
export type MatchState = DeepReadonly<{
  schemaVersion: 2; rulesId: RulesId; rulesDigest: string; seed: number;
  rngState: number; nextEntityId: number; tick: number; phase: Phase;
  outcome: Outcome; outcomeReason: OutcomeReason; wave: number; waveTick: number;
  spawnCursor: number; gold: number; offers: Offer[]; units: Unit[]; books: Book[];
  enemies: Enemy[]; waveParticipants: number[]; acceptedLog: ReplayEntry[];
}>;
export type CharacterDefinition = Readonly<{
  tag: SynergyTag; damage: number; cooldownTicks: number; range: number;
  behavior: 'single' | 'splash' | 'multi' | 'slow' | 'support' | 'bossFirst';
  maxTargets: number | null; splashRadius: number; bossDamagePercent: number;
}>;
export type Spawn = Readonly<{ atWaveTick: number; typeId: EnemyTypeId; hp: number }>;
export type WaveDefinition = DeepReadonly<{
  wave: number; durationTicks: number; bossDeadlineWaveTick: number | null;
  xpBudget: number; spawns: Spawn[];
}>;
export type RuleData = DeepReadonly<{
  schemaVersion: 2; rulesId: RulesId; status: 'review-proposal';
  tickMs: 50; waveCount: 20; startingGold: 12;
  recruitCost: number; rerollCost: number; waveReward: number;
  offerCount: 3; board: { columns: 4; rows: 4; tileSize: 1000; capacity: 8 };
  benchCapacity: 8; countLimit: 40 | 80; warningCount: 32 | 64;
  sellGoldByStar: [1, 3, 9]; xpRecoveryPercent: 80;
  starDamagePercent: [100, 220, 484]; levelDamageStepPercent: 8;
  xpThresholds: [0, 8, 24, 48, 80, 120, 168, 224, 288, 360];
  synergyPercentByDistinctCount: [0, 0, 5, 10];
  slow: { percent: 30; durationTicks: 40 }; supportPeriodPercent: 90;
  path: { length: number; vertices: Point[] };
  characters: Record<CharacterId, CharacterDefinition>;
  enemySpeed: Record<EnemyTypeId, number>; waves: WaveDefinition[];
  prng: { algorithm: 'xorshift32'; shifts: [13, 17, 5]; seedMin: 1;
    seedMax: 4294967295; offerMapping: CharacterId[]; sampling: 'rejection-uniform' };
  semantics: { revision: string; tickOrder: string[]; targetOrder: string[];
    hitOrder: string; rangeBoundary: string; slowRounding: string };
}>;
/** Full fixed data, but no PRNG machinery. Fixed wave schedules are public. */
export type PublicRules = DeepReadonly<Omit<RuleData, 'prng'> & { rulesDigest: string }>;
export type Synergy = DeepReadonly<{
  tag: SynergyTag; distinctCharacters: CharacterId[]; affectedUnitIds: number[]; tier: 0 | 2 | 3; percent: 0 | 5 | 10;
}>;
export type ObservedUnit = DeepReadonly<Unit & {
  level: number; nextXpThreshold: number | null; xpToNext: number | null; levelCapped: boolean;
  damage: number; bossDamage: number; range: number; nextAttackCooldown: number;
  supportActive: boolean; supportSourceIds: number[]; plannedXp: number; sellGold: number; recoverableXp: number;
}>;
export type ObservedEnemy = DeepReadonly<Enemy & {
  boss: boolean; position: Point; speed: number;
}>;
export type MergeGroup = DeepReadonly<{
  characterId: CharacterId; star: 1 | 2; unitIds: number[];
}>;
/** Detached, deeply readonly. Deliberately excludes seed/RNG/IDs-to-allocate/log. */
export type Observation = DeepReadonly<{
  rules: PublicRules; tick: number; phase: Phase; outcome: Outcome;
  outcomeReason: OutcomeReason; wave: number; waveTick: number; gold: number;
  offers: Offer[]; units: ObservedUnit[]; books: Book[]; enemies: ObservedEnemy[];
  synergies: Synergy[]; mergeGroups: MergeGroup[]; boardCount: number; benchCount: number;
  remainingCount: number; countLimit: number; warningCount: number; warning: boolean;
  segmentRemainingTicks: number; bossDeadlineWaveTick: number | null;
  bossRemainingTicks: number | null; plannedXpBudget: number;
  nextWave: WaveDefinition | null; canStartWave: boolean;
}>;
export type CoreErrorCode =
  | 'BAD_FORMAT' | 'BAD_SEED' | 'UNKNOWN_RULES' | 'UNSUPPORTED_COMMAND'
  | 'BAD_PHASE' | 'BAD_LOCATION' | 'BAD_SLOT' | 'OFFER_EMPTY'
  | 'UNIT_NOT_FOUND' | 'BOOK_NOT_FOUND' | 'DUPLICATE_ID' | 'KEEP_ID_NOT_INCLUDED'
  | 'MERGE_MISMATCH' | 'MAX_STAR' | 'SAME_LOCATION' | 'LOCATION_OCCUPIED'
  | 'CAPACITY_REACHED' | 'INSUFFICIENT_GOLD' | 'NO_BOARD_UNITS'
  | 'BAD_COUNT' | 'INTEGER_OVERFLOW';
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
export type ReplayErrorCode =
  | 'BAD_FORMAT' | 'UNSUPPORTED_SCHEMA' | 'UNKNOWN_RULES' | 'RULES_DIGEST_MISMATCH'
  | 'BAD_SEED' | 'BAD_SEQUENCE' | 'TICK_MISMATCH' | 'COMMAND_REJECTED'
  | 'ADVANCE_MISMATCH' | 'EVENT_MISMATCH' | 'FINAL_HASH_MISMATCH';
export type ReplayResult =
  | Readonly<{ ok: true; state: MatchState }>
  | Readonly<{ ok: false; error: Readonly<{ code: ReplayErrorCode; entryIndex: number | null }> }>;
/** Planned synchronous contract; no implementation value is exported yet. */
export interface CoreApi {
  createMatch(seed: unknown, rulesId: unknown): CreateMatchResult;
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
