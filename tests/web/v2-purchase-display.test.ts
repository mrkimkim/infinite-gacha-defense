import assert from 'node:assert/strict';
import test from 'node:test';
import * as core from '../../src/core-v2/index.ts';
import type { MatchState, Observation, ObservedUnit } from '../../src/core-v2/index.ts';
import type { V2ShellRefs } from '../../src/web/v2-shell.ts';
import { createV2Renderer } from '../../src/web/v2-view.ts';

/** Small DOM sink for projection regression only; no layout or browser claims. */
class ElementSink {
  textContent = '';
  hidden = false;
  disabled = false;
  title = '';
  className = '';
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  children: ElementSink[] = [];
  previousElementSibling: ElementSink | null = null;
  following: ElementSink | null = null;
  removed = false;
  classList = { toggle: (_name: string, _force: boolean) => {} };
  ownerDocument = {
    createElement: (_tag: string) => new ElementSink(),
    createElementNS: (_namespace: string, _tag: string) => new ElementSink(),
    createDocumentFragment: () => new ElementSink(),
  };
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  querySelector(_selector: string) { return null; }
  append(...nodes: ElementSink[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: ElementSink[]) { this.children = nodes; }
  after(node: ElementSink) { this.following = node; }
  remove() { this.removed = true; }
}
function shellSink() {
  const elements = Object.fromEntries([
    'root', 'phase', 'wave', 'gold', 'enemyPressure', 'capacity', 'enemyCount', 'bossTime', 'segmentTime',
    'wavePreview', 'arena', 'board', 'enemyLayer', 'bench', 'benchCount', 'offers', 'rerollButton', 'rerollCost',
    'selectionPanel', 'selectedName', 'selectedDetail', 'selectedStats', 'attack', 'attackSpeed', 'range',
    'recruitButton', 'recruitPreview', 'sellButton', 'cancelButton', 'synergies', 'synergyList', 'synergyCount',
    'startButton', 'pauseButton', 'message',
  ].map(key => [key, new ElementSink()]));
  elements.attackSpeed.previousElementSibling = new ElementSink();
  elements.attackSpeed.previousElementSibling.textContent = '공격 간격';
  elements.range.previousElementSibling = new ElementSink();
  const slots = (count: number) => Array.from({ length: count }, () => ({
    button: new ElementSink(), token: new ElementSink(), label: new ElementSink(), detail: new ElementSink(),
  }));
  const sink = { ...elements, boardCells: slots(16), benchSlots: slots(8), offerSlots: slots(3) };
  return { elements, sink, shell: sink as unknown as V2ShellRefs };
}
function initial() {
  const result = core.createMatch(1, core.EXPERIMENT_RULES_ID);
  assert.ok(result.ok);
  return result.state;
}

test('offer selection reveals baseline stats before purchase, then clears on cancel or empty offer', () => {
  const { shell, elements, sink } = shellSink();
  const renderer = createV2Renderer(shell, core);
  const o = core.observe(initial());
  const definition = o.rules.characters.find(c => c.id === o.offers[0].definitionId)!;
  renderer.render(o, { offerSlot: 0 });
  assert.equal(elements.selectionPanel.hidden, false);
  assert.equal(elements.selectedStats.hidden, false);
  assert.equal(elements.attack.textContent, String(definition.damage));
  assert.equal(elements.attackSpeed.textContent, `${definition.cooldownTicks * o.rules.tickMs / 1000}초`);
  assert.equal(elements.range.textContent, `${definition.range / o.rules.board.tileSize}칸`);
  assert.equal(elements.attackSpeed.previousElementSibling!.textContent, '공격 간격', 'renderer preserves the shell-owned heading');
  assert.equal(elements.range.previousElementSibling!.textContent, '사거리 반경');
  assert.match(elements.selectedDetail.textContent, /1성 기본값/);
  assert.match(elements.selectedStats.following!.textContent, /시너지·인접 지원 미반영/);
  assert.match(sink.offerSlots[0].button.getAttribute('aria-label')!, /1성 기본 공격력.*공격 주기.*사거리 반경/);
  assert.equal(elements.recruitButton.disabled, false);
  renderer.render(o, { offerSlot: 0 });
  assert.equal(elements.selectedStats.hidden, false, 'repeated selection does not hide stats');
  renderer.render(o);
  assert.equal(elements.selectionPanel.hidden, true);
  assert.equal(elements.selectedStats.hidden, true);
  assert.equal(elements.selectedStats.following!.textContent, '');
  assert.equal(elements.recruitPreview.textContent, '');
  assert.equal(elements.attack.textContent, '—');
  renderer.render({ ...o, offers: o.offers.map(offer => ({ ...offer, definitionId: null })) }, { offerSlot: 0 });
  assert.equal(elements.selectionPanel.hidden, true);
  assert.equal(elements.recruitButton.disabled, true);
  renderer.dispose();
  assert.equal(elements.selectedStats.following!.removed, true);
});

test('rejected purchase stays inspectable with base stats and disabled confirmation, then refreshes cleanly', () => {
  const { shell, elements, sink } = shellSink();
  const renderer = createV2Renderer(shell, core);
  const o = core.observe(initial());
  for (const code of ['INSUFFICIENT_GOLD', 'NO_RECRUIT_SPACE'] as const) {
    const rejected: Observation = { ...o, offers: o.offers.map(offer => ({
      ...offer, recruitPreview: { ok: false, error: { code } },
    })) };
    renderer.render(rejected, { offerSlot: 0 });
    assert.equal(elements.selectionPanel.hidden, false);
    assert.equal(elements.selectedStats.hidden, false);
    assert.equal(sink.offerSlots[0].button.disabled, false);
    assert.equal(elements.recruitButton.disabled, true);
    assert.doesNotMatch(elements.recruitPreview.textContent, /최종:|→/);
  }
  renderer.render(o, { offerSlot: 0 });
  assert.equal(elements.recruitButton.disabled, false);
  assert.match(elements.recruitPreview.textContent, /최종:/);
  renderer.render(o, { offerSlot: 0, fatal: true });
  assert.equal(elements.recruitButton.disabled, true);
  renderer.dispose();
});

test('owned selection shows exact observed period and tile radius while range overlay keeps world radius', () => {
  const { shell, elements } = shellSink();
  const renderer = createV2Renderer(shell, core);
  const o = core.observe(initial());
  const unit: ObservedUnit = {
    id: 5, definitionId: o.rules.characters[0].id, rarityId: o.rules.characters[0].rarityId,
    star: 2, location: { kind: 'board', row: 0, col: 0 }, cooldown: 1,
    damage: 777, bossDamage: 888, nextAttackCooldown: 9, range: 2345,
    supportActive: false, supportSourceIds: [], sellGold: 3,
  };
  renderer.render({ ...o, units: [unit], boardCount: 1 }, { unitId: unit.id });
  assert.equal(elements.attack.textContent, '777');
  assert.equal(elements.attackSpeed.textContent, '0.45초');
  assert.equal(elements.range.textContent, '2.345칸');
  assert.match(elements.selectedDetail.textContent, /현재 2성 실효값/);
  assert.match(elements.selectedStats.following!.textContent, /1성 기본:/);
  assert.match(elements.selectedStats.following!.textContent, /현재 보스 공격력 888/);
  assert.equal(elements.enemyLayer.children[0].children[0].getAttribute('r'), '2345');
  assert.equal(elements.recruitPreview.hidden, true);
  assert.equal(elements.sellButton.hidden, false);
  renderer.dispose();
});

test('actual core full-bench chain renders real consumed locations and committed result without stale preview', () => {
  // Synthetic stabilized input for engine-preview projection, not a public-command playthrough.
  const base = initial();
  const state: MatchState = { ...base, nextEntityId: 40, units: [
    { id: 11, definitionId: 'fixture-01', star: 1, location: { kind: 'board', col: 0, row: 0 }, cooldown: 6 },
    { id: 7, definitionId: 'fixture-01', star: 1, location: { kind: 'board', col: 3, row: 3 }, cooldown: 2 },
    { id: 3, definitionId: 'fixture-01', star: 2, location: { kind: 'board', col: 0, row: 1 }, cooldown: 8 },
    { id: 9, definitionId: 'fixture-01', star: 2, location: { kind: 'bench', slot: 2 }, cooldown: 4 },
    ...Array.from({ length: 8 }, (_, slot) => ({ id: 20 + slot,
      definitionId: `fixture-${String(2 + slot % 7).padStart(2, '0')}`, star: 1 as const,
      location: { kind: 'bench' as const, slot }, cooldown: slot,
    })).filter(unit => unit.location.slot !== 2),
  ] };
  const { shell, elements } = shellSink();
  const renderer = createV2Renderer(shell, core);
  const o = core.observe(state);
  assert.equal(o.benchCount, 8);
  const preview = o.offers[0].recruitPreview;
  assert.ok(preview.ok);
  assert.equal(preview.upgrades.length, 2);
  const hash = core.stateHash(state);
  renderer.render(o, { offerSlot: 0 });
  assert.equal(core.stateHash(state), hash);
  const text = elements.recruitPreview.textContent;
  assert.match(text, /자동 승급 2단계/);
  assert.match(text, /1\. 1성 3개 → 2성 1개\n  재료:/);
  assert.match(text, /2\. 2성 3개 → 3성 1개\n  재료:/);
  assert.match(text, /1성 \(4행 4열\).*1성 \(1행 1열\).*이번 영입/);
  assert.match(text, /2성 \(2행 1열\).*2성 \(대기석 3\).*1단계 결과.*2성 \(4행 4열\)/);
  assert.match(text, /최종:.*3성 \(2행 1열\)/);
  assert.match(text, /대기석 7\/8/);
  assert.equal(elements.recruitButton.disabled, false);
  const result = core.dispatch(state, { type: 'recruit', offerSlot: 0 });
  assert.ok(result.ok);
  const event = result.events[0];
  assert.equal(event.type, 'recruited');
  if (event.type !== 'recruited') assert.fail('Expected real recruited event');
  renderer.render(core.observe(result.state), { unitId: event.result.id });
  assert.match(elements.selectedDetail.textContent, /3★.*2행 1열.*현재 3성 실효값/);
  assert.equal(elements.recruitPreview.hidden, true);
  assert.equal(elements.recruitPreview.textContent, '');
  assert.equal(elements.recruitButton.hidden, true);
  assert.equal(elements.sellButton.hidden, false);
  renderer.dispose();
});
