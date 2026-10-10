/** Shared public types for the first technical profile. */
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

export type Phase = 'preparation' | 'combat' | 'result';
export type Outcome = 'win' | 'loss' | null;
export type UnitTypeId = 'single' | 'splash';
export type EnemyTypeId = 'basic';
export type Point = Readonly<{ x: number; y: number }>;
export type Location =
  | Readonly<{ kind: 'board'; col: number; row: number }>
  | Readonly<{ kind: 'bench'; slot: number }>;

export type Command = DeepReadonly<
  | { type: 'recruit'; offerSlot: number; to: Location }
  | { type: 'move'; unitId: number; to: Location }
  | { type: 'swap'; aId: number; bId: number }
  | { type: 'startWave' }
  | { type: 'merge'; ids: [number, number, number]; keepId: number }
>;

export type Unit = DeepReadonly<{
  id: number;
  typeId: UnitTypeId;
  star: 1 | 2;
  location: Location;
  cooldown: number;
}>;
export type Enemy = Readonly<{
  id: number;
  typeId: EnemyTypeId;
  hp: number;
  distance: number;
}>;
export type Offer = Readonly<{ slot: number; typeId: UnitTypeId }>;

/** Authoritative command ID events. Move/swap/startWave produce an empty array. */
export type CommandEvent = DeepReadonly<{
  type: 'unitCreated';
  id: number;
  typeId: UnitTypeId;
  star: 1;
  location: Location;
}>;
export type CombatEvent = DeepReadonly<
  | { type: 'enemySpawned'; tick: number; id: number; typeId: EnemyTypeId }
  | { type: 'attack'; tick: number; unitId: number; targetId: number;
      hits: { enemyId: number; damage: number }[] }
  | { type: 'enemyDefeated'; tick: number; id: number }
  | { type: 'enemyLeaked'; tick: number; id: number; damage: number }
  | { type: 'waveCompleted'; tick: number; wave: number; reward: number }
  | { type: 'matchEnded'; tick: number; outcome: 'win' | 'loss' }
>;

export type ReplayHeader = Readonly<{
  schemaVersion: number;
  rulesId: string;
  rulesDigest: string;
  seed: number;
}>;
export type ReplayEntry = DeepReadonly<
  | { type: 'command'; seq: number; atTick: number; command: Command;
      events: CommandEvent[] }
  | { type: 'advance'; seq: number; startTick: number; executedTicks: number }
>;

/** Engine-owned immutable value. Adapters must never fabricate or mutate it. */
export type MatchState = DeepReadonly<{
  schemaVersion: number;
  rulesId: string;
  rulesDigest: string;
  seed: number;
  rngState: number;
  nextEntityId: number;
  tick: number;
  phase: Phase;
  outcome: Outcome;
  wave: number;
  waveTick: number;
  spawnCursor: number;
  lives: number;
  gold: number;
  offers: Offer[];
  units: Unit[];
  enemies: Enemy[];
  acceptedLog: ReplayEntry[];
}>;

/** Displayable shared definitions, without future spawn schedules or RNG state. */
export type PublicRules = DeepReadonly<{
  schemaVersion: number;
  rulesId: string;
  rulesDigest: string;
  tickMs: number;
  waveCount: number;
  startingLives: number;
  startingGold: number;
  recruitCost: number;
  offerCount: number;
  waveReward: number;
  board: { columns: number; rows: number; tileSize: number; capacity: number };
  benchCapacity: number;
  path: { length: number; vertices: Point[] };
  units: Record<UnitTypeId, {
    damage: number; range: number; cooldownTicks: number; splashRadius: number;
  }>;
  enemies: Record<EnemyTypeId, { speed: number; leakDamage: number }>;
}>;

/** Detached copies only; no MatchState, replay header, seed, RNG, or future data. */
export type Observation = DeepReadonly<{
  rules: PublicRules;
  tick: number;
  phase: Phase;
  outcome: Outcome;
  wave: number;
  waveTick: number;
  lives: number;
  gold: number;
  offers: Offer[];
  units: Unit[];
  enemies: Enemy[];
}>;

export type CoreErrorCode =
  | 'BAD_FORMAT' | 'BAD_SEED' | 'UNKNOWN_RULES' | 'BAD_PHASE'
  | 'BAD_LOCATION' | 'LOCATION_OCCUPIED' | 'CAPACITY_REACHED'
  | 'INSUFFICIENT_GOLD' | 'UNIT_NOT_FOUND' | 'SAME_LOCATION'
  | 'DUPLICATE_ID' | 'NO_BOARD_UNITS' | 'UNSUPPORTED_COMMAND'
  | 'BAD_COUNT' | 'INTEGER_OVERFLOW';
export type CoreError = Readonly<{ code: CoreErrorCode }>;
export type CreateMatchResult =
  | Readonly<{ ok: true; state: MatchState }>
  | Readonly<{ ok: false; error: CoreError }>;
export type DispatchResult =
  | Readonly<{ ok: true; state: MatchState; events: readonly CommandEvent[] }>
  | Readonly<{ ok: false; state: MatchState; error: CoreError }>;
export type AdvanceResult =
  | Readonly<{ ok: true; state: MatchState; events: readonly CombatEvent[];
      executedTicks: number }>
  | Readonly<{ ok: false; state: MatchState; error: CoreError; executedTicks: 0 }>;

export type ReplayErrorCode =
  | 'BAD_FORMAT' | 'UNSUPPORTED_SCHEMA' | 'UNKNOWN_RULES'
  | 'RULES_DIGEST_MISMATCH' | 'BAD_SEED' | 'BAD_SEQUENCE'
  | 'TICK_MISMATCH' | 'COMMAND_REJECTED' | 'ADVANCE_MISMATCH'
  | 'EVENT_MISMATCH' | 'FINAL_HASH_MISMATCH';
export type ReplayResult =
  | Readonly<{ ok: true; state: MatchState }>
  | Readonly<{ ok: false; error: Readonly<{
      code: ReplayErrorCode; entryIndex: number | null;
    }> }>;

export interface CoreApi {
  createMatch(seed: unknown, rulesId?: string): CreateMatchResult;
  dispatch(state: MatchState, command: unknown): DispatchResult;
  advance(state: MatchState, count: unknown): AdvanceResult;
  observe(state: MatchState): Observation;
  canonicalState(state: MatchState): string;
  stateHash(state: MatchState): string;
  replay(header: unknown, entries: unknown, expectedFinalHash?: string): ReplayResult;
  getRules(rulesId?: string): PublicRules | null;
  pathPosition(distance: number): Point | null;
  boardPosition(col: number, row: number): Point | null;
}
