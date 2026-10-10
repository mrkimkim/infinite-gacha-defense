import type {
  CombatEvent, CoreApi, Observation, ObservedUnit, Point, PublicRules,
  DefinitionId, RarityId, RecruitPreview, PlanRef, Location, CharacterDefinition,
} from '../core-v2/index.ts';
import type { V2ShellRefs, V2SlotRefs } from './v2-shell.ts';

export interface V2RenderUi {
  readonly unitId?: number | null;
  readonly offerSlot?: number | null;
  readonly paused?: boolean;
  readonly hidden?: boolean;
  readonly message?: string;
  readonly fatal?: boolean;
}

const ROLES = {
  single: ['●', '단일 공격'], splash: ['◎', '범위 공격'], multi: ['Ⅱ', '두 대상 공격'],
  slow: ['❄', '둔화'], support: ['＋', '인접 지원'], bossFirst: ['◆', '보스 우선'],
} as const;
const TAG_NAMES = { focus: '집중', cooperation: '협동' } as const;
const ENEMY_NAMES = { basic: '일반', swift: '신속', sturdy: '튼튼', boss: '보스' } as const;
const OUTCOME_NAMES = {
  accumulation: '잔존 적 한계 도달', bossTimeout: '보스 제한 시간 초과',
  finalTimeout: '최종 웨이브 시간 초과', cleared: '모든 웨이브 방어 성공',
} as const;
const SVG_NS = 'http://www.w3.org/2000/svg';
const EFFECT_LIFETIME_TICKS = 12;
const MAX_ATTACK_EFFECTS = 64;
type Attack = Extract<CombatEvent, { type: 'attack' }>;
type AttackEffect = { event: Attack; shownAt: number; definition: CharacterDefinition | undefined };

/** Pure copy projection, including deliberately symbolic transaction-local refs. */
export function definitionLabel(rules: Pick<PublicRules, 'characters'>, id: DefinitionId): string {
  return rules.characters.find(definition => definition.id === id)?.label ?? id;
}
export function rarityLabel(rules: Pick<PublicRules, 'rarities'>, id: RarityId): string {
  return rules.rarities.find(rarity => rarity.id === id)?.label ?? id;
}
export function unitAccessibleLabel(unit: Pick<ObservedUnit, 'definitionId' | 'rarityId' | 'star'>, rules: Pick<PublicRules, 'characters' | 'rarities'>): string {
  return `${definitionLabel(rules, unit.definitionId)}, 희귀도 ${rarityLabel(rules, unit.rarityId)}, ${unit.star}성`;
}
export function locationLabel(location: Location): string {
  return location.kind === 'board' ? `${location.row + 1}행 ${location.col + 1}열`
    : `대기석 ${location.slot + 1}`;
}
export function planRefLabel(ref: PlanRef): string {
  return ref.kind === 'existing' ? `기존 #${ref.unitId}` : `생성 예정 기물 ${ref.creationIndex + 1}`;
}
const RECRUIT_ERRORS = {
  BAD_FORMAT: '영입 요청 형식 오류', BAD_PHASE: '준비 단계에서 영입할 수 있습니다',
  BAD_SLOT: '잘못된 후보', OFFER_EMPTY: '이미 영입한 후보',
  INSUFFICIENT_GOLD: '코인이 부족합니다', NO_RECRUIT_SPACE: '자동 승급 후에도 대기석 공간이 부족합니다',
  INTEGER_OVERFLOW: '수치 한계를 초과해 영입할 수 없습니다',
} as const;
export function recruitPreviewLabel(preview: RecruitPreview, rules: Pick<PublicRules, 'characters' | 'benchCapacity'>): string {
  if (!preview.ok) return RECRUIT_ERRORS[preview.error.code];
  const steps = preview.upgrades.map((upgrade, index) =>
    `${index + 1}. ${upgrade.consumed.map(planRefLabel).join(' + ')} → ${definitionLabel(rules, upgrade.result.definitionId)} ${upgrade.result.star}성 (${planRefLabel(upgrade.result.ref)}), ${locationLabel(upgrade.result.location)}`);
  return [
    `영입 ${preview.price}코인 · 영입 후 ${preview.goldAfter}코인`,
    steps.length ? `자동 승급 ${steps.length}단계` : '자동 승급 없음', ...steps,
    `최종: ${definitionLabel(rules, preview.result.definitionId)} ${preview.result.star}성 · ${locationLabel(preview.result.location)} · ${planRefLabel(preview.result.ref)}`,
    `배치 ${preview.boardCountAfter}/16 · 대기석 ${preview.benchCountAfter}/${rules.benchCapacity}`,
  ].join('\n');
}
export function ticksLabel(ticks: number | null, tickMs: number): string {
  return ticks === null ? '—' : `${(ticks * tickMs / 1000).toFixed(1)}초`;
}

/** Pure projection of observations and event snapshots; owns no simulation clock. */
export function createV2Renderer(shell: V2ShellRefs, api: CoreApi) {
  const document = shell.root.ownerDocument;
  let observation: Observation | null = null;
  let currentUi: V2RenderUi = {};
  let effects: AttackEffect[] = [];
  let disposed = false;
  const definition = (id: DefinitionId) => observation?.rules.characters.find(item => item.id === id);

  function svg<K extends keyof SVGElementTagNameMap>(
    tag: K, attributes: Record<string, string | number> = {}, text?: string,
  ): SVGElementTagNameMap[K] {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function line(from: Point, to: Point, color: string, width: number): SVGLineElement {
    return svg('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      stroke: color, 'stroke-width': width, 'stroke-linecap': 'round' });
  }
  function position(unit: ObservedUnit): Point | null {
    return unit.location.kind === 'board'
      ? api.boardPosition(unit.location.col, unit.location.row) : null;
  }
  function selected(slot: V2SlotRefs, active: boolean) {
    slot.button.dataset.selected = String(active);
    slot.button.setAttribute('aria-pressed', String(active));
  }
  function unitSlot(slot: V2SlotRefs, unit: ObservedUnit | undefined, location: string, enabled: boolean) {
    if (!observation) return;
    selected(slot, Boolean(unit && unit.id === currentUi.unitId));
    slot.button.disabled = !enabled;
    if (!unit) {
      delete slot.button.dataset.unitId;
      delete slot.button.dataset.definitionId;
      delete slot.button.dataset.rarity;
      slot.token.textContent = '·';
      slot.label.textContent = '';
      slot.detail.textContent = '';
      slot.button.setAttribute('aria-label', `${location}, 빈칸`);
      slot.button.title = `${location}, 빈칸`;
      return;
    }
    const role = ROLES[definition(unit.definitionId)?.behavior ?? 'single'];
    slot.button.dataset.unitId = String(unit.id);
    slot.button.dataset.definitionId = unit.definitionId;
    slot.button.dataset.rarity = unit.rarityId;
    slot.token.textContent = role[0];
    slot.label.textContent = definitionLabel(observation.rules, unit.definitionId);
    slot.detail.textContent = `${rarityLabel(observation.rules, unit.rarityId)} · ${unit.star}★`;
    const label = `${location}, ${unitAccessibleLabel(unit, observation.rules)}, ${role[1]}, 임시 역할 아이콘`;
    slot.button.setAttribute('aria-label', label);
    slot.button.title = label;
  }

  function renderScene() {
    if (!observation || disposed) return;
    const o = observation;
    const fragment = document.createDocumentFragment();
    // The shell supplies the world viewport; path vertices come from public rules.
    const path = shell.arena.querySelector<SVGPathElement>('.v2-path path');
    if (path) path.setAttribute('d', o.rules.path.vertices.map((p, index) =>
      `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z');
    const units = new Map(o.units.map(unit => [unit.id, unit]));
    const chosen = o.units.find(unit => unit.id === currentUi.unitId);
    if (chosen) {
      const center = position(chosen);
      if (center) fragment.append(svg('circle', {
        cx: center.x, cy: center.y, r: chosen.range, fill: '#557bc011',
        stroke: '#446aa8', 'stroke-width': 24, 'stroke-dasharray': '80 45',
        'data-effect': 'range',
      }));
    }
    // Do not reconstruct adjacency. Source IDs are the engine's aura decision.
    for (const target of o.units) {
      const end = position(target);
      if (!end) continue;
      for (const sourceId of target.supportSourceIds) {
        const source = units.get(sourceId);
        const start = source && position(source);
        if (!start) continue;
        const link = line(start, end, '#377d60', 26);
        link.setAttribute('stroke-dasharray', '45 35');
        link.dataset.effect = 'support';
        link.dataset.sourceId = String(sourceId);
        link.dataset.targetId = String(target.id);
        fragment.append(link);
      }
    }
    for (const enemy of o.enemies) {
      const p = enemy.position;
      const group = svg('g', { 'data-enemy-id': enemy.id });
      group.append(svg('title', {}, `${ENEMY_NAMES[enemy.typeId]} #${enemy.id}, HP ${enemy.hp}/${enemy.maxHp}${enemy.slow ? `, 둔화 ${enemy.slow.percent}%` : ''}`));
      group.append(svg('circle', { cx: p.x, cy: p.y, r: enemy.boss ? 160 : 110,
        fill: enemy.boss ? '#9c3e53' : enemy.typeId === 'sturdy' ? '#9a7845' : '#526b83',
        stroke: '#fffbea', 'stroke-width': 25 }));
      group.append(svg('rect', { x: p.x - 160, y: p.y - 225, width: 320, height: 45, fill: '#413c3b' }));
      group.append(svg('rect', { x: p.x - 160, y: p.y - 225,
        width: enemy.maxHp > 0 ? 320 * enemy.hp / enemy.maxHp : 0, height: 45, fill: '#7dcc89' }));
      if (enemy.slow) group.append(svg('text', { x: p.x, y: p.y + 270,
        fill: '#164c7c', 'font-size': 180, 'font-weight': 800, 'text-anchor': 'middle',
        'data-effect': 'slow' }, '❄'));
      fragment.append(group);
    }
    effects = effects.filter(effect => o.tick - effect.shownAt < EFFECT_LIFETIME_TICKS);
    for (const effect of effects) {
      const event = effect.event;
      const definition = effect.definition;
      const age = Math.max(0, o.tick - effect.shownAt);
      const group = svg('g', { opacity: 1 - age / EFFECT_LIFETIME_TICKS, 'data-effect': 'attack',
        'data-unit-id': event.unitId, 'data-tick': event.tick });
      if (definition?.behavior === 'multi') {
        for (const [index, hit] of event.hits.entries()) {
          const ray = line(event.sourcePosition, hit.position, index === 0 ? '#d47824' : '#8051ac', 35);
          ray.dataset.ray = String(index);
          group.append(ray);
        }
      } else {
        group.append(line(event.sourcePosition, event.center,
          definition?.behavior === 'slow' ? '#3280b7' : '#c26327', 32));
      }
      if (definition?.behavior === 'splash') group.append(svg('circle', {
        cx: event.center.x, cy: event.center.y, r: definition.splashRadius,
        fill: '#d89a2622', stroke: '#ba7621', 'stroke-width': 40, 'data-effect': 'splash',
      }));
      for (const hit of event.hits) {
        group.append(svg('text', { x: hit.position.x, y: hit.position.y - 280 - age * 14,
          fill: '#8e302a', stroke: '#fffbea', 'stroke-width': 28, 'paint-order': 'stroke',
          'font-size': 210, 'font-weight': 800, 'text-anchor': 'middle',
          'data-hit-id': hit.enemyId }, String(hit.damage)));
      }
      fragment.append(group);
    }
    shell.enemyLayer.replaceChildren(fragment);
    shell.enemyLayer.setAttribute('aria-label', `전장: 남은 적 ${o.remainingCount}명${o.enemies.some(enemy => enemy.slow) ? ', 둔화된 적 있음' : ''}`);
  }

  function render(o: Observation, ui: V2RenderUi = {}) {
    if (disposed) return;
    if (observation && o.tick < observation.tick) effects = [];
    observation = o;
    currentUi = ui;
    const canPrepare = o.phase === 'preparation' && !ui.fatal;
    const chosen = o.units.find(unit => unit.id === ui.unitId);
    const chosenOffer = o.offers.find(offer => offer.slot === ui.offerSlot && offer.definitionId !== null);
    shell.root.classList.toggle('v2-fatal', Boolean(ui.fatal));
    shell.root.classList.toggle('v2-warning', o.warning);
    shell.phase.textContent = ui.fatal ? '오류 · 정지' : ui.hidden ? '화면 숨김 · 정지'
      : ui.paused ? '일시정지' : o.phase === 'preparation' ? '준비' : o.phase === 'combat' ? '전투 중'
        : o.outcome === 'win' ? '방어 성공' : '방어 실패';
    shell.wave.textContent = `${o.wave} / ${o.rules.waveCount}`;
    shell.gold.textContent = String(o.gold);
    shell.enemyPressure.textContent = `${o.remainingCount} / ${o.countLimit}${o.warning ? ' ⚠' : ''}`;
    shell.capacity.textContent = `${o.boardCount} / 16`;
    shell.enemyCount.textContent = String(o.remainingCount);
    shell.segmentTime.textContent = ticksLabel(o.segmentRemainingTicks, o.rules.tickMs);
    shell.bossTime.textContent = ticksLabel(o.bossRemainingTicks, o.rules.tickMs);
    shell.benchCount.textContent = `${o.benchCount} / ${o.rules.benchCapacity}`;
    shell.wavePreview.textContent = o.nextWave
      ? `${o.nextWave.wave}웨이브 · 적 ${o.nextWave.spawns.length}명${o.nextWave.bossDeadlineWaveTick !== null ? ' · 보스' : ''}`
      : '다음 웨이브 없음';
    shell.rerollCost.textContent = `${o.rules.rerollCost}코인`;
    shell.rerollButton.disabled = !canPrepare || o.gold < o.rules.rerollCost;
    shell.startButton.disabled = !canPrepare || !o.canStartWave;
    shell.pauseButton.disabled = o.phase !== 'combat' || Boolean(ui.fatal);
    shell.pauseButton.textContent = ui.paused ? '계속하기' : '일시정지';
    shell.pauseButton.setAttribute('aria-pressed', String(Boolean(ui.paused)));
    for (const [index, slot] of shell.boardCells.entries()) {
      const col = index % o.rules.board.columns;
      const row = Math.floor(index / o.rules.board.columns);
      const unit = o.units.find(candidate => candidate.location.kind === 'board'
        && candidate.location.col === col && candidate.location.row === row);
      unitSlot(slot, unit, `${row + 1}행 ${col + 1}열`, Boolean(unit) || (canPrepare && Boolean(chosen)));
    }
    for (const [index, slot] of shell.benchSlots.entries()) {
      const unit = o.units.find(candidate => candidate.location.kind === 'bench' && candidate.location.slot === index);
      unitSlot(slot, unit, `대기석 ${index + 1}`, Boolean(unit) || (canPrepare && Boolean(chosen)));
    }
    for (const [index, slot] of shell.offerSlots.entries()) {
      const offer = o.offers.find(candidate => candidate.slot === index);
      const id = offer?.definitionId;
      selected(slot, ui.offerSlot === index);
      // A rejected preview remains inspectable, including full-bench failures.
      slot.button.disabled = !id || !canPrepare;
      slot.token.textContent = id ? ROLES[definition(id)?.behavior ?? 'single'][0] : '·';
      slot.label.textContent = id ? definitionLabel(o.rules, id) : '영입 완료';
      slot.detail.textContent = id && offer ? `${offer.rarityId ? rarityLabel(o.rules, offer.rarityId) : '—'} · 1★ · ${offer.price ?? '—'}코인` : '';
      slot.button.setAttribute('aria-label', id && offer
        ? `후보 ${index + 1}, ${definitionLabel(o.rules, id)}, 희귀도 ${offer.rarityId ? rarityLabel(o.rules, offer.rarityId) : '—'}, 1성, ${offer.price ?? '—'}코인, ${offer.recruitPreview.ok ? '영입 가능' : RECRUIT_ERRORS[offer.recruitPreview.error.code]}`
        : `후보 ${index + 1}, 비어 있음`);
      slot.button.title = slot.button.getAttribute('aria-label') ?? '';
      if (id) slot.button.dataset.definitionId = id;
      else delete slot.button.dataset.definitionId;
      if (offer?.rarityId) slot.button.dataset.rarity = offer.rarityId;
      else delete slot.button.dataset.rarity;
    }
    shell.selectionPanel.hidden = !chosen && !chosenOffer;
    shell.selectedStats.hidden = !chosen;
    shell.selectedName.textContent = chosen ? definitionLabel(o.rules, chosen.definitionId)
      : chosenOffer?.definitionId ? definitionLabel(o.rules, chosenOffer.definitionId) : '수호자를 선택하세요';
    shell.selectedDetail.textContent = chosen
      ? `희귀도 ${rarityLabel(o.rules, chosen.rarityId)} · ${chosen.star}★ · ${locationLabel(chosen.location)}${chosen.supportActive ? ` · 지원 #${chosen.supportSourceIds.join(', #')}` : ''}`
      : chosenOffer?.rarityId ? `희귀도 ${rarityLabel(o.rules, chosenOffer.rarityId)} · 1★ · ${chosenOffer.price ?? '—'}코인` : '';
    shell.attack.textContent = chosen ? `${chosen.damage} / 보스 ${chosen.bossDamage}` : '—';
    shell.attackSpeed.textContent = chosen ? `${ticksLabel(chosen.nextAttackCooldown, o.rules.tickMs)}/회` : '—';
    shell.range.textContent = chosen ? String(chosen.range) : '—';
    shell.sellButton.hidden = !chosen;
    shell.sellButton.textContent = chosen ? `판매 ${chosen.sellGold}코인` : '판매';
    shell.sellButton.disabled = !canPrepare || !chosen;
    shell.recruitButton.hidden = !chosenOffer;
    shell.recruitButton.disabled = !canPrepare || !chosenOffer?.recruitPreview.ok;
    shell.recruitButton.textContent = chosenOffer ? `영입 ${chosenOffer.price ?? '—'}코인` : '영입';
    shell.recruitPreview.hidden = !chosenOffer;
    shell.recruitPreview.textContent = chosenOffer ? recruitPreviewLabel(chosenOffer.recruitPreview, o.rules) : '';
    shell.cancelButton.disabled = !chosen && !chosenOffer;
    shell.synergyCount.textContent = String(o.synergies.filter(synergy => synergy.tier > 0).length);
    shell.synergyList.replaceChildren(...o.synergies.map(synergy => {
      const item = document.createElement('li');
      item.textContent = `${TAG_NAMES[synergy.tag]} ${synergy.distinctDefinitions.length}종 · ${synergy.tag === 'focus' ? '공격력' : '사거리'} +${synergy.percent}% · ${synergy.distinctDefinitions.map(id => definitionLabel(o.rules, id)).join(', ') || '없음'}`;
      item.title = `적용 수호자: ${synergy.affectedUnitIds.map(id => `#${id}`).join(', ') || '없음'}`;
      return item;
    }));
    shell.message.textContent = ui.message ?? (o.phase === 'result'
      ? (o.outcomeReason ? OUTCOME_NAMES[o.outcomeReason] : '전투 종료')
      : o.phase === 'preparation' ? '후보 선택 → 자동 승급 미리보기 → 영입 · 수호자 선택 → 이동 또는 교환'
          : '전투 중에는 편성을 바꿀 수 없습니다. 수호자를 눌러 능력치를 확인하세요.');
    renderScene();
  }

  function consume(events: readonly CombatEvent[]) {
    if (disposed) return;
    // Called either side of render: same-tick transition hits remain visible even
    // when the engine has already switched to preparation/result. No wall clock.
    for (const event of events) {
      if (event.type !== 'attack') continue;
      const source = observation?.units.find(unit => unit.id === event.unitId);
      effects.push({ event, shownAt: event.tick,
        definition: source ? definition(source.definitionId) : undefined });
    }
    if (effects.length > MAX_ATTACK_EFFECTS) effects = effects.slice(-MAX_ATTACK_EFFECTS);
    renderScene();
  }
  function clearEffects() { effects = []; renderScene(); }
  function reset() { effects = []; observation = null; currentUi = {}; shell.enemyLayer.replaceChildren(); }
  function dispose() { reset(); disposed = true; }
  return { render, consume, reset, dispose, showEvents: consume, clearEffects };
}
