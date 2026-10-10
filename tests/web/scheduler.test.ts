import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createScheduler } from '../../src/web/scheduler.ts';
import type { FrameCallback, SchedulerPhase } from '../../src/web/scheduler.ts';

/** Deliberately retains canceled callbacks so stale invocation is testable. */
class FakeRAF {
  nextId = 0;
  queued = new Map<number, FrameCallback>();
  all = new Map<number, FrameCallback>();
  canceled: number[] = [];
  request = (callback: FrameCallback): number => {
    const id = this.nextId++;
    this.queued.set(id, callback);
    this.all.set(id, callback);
    return id;
  };
  cancel = (id: number): void => {
    this.canceled.push(id);
    this.queued.delete(id);
  };
  invoke(id: number, timestamp: number): void {
    const callback = this.all.get(id);
    assert.ok(callback, `callback ${id} exists`);
    this.queued.delete(id);
    callback(timestamp);
  }
  frame(timestamp: number): number {
    assert.equal(this.queued.size, 1, 'exactly one live callback');
    const id = this.queued.keys().next().value;
    assert.notEqual(id, undefined);
    this.invoke(id!, timestamp);
    return id!;
  }
}

interface Match { phase: SchedulerPhase; ticks: number }
function harness(initialPhase: SchedulerPhase = 'combat', initiallyHidden = false) {
  const raf = new FakeRAF();
  let match: Match = { phase: initialPhase, ticks: 0 };
  const advances: { match: Match; count: number }[] = [];
  let onAdvance: (() => void) | undefined;
  const scheduler = createScheduler({
    tickMs: 50,
    getMatch: () => match,
    getPhase: (state) => state.phase,
    advance: (state, count) => {
      advances.push({ match: state, count });
      state.ticks += count;
      onAdvance?.();
    },
    requestFrame: raf.request,
    cancelFrame: raf.cancel,
    initiallyHidden,
  });
  return { raf, scheduler, advances, get match() { return match; },
    replace(phase: SchedulerPhase = 'combat') { match = { phase, ticks: 0 }; },
    onAdvance(callback: () => void) { onAdvance = callback; } };
}

test('first frame has zero ticks; 50ms fixed steps retain fractional carry', () => {
  const h = harness();
  h.raf.frame(1_000);
  h.raf.frame(1_049);
  assert.equal(h.match.ticks, 0);
  h.raf.frame(1_050);
  h.raf.frame(1_175);
  assert.deepEqual(h.advances.map((x) => x.count), [1, 2]);
  assert.equal(h.scheduler.getStatus().accumulator, 25);
  h.raf.frame(1_200);
  assert.equal(h.match.ticks, 4);
  assert.equal(h.scheduler.getStatus().accumulator, 0);
});

test('exactly 250ms is accepted with carry; zero delta does not advance', () => {
  const h = harness();
  h.raf.frame(0);
  h.raf.frame(25);
  h.raf.frame(275);
  assert.deepEqual(h.advances.map((x) => x.count), [5]);
  assert.equal(h.scheduler.getStatus().accumulator, 25);
  h.raf.frame(275);
  assert.equal(h.match.ticks, 5);
  h.raf.frame(300);
  assert.equal(h.match.ticks, 6);
});

for (const dt of [-1, 251, 10_000]) {
  test(`invalid delta ${dt} discards carry and anchors new timestamp`, () => {
    const h = harness();
    h.raf.frame(100);
    h.raf.frame(149);
    h.raf.frame(149 + dt);
    assert.equal(h.match.ticks, 0);
    assert.equal(h.scheduler.getStatus().accumulator, 0);
    h.raf.frame(198 + dt);
    assert.equal(h.match.ticks, 0);
    h.raf.frame(199 + dt);
    assert.equal(h.match.ticks, 1);
  });
}

for (const timestamp of [NaN, Infinity, -Infinity]) {
  test(`non-finite timestamp ${timestamp} cannot poison future frames`, () => {
    const h = harness();
    h.raf.frame(0);
    h.raf.frame(49);
    h.raf.frame(timestamp);
    assert.equal(h.scheduler.getStatus().accumulator, 0);
    assert.equal(h.scheduler.getStatus().lastTimestamp, null);
    h.raf.frame(10_000);
    assert.equal(h.match.ticks, 0);
    h.raf.frame(10_050);
    assert.equal(h.match.ticks, 1);
  });
}

test('manual pause cancels handle zero; canceled callback remains inert', () => {
  const h = harness();
  h.scheduler.setPaused(true);
  assert.deepEqual(h.raf.canceled, [0]);
  h.raf.invoke(0, 5_000);
  assert.equal(h.raf.queued.size, 0);
  assert.equal(h.match.ticks, 0);
  assert.equal(h.scheduler.getStatus().lastTimestamp, null);
  h.scheduler.setPaused(false);
  h.raf.frame(10_000);
  assert.equal(h.match.ticks, 0);
  h.raf.frame(10_050);
  assert.equal(h.match.ticks, 1);
});

test('pause/resume clears carry and old epoch cannot steal the live callback', () => {
  const h = harness();
  h.raf.frame(0);
  h.raf.frame(49);
  const oldId = h.raf.nextId - 1;
  const epoch = h.scheduler.getStatus().epoch;
  h.scheduler.setPaused(true);
  h.scheduler.setPaused(false);
  assert.equal(h.scheduler.getStatus().epoch, epoch + 2);
  h.raf.invoke(oldId, 10_000);
  assert.equal(h.raf.queued.size, 1);
  h.raf.frame(20_000);
  h.raf.frame(20_001);
  assert.equal(h.match.ticks, 0);
  h.raf.frame(20_050);
  assert.equal(h.match.ticks, 1);
});

test('repeated pause/resume and sync are idempotent and never create parallel loops', () => {
  const h = harness();
  for (let i = 0; i < 10; i += 1) {
    h.scheduler.sync();
    h.scheduler.setPaused(false);
    assert.equal(h.raf.queued.size, 1);
    h.raf.frame(i * 1_000);
    h.raf.frame(i * 1_000 + 49);
    h.scheduler.setPaused(true);
    const epoch = h.scheduler.getStatus().epoch;
    h.scheduler.setPaused(true);
    h.scheduler.sync();
    assert.equal(h.scheduler.getStatus().epoch, epoch);
    assert.equal(h.raf.queued.size, 0);
    h.scheduler.setPaused(false);
  }
  assert.equal(h.match.ticks, 0);
  assert.equal(h.raf.queued.size, 1);
});

test('hidden pauses independently: visibility cannot undo manual pause', () => {
  const h = harness();
  h.raf.frame(0);
  h.raf.frame(49);
  h.scheduler.setPaused(true);
  h.scheduler.setHidden(true);
  h.scheduler.setHidden(false);
  assert.equal(h.scheduler.getStatus().paused, true);
  assert.equal(h.raf.queued.size, 0);
  h.scheduler.setPaused(false);
  h.raf.frame(10_000);
  h.raf.frame(10_049);
  assert.equal(h.match.ticks, 0);
  h.raf.frame(10_050);
  assert.equal(h.match.ticks, 1);
});

test('manual resume while hidden does not run; visibility resume starts with zero ticks', () => {
  const h = harness('combat', true);
  assert.equal(h.raf.queued.size, 0);
  h.scheduler.setPaused(true);
  h.scheduler.setPaused(false);
  h.scheduler.setHidden(true);
  assert.equal(h.raf.queued.size, 0);
  h.scheduler.setHidden(false);
  h.raf.frame(9_000);
  assert.equal(h.match.ticks, 0);
  h.raf.frame(9_050);
  assert.equal(h.match.ticks, 1);
});

for (const phase of ['preparation', 'result'] as const) {
  test(`${phase} never schedules ticks and starting combat anchors first frame`, () => {
    const h = harness(phase);
    h.scheduler.sync();
    assert.equal(h.raf.queued.size, 0);
    h.match.phase = 'combat';
    h.scheduler.sync();
    h.raf.frame(5_000);
    assert.equal(h.match.ticks, 0);
    h.raf.frame(5_050);
    assert.equal(h.match.ticks, 1);
  });

  test(`advance transition to ${phase} discards carry and stops immediately`, () => {
    const h = harness();
    h.onAdvance(() => { h.match.phase = phase; });
    h.raf.frame(0);
    const fired = h.raf.frame(249);
    assert.equal(h.advances.length, 1);
    assert.equal(h.advances[0]?.count, 4);
    assert.equal(h.scheduler.getStatus().phase, phase);
    assert.equal(h.scheduler.getStatus().accumulator, 0);
    assert.equal(h.scheduler.getStatus().lastTimestamp, null);
    assert.equal(h.raf.queued.size, 0);
    h.raf.invoke(fired, 299);
    assert.equal(h.advances.length, 1);
    h.match.phase = 'combat';
    h.scheduler.sync();
    h.raf.frame(10_000);
    h.raf.frame(10_001);
    assert.equal(h.advances.length, 1);
  });

  test(`external ${phase} transition without sync is caught before advance`, () => {
    const h = harness();
    h.raf.frame(0);
    h.match.phase = phase;
    h.raf.frame(50);
    assert.equal(h.match.ticks, 0);
    assert.equal(h.raf.queued.size, 0);
    assert.equal(h.scheduler.getStatus().phase, phase);
  });
}

test('match replacement clears carry and canceled old-match callbacks cannot affect new match', () => {
  const h = harness();
  h.raf.frame(0);
  h.raf.frame(49);
  const old = h.match;
  const oldId = h.raf.nextId - 1;
  h.replace();
  h.scheduler.sync();
  h.raf.invoke(oldId, 100_000);
  assert.equal(old.ticks, 0);
  assert.equal(h.match.ticks, 0);
  assert.equal(h.raf.queued.size, 1);
  h.raf.frame(200_000);
  h.raf.frame(200_001);
  assert.equal(h.match.ticks, 0);
  h.raf.frame(200_050);
  assert.equal(h.match.ticks, 1);
  assert.equal(h.advances[0]?.match, h.match);
});

test('replacement without sync is detected by captured match identity before any tick', () => {
  const h = harness();
  h.raf.frame(0);
  const old = h.match;
  h.replace();
  h.raf.frame(50);
  assert.equal(old.ticks, 0);
  assert.equal(h.match.ticks, 0);
  h.raf.frame(100);
  assert.equal(h.match.ticks, 0);
  h.raf.frame(150);
  assert.equal(h.match.ticks, 1);
});

test('new preparation match from result stays idle until an explicit phase transition', () => {
  const h = harness('result');
  h.replace('preparation');
  h.scheduler.sync();
  assert.equal(h.raf.queued.size, 0);
  assert.equal(h.scheduler.getStatus().lastTimestamp, null);
  h.match.phase = 'combat';
  h.scheduler.sync();
  h.raf.frame(1_000);
  assert.equal(h.match.ticks, 0);
});

test('same-epoch duplicate invocation cannot add time or erase another request', () => {
  const h = harness();
  const oldId = h.raf.frame(0);
  h.raf.invoke(oldId, 100);
  assert.equal(h.match.ticks, 0);
  assert.equal(h.scheduler.getStatus().lastTimestamp, 0);
  assert.equal(h.raf.queued.size, 1);
  h.raf.frame(50);
  assert.equal(h.match.ticks, 1);
});

test('dispose is terminal and canceled callbacks cannot advance or reschedule', () => {
  const h = harness();
  h.raf.frame(0);
  const oldId = h.raf.nextId - 1;
  h.scheduler.dispose();
  const epoch = h.scheduler.getStatus().epoch;
  h.scheduler.dispose();
  h.scheduler.setPaused(true);
  h.scheduler.setHidden(true);
  h.scheduler.sync();
  h.raf.invoke(oldId, 50);
  assert.equal(h.scheduler.getStatus().epoch, epoch);
  assert.equal(h.scheduler.getStatus().disposed, true);
  assert.equal(h.scheduler.getStatus().running, false);
  assert.equal(h.match.ticks, 0);
  assert.equal(h.raf.queued.size, 0);
});

test('immutable inner state replacement preserves stable game identity and time carry', () => {
  const raf = new FakeRAF();
  const game = { state: { phase: 'combat' as SchedulerPhase, ticks: 0 } };
  const scheduler = createScheduler({
    tickMs: 50,
    getMatch: () => game,
    getPhase: (match) => match.state.phase,
    advance: (match, count) => {
      match.state = { ...match.state, ticks: match.state.ticks + count };
    },
    requestFrame: raf.request,
    cancelFrame: raf.cancel,
  });
  const original = game.state;
  raf.frame(0);
  raf.frame(75);
  assert.notEqual(game.state, original);
  assert.equal(game.state.ticks, 1);
  assert.equal(scheduler.getStatus().epoch, 0);
  assert.equal(scheduler.getStatus().accumulator, 25);
  scheduler.sync();
  raf.frame(100);
  assert.equal(game.state.ticks, 2);
  assert.equal(scheduler.getStatus().epoch, 0);
  game.state = { ...game.state, phase: 'preparation' };
  scheduler.sync();
  assert.equal(scheduler.getStatus().epoch, 1);
  assert.equal(raf.queued.size, 0);
});

test('advance exceptions propagate, dispose the loop, and cannot restart on sync', () => {
  const h = harness();
  const error = new Error('core advance failed');
  h.onAdvance(() => { throw error; });
  h.raf.frame(0);
  const id = h.raf.nextId - 1;
  assert.throws(() => h.raf.frame(50), (thrown) => thrown === error);
  assert.equal(h.scheduler.getStatus().disposed, true);
  assert.equal(h.scheduler.getStatus().accumulator, 0);
  assert.equal(h.scheduler.getStatus().lastTimestamp, null);
  assert.equal(h.raf.queued.size, 0);
  h.scheduler.sync();
  h.scheduler.setPaused(false);
  h.raf.invoke(id, 100);
  assert.equal(h.advances.length, 1);
  assert.equal(h.raf.queued.size, 0);
});

test('hidden boundary cancels old callback and reopening does not catch up hidden time', () => {
  const h = harness();
  h.raf.frame(0);
  h.raf.frame(49);
  const oldId = h.raf.nextId - 1;
  h.scheduler.setHidden(true);
  h.raf.invoke(oldId, 20_000);
  assert.equal(h.match.ticks, 0);
  assert.equal(h.raf.queued.size, 0);
  h.scheduler.setHidden(false);
  h.raf.invoke(oldId, 30_000);
  assert.equal(h.scheduler.getStatus().lastTimestamp, null);
  assert.equal(h.raf.queued.size, 1);
  h.raf.frame(40_000);
  h.raf.frame(40_049);
  assert.equal(h.match.ticks, 0);
  h.raf.frame(40_050);
  assert.equal(h.match.ticks, 1);
});

test('replacement preserves both pause controls until each is explicitly released', () => {
  const h = harness();
  h.scheduler.setPaused(true);
  h.scheduler.setHidden(true);
  h.replace();
  h.scheduler.sync();
  assert.equal(h.scheduler.getStatus().paused, true);
  assert.equal(h.scheduler.getStatus().hidden, true);
  assert.equal(h.raf.queued.size, 0);
  h.scheduler.setPaused(false);
  assert.equal(h.raf.queued.size, 0);
  h.scheduler.setHidden(false);
  h.raf.frame(10_000);
  assert.equal(h.match.ticks, 0);
  h.raf.frame(10_050);
  assert.equal(h.match.ticks, 1);
});

test('fixed tick duration comes from supplied core rules rather than adapter defaults', () => {
  const raf = new FakeRAF();
  const match: Match = { phase: 'combat', ticks: 0 };
  const scheduler = createScheduler({
    tickMs: 40,
    getMatch: () => match,
    getPhase: (state) => state.phase,
    advance: (state, count) => { state.ticks += count; },
    requestFrame: raf.request,
    cancelFrame: raf.cancel,
  });
  raf.frame(0);
  raf.frame(39);
  assert.equal(match.ticks, 0);
  raf.frame(40);
  assert.equal(match.ticks, 1);
  raf.frame(290);
  assert.equal(match.ticks, 7);
  assert.equal(scheduler.getStatus().accumulator, 10);
  raf.frame(541);
  assert.equal(match.ticks, 7);
  assert.equal(scheduler.getStatus().accumulator, 0);
});

for (const tickMs of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  test(`invalid tick duration ${tickMs} is rejected before scheduling`, () => {
    const raf = new FakeRAF();
    const match: Match = { phase: 'combat', ticks: 0 };
    assert.throws(() => createScheduler({
      tickMs,
      getMatch: () => match,
      getPhase: (state) => state.phase,
      advance: () => { assert.fail('invalid scheduler must not advance'); },
      requestFrame: raf.request,
      cancelFrame: raf.cancel,
    }), RangeError);
    assert.equal(raf.queued.size, 0);
  });
}
