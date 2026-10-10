import type { Point, PublicRules } from './types.ts';
import { canonicalJson, sha256 } from './serialization.ts';

export const SCHEMA_VERSION = 1;
export const DEFAULT_RULES_ID = 'technical-v1';

/** Full authoritative data: changing any gameplay definition requires a new ID. */
export const RULE_DATA = {
  schemaVersion: SCHEMA_VERSION,
  rulesId: DEFAULT_RULES_ID,
  tickMs: 50,
  startingLives: 10,
  startingGold: 6,
  recruitCost: 2,
  offerCount: 3,
  waveReward: 3,
  board: { columns: 4, rows: 4, tileSize: 1000, capacity: 4 },
  benchCapacity: 0,
  path: { length: 20000, vertices: [
    { x: -500, y: -500 }, { x: 4500, y: -500 },
    { x: 4500, y: 4500 }, { x: -500, y: 4500 },
  ] },
  units: {
    single: { damage: 4, range: 3000, cooldownTicks: 10, splashRadius: 0 },
    splash: { damage: 2, range: 3000, cooldownTicks: 15, splashRadius: 1000 },
  },
  enemies: { basic: { speed: 100, leakDamage: 1 } },
  waves: Array.from({ length: 5 }, (_, index) => {
    const wave = index + 1;
    return { wave, spawns: Array.from({ length: 3 + 2 * wave }, (_, i) => (
      { atWaveTick: 10 * i, typeId: 'basic' as const, hp: 8 + 4 * wave }
    )) };
  }),
  prng: { algorithm: 'xorshift32', shifts: [13, 17, 5], seedMin: 1,
    seedMax: 4294967295, offerMapping: ['single', 'splash'], modulus: 2 },
  semantics: {
    phaseOrder: ['preparation', 'combat', 'result'],
    tickOrder: ['spawn', 'cooldown', 'attack', 'moveLeak', 'increment', 'loss', 'waveEnd'],
    targeting: ['distanceDescending', 'numericIdAscending'],
    unitOrder: 'numericIdAscending', hitOrder: 'numericIdAscending',
    rangeBoundary: 'inclusiveSquaredDistance', splashBoundary: 'inclusiveSquaredDistance',
    leakBoundary: 'distanceGreaterThanOrEqualLength',
    firstEntityId: 1, initialWave: 1, initialTick: 0, initialWaveTick: 0,
    initialCooldown: 0, star: 1, growthEnabled: false,
  },
} as const;

function freezeTree(value: unknown): void {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
}
freezeTree(RULE_DATA);

export const RULES_DIGEST = sha256(canonicalJson(RULE_DATA));

export function getRules(rulesId = DEFAULT_RULES_ID): PublicRules | null {
  if (rulesId !== DEFAULT_RULES_ID) return null;
  return {
    schemaVersion: SCHEMA_VERSION, rulesId, rulesDigest: RULES_DIGEST,
    tickMs: RULE_DATA.tickMs, waveCount: RULE_DATA.waves.length,
    startingLives: RULE_DATA.startingLives, startingGold: RULE_DATA.startingGold,
    recruitCost: RULE_DATA.recruitCost, offerCount: RULE_DATA.offerCount,
    waveReward: RULE_DATA.waveReward, board: { ...RULE_DATA.board },
    benchCapacity: RULE_DATA.benchCapacity,
    path: { length: RULE_DATA.path.length,
      vertices: RULE_DATA.path.vertices.map(p => ({ ...p })) },
    units: { single: { ...RULE_DATA.units.single }, splash: { ...RULE_DATA.units.splash } },
    enemies: { basic: { ...RULE_DATA.enemies.basic } },
  };
}

export function boardPosition(col: number, row: number): Point | null {
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || col >= RULE_DATA.board.columns || row < 0 || row >= RULE_DATA.board.rows) return null;
  const tile = RULE_DATA.board.tileSize;
  return { x: tile / 2 + tile * col, y: tile / 2 + tile * row };
}

export function pathPosition(distance: number): Point | null {
  if (!Number.isInteger(distance) || distance < 0 || distance >= RULE_DATA.path.length) return null;
  const vertices = RULE_DATA.path.vertices;
  let remaining = distance;
  for (let i = 0; i < vertices.length; i++) {
    const from = vertices[i], to = vertices[(i + 1) % vertices.length];
    const dx = to.x - from.x, dy = to.y - from.y;
    const length = Math.abs(dx) + Math.abs(dy);
    if (remaining < length) return {
      x: from.x + Math.sign(dx) * remaining,
      y: from.y + Math.sign(dy) * remaining,
    };
    remaining -= length;
  }
  return null;
}

export function nextRandom(value: number): number {
  let x = value;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}
