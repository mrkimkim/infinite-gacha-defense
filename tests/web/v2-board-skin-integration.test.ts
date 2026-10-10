import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as core from '../../src/core-v2/index.ts';
import type { CombatEvent, Observation } from '../../src/core-v2/index.ts';
import { createV2Session } from '../../src/web/v2-session.ts';
import { createV2Renderer } from '../../src/web/v2-view.ts';
import { shellSink } from './v2-render-harness.ts';
import type { ElementSink } from './v2-render-harness.ts';

const settle = () => new Promise<void>(resolve => setImmediate(resolve));
function projected(node: ElementSink): unknown {
  return { text: node.textContent, hidden: node.hidden, disabled: node.disabled,
    title: node.title, dataset: node.dataset, attributes: [...node.attributes],
    children: node.children.filter(child => !child.className.startsWith('v2-board-skin')).map(projected) };
}

test('default rendering makes no board-image request and creates no candidate nodes or notice', async () => {
  const { shell, elements, sink } = shellSink();
  const renderer = createV2Renderer(shell, core);
  const match = core.createMatch(1, core.EXPERIMENT_RULES_ID); assert.ok(match.ok);
  renderer.render(core.observe(match.state)); await settle();
  assert.equal(elements.arena.children.length, 0);
  assert.equal(elements.arena.following, null);
  for (const slot of sink.boardCells) assert.equal(slot.button.children.length, 0);
  renderer.dispose();
});

test('default v2 and explicit v1 routing are independent of the board review query', () => {
  const entry = readFileSync(new URL('../../src/web/entry.ts', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../../src/web/main.ts', import.meta.url), 'utf8');
  const v2 = readFileSync(new URL('../../src/web/v2-main.ts', import.meta.url), 'utf8');
  assert.match(entry, /const screen = query\.get\('screen'\) \?\? 'v2'/);
  assert.match(entry, /if \(screen === 'v2-layout' \|\| screen === 'v2'\)/);
  assert.match(entry, /else \{\s*await import\('\.\/main.ts'\)/);
  assert.doesNotMatch(entry + main, /boardSkin|v2-board-skin/);
  assert.match(v2, /boardSkin: boardSkinReviewOption\(root\.ownerDocument\.defaultView\?\.location\.search \?\? ''\)/);
  assert.equal(v2.split("import './v2-board-skin.css';").length - 1, 1);
  const manifest = JSON.parse(readFileSync(new URL('../../public/assets/mvp/manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest, { version: 1, sprites: [] });
});

test('ring and button centers share the public arena/path geometry at both target sizes', () => {
  const rules = core.getRules(core.EXPERIMENT_RULES_ID)!;
  assert.equal(rules.board.columns, 4); assert.equal(rules.board.rows, 4);
  assert.deepEqual(rules.path.vertices, [
    { x: -500, y: -500 }, { x: 4500, y: -500 }, { x: 4500, y: 4500 }, { x: -500, y: 4500 },
  ]);
  for (const inner of [284, 426]) {
    const pitch = inner / 6;
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const position = core.boardPosition(col, row);
      assert.ok(position);
      assert.ok(Math.abs((position.x + 1000) / 6000 * inner - (col + 1.5) * pitch) < 1e-9);
      assert.ok(Math.abs((position.y + 1000) / 6000 * inner - (row + 1.5) * pitch) < 1e-9);
    }
  }
});

test('real recruitment/placement/combat/pause/restart projection is identical with skin on or off', async () => {
  // Real core/session commands and DOM sinks. This is not browser input/layout evidence.
  const session = createV2Session(1, core.EXPERIMENT_RULES_ID, core);
  const initial = session.canonical();
  const plain = shellSink(), skinned = shellSink();
  let loads = 0;
  const defaultView = createV2Renderer(plain.shell, core);
  const skinView = createV2Renderer(skinned.shell, core, { boardSkin: { candidate: 'v03', loader: async () => {
    loads++; return { width: 1254, height: 1254 };
  } } });
  const originalTargets = skinned.sink.boardCells.map(slot => slot.button);
  await settle();
  function render(paused = false) {
    const observation = session.observe(), before = session.canonical(), record = session.record();
    const selection = session.selection;
    const ui = { unitId: selection?.kind === 'unit' ? selection.id : null,
      offerSlot: selection?.kind === 'offer' ? selection.slot : null, paused };
    defaultView.render(observation, ui); skinView.render(observation, ui);
    assert.equal(session.canonical(), before);
    assert.deepEqual(session.record(), record, 'skin never changes accepted log, RNG or hash');
    for (const key of ['boardCells', 'benchSlots', 'offerSlots'] as const) {
      skinned.sink[key].forEach((slot, index) => {
        for (const part of ['button', 'token', 'label', 'detail'] as const) {
          assert.deepEqual(projected(slot[part]), projected(plain.sink[key][index][part]), `${key}.${index}.${part}`);
        }
      });
    }
    for (const key of ['enemyLayer', 'phase', 'selectedName', 'selectedDetail', 'recruitPreview', 'pauseButton', 'startButton']) {
      assert.deepEqual(projected(skinned.elements[key]), projected(plain.elements[key]), key);
    }
    assert.deepEqual(skinned.sink.boardCells.map(slot => slot.button), originalTargets, 'all hit targets retain identity');
    return observation;
  }
  render();
  const offer = session.observe().offers.find(value => value.recruitPreview.ok)!;
  assert.ok(session.selectOffer(offer.slot).ok); render();
  assert.ok(session.recruitSelected().ok); render();
  assert.ok(session.selectLocation({ kind: 'board', col: 1, row: 1 }).ok); render();
  assert.ok(session.selectLocation({ kind: 'board', col: 1, row: 1 }).ok); render();
  assert.ok(session.start().ok); render();
  let attacks = 0;
  while (session.observe().phase === 'combat') {
    const advanced = session.advance(session.match, 1)!;
    attacks += advanced.events.filter(event => event.type === 'attack').length;
    defaultView.consume(advanced.events); skinView.consume(advanced.events);
    render();
    if (session.observe().tick === 50) {
      const frozen = session.canonical(); render(true); render(true); render();
      assert.equal(session.canonical(), frozen, 'pause presentation never advances the session');
    }
  }
  assert.ok(attacks > 0, 'trace contains actual core attacks');
  const beforeRestart = session.record();
  assert.ok(session.restart().ok);
  defaultView.clearEffects(); skinView.clearEffects(); render();
  assert.equal(session.canonical(), initial);
  assert.deepEqual(session.archives, [beforeRestart]);
  assert.equal(loads, 1, 'rerenders, pause and restart reuse the same static decoration');
  defaultView.dispose(); skinView.dispose();
});

test('range/support/HP/slow/attack scene nodes and event payloads are unchanged under the skin', async () => {
  // Explicit display fixture to cover effects without inventing a reachable gameplay trace.
  const match = core.createMatch(1, core.EXPERIMENT_RULES_ID); assert.ok(match.ok);
  const fresh = core.observe(match.state);
  const unit = { id: 1, definitionId: 'fixture-01', rarityId: 'common' as const, star: 1 as const,
    location: { kind: 'board' as const, col: 0, row: 0 }, cooldown: 0, damage: 10, bossDamage: 10,
    range: 2345, nextAttackCooldown: 9, supportActive: false, supportSourceIds: [] as number[], sellGold: 1 };
  const observation: Observation = { ...fresh, tick: 2, phase: 'combat', boardCount: 2,
    units: [unit, { ...unit, id: 2, location: { kind: 'board', col: 1, row: 0 }, supportSourceIds: [1] }],
    enemies: [{ id: 99, typeId: 'basic', boss: false, position: { x: -500, y: -500 }, hp: 8, maxHp: 10,
      totalDistance: 0, spawnTick: 0, speed: 50,
      slow: { type: 'slow', percent: 20, expireAt: 7 } }], remainingCount: 1 };
  const event: CombatEvent = { type: 'attack', tick: 1, wave: 1, waveTick: 1, unitId: 1,
    targetId: 99, sourcePosition: { x: 500, y: 500 }, center: { x: -500, y: -500 },
    hits: [{ enemyId: 99, damage: 2, position: { x: -500, y: -500 } }] };
  const before = JSON.stringify({ observation, event });
  const plain = shellSink(), skin = shellSink();
  const a = createV2Renderer(plain.shell, core), b = createV2Renderer(skin.shell, core,
    { boardSkin: { candidate: 'v03', loader: async () => ({ width: 1254, height: 1254 }) } });
  await settle();
  for (const view of [a, b]) {
    view.render(observation, { unitId: 1 }); view.consume([event]); view.render(observation, { unitId: 1 });
  }
  assert.deepEqual(projected(skin.elements.enemyLayer), projected(plain.elements.enemyLayer));
  const scene = JSON.stringify(projected(skin.elements.enemyLayer));
  for (const effect of ['range', 'support', 'slow', 'attack']) assert.ok(scene.includes(effect));
  assert.ok(scene.includes('HP 8/10'));
  assert.equal(JSON.stringify({ observation, event }), before);
  a.dispose(); b.dispose();
});
