import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestTaskGate } from '../../src/web/latest-task.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('latest async presentation result wins even when older work resolves last', async () => {
  const owner = {}; const gate = createLatestTaskGate(() => owner);
  const a = deferred<number>(); const b = deferred<number>(); const values: number[] = [];
  const fail = () => assert.fail('unexpected rejection');
  const first = gate.run(() => a.promise, value => values.push(value), fail);
  const second = gate.run(() => b.promise, value => values.push(value), fail);
  b.resolve(2); assert.equal(await second, true);
  a.resolve(1); assert.equal(await first, false);
  assert.deepEqual(values, [2]);
});

test('older rejection cannot overwrite a newer success', async () => {
  const owner = {}; const gate = createLatestTaskGate(() => owner);
  const old = deferred<number>(); const values: number[] = [];
  const stale = gate.run(() => old.promise, () => assert.fail(), () => assert.fail());
  assert.equal(await gate.run(() => 2, value => values.push(value), () => assert.fail()), true);
  old.reject(new Error('old hash failure')); assert.equal(await stale, false);
  assert.deepEqual(values, [2]);
});

test('changing match ownership alone suppresses a pending result', async () => {
  let owner = {}; const gate = createLatestTaskGate(() => owner);
  const pending = deferred<number>();
  const run = gate.run(() => pending.promise, () => assert.fail(), () => assert.fail());
  owner = {}; pending.resolve(1); assert.equal(await run, false);
});

test('explicit invalidation suppresses work even if an owner is reused', async () => {
  const owner = {}; const gate = createLatestTaskGate(() => owner);
  const pending = deferred<number>();
  const run = gate.run(() => pending.promise, () => assert.fail(), () => assert.fail());
  gate.invalidate(); pending.resolve(1); assert.equal(await run, false);
  const values: number[] = [];
  assert.equal(await gate.run(() => 2, value => values.push(value), () => assert.fail()), true);
  assert.deepEqual(values, [2]);
});

test('disposal suppresses both pending callbacks and future computation', async () => {
  const owner = {}; const gate = createLatestTaskGate(() => owner);
  const pending = deferred<number>();
  const run = gate.run(() => pending.promise, () => assert.fail(), () => assert.fail());
  gate.dispose(); pending.reject(new Error('after disposal'));
  assert.equal(await run, false);
  assert.equal(await gate.run(() => assert.fail(), () => assert.fail(), () => assert.fail()), false);
});

test('current synchronous work failure is reported once', async () => {
  const owner = {}; const gate = createLatestTaskGate(() => owner);
  const error = new Error('compute failed'); const errors: unknown[] = [];
  assert.equal(await gate.run(() => { throw error; }, () => assert.fail(), e => errors.push(e)), true);
  assert.deepEqual(errors, [error]);
});

test('consumer failure is not misreported as a computation rejection', async () => {
  const owner = {}; const gate = createLatestTaskGate(() => owner);
  const error = new Error('render failed');
  await assert.rejects(gate.run(() => 1, () => { throw error; }, () => assert.fail()), error);
});
