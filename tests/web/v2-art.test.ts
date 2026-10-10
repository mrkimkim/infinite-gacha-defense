import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateArtManifest, createArtLibrary, createSpritePlayer, spriteLayout } from '../../src/web/v2-art.ts';

// Metadata/decoder fixtures only. No production art or approval is represented here.
function fixture() {
  return { version: 1, sprites: [{ id: 'test-only', src: 'assets/mvp/test-only.png',
    status: 'synthetic-test', approvalRef: null as string | null, width: 96, height: 32,
    pivot: { x: 16, y: 30 }, frames: [0, 32, 64].map(x => ({ x, y: 0, width: 32, height: 32 })),
    clips: { idle: { frames: [0, 2], durations: [3, 2] },
      attack: { frames: [1], durations: [2] }, recovery: { frames: [2], durations: [3] } } }] };
}
const sprite = () => validateArtManifest(fixture()).sprites[0];

test('manifest is an immutable copy and empty production manifest is valid', () => {
  const source = fixture(), parsed = validateArtManifest(source);
  source.sprites[0].clips.idle.frames[0] = 2;
  assert.equal(parsed.sprites[0].clips.idle.frames[0], 0);
  assert.ok(Object.isFrozen(parsed.sprites[0].clips.idle.frames));
  assert.deepEqual(validateArtManifest({ version: 1, sprites: [] }).sprites, []);
});
test('manifest rejects unsafe paths, incorrect dimensions, clips, pivots and extra fields before I/O', () => {
  const changes = [
    (m: ReturnType<typeof fixture>) => { m.sprites[0].src = 'https://example.com/a.png'; },
    (m: ReturnType<typeof fixture>) => { m.sprites[0].src = 'assets/mvp/../a.png'; },
    (m: ReturnType<typeof fixture>) => { m.sprites[0].src = 'assets/mvp/%2e%2e/a.png'; },
    (m: ReturnType<typeof fixture>) => { m.sprites[0].frames[2].width = 33; },
    (m: ReturnType<typeof fixture>) => { m.sprites[0].pivot.y = 33; },
    (m: ReturnType<typeof fixture>) => { m.sprites[0].clips.attack.durations[0] = 0; },
    (m: ReturnType<typeof fixture>) => { m.sprites[0].clips.attack.frames[0] = 3; },
    (m: ReturnType<typeof fixture>) => { m.sprites[0].clips.recovery.frames = []; },
    (m: ReturnType<typeof fixture>) => { m.sprites[0].width = Infinity; },
    (m: ReturnType<typeof fixture>) => { m.sprites[0].height = 1.5; },
    (m: ReturnType<typeof fixture>) => { m.sprites.push(m.sprites[0]); },
    (m: ReturnType<typeof fixture>) => { Object.assign(m.sprites[0], { extra: 1 }); },
    (m: ReturnType<typeof fixture>) => { delete (m.sprites[0].clips.idle.frames as unknown[])[0]; },
    (m: ReturnType<typeof fixture>) => { m.sprites[0].status = 'production'; },
  ];
  for (const mutate of changes) { const m = fixture(); mutate(m); assert.throws(() => createArtLibrary(m)); }
});
test('one image cannot advertise conflicting atlas dimensions', () => {
  const m = fixture(); m.sprites.push({ ...m.sprites[0], id: 'other', width: 128 });
  assert.throws(() => validateArtManifest(m), /ART_SOURCE_DIMENSIONS/);
});
test('missing and unapproved sprites retain role fallback without requesting bytes', async () => {
  let calls = 0;
  const lib = createArtLibrary(fixture(), { loader: async () => { calls++; return { width: 96, height: 32 }; } });
  assert.deepEqual(await lib.resolve('unknown'), { ok: false, reason: 'missing', fallback: 'role-icon' });
  assert.equal((await lib.resolve('test-only')).ok, false);
  assert.equal(calls, 0);
});
test('concurrent resolutions share one decoder request and preserve synthetic status', async () => {
  let calls = 0;
  const lib = createArtLibrary(fixture(), { allow: ['synthetic-test'], loader: async () => {
    calls++; return { width: 96, height: 32 };
  } });
  const results = await Promise.all([lib.resolve('test-only'), lib.resolve('test-only')]);
  assert.equal(calls, 1);
  for (const r of results) { assert.ok(r.ok); assert.equal(r.sprite.status, 'synthetic-test'); }
});
test('candidate permission cannot be changed through a mutable options array', async () => {
  const allow: ('production' | 'synthetic-test')[] = ['production'];
  const lib = createArtLibrary(fixture(), { allow }); allow.push('synthetic-test');
  assert.equal((await lib.resolve('test-only')).ok, false);
});
test('decoder rejection, synchronous exception and wrong dimensions become cached fallbacks', async () => {
  for (const decoder of [() => Promise.reject(new Error('404')), () => { throw new Error('decode'); },
    async () => ({ width: 32, height: 96 })]) {
    let calls = 0;
    const lib = createArtLibrary(fixture(), { allow: ['synthetic-test'], loader: () => { calls++; return decoder(); } });
    assert.deepEqual(await lib.resolve('test-only'), { ok: false, reason: 'load-failed', fallback: 'role-icon' });
    assert.equal((await lib.resolve('test-only')).ok, false); assert.equal(calls, 1);
  }
});
test('dispose makes in-flight load completions inert', async () => {
  let complete!: (size: { width: number; height: number }) => void;
  const lib = createArtLibrary(fixture(), { allow: ['synthetic-test'], loader: () => new Promise(resolve => { complete = resolve; }) });
  const pending = lib.resolve('test-only'); await Promise.resolve(); lib.dispose();
  complete({ width: 96, height: 32 });
  assert.deepEqual(await pending, { ok: false, reason: 'disposed', fallback: 'role-icon' });
  assert.equal((await lib.resolve('test-only')).ok, false);
});
test('tick boundaries select idle, attack, recovery and return to idle', () => {
  const p = createSpritePlayer(sprite()), owner = {}; p.reset(owner);
  const at = (tick: number, attackTick?: number) => p.sample({ generation: 1, owner, tick, paused: false, attackTick });
  assert.equal(at(0)?.frame, 0); assert.equal(at(3)?.frame, 2);
  assert.equal(at(5, 5)?.clip, 'attack'); assert.equal(at(6)?.clip, 'attack');
  assert.equal(at(7)?.clip, 'recovery'); assert.equal(at(9)?.clip, 'recovery');
  assert.equal(at(10)?.clip, 'idle'); assert.equal(at(10)?.frame, 0);
});
test('batched ticks age attack feedback from event tick, not render arrival', () => {
  const owner = {}, a = createSpritePlayer(sprite()), b = createSpritePlayer(sprite());
  a.reset(owner); b.reset(owner);
  a.sample({ generation: 1, owner, tick: 1, paused: false, attackTick: 1 });
  const incremental = a.sample({ generation: 1, owner, tick: 4, paused: false });
  const batched = b.sample({ generation: 1, owner, tick: 4, paused: false, attackTick: 1 });
  assert.deepEqual(incremental, batched); assert.equal(batched?.clip, 'recovery');
});
test('paused samples freeze; resume does not catch up elapsed paused ticks', () => {
  const p = createSpritePlayer(sprite()), owner = {}; p.reset(owner);
  const pose = p.sample({ generation: 1, owner, tick: 1, paused: false, attackTick: 1 });
  assert.deepEqual(p.sample({ generation: 1, owner, tick: 1, paused: true }), pose);
  assert.deepEqual(p.sample({ generation: 1, owner, tick: 100, paused: true }), pose);
  assert.equal(p.sample({ generation: 1, owner, tick: 101, paused: false })?.clip, 'attack');
  assert.equal(p.sample({ generation: 1, owner, tick: 102, paused: false })?.clip, 'recovery');
});
test('duplicate attack notifications do not restart a clip; a newer attack does', () => {
  const p = createSpritePlayer(sprite()), owner = {}; p.reset(owner);
  p.sample({ generation: 1, owner, tick: 1, paused: false, attackTick: 1 });
  assert.equal(p.sample({ generation: 1, owner, tick: 3, paused: false, attackTick: 1 })?.clip, 'recovery');
  assert.equal(p.sample({ generation: 1, owner, tick: 3, paused: false, attackTick: 3 })?.clip, 'attack');
});
test('restart discards old attack and stale owner/tick callbacks', () => {
  const p = createSpritePlayer(sprite()), first = {}, second = {}; p.reset(first);
  p.sample({ generation: 1, owner: first, tick: 10, paused: false, attackTick: 10 }); p.reset(second);
  assert.equal(p.sample({ generation: 1, owner: first, tick: 20, paused: false, attackTick: 20 }), null);
  assert.equal(p.sample({ generation: 2, owner: second, tick: 0, paused: false })?.clip, 'idle');
  p.sample({ generation: 2, owner: second, tick: 2, paused: false });
  assert.equal(p.sample({ generation: 2, owner: second, tick: 1, paused: false }), null);
});
test('sprite layout preserves aspect ratio and aligns frame-local foot pivot', () => {
  const s = sprite(), l = spriteLayout(s, 1, { width: 40, height: 50 }, { x: 20, y: 45 });
  assert.equal(l.width, 40); assert.equal(l.height, 40);
  assert.equal(l.left + s.pivot.x * 1.25, 20);
  assert.equal(l.top + s.pivot.y * 1.25, 45);
  assert.equal(l.backgroundPosition, '-40px 0px'); assert.equal(l.backgroundSize, '120px 40px');
  assert.throws(() => spriteLayout(s, 3, { width: 40, height: 50 }, { x: 0, y: 0 }));
  assert.throws(() => spriteLayout(s, 0, { width: 0, height: 50 }, { x: 0, y: 0 }));
});

test('native image adapter resolves load dimensions and clears handlers', async () => {
  const { loadArtImage } = await import('../../src/web/v2-art.ts');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  let instance!: FakeImage;
  class FakeImage {
    naturalWidth = 96; naturalHeight = 32; onload: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor() { instance = this; }
    set src(_value: string) { /* explicitly driven browser transport substitute */ }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: FakeImage });
  try {
    const loaded = loadArtImage('assets/mvp/test-only.png'); instance.onload!();
    assert.deepEqual(await loaded, { width: 96, height: 32 });
    assert.equal(instance.onload, null); assert.equal(instance.onerror, null);
    const failed = loadArtImage('assets/mvp/test-only.png'); instance.onerror!();
    await assert.rejects(failed, /ART_LOAD/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'Image', previous); else Reflect.deleteProperty(globalThis, 'Image');
  }
});

test('explicit retry recovers a failed cached image and coalesces concurrent retries', async () => {
  let calls = 0;
  const library = createArtLibrary(fixture(), { allow: ['synthetic-test'], loader: async () => {
    if (++calls === 1) throw new Error('transient');
    return { width: 96, height: 32 };
  } });
  assert.equal((await library.resolve('test-only')).ok, false);
  assert.equal((await library.resolve('test-only')).ok, false); assert.equal(calls, 1);
  const results = await Promise.all([library.resolve('test-only', { retryFailed: true }), library.resolve('test-only', { retryFailed: true })]);
  assert.ok(results.every(r => r.ok)); assert.equal(calls, 2);
  await library.resolve('test-only', { retryFailed: true }); assert.equal(calls, 2);
});
test('attack received during pause preserves pose and starts once on resume', () => {
  const p = createSpritePlayer(sprite()), owner = {}; p.reset(owner);
  const before = p.sample({ generation: 1, owner, tick: 1, paused: false });
  assert.deepEqual(p.sample({ generation: 1, owner, tick: 1, paused: true, attackTick: 1 }), before);
  assert.deepEqual(p.sample({ generation: 1, owner, tick: 10, paused: true }), before);
  assert.equal(p.sample({ generation: 1, owner, tick: 10, paused: false })?.clip, 'attack');
  assert.equal(p.sample({ generation: 1, owner, tick: 12, paused: false, attackTick: 1 })?.clip, 'recovery');
  p.reset({}); assert.equal(p.sample({ generation: 1, owner, tick: 13, paused: false }), null);
});

test('reset generation rejects callbacks even when the same owner object is reused', () => {
  const owner = {}, p = createSpritePlayer(sprite());
  const oldGeneration = p.reset(owner);
  const currentGeneration = p.reset(owner);
  assert.notEqual(currentGeneration, oldGeneration);
  assert.equal(p.sample({ owner, generation: oldGeneration, tick: 8, paused: false, attackTick: 8 }), null);
  assert.equal(p.sample({ owner, generation: currentGeneration, tick: 0, paused: false })?.clip, 'idle');
});
