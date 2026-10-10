import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, boardPosition, createMatch, dispatch, EXPERIMENT_RULES_ID, observe,
  pathPosition, RULES_PROPOSALS, stateHash } from '../../src/core-v2/index.ts';
import type { DefinitionId, CombatEvent, Enemy, MatchState, Unit } from '../../src/core-v2/types.ts';
import { copy } from '../../src/core-v2/util.ts';
import type { Mutable } from '../../src/core-v2/util.ts';

const rules = RULES_PROPOSALS[EXPERIMENT_RULES_ID];
/** Synthetic valid-state boundary fixtures; not replay or policy evidence. */
function fixture(characters: DefinitionId[] = ['fixture-01'], wave = 1): Mutable<MatchState> {
  const made = createMatch(1, EXPERIMENT_RULES_ID); assert.ok(made.ok);
  const state = copy(made.state); state.phase = 'combat'; state.wave = wave;
  state.spawnCursor = rules.waves[wave - 1].spawns.length; state.nextEntityId = 1000;
  state.units = characters.map((definitionId, index) => ({ id: index + 1, definitionId,
    star: 1, location: { kind: 'board', col: index % 4, row: Math.floor(index / 4) }, cooldown: 0 }));
  state.enemies = [enemy(100, 1000, 1000)];
  return state;
}
function enemy(id: number, hp = 1000, totalDistance = 1000, typeId: Enemy['typeId'] = 'basic'): Mutable<Enemy> {
  return { id, typeId, hp, maxHp: hp, totalDistance, spawnTick: 0, slow: null };
}
function progressed(state: MatchState, count = 1) {
  const result = advance(state, count); assert.ok(result.ok); return result;
}
function attacks(events: readonly CombatEvent[]) {
  return events.filter(e => e.type === 'attack');
}

test('coordinate helpers wrap cumulative distance exactly and reject malformed values', () => {
  for (const distance of [0, 5000, 10000, 15000, 20000, 25000]) {
    assert.deepEqual(pathPosition(distance), rules.path.vertices[(distance / 5000) % 4]);
  }
  assert.deepEqual(pathPosition(20001), { x: -499, y: -500 });
  assert.ok(pathPosition(Number.MAX_SAFE_INTEGER));
  for (const invalid of [-1, 0.5, NaN, Infinity, '0', undefined]) assert.equal(pathPosition(invalid), null);
  assert.deepEqual(boardPosition(3, 3), { x: 3500, y: 3500 });
  for (const invalid of [-1, 4, 0.5, '0', undefined]) assert.equal(boardPosition(invalid, 0), null);
});
test('cooldown attacks exactly tick1/13/25; only board units tick, and no target leaves zero', () => {
  const state = fixture();
  state.enemies[0].totalDistance = 0;
  state.units.push({ id: 2, definitionId: 'fixture-06', star: 1,
    location: { kind: 'bench', slot: 0 }, cooldown: 9 });
  const result = progressed(state, 25);
  assert.deepEqual(attacks(result.events).map(e => e.tick), [1, 13, 25]);
  assert.equal(result.state.units[1].cooldown, 9);
  const noTarget = fixture(); noTarget.enemies[0].totalDistance = 10000;
  assert.equal(progressed(noTarget).state.units[0].cooldown, 0);
});
test('snapshot damage is clamped and coordinates survive lethal removal before movement', () => {
  const state = fixture(); state.enemies = [enemy(100, 1, 1000)];
  const result = progressed(state), attack = attacks(result.events)[0];
  assert.deepEqual(attack.sourcePosition, { x: 500, y: 500 });
  assert.deepEqual(attack.center, { x: 500, y: -500 });
  assert.deepEqual(attack.hits, [{ enemyId: 100, damage: 1, position: { x: 500, y: -500 } }]);
  assert.equal(result.state.enemies.length, 0);
  assert.ok(Object.isFrozen(attack.hits[0].position));
  assert.deepEqual(result.events.slice(0, 2).map(e => e.type), ['attack', 'enemyDefeated']);
});
test('priority uses cumulative distance then numeric IDs, not wrapped position', () => {
  const state = fixture(); state.enemies = [enemy(101, 1000, 1000), enemy(102, 1000, 21000), enemy(100, 1000, 21000)];
  assert.equal(attacks(progressed(state).events)[0].targetId, 100);
});
test('sequential units retarget immediately after death; Ruru never doubles one enemy', () => {
  const state = fixture(['fixture-01', 'fixture-01']); state.enemies = [enemy(100, 1, 1000), enemy(101, 1, 1000)];
  assert.deepEqual(attacks(progressed(state).events).map(e => [e.unitId, e.targetId]), [[1, 100], [2, 101]]);
  const one = fixture(['fixture-03']); assert.equal(attacks(progressed(one).events)[0].hits.length, 1);
  const two = fixture(['fixture-03']); two.enemies.push(enemy(101), enemy(102));
  assert.deepEqual(attacks(progressed(two).events)[0].hits.map(h => h.enemyId), [100, 101]);
});
test('Nuri splash locks primary center, includes boundary1100, excludes1101, and hits beyond own range', () => {
  const state = fixture(['fixture-02']);
  // Source (1500,500), primary (4500,500) exactly range3000 on the right edge.
  state.units[0].location = { kind: 'board', col: 1, row: 0 };
  // Primary highest priority within range. Collateral has higher cumulative distance
  // but is outside source range and exactly1100 from the fixed primary center.
  state.enemies = [enemy(100, 1, 6000), enemy(101, 1, 7100), enemy(102, 1, 7101)];
  const event = attacks(progressed(state).events)[0];
  assert.equal(event.targetId, 100); assert.deepEqual(event.center, { x: 4500, y: 500 });
  assert.deepEqual(event.hits.map(h => h.enemyId), [101, 100]);
});
test('Tori prefers any in-range boss and applies boss factor within the single final floor', () => {
  const state = fixture(['fixture-06', 'fixture-01', 'fixture-03']);
  state.units[0].star = 2;
  state.enemies = [enemy(100, 1000, 21000), enemy(101, 1000, 1000, 'boss')];
  const event = attacks(progressed(state).events)[0];
  assert.equal(event.targetId, 101); assert.equal(event.hits[0].damage, 48);
  assert.equal(observe(state).units[0].damage, 24);
});
test('distinct board tag members gate synergy; bench and duplicate stars add no tier', () => {
  const state = fixture(['fixture-01', 'fixture-01', 'fixture-03', 'fixture-02', 'fixture-04', 'fixture-05']);
  state.units[1].star = 3; state.units[2].location = { kind: 'bench', slot: 0 };
  let observation = observe(state);
  assert.equal(observation.synergies[0].tier, 0);
  assert.deepEqual(observation.synergies[0].affectedUnitIds, []);
  assert.equal(observation.synergies[1].tier, 3);
  assert.equal(observation.units.find(u => u.definitionId === 'fixture-02')!.range, 3300);
  state.units[2].location = { kind: 'board', col: 2, row: 0 };
  observation = observe(state);
  assert.equal(observation.synergies[0].tier, 2);
  assert.deepEqual(observation.synergies[0].affectedUnitIds, [1, 2, 3]);
  assert.equal(observation.units[0].range, 3200);
});
test('support is orthogonal nonstacking, excludes self/bench and only changes newly set period', () => {
  const state = fixture(['fixture-01', 'fixture-05', 'fixture-05']);
  state.units[0].location = { kind: 'board', col: 1, row: 1 };
  state.units[1].location = { kind: 'board', col: 0, row: 1 };
  state.units[2].location = { kind: 'board', col: 1, row: 0 };
  state.units[0].cooldown = 2;
  const observation = observe(state);
  assert.deepEqual(observation.units[0].supportSourceIds, [2, 3]);
  assert.equal(observation.units[0].nextAttackCooldown, 10);
  const first = progressed(state); assert.equal(first.state.units[0].cooldown, 1);
  assert.ok(!attacks(first.events).some(e => e.unitId === 1));
  const second = progressed(first.state); assert.equal(second.state.units[0].cooldown, 10);
  assert.ok(attacks(second.events).some(e => e.unitId === 1));
  const bench = copy(state); bench.units[0].location = { kind: 'bench', slot: 0 };
  assert.equal(observe(bench).units[0].supportActive, false);
});
test('slow applies before movement, refreshes max expiry, and expires globally after frozen preparation', () => {
  const state = fixture(['fixture-04']); state.tick = 99; state.waveTick = 399;
  const first = progressed(state);
  assert.equal(first.state.phase, 'preparation');
  assert.equal(first.state.tick, 100); assert.equal(first.state.enemies[0].slow!.expireAt, 140);
  assert.equal(first.state.enemies[0].totalDistance, 1049);
  assert.deepEqual(first.events.filter(e => e.type === 'effectApplied').map(e => e.tick), [100]);
  const paused = advance(first.state, 500); assert.equal(paused.ok, false); assert.equal(paused.state, first.state);
  const restart = dispatch(first.state, { type: 'startWave' }); assert.ok(restart.ok);
  const noRefresh = copy(restart.state); noRefresh.units[0].cooldown = 1000;
  const beforeExpiry = progressed(noRefresh, 39);
  assert.equal(beforeExpiry.state.tick, 139); assert.equal(beforeExpiry.state.enemies[0].slow!.expireAt, 140);
  const distance = beforeExpiry.state.enemies[0].totalDistance;
  const expired = progressed(beforeExpiry.state);
  assert.equal(expired.events[0].type, 'effectExpired');
  assert.equal(expired.state.enemies[0].slow, null);
  assert.equal(expired.state.enemies[0].totalDistance, distance + 70);
  const existing = fixture(['fixture-04']); existing.enemies[0].slow = { type: 'slow', percent: 30, expireAt: 999 };
  assert.equal(progressed(existing).state.enemies[0].slow!.expireAt, 999);
});
test('boss slow is identical; lethal slow attacks do not apply an orphan effect', () => {
  const state = fixture(['fixture-04']); state.enemies = [enemy(100, 1000, 1000, 'boss')];
  const result = progressed(state); assert.equal(result.state.enemies[0].totalDistance, 1038);
  assert.equal(result.state.enemies[0].slow!.percent, 30);
  state.enemies[0].hp = 1;
  const killed = progressed(state); assert.ok(!killed.events.some(e => e.type === 'effectApplied'));
});
test('count equality loses after attacks; same-tick kill avoids limit, warnings use80%', () => {
  const state = fixture(); state.enemies = Array.from({ length: 40 }, (_, i) => enemy(100 + i, 1000));
  state.units[0].cooldown = 2;
  const lost = progressed(state); assert.equal(lost.state.outcomeReason, 'accumulation');
  assert.ok(!lost.events.some(e => e.type === 'waveCompleted'));
  assert.equal(observe(lost.state).warning, true);
  state.units[0].cooldown = 0; state.enemies[0].hp = 1;
  const survived = progressed(state); assert.equal(survived.state.phase, 'combat'); assert.equal(survived.state.enemies.length, 39);
  state.enemies.length = 31; assert.equal(observe(state).warning, false);
  state.enemies.push(enemy(200)); assert.equal(observe(state).warning, true);
});
test('future spawns prevent early success; first tick spawns before attacks', () => {
  const state = fixture(); state.enemies = []; state.spawnCursor = 1;
  const empty = progressed(state); assert.equal(empty.state.phase, 'combat');
  assert.equal(empty.state.waveTick, 1);
  state.spawnCursor = 0;
  const spawned = progressed(state);
  assert.equal(spawned.events[0].type, 'enemySpawned');
  assert.equal(spawned.events[1].type, 'attack');
  assert.equal(spawned.state.enemies[0].spawnTick, 1);
});
test('ordinary duration rewards once and stamps completed wave while observation previews upcoming boss', () => {
  const state = fixture(['fixture-01', 'fixture-03', 'fixture-06'], 4); state.tick = 900; state.waveTick = 399;
  state.units.forEach(u => { u.cooldown = 1000; });
  const result = progressed(state, 600);
  assert.equal(result.executedTicks, 1); assert.equal(result.state.wave, 5);
  assert.equal(result.state.waveTick, 400); assert.equal(result.state.tick, 901);
  assert.deepEqual(result.events.map(e => e.type), ['waveCompleted', 'shopRefreshed']);
  assert.ok(result.events.every(e => e.wave === 4 && e.tick === 901 && e.waveTick === 400));
  const observation = observe(result.state);
  assert.equal(observation.segmentRemainingTicks, 600); assert.equal(observation.bossRemainingTicks, 600);
  assert.equal(observation.bossDeadlineWaveTick, 600);
  assert.equal(observation.nextWave!.wave, 5);
  assert.equal(result.state.gold, state.gold + 6);
  assert.equal(advance(result.state, 1).state, result.state);
});
test('boss deadline is per-wave tick600 after attacks, independent of global tick', () => {
  const state = fixture(['fixture-06'], 5); state.tick = 1234; state.waveTick = 598;
  state.enemies = [enemy(100, 1000, 1000, 'boss')]; state.units[0].cooldown = 1000;
  const before = progressed(state); assert.equal(before.state.phase, 'combat');
  const lost = progressed(before.state); assert.equal(lost.state.tick, 1236); assert.equal(lost.state.outcomeReason, 'bossTimeout');
  const kill = copy(before.state); kill.units[0].cooldown = 0; kill.enemies[0].hp = 1;
  kill.enemies.push(enemy(101, 1000, 1000));
  const saved = progressed(kill); assert.equal(saved.state.phase, 'preparation');
  assert.equal(saved.state.enemies.length, 1); assert.equal(saved.state.enemies[0].typeId, 'basic');
});
test('final success gives one reward without refresh; remaining ordinary or boss deadline loses distinctly', () => {
  const state = fixture(['fixture-06'], 20); state.tick = 9999; state.waveTick = 599;
  state.enemies = [enemy(100, 1, 1000, 'boss')];
  const won = progressed(state, 100);
  assert.equal(won.state.outcome, 'win'); assert.equal(won.state.outcomeReason, 'cleared');
  assert.equal(won.state.gold, state.gold + 6);
  assert.ok(!won.events.some(e => e.type === 'shopRefreshed'));
  const observation = observe(won.state);
  assert.equal(observation.segmentRemainingTicks, 0); assert.equal(observation.bossRemainingTicks, null);
  const ordinary = copy(state); ordinary.enemies.push(enemy(101, 1000));
  assert.equal(progressed(ordinary).state.outcomeReason, 'finalTimeout');
  const boss = copy(state); boss.enemies[0].hp = 1000;
  assert.equal(progressed(boss).state.outcomeReason, 'bossTimeout');
});
test('later-tick overflow rolls the entire advance back including spawn IDs, events and RNG', () => {
  const state = fixture(); state.units[0].cooldown = 1000;
  state.tick = Number.MAX_SAFE_INTEGER - 1; state.spawnCursor = 0;
  const before = stateHash(state), result = advance(state, 2);
  assert.equal(result.ok, false); assert.equal(result.state, state);
  if (!result.ok) { assert.equal(result.error.code, 'INTEGER_OVERFLOW'); assert.equal(result.executedTicks, 0); }
  assert.equal(stateHash(state), before); assert.equal(state.acceptedLog.length, 0);
});
test('movement overflow is atomic, and preparation returns the same completely frozen state', () => {
  const state = fixture(); state.units[0].cooldown = 1000;
  state.enemies[0].totalDistance = Number.MAX_SAFE_INTEGER - 20;
  const failed = advance(state, 1); assert.equal(failed.ok, false); assert.equal(failed.state, state);
  if (!failed.ok) assert.equal(failed.error.code, 'INTEGER_OVERFLOW');
  const made = createMatch(2, EXPERIMENT_RULES_ID); assert.ok(made.ok);
  assert.equal(advance(made.state, 1).state, made.state); assert.ok(Object.isFrozen(made.state));
});
test('frozen bench cooldown resumes only after returning to board, never resets on move or swap', () => {
  const state = fixture(); state.waveTick = 399; state.units[0].cooldown = 5;
  state.units.push({ id: 2, definitionId: 'fixture-03', star: 1, cooldown: 9,
    location: { kind: 'bench', slot: 0 } });
  const prepared = progressed(state).state;
  assert.equal(prepared.units[0].cooldown, 4); assert.equal(prepared.units[1].cooldown, 9);
  const swapped = dispatch(prepared, { type: 'swap', aId: 1, bId: 2 }); assert.ok(swapped.ok);
  assert.deepEqual(swapped.state.units.map(u => u.cooldown), [4, 9]);
  const started = dispatch(swapped.state, { type: 'startWave' }); assert.ok(started.ok);
  const next = progressed(started.state);
  assert.deepEqual(next.state.units.map(u => u.cooldown), [4, 8]);
});
// Keep a compile-time promise that fixture units adhere to the public type.
export type FixtureUnit = Unit;

test('four distinct definitions clamp synergy at tier3 instead of indexing beyond the fixture table', () => {
  const state = fixture(['fixture-01', 'fixture-03', 'fixture-06', 'fixture-07',
    'fixture-02', 'fixture-04', 'fixture-05', 'fixture-08']);
  const view = observe(state);
  for (const synergy of view.synergies) {
    assert.equal(synergy.distinctDefinitions.length, 4); assert.equal(synergy.tier, 3);
    assert.equal(synergy.percent, 10); assert.equal(synergy.affectedUnitIds.length, 4);
  }
  assert.equal(view.units.find(u => u.definitionId === 'fixture-02')!.range, 3300);
  assert.ok(view.units.every(u => Number.isSafeInteger(u.damage) && Number.isSafeInteger(u.range)));
});
