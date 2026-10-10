import type {
  AdvanceResult, CombatEvent, Command, CommandEvent, CoreErrorCode, CreateMatchResult,
  DispatchResult, Location, MatchState, Observation, ReplayEntry,
} from './types.ts';
import { DEFAULT_RULES_ID, RULE_DATA, RULES_DIGEST, SCHEMA_VERSION,
  boardPosition, getRules, nextRandom, pathPosition } from './rules.ts';
import { command as validCommand, integer } from './validation.ts';

type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
type WorkingState = Mutable<MatchState>;

/** Copies only engine-owned plain JSON trees, including commands and accepted log. */
export function copy<T>(value: T): Mutable<T> {
  if (Array.isArray(value)) return value.map(item => copy(item)) as Mutable<T>;
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) result[key] = copy((value as Record<string, unknown>)[key]);
    return result as Mutable<T>;
  }
  return value as Mutable<T>;
}

function numbersSafe(value: unknown): boolean {
  if (typeof value === 'number') return Number.isSafeInteger(value);
  if (value !== null && typeof value === 'object') return Object.values(value).every(numbersSafe);
  return true;
}

function draw(state: WorkingState): 'single' | 'splash' {
  state.rngState = nextRandom(state.rngState);
  return state.rngState % 2 === 0 ? 'single' : 'splash';
}

function refreshOffers(state: WorkingState): void {
  state.offers = Array.from({ length: RULE_DATA.offerCount }, (_, slot) => ({ slot, typeId: draw(state) }));
}

export function createMatch(seed: unknown, rulesId = DEFAULT_RULES_ID): CreateMatchResult {
  if (rulesId !== DEFAULT_RULES_ID) return { ok: false, error: { code: 'UNKNOWN_RULES' } };
  if (!integer(seed, 1, 4294967295)) return { ok: false, error: { code: 'BAD_SEED' } };
  const state: WorkingState = {
    schemaVersion: SCHEMA_VERSION, rulesId, rulesDigest: RULES_DIGEST,
    seed, rngState: seed, nextEntityId: 1, tick: 0, phase: 'preparation', outcome: null,
    wave: 1, waveTick: 0, spawnCursor: 0, lives: RULE_DATA.startingLives,
    gold: RULE_DATA.startingGold, offers: [], units: [], enemies: [], acceptedLog: [],
  };
  refreshOffers(state);
  return { ok: true, state };
}

function sameLocation(a: Location, b: Location): boolean {
  return a.kind === 'board' ? b.kind === 'board' && a.col === b.col && a.row === b.row
    : b.kind === 'bench' && a.slot === b.slot;
}

function destinationError(state: MatchState, to: Location, movingId?: number): CoreErrorCode | null {
  if (to.kind === 'bench') return 'BAD_LOCATION';
  if (state.units.some(unit => sameLocation(unit.location, to))) return 'LOCATION_OCCUPIED';
  const occupied = state.units.filter(unit => unit.id !== movingId && unit.location.kind === 'board').length;
  return occupied >= RULE_DATA.board.capacity ? 'CAPACITY_REACHED' : null;
}

function reject(state: MatchState, code: CoreErrorCode): DispatchResult {
  return { ok: false, state, error: { code } };
}

export function dispatch(state: MatchState, input: unknown): DispatchResult {
  let valid: boolean;
  try { valid = validCommand(input); } catch { valid = false; }
  if (!valid) return reject(state, 'BAD_FORMAT');
  const command = input as Command;
  if (state.phase !== 'preparation') return reject(state, 'BAD_PHASE');
  if (command.type === 'merge') return reject(state, 'UNSUPPORTED_COMMAND');
  if (command.type === 'recruit') {
    const error = destinationError(state, command.to);
    if (error) return reject(state, error);
    if (state.gold < RULE_DATA.recruitCost) return reject(state, 'INSUFFICIENT_GOLD');
  } else if (command.type === 'move') {
    const unit = state.units.find(u => u.id === command.unitId);
    if (!unit) return reject(state, 'UNIT_NOT_FOUND');
    if (sameLocation(unit.location, command.to)) return reject(state, 'SAME_LOCATION');
    const error = destinationError(state, command.to, command.unitId);
    if (error) return reject(state, error);
  } else if (command.type === 'swap') {
    if (command.aId === command.bId) return reject(state, 'DUPLICATE_ID');
    if (!state.units.some(u => u.id === command.aId) || !state.units.some(u => u.id === command.bId)) {
      return reject(state, 'UNIT_NOT_FOUND');
    }
  } else if (!state.units.some(u => u.location.kind === 'board')) return reject(state, 'NO_BOARD_UNITS');

  const next = copy(state);
  const events: CommandEvent[] = [];
  if (command.type === 'recruit') {
    const typeId = next.offers[command.offerSlot].typeId;
    const unit = { id: next.nextEntityId++, typeId, star: 1 as const,
      location: copy(command.to), cooldown: 0 };
    next.units.push(unit);
    next.gold -= RULE_DATA.recruitCost;
    next.offers[command.offerSlot] = { slot: command.offerSlot, typeId: draw(next) };
    events.push({ type: 'unitCreated', id: unit.id, typeId, star: 1, location: copy(unit.location) });
  } else if (command.type === 'move') {
    next.units.find(u => u.id === command.unitId)!.location = copy(command.to);
  } else if (command.type === 'swap') {
    const a = next.units.find(u => u.id === command.aId)!;
    const b = next.units.find(u => u.id === command.bId)!;
    const location = a.location;
    a.location = b.location;
    b.location = location;
  } else {
    next.phase = 'combat';
    next.waveTick = 0;
    next.spawnCursor = 0;
    for (const unit of next.units) if (unit.location.kind === 'board') unit.cooldown = 0;
  }
  next.acceptedLog.push(copy({ type: 'command', seq: next.acceptedLog.length + 1,
    atTick: state.tick, command, events } satisfies ReplayEntry));
  if (!numbersSafe(next)) return reject(state, 'INTEGER_OVERFLOW');
  return { ok: true, state: next, events };
}

function squared(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function combatTick(state: WorkingState, events: CombatEvent[]): void {
  const wave = RULE_DATA.waves[state.wave - 1];
  while (state.spawnCursor < wave.spawns.length && wave.spawns[state.spawnCursor].atWaveTick === state.waveTick) {
    const spawn = wave.spawns[state.spawnCursor++];
    const id = state.nextEntityId++;
    state.enemies.push({ id, typeId: spawn.typeId, hp: spawn.hp, distance: 0 });
    events.push({ type: 'enemySpawned', tick: state.tick, id, typeId: spawn.typeId });
  }
  const board = state.units.filter(unit => unit.location.kind === 'board').sort((a, b) => a.id - b.id);
  for (const unit of board) unit.cooldown = Math.max(0, unit.cooldown - 1);
  for (const unit of board) {
    if (unit.cooldown !== 0 || unit.location.kind !== 'board') continue;
    const rules = RULE_DATA.units[unit.typeId];
    const center = boardPosition(unit.location.col, unit.location.row)!;
    const targets = state.enemies.filter(enemy => squared(center, pathPosition(enemy.distance)!) <= rules.range ** 2)
      .sort((a, b) => b.distance - a.distance || a.id - b.id);
    const target = targets[0];
    if (!target) continue;
    const hits = (unit.typeId === 'single' ? [target] : state.enemies.filter(enemy =>
      squared(pathPosition(target.distance)!, pathPosition(enemy.distance)!) <= rules.splashRadius ** 2))
      .sort((a, b) => a.id - b.id);
    events.push({ type: 'attack', tick: state.tick, unitId: unit.id, targetId: target.id,
      hits: hits.map(enemy => ({ enemyId: enemy.id, damage: rules.damage })) });
    for (const enemy of hits) enemy.hp -= rules.damage;
    unit.cooldown = rules.cooldownTicks;
    const dead = state.enemies.filter(enemy => enemy.hp <= 0).sort((a, b) => a.id - b.id);
    for (const enemy of dead) events.push({ type: 'enemyDefeated', tick: state.tick, id: enemy.id });
    state.enemies = state.enemies.filter(enemy => enemy.hp > 0);
  }
  const survivors: WorkingState['enemies'] = [];
  for (const enemy of state.enemies.sort((a, b) => a.id - b.id)) {
    const rules = RULE_DATA.enemies[enemy.typeId];
    enemy.distance += rules.speed;
    if (enemy.distance >= RULE_DATA.path.length) {
      state.lives = Math.max(0, state.lives - rules.leakDamage);
      events.push({ type: 'enemyLeaked', tick: state.tick, id: enemy.id, damage: rules.leakDamage });
    } else survivors.push(enemy);
  }
  state.enemies = survivors;
  state.tick++;
  state.waveTick++;
  if (state.lives === 0) {
    state.phase = 'result'; state.outcome = 'loss';
    events.push({ type: 'matchEnded', tick: state.tick, outcome: 'loss' });
  } else if (state.spawnCursor === wave.spawns.length && state.enemies.length === 0) {
    const final = state.wave === RULE_DATA.waves.length;
    events.push({ type: 'waveCompleted', tick: state.tick, wave: state.wave,
      reward: final ? 0 : RULE_DATA.waveReward });
    if (final) {
      state.phase = 'result'; state.outcome = 'win';
      events.push({ type: 'matchEnded', tick: state.tick, outcome: 'win' });
    } else {
      state.gold += RULE_DATA.waveReward;
      state.wave++;
      state.phase = 'preparation';
      state.waveTick = 0;
      state.spawnCursor = 0;
      refreshOffers(state);
    }
  }
}

export function advance(state: MatchState, count: unknown): AdvanceResult {
  if (!integer(count, 1, 10000)) return { ok: false, state, error: { code: 'BAD_COUNT' }, executedTicks: 0 };
  if (state.phase !== 'combat') return { ok: false, state, error: { code: 'BAD_PHASE' }, executedTicks: 0 };
  const next = copy(state);
  const events: CombatEvent[] = [];
  let executedTicks = 0;
  while (executedTicks < count && next.phase === 'combat') {
    combatTick(next, events);
    executedTicks++;
    if (!numbersSafe(next)) return { ok: false, state, error: { code: 'INTEGER_OVERFLOW' }, executedTicks: 0 };
  }
  next.acceptedLog.push({ type: 'advance', seq: next.acceptedLog.length + 1, startTick: state.tick, executedTicks });
  return { ok: true, state: next, events, executedTicks };
}

export function observe(state: MatchState): Observation {
  return { rules: getRules(state.rulesId)!, tick: state.tick, phase: state.phase,
    outcome: state.outcome, wave: state.wave, waveTick: state.waveTick,
    lives: state.lives, gold: state.gold, offers: copy(state.offers),
    units: copy(state.units), enemies: copy(state.enemies) };
}
