import type { CharacterDefinition, Location, MatchState, Point, PublicRules, RuleData, RulesId,
  Synergy, Unit } from './types.ts';
import { EXPERIMENT_RULES_ID, RULES_DIGESTS, RULES_PROPOSALS } from './profiles.ts';
import { copy, freeze, safe } from './util.ts';

export function isRulesId(value: unknown): value is RulesId {
  return typeof value === 'string' && Object.hasOwn(RULES_PROPOSALS, value);
}
export function getRules(rulesId: unknown): PublicRules | null {
  if (!isRulesId(rulesId)) return null;
  const { prng: _prng, ...data } = RULES_PROPOSALS[rulesId];
  return freeze({ ...copy(data), rulesDigest: RULES_DIGESTS[rulesId] });
}
export function boardPosition(col: unknown, row: unknown): Point | null {
  if (typeof col !== 'number' || typeof row !== 'number' || !Number.isSafeInteger(col) ||
      !Number.isSafeInteger(row) || col < 0 || col > 3 || row < 0 || row > 3) return null;
  return { x: 500 + 1000 * col, y: 500 + 1000 * row };
}
export function pathPosition(totalDistance: unknown): Point | null {
  if (typeof totalDistance !== 'number' || !Number.isSafeInteger(totalDistance) || totalDistance < 0) return null;
  const path = RULES_PROPOSALS[EXPERIMENT_RULES_ID].path;
  let distance = totalDistance % path.length;
  for (let i = 0; i < path.vertices.length; i += 1) {
    const a = path.vertices[i], b = path.vertices[(i + 1) % path.vertices.length];
    const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (distance < length) return { x: a.x + Math.sign(b.x - a.x) * distance,
      y: a.y + Math.sign(b.y - a.y) * distance };
    distance -= length;
  }
  return null;
}
export function sameLocation(a: Location, b: Location): boolean {
  return a.kind === 'board' ? b.kind === 'board' && a.col === b.col && a.row === b.row
    : b.kind === 'bench' && a.slot === b.slot;
}
export function validLocation(value: Location): boolean {
  return value.kind === 'board' ? boardPosition(value.col, value.row) !== null
    : value.slot >= 0 && value.slot < 8;
}
export function nextRandom(state: number): number {
  let x = state; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0;
}
export function definition(rules: RuleData, id: string): CharacterDefinition {
  const found = rules.characters.find(character => character.id === id);
  if (!found) throw new Error('Invalid engine-owned definition ID');
  return found;
}
export function price(rules: RuleData, id: string): number {
  const rarity = definition(rules, id).rarityId;
  return rules.rarities.find(row => row.id === rarity)!.recruitPrice;
}
export function sellGold(rules: RuleData, unit: Unit): number {
  return rules.rarities.find(row => row.id === definition(rules, unit.definitionId).rarityId)!.sellGoldByStar[unit.star - 1];
}
export function synergies(state: MatchState, rules: RuleData): Synergy[] {
  const order = rules.characters.map(c => c.id);
  return (['focus', 'cooperation'] as const).map(tag => {
    const members = state.units.filter(u => u.location.kind === 'board' && definition(rules, u.definitionId).tag === tag);
    const distinctDefinitions = order.filter(id => members.some(u => u.definitionId === id));
    const tier = distinctDefinitions.length >= 3 ? 3 : distinctDefinitions.length >= 2 ? 2 : 0;
    const percent = rules.synergyPercentByDistinctCount[tier];
    return { tag, distinctDefinitions, tier, percent,
      affectedUnitIds: tier === 0 ? [] : members.map(u => u.id).sort((a, b) => a - b) };
  });
}
export function supportSources(unit: Unit, state: MatchState): number[] {
  const location = unit.location;
  if (location.kind !== 'board') return [];
  return state.units.filter(other => other.id !== unit.id && definition(RULES_PROPOSALS[state.rulesId], other.definitionId).behavior === 'support' &&
    other.location.kind === 'board' &&
    Math.abs(other.location.col - location.col) + Math.abs(other.location.row - location.row) === 1)
    .map(u => u.id).sort((a, b) => a - b);
}
export function stats(unit: Unit, state: MatchState, rules: RuleData) {
  const character = definition(rules, unit.definitionId);
  const active = unit.location.kind === 'board'
    ? synergies(state, rules).find(s => s.tag === character.tag)!.percent : 0;
  const damagePercent = character.tag === 'focus' ? active : 0;
  const rangePercent = character.tag === 'cooperation' ? active : 0;
  let numerator = character.damage;
  for (const factor of [rules.starDamagePercent[unit.star - 1],
    100 + damagePercent]) numerator = safe(numerator * factor);
  const damage = Math.max(1, Math.floor(safe(numerator * 100) / 1000000));
  const bossDamage = Math.max(1, Math.floor(safe(numerator * character.bossDamagePercent) / 1000000));
  const sources = supportSources(unit, state);
  return { damage, bossDamage,
    range: Math.floor(safe(character.range * (100 + rangePercent)) / 100),
    nextAttackCooldown: sources.length === 0 ? character.cooldownTicks
      : Math.max(1, Math.floor(safe(character.cooldownTicks * rules.supportPeriodPercent) / 100)),
    supportActive: sources.length > 0, supportSourceIds: sources };
}
export function squared(a: Point, b: Point): number {
  const dx = safe(a.x - b.x), dy = safe(a.y - b.y);
  return safe(safe(dx * dx) + safe(dy * dy));
}
