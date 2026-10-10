/** Static contract examples. These do NOT execute or test a purchase planner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { PlanRef, PlannedUnit, RecruitPreview } from '../../src/core-v2/types.ts';

const old = (unitId: number): PlanRef => ({ kind: 'existing', unitId });
const made = (creationIndex: number): PlanRef => ({ kind: 'created', creationIndex });
const first: PlannedUnit = { ref: made(1), definitionId: 'fixture-01', star: 2,
  location: { kind: 'board', col: 3, row: 3 }, cooldown: 6 };
const final: PlannedUnit = { ref: made(2), definitionId: 'fixture-01', star: 3,
  location: { kind: 'board', col: 0, row: 1 }, cooldown: 8 };
const survivors: PlannedUnit[] = Array.from({ length: 7 }, (_, i) => ({
  ref: old(20 + i), definitionId: `fixture-${String(i + 2).padStart(2, '0')}`, star: 1,
  location: { kind: 'bench', slot: i < 2 ? i : i + 1 }, cooldown: 0,
}));
/** Given bench full, star1 board IDs7/11 and star2 board3/bench9 as documented. */
const chainedPreview: RecruitPreview = {
  ok: true, offerSlot: 0, price: 2, goldAfter: 10,
  arrival: { ref: { kind: 'created', creationIndex: 0 }, definitionId: 'fixture-01',
    star: 1, cooldown: 0, location: null },
  upgrades: [{ consumed: [old(7), old(11), made(0)], result: first },
    { consumed: [old(3), old(9), made(1)], result: final }],
  result: final, finalUnits: [...survivors, final], boardCountAfter: 1, benchCountAfter: 7,
};
function key(ref: PlanRef): string {
  return ref.kind === 'existing' ? `existing:${ref.unitId}` : `created:${ref.creationIndex}`;
}
test('static full-bench chain example preserves oldest board material then relocates again', () => {
  assert.ok(chainedPreview.ok);
  assert.equal(chainedPreview.arrival.location, null);
  assert.deepEqual(chainedPreview.upgrades.map(s => s.result.location), [
    { kind: 'board', col: 3, row: 3 }, { kind: 'board', col: 0, row: 1 },
  ]);
  assert.deepEqual(chainedPreview.upgrades.map(s => s.result.cooldown), [6, 8]);
  assert.equal(chainedPreview.finalUnits.length, 8);
  assert.deepEqual(chainedPreview.finalUnits.at(-1), chainedPreview.result);
  assert.equal(chainedPreview.finalUnits.filter(u => u.location.kind === 'board').length, 1);
  assert.equal(chainedPreview.finalUnits.filter(u => u.location.kind === 'bench').length, 7);
});
test('static preview refs contain only public existing IDs and local acyclic creation symbols', () => {
  assert.ok(chainedPreview.ok);
  const publicIds = [3, 7, 9, 11, ...survivors.map(u => u.ref.kind === 'existing' ? u.ref.unitId : 0)];
  const live = new Set(publicIds.map(id => key(old(id)))); live.add(key(made(0)));
  const order = (a: PlanRef, b: PlanRef) => a.kind === 'existing'
    ? b.kind === 'existing' ? a.unitId - b.unitId : -1
    : b.kind === 'existing' ? 1 : a.creationIndex - b.creationIndex;
  for (const [i, step] of chainedPreview.upgrades.entries()) {
    assert.deepEqual([...step.consumed].sort(order), step.consumed);
    assert.equal(new Set(step.consumed.map(key)).size, 3);
    for (const ref of step.consumed) { assert.ok(live.has(key(ref))); live.delete(key(ref)); }
    assert.deepEqual(step.result.ref, made(i + 1)); assert.ok(!live.has(key(step.result.ref)));
    live.add(key(step.result.ref));
  }
  assert.deepEqual([...chainedPreview.finalUnits].sort((a, b) => order(a.ref, b.ref)), chainedPreview.finalUnits);
  assert.deepEqual(new Set(chainedPreview.finalUnits.map(u => key(u.ref))), live);
  const text = JSON.stringify(chainedPreview);
  for (const secret of ['nextEntityId', 'rngState', 'seed', 'acceptedLog']) assert.ok(!text.includes(secret));
  const inspect = (value: unknown): void => {
    if (value !== null && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      if (object.kind === 'created') assert.deepEqual(Object.keys(object).sort(), ['creationIndex', 'kind']);
      if (object.kind === 'existing') assert.ok(publicIds.includes(object.unitId as number));
      Object.values(object).forEach(inspect);
    }
  }; inspect(chainedPreview);
});
