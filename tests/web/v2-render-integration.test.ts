import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as core from '../../src/core-v2/index.ts';
import type { CombatEvent, Observation, ObservedUnit } from '../../src/core-v2/index.ts';
import { createArtLibrary } from '../../src/web/v2-art.ts';
import type { ArtLoader } from '../../src/web/v2-art.ts';
import { createV2Renderer } from '../../src/web/v2-view.ts';
import { waveGuidance } from '../../src/web/v2-wave-guidance.ts';
import { shellSink } from './v2-render-harness.ts';
import type { ElementSink } from './v2-render-harness.ts';

const created = core.createMatch(1, core.EXPERIMENT_RULES_ID);
assert.ok(created.ok);
const fresh = core.observe(created.state);
const unit: ObservedUnit = { id: 5, definitionId: 'fixture-01', rarityId: 'common', star: 1,
  location: { kind: 'board', row: 0, col: 0 }, cooldown: 0, damage: 10, bossDamage: 10,
  range: 2345, nextAttackCooldown: 9, supportActive: false, supportSourceIds: [], sellGold: 1 };
// Explicit observation/decoder fixtures, not reachable gameplay, production art,
// actual approvals, browser rendering, or a fixture-to-IP adoption decision.
function observation(tick = 0, overrides: Partial<Observation> = {}): Observation {
  return { ...fresh, phase: 'combat', tick, units: [unit], boardCount: 1,
    offers: fresh.offers.map(offer => ({ ...offer, definitionId: null })), ...overrides };
}
function manifest() {
  return { version: 1, sprites: [{ id: 'render-test', src: 'assets/mvp/render-test.png',
    status: 'synthetic-test', approvalRef: null as string | null, width: 96, height: 32,
    pivot: { x: 16, y: 30 }, frames: [0, 32, 64].map(x => ({ x, y: 0, width: 32, height: 32 })),
    clips: { idle: { frames: [0, 2], durations: [3, 2] },
      attack: { frames: [1], durations: [2] }, recovery: { frames: [2], durations: [3] } } }] };
}
function library(loader: ArtLoader = async () => ({ width: 96, height: 32 })) {
  return createArtLibrary(manifest(), { allow: ['synthetic-test'], loader });
}
const mapping = { 'fixture-01': 'render-test' };
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
function attack(tick: number): CombatEvent {
  return { type: 'attack', tick, wave: 1, waveTick: tick, unitId: unit.id, targetId: 99,
    sourcePosition: { x: 500, y: 500 }, center: { x: 0, y: 0 },
    hits: [{ enemyId: 99, damage: 10, position: { x: 0, y: 0 } }] };
}
function svgAttacks(node: ElementSink): ElementSink[] {
  return [...(node.getAttribute('data-effect') === 'attack' ? [node] : []), ...node.children.flatMap(svgAttacks)];
}

test('preparation-to-combat SVG hit matches combat control and retains its original event age', () => {
  for (const phase of ['preparation', 'combat'] as const) {
    const { shell, elements } = shellSink(), renderer = createV2Renderer(shell, core);
    const event = attack(1), before = JSON.stringify(event);
    renderer.render(observation(0, { phase }));
    renderer.consume([event]);
    assert.equal(svgAttacks(elements.enemyLayer).length, 0, 'consume waits for its matching observation before drawing');
    renderer.render(observation(4));
    const groups = svgAttacks(elements.enemyLayer);
    assert.equal(groups.length, 1, phase);
    assert.equal(groups[0].getAttribute('data-tick'), '1');
    assert.equal(groups[0].getAttribute('opacity'), '0.75', 'age is tick4 minus committed tick1');
    const hits = groups[0].children.filter(node => node.getAttribute('data-hit-id') === '99');
    assert.equal(hits.length, 1);
    assert.equal(hits[0].textContent, '10');
    assert.equal(hits[0].getAttribute('y'), '-322', 'hit number rises by three ticks, not zero');
    renderer.render(observation(12));
    assert.equal(svgAttacks(elements.enemyLayer).length, 1);
    renderer.render(observation(13));
    assert.equal(svgAttacks(elements.enemyLayer).length, 0, 'expires 12 ticks after the event, not after render arrival');
    assert.equal(JSON.stringify(event), before, 'display never rewrites committed damage or events');
    renderer.dispose();
  }
});

test('final SVG hits clear on preparation and result and cannot return in the next combat', () => {
  for (const phase of ['preparation', 'result'] as const) {
    const { shell, elements } = shellSink(), renderer = createV2Renderer(shell, core);
    renderer.render(observation()); renderer.consume([attack(1)]); renderer.render(observation(4));
    assert.equal(svgAttacks(elements.enemyLayer).length, 1);
    renderer.consume([attack(5)]);
    renderer.render(observation(5, { phase }));
    assert.equal(svgAttacks(elements.enemyLayer).length, 0);
    renderer.render(observation(5));
    assert.equal(svgAttacks(elements.enemyLayer).length, 0, 'frozen-phase cleanup is permanent for old feedback');
    renderer.consume([attack(6)]); renderer.render(observation(6));
    assert.equal(svgAttacks(elements.enemyLayer).length, 1, 'a newly committed hit still renders normally');
    renderer.dispose();
  }
});

test('restart clear/reset and disposal discard pending SVG hits before any new observation', () => {
  for (const boundary of ['clearEffects', 'reset', 'dispose'] as const) {
    const { shell, elements } = shellSink(), renderer = createV2Renderer(shell, core);
    renderer.render(observation(0, { phase: 'preparation' }));
    renderer.consume([attack(1)]); renderer[boundary]();
    renderer.render(observation(4));
    assert.equal(svgAttacks(elements.enemyLayer).length, 0, boundary);
    if (boundary !== 'dispose') {
      renderer.consume([attack(5)]); renderer.render(observation(5));
      assert.equal(svgAttacks(elements.enemyLayer).length, 1);
      renderer.dispose();
    }
  }
});

test('renderer projects all three guidance fields and exact ordinary/boss/final countdowns', () => {
  const { shell, elements } = shellSink(), renderer = createV2Renderer(shell, core);
  for (const o of [
    observation(1, { segmentRemainingTicks: 9, remainingCount: 7 }),
    observation(591, { wave: 5, waveTick: 591, segmentRemainingTicks: 9,
      bossDeadlineWaveTick: 600, bossRemainingTicks: 9 }),
    observation(591, { wave: fresh.rules.waveCount, waveTick: 591, segmentRemainingTicks: 9,
      bossDeadlineWaveTick: 600, bossRemainingTicks: null }),
  ]) {
    const before = JSON.stringify(o), guidance = waveGuidance(o);
    renderer.render(o);
    assert.equal(elements.wavePreview.textContent, guidance.preview);
    assert.equal(elements.waveCarry.textContent, guidance.carry);
    assert.equal(elements.waveTiming.textContent, guidance.timing);
    assert.equal(elements.segmentTime.textContent, '0.45초');
    assert.equal(elements.bossTime.textContent, o.bossRemainingTicks === null ? '—' : '0.45초');
    assert.match(elements.waveTiming.textContent, /0.45초/);
    assert.equal(JSON.stringify(o), before);
  }
  renderer.render(observation(600, { phase: 'result', outcome: 'loss', outcomeReason: 'finalTimeout' }));
  assert.equal(elements.wavePreview.textContent, '다음 웨이브 없음');
  assert.equal(elements.waveTiming.textContent, '최종 웨이브 시간 초과');
  renderer.clearEffects(); renderer.render(fresh);
  assert.equal(elements.waveCarry.textContent, waveGuidance(fresh).carry);
  assert.equal(elements.waveTiming.textContent, waveGuidance(fresh).timing);
  renderer.dispose();
});

test('empty default mapping preserves icons, including registry IDs resembling object properties', async () => {
  const { shell, sink } = shellSink(), renderer = createV2Renderer(shell, core);
  for (const definitionId of ['fixture-01', 'constructor', 'toString']) {
    renderer.render(observation(0, { units: [{ ...unit, definitionId }] }));
    await settle();
    assert.equal(sink.boardCells[0].token.children.length, 0);
    assert.ok(sink.boardCells[0].token.textContent.length > 0);
  }
  renderer.dispose();
});

test('production manifest stays empty and art CSS is imported only at the browser entry', () => {
  const production = JSON.parse(readFileSync(new URL('../../public/assets/mvp/manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(production, { version: 1, sprites: [] });
  const main = readFileSync(new URL('../../src/web/v2-main.ts', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../../src/web/v2-view.ts', import.meta.url), 'utf8');
  assert.equal(main.split("import './v2-art.css';").length - 1, 1);
  assert.doesNotMatch(view, /import\s+['"][^'"]+\.css['"]/);
});

test('explicit mapping reveals decoded art without replacing labels or destroying sprite children on rerender', async () => {
  let calls = 0;
  const { shell, sink } = shellSink();
  const lib = library(async () => { calls++; return { width: 96, height: 32 }; });
  const renderer = createV2Renderer(shell, core, { art: { mapping, library: lib } });
  renderer.render(observation());
  const slot = sink.boardCells[0], [icon, sprite] = slot.token.children;
  const label = slot.button.getAttribute('aria-label');
  assert.equal(icon.hidden, false); assert.equal(sprite.hidden, true);
  await settle();
  assert.equal(icon.hidden, true); assert.equal(sprite.hidden, false);
  assert.equal(sprite.dataset.artStatus, 'synthetic-test');
  assert.equal(sprite.style.backgroundImage, 'url("https://example.test/deployed/game/assets/mvp/render-test.png")');
  assert.equal(sprite.style.width, '32px');
  renderer.render(observation(1));
  assert.equal(slot.token.children[1], sprite);
  assert.equal(slot.token.children.length, 2);
  assert.equal(slot.button.getAttribute('aria-label'), label);
  assert.equal(calls, 1);
  renderer.dispose();
  assert.deepEqual(await lib.resolve('render-test'), { ok: false, reason: 'disposed', fallback: 'role-icon' });
});

test('missing, unapproved and failed images retain icons with no repeated decoder requests', async () => {
  for (const mode of ['missing', 'unapproved', 'candidate', 'failed'] as const) {
    let calls = 0;
    const loader = async () => { calls++; throw new Error('decoder failed'); };
    const candidate = manifest(); candidate.sprites[0].status = 'candidate';
    const lib = mode === 'unapproved' ? createArtLibrary(manifest(), { loader })
      : mode === 'candidate' ? createArtLibrary(candidate, { loader }) : library(loader);
    const { shell, sink } = shellSink();
    const renderer = createV2Renderer(shell, core, { art: {
      mapping: { 'fixture-01': mode === 'missing' ? 'unlisted' : 'render-test' }, library: lib,
    } });
    for (let tick = 0; tick < 3; tick++) { renderer.render(observation(tick)); await settle(); }
    const [icon, sprite] = sink.boardCells[0].token.children;
    assert.equal(icon.hidden, false); assert.equal(sprite.hidden, true);
    assert.equal(calls, mode === 'failed' ? 1 : 0);
    renderer.dispose();
  }
});

test('delayed resolutions cannot paint sold entities, cleared generations, reset owners or disposed renderers', async () => {
  for (const boundary of ['sold', 'clearEffects', 'reset', 'dispose'] as const) {
    let finish!: (size: { width: number; height: number }) => void;
    const lib = library(() => new Promise(resolve => { finish = resolve; }));
    const { shell, sink } = shellSink();
    const renderer = createV2Renderer(shell, core, { art: { mapping, library: lib } });
    renderer.render(observation()); await settle();
    const sprite = sink.boardCells[0].token.children[1];
    if (boundary === 'sold') renderer.render(observation(1, { units: [] }));
    else renderer[boundary]();
    finish({ width: 96, height: 32 }); await settle();
    assert.equal(sprite.hidden, true, boundary);
    assert.equal(sprite.dataset.artId, undefined, boundary);
    if (boundary !== 'dispose') {
      renderer.render(observation()); await settle();
      assert.equal(sprite.hidden, false, 'new current binding may reuse the decoded image');
      renderer.dispose();
    }
  }
});

test('automatic-upgrade replacement rejects the old identity even when it uses the same asset and slot', async () => {
  let finish!: (size: { width: number; height: number }) => void;
  const { shell, sink } = shellSink();
  const renderer = createV2Renderer(shell, core, { art: {
    mapping, library: library(() => new Promise(resolve => { finish = resolve; })),
  } });
  renderer.render(observation(0, { phase: 'preparation' })); await settle();
  renderer.render(observation(0, { phase: 'preparation', units: [{ ...unit, id: 8, star: 2 }] }), { unitId: 8 });
  finish({ width: 96, height: 32 }); await settle();
  assert.equal(sink.boardCells[0].token.children[1].dataset.artEntity, 'unit:8');
  assert.equal(sink.boardCells[0].button.dataset.unitId, '8');
  assert.match(sink.boardCells[0].detail.textContent, /2★/);
  renderer.dispose();
});

test('moving a mapped entity while its image loads leaves the old slot empty', async () => {
  let finish!: (size: { width: number; height: number }) => void;
  const lib = library(() => new Promise(resolve => { finish = resolve; }));
  const { shell, sink } = shellSink();
  const renderer = createV2Renderer(shell, core, { art: { mapping, library: lib } });
  renderer.render(observation(0, { phase: 'preparation' })); await settle();
  renderer.render(observation(0, { phase: 'preparation', units: [{ ...unit,
    location: { kind: 'board', col: 1, row: 0 } }] }));
  finish({ width: 96, height: 32 }); await settle();
  assert.equal(sink.boardCells[0].token.children[1].hidden, true);
  assert.equal(sink.boardCells[0].token.children[0].textContent, '·');
  assert.equal(sink.boardCells[1].token.children[1].hidden, false);
  renderer.dispose();
});

test('an old entity load cannot overwrite a newer entity already displayed in the same slot', async () => {
  let finishOld!: (size: { width: number; height: number }) => void;
  const input = manifest();
  input.sprites.push({ ...input.sprites[0], id: 'new-entity', src: 'assets/mvp/new-entity.png' });
  const lib = createArtLibrary(input, { allow: ['synthetic-test'], loader: src =>
    src.endsWith('new-entity.png') ? Promise.resolve({ width: 96, height: 32 })
      : new Promise(resolve => { finishOld = resolve; }) });
  const { shell, sink } = shellSink();
  const renderer = createV2Renderer(shell, core, { art: {
    mapping: { ...mapping, 'fixture-04': 'new-entity' }, library: lib,
  } });
  renderer.render(observation()); await settle();
  renderer.render(observation(1, { units: [{ ...unit, id: 6, definitionId: 'fixture-04' }] }));
  await settle();
  const sprite = sink.boardCells[0].token.children[1];
  assert.equal(sprite.dataset.artId, 'new-entity');
  finishOld({ width: 96, height: 32 }); await settle();
  assert.equal(sprite.dataset.artId, 'new-entity');
  assert.equal(sprite.hidden, false);
  renderer.dispose();
});

test('image completion between consume and observation render reveals only static idle', async () => {
  let finish!: (size: { width: number; height: number }) => void;
  const { shell, sink } = shellSink();
  const renderer = createV2Renderer(shell, core, { art: {
    mapping, library: library(() => new Promise(resolve => { finish = resolve; })),
  } });
  renderer.render(observation()); await settle();
  renderer.consume([attack(1)]);
  finish({ width: 96, height: 32 }); await settle();
  const sprite = sink.boardCells[0].token.children[1];
  assert.equal(sprite.dataset.artClip, 'idle');
  renderer.render(observation(1)); assert.equal(sprite.dataset.artClip, 'attack');
  renderer.dispose();
});

test('committed attacks sample only with the new observation, preserve batch age and ignore duplicates', async () => {
  const { shell, sink } = shellSink();
  const renderer = createV2Renderer(shell, core, { art: { mapping, library: library() } });
  renderer.render(observation()); await settle();
  const sprite = sink.boardCells[0].token.children[1];
  renderer.consume([attack(1)]);
  assert.equal(sprite.dataset.artClip, 'idle', 'consume must not sample a future event against the old tick');
  renderer.render(observation(4));
  assert.equal(sprite.dataset.artClip, 'recovery', 'feedback ages from event tick, not render arrival');
  renderer.consume([attack(1)]); renderer.render(observation(4));
  assert.equal(sprite.dataset.artClip, 'recovery');
  renderer.render(observation(6)); assert.equal(sprite.dataset.artClip, 'idle');
  renderer.consume([attack(7)]); renderer.render(observation(7));
  assert.equal(sprite.dataset.artClip, 'attack');
  renderer.render(observation(7, { phase: 'preparation' })); await settle();
  assert.equal(sprite.dataset.artClip, 'idle', 'frozen phase clears combat feedback');
  renderer.dispose();
});

test('first combat batch preserves pending committed attack age; final attacks clear on preparation', async () => {
  const { shell, sink } = shellSink();
  const renderer = createV2Renderer(shell, core, { art: { mapping, library: library() } });
  renderer.render(observation(0, { phase: 'preparation' })); await settle();
  const sprite = sink.boardCells[0].token.children[1];
  renderer.consume([attack(1)]);
  renderer.render(observation(4)); await settle();
  renderer.render(observation(4));
  assert.equal(sprite.dataset.artClip, 'recovery', 'preparation-to-combat does not erase or redate the pending hit');
  renderer.consume([attack(5)]);
  renderer.render(observation(5, { phase: 'preparation' })); await settle();
  renderer.render(observation(5, { phase: 'preparation' }));
  assert.equal(sprite.dataset.artClip, 'idle', 'final combat hit is not shown in frozen preparation');
  renderer.render(observation(5)); await settle(); renderer.render(observation(5));
  assert.equal(sprite.dataset.artClip, 'idle', 'previous wave hit cannot reappear in the next combat');
  renderer.dispose();
});

test('turning reduced motion off keeps a newly consumed hit while discarding older feedback', async () => {
  let reduced = true;
  const { shell, sink } = shellSink();
  const renderer = createV2Renderer(shell, core, { art: { mapping, library: library() }, reducedMotion: () => reduced });
  renderer.render(observation()); await settle();
  renderer.consume([attack(1)]); renderer.render(observation(1));
  renderer.consume([attack(4)]); reduced = false;
  renderer.render(observation(5)); await settle(); renderer.render(observation(5));
  assert.equal(sink.boardCells[0].token.children[1].dataset.artClip, 'attack');
  renderer.dispose();
});

test('pause, hidden and reduced-motion presentation never advance gameplay or resurrect old attacks', async () => {
  let reduced = false;
  const { shell, sink } = shellSink();
  const renderer = createV2Renderer(shell, core, { art: { mapping, library: library() }, reducedMotion: () => reduced });
  renderer.render(observation()); await settle();
  const sprite = sink.boardCells[0].token.children[1];
  renderer.consume([attack(1)]); renderer.render(observation(1), { paused: true });
  assert.equal(sprite.dataset.artClip, 'idle');
  renderer.render(observation(1)); assert.equal(sprite.dataset.artClip, 'attack');
  renderer.render(observation(50), { hidden: true });
  assert.equal(sprite.dataset.artClip, 'attack');
  renderer.render(observation(100), { hidden: true });
  renderer.render(observation(100)); assert.equal(sprite.dataset.artClip, 'attack');
  renderer.render(observation(102)); assert.equal(sprite.dataset.artClip, 'recovery');
  reduced = true; renderer.render(observation(103)); await settle();
  renderer.consume([attack(104)]); renderer.render(observation(104));
  assert.equal(sprite.dataset.artClip, 'idle'); assert.equal(sprite.dataset.artFrame, '0');
  reduced = false; renderer.render(observation(105)); await settle();
  renderer.render(observation(106)); assert.equal(sprite.dataset.artClip, 'idle');
  renderer.dispose();
});

test('manifest, image decoder and background use the same nested deployment base', async () => {
  const originalFetch = globalThis.fetch;
  const fetchUrls: string[] = [], imageUrls: string[] = [];
  const input = manifest(); input.sprites[0].status = 'production';
  input.sprites[0].approvalRef = 'test-only metadata, not a real approval';
  globalThis.fetch = async url => {
    fetchUrls.push(String(url)); return new Response(JSON.stringify(input), { status: 200 });
  };
  const { shell, sink } = shellSink();
  const renderer = createV2Renderer(shell, core, { art: { mapping,
    loader: async url => { imageUrls.push(url); return { width: 96, height: 32 }; },
  } });
  try {
    renderer.render(observation()); await settle();
    const sprite = sink.boardCells[0].token.children[1];
    assert.deepEqual(fetchUrls, ['https://example.test/deployed/game/assets/mvp/manifest.json']);
    assert.deepEqual(imageUrls, ['https://example.test/deployed/game/assets/mvp/render-test.png']);
    assert.equal(sprite.style.backgroundImage, `url(${JSON.stringify(imageUrls[0])})`);
    assert.equal(sprite.hidden, false);
  } finally { renderer.dispose(); globalThis.fetch = originalFetch; }
});

test('malformed fetched manifest is cached as a fallback before any image request', async () => {
  const originalFetch = globalThis.fetch;
  let fetches = 0, images = 0;
  globalThis.fetch = async () => { fetches++; return new Response('{"version":999,"sprites":[]}'); };
  const { shell, sink } = shellSink();
  const renderer = createV2Renderer(shell, core, { art: { mapping, loader: async () => {
    images++; return { width: 96, height: 32 };
  } } });
  try {
    renderer.render(observation()); await settle();
    renderer.render(observation(1)); await settle();
    assert.equal(fetches, 1); assert.equal(images, 0);
    assert.equal(sink.boardCells[0].token.children[1].hidden, true);
  } finally { renderer.dispose(); globalThis.fetch = originalFetch; }
});
