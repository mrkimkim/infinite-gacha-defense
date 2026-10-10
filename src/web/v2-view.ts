import type {
  CombatEvent, CoreApi, Observation, ObservedUnit, Point, PublicRules,
  DefinitionId, RecruitPreview, CharacterDefinition, Phase,
} from '../core-v2/index.ts';
import type { V2ShellRefs, V2SlotRefs } from './v2-shell.ts';
import { waveGuidance } from './v2-wave-guidance.ts';
import { createArtLibrary, createSpritePlayer, loadArtImage, spriteLayout } from './v2-art.ts';
import type { ArtLibrary, ArtLoader, ArtSprite, SpritePlayer } from './v2-art.ts';
import {
  definitionLabel, rarityLabel, locationLabel, planRefLabel, RECRUIT_ERRORS,
  unitRole, unitStatsDisplay, recruitPreviewDetails, attackIntervalLabel,
} from './v2-unit-display.ts';
export { definitionLabel, rarityLabel, locationLabel, planRefLabel } from './v2-unit-display.ts';

export interface V2RenderUi {
  readonly unitId?: number | null;
  readonly offerSlot?: number | null;
  readonly paused?: boolean;
  readonly hidden?: boolean;
  readonly message?: string;
  readonly fatal?: boolean;
}

export interface V2RendererOptions {
  /** Only an explicitly reviewed definition-to-asset mapping enables sprites. */
  readonly art?: {
    readonly mapping: Readonly<Record<DefinitionId, string>>;
    /** The renderer owns disposal of an injected library as well as a fetched one. */
    readonly library?: ArtLibrary;
    readonly loader?: ArtLoader;
  };
  readonly reducedMotion?: () => boolean;
}

// No approved fixture-to-IP mapping exists. Loading an image cannot approve one.
const PRODUCTION_ART_MAPPING: Readonly<Record<DefinitionId, string>> = Object.freeze({});

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

/** Attack feedback has no meaning in frozen preparation/results; logs retain history. */
export function activeAttackEffects<T extends { shownAt: number }>(effects: readonly T[], tick: number, phase: Phase): T[] {
  return phase === 'combat' ? effects.filter(effect => tick - effect.shownAt < EFFECT_LIFETIME_TICKS) : [];
}

export function unitAccessibleLabel(unit: Pick<ObservedUnit, 'definitionId' | 'rarityId' | 'star'>, rules: Pick<PublicRules, 'characters' | 'rarities'>): string {
  return `${definitionLabel(rules, unit.definitionId)}, 희귀도 ${rarityLabel(rules, unit.rarityId)}, ${unit.star}성`;
}
/** Symbolic diagnostic projection retained for callers without observed material units. */
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
  return ticks === null ? '—' : attackIntervalLabel(ticks, tickMs);
}

/** Pure projection of observations and event snapshots; owns no simulation clock. */
export function createV2Renderer(shell: V2ShellRefs, api: CoreApi, options: V2RendererOptions = {}) {
  const document = shell.root.ownerDocument;
  const statNote = document.createElement('p');
  statNote.className = 'v2-message';
  statNote.dataset.v2 = 'unit-stat-note';
  shell.selectedStats.after(statNote);
  // The displayed distance is a center-to-target radius, not a diameter.
  if (shell.range.previousElementSibling) shell.range.previousElementSibling.textContent = '사거리 반경';
  let observation: Observation | null = null;
  let currentUi: V2RenderUi = {};
  let effects: AttackEffect[] = [];
  let disposed = false;
  const definition = (id: DefinitionId) => observation?.rules.characters.find(item => item.id === id);

  type TokenNodes = { icon: HTMLSpanElement; sprite: HTMLSpanElement };
  type EntityPlayer = { player: SpritePlayer; generation: number; sprite: ArtSprite; paused: boolean };
  type ArtBinding = { key: string; assetId: string; unitId?: number; nodes: TokenNodes; resolved?: EntityPlayer };
  const artMapping = Object.freeze({ ...(options.art?.mapping ?? PRODUCTION_ART_MAPPING) });
  const tokenNodes = new Map<V2SlotRefs, TokenNodes>();
  const artBindings = new Map<V2SlotRefs, ArtBinding>();
  const entityPlayers = new Map<string, EntityPlayer>();
  const attackTicks = new Map<number, number>();
  const pendingAttackTicks = new Map<number, number>();
  const artAbort = new AbortController();
  let artOwner: object = {}, artGeneration = 0, reducedMotion = false;
  let seenArtEntities = new Set<string>();
  let artLibrary = options.art?.library ?? null;
  let libraryTask: Promise<ArtLibrary | null> | null = null;
  const deploymentBase = () => new URL('.', document.baseURI);
  // One captured deployment base is shared by manifest, decoder, and CSS URLs.
  const assetBase = Object.keys(artMapping).length ? deploymentBase() : null;
  const assetUrl = (src: string) => new URL(src, assetBase!).href;
  function library(): Promise<ArtLibrary | null> {
    if (artLibrary) return Promise.resolve(artLibrary);
    if (!libraryTask) libraryTask = fetch(assetUrl('assets/mvp/manifest.json'), { signal: artAbort.signal })
      .then(response => { if (!response.ok) throw new Error('ART_MANIFEST_LOAD'); return response.json(); })
      .then(input => {
        const loaded = createArtLibrary(input, { loader: src => (options.art?.loader ?? loadArtImage)(assetUrl(src)) });
        if (disposed) { loaded.dispose(); return null; }
        artLibrary = loaded;
        return loaded;
      }).catch(() => null);
    return libraryTask;
  }
  function roleIcon(slot: V2SlotRefs, icon: string) {
    const nodes = tokenNodes.get(slot);
    if (nodes) nodes.icon.textContent = icon;
    else slot.token.textContent = icon;
  }
  function clearArt(slot: V2SlotRefs) {
    artBindings.delete(slot);
    const nodes = tokenNodes.get(slot);
    if (!nodes) return;
    nodes.sprite.hidden = true;
    nodes.icon.hidden = false;
    slot.token.style.width = '';
    slot.token.style.height = '';
  }
  function resetArt(rotateOwner: boolean) {
    artGeneration += 1;
    if (rotateOwner) artOwner = {};
    for (const slot of artBindings.keys()) clearArt(slot);
    entityPlayers.clear();
    attackTicks.clear();
    pendingAttackTicks.clear();
  }
  function paintArt(slot: V2SlotRefs, binding: ArtBinding, entity: EntityPlayer, frame: number, clip: string) {
    const layout = spriteLayout(entity.sprite, frame, { width: 32, height: 32 }, { x: 16, y: 30 });
    Object.assign(binding.nodes.sprite.style, {
      left: `${layout.left}px`, top: `${layout.top}px`, width: `${layout.width}px`, height: `${layout.height}px`,
      backgroundSize: layout.backgroundSize, backgroundPosition: layout.backgroundPosition,
      backgroundImage: `url(${JSON.stringify(assetUrl(entity.sprite.src))})`,
    });
    Object.assign(binding.nodes.sprite.dataset, { artStatus: entity.sprite.status,
      artId: entity.sprite.id, artEntity: binding.key, artFrame: String(frame), artClip: clip });
    slot.token.style.width = '32px';
    slot.token.style.height = '32px';
    binding.nodes.icon.hidden = true;
    binding.nodes.sprite.hidden = false;
  }
  function sampleArt(slot: V2SlotRefs, binding: ArtBinding) {
    const entity = binding.resolved, o = observation;
    if (!entity || !o) return;
    if (reducedMotion) {
      paintArt(slot, binding, entity, entity.sprite.clips.idle.frames[0], 'idle');
      return;
    }
    const paused = binding.unitId === undefined || o.phase !== 'combat'
      || Boolean(currentUi.paused || currentUi.hidden || currentUi.fatal);
    const committed = binding.unitId === undefined ? undefined : attackTicks.get(binding.unitId);
    const input = { owner: artOwner, generation: entity.generation, tick: o.tick,
      paused, attackTick: committed !== undefined && committed <= o.tick ? committed : undefined };
    // Close a paused interval at the resume tick before allowing active progression.
    if (entity.paused && !paused) entity.player.sample({ ...input, paused: true });
    const pose = entity.player.sample(input);
    entity.paused = paused;
    if (pose) paintArt(slot, binding, entity, pose.frame, pose.clip);
  }
  function bindArt(slot: V2SlotRefs, key: string | null, id?: DefinitionId, unitId?: number) {
    const assetId = id !== undefined && Object.hasOwn(artMapping, id) ? artMapping[id] : undefined;
    if (!key || !assetId || !observation) { clearArt(slot); return; }
    seenArtEntities.add(key);
    const current = artBindings.get(slot);
    if (current?.key === key && current.assetId === assetId) { sampleArt(slot, current); return; }
    clearArt(slot);
    let nodes = tokenNodes.get(slot);
    if (!nodes) {
      const icon = document.createElement('span'), sprite = document.createElement('span');
      icon.textContent = slot.token.textContent;
      sprite.className = 'v2-art-sprite'; sprite.hidden = true;
      sprite.setAttribute('aria-hidden', 'true');
      slot.token.classList.add('v2-art-host');
      slot.token.replaceChildren(icon, sprite);
      nodes = { icon, sprite }; tokenNodes.set(slot, nodes);
    }
    const binding: ArtBinding = { key, assetId, unitId, nodes };
    artBindings.set(slot, binding);
    const owner = artOwner, generation = artGeneration;
    const startTick = Math.min(observation.tick, unitId === undefined
      ? observation.tick : attackTicks.get(unitId) ?? observation.tick);
    void library().then(async loaded => {
      if (!loaded) return;
      const resolution = await loaded.resolve(assetId);
      if (disposed || owner !== artOwner || generation !== artGeneration
          || artBindings.get(slot) !== binding || !resolution.ok) return;
      let entity = entityPlayers.get(key);
      if (!entity || entity.sprite.id !== resolution.sprite.id) {
        const player = createSpritePlayer(resolution.sprite);
        entity = { player, generation: player.reset(owner, startTick), sprite: resolution.sprite,
          paused: unitId === undefined || observation?.phase !== 'combat'
            || Boolean(currentUi.paused || currentUi.hidden || currentUi.fatal) };
        entityPlayers.set(key, entity);
      }
      binding.resolved = entity;
      // Async completion may occur between consume and render. Reveal only static
      // idle here; attack sampling happens exclusively in the next render call.
      paintArt(slot, binding, entity, entity.sprite.clips.idle.frames[0], 'idle');
    }).catch(() => { /* Malformed/failed assets retain the existing role icon. */ });
  }

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
      roleIcon(slot, '·');
      bindArt(slot, null);
      slot.label.textContent = '';
      slot.detail.textContent = '';
      slot.button.setAttribute('aria-label', `${location}, 빈칸`);
      slot.button.title = `${location}, 빈칸`;
      return;
    }
    const role = unitRole(definition(unit.definitionId));
    slot.button.dataset.unitId = String(unit.id);
    slot.button.dataset.definitionId = unit.definitionId;
    slot.button.dataset.rarity = unit.rarityId;
    roleIcon(slot, role[0]);
    bindArt(slot, `unit:${unit.id}`, unit.definitionId, unit.id);
    slot.label.textContent = definitionLabel(observation.rules, unit.definitionId);
    slot.detail.textContent = `${rarityLabel(observation.rules, unit.rarityId)} · ${unit.star}★`;
    const label = `${location}, ${unitAccessibleLabel(unit, observation.rules)}, ${role[1]}`;
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
    effects = activeAttackEffects(effects, o.tick, o.phase);
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
    const nextReducedMotion = options.reducedMotion?.()
      ?? document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const backwards = observation !== null && o.tick < observation.tick;
    const pending = backwards ? [] : [...pendingAttackTicks];
    pendingAttackTicks.clear();
    if (backwards) { effects = []; resetArt(true); }
    else if (observation && observation.phase !== o.phase) resetArt(false);
    if (nextReducedMotion !== reducedMotion) resetArt(false);
    reducedMotion = nextReducedMotion;
    // Phase/presentation resets discard old feedback, but events just consumed
    // for this new combat observation still need their original committed age.
    for (const [unitId, tick] of pending) {
      if (tick > o.tick) pendingAttackTicks.set(unitId, tick);
      else if (o.phase === 'combat') attackTicks.set(unitId, Math.max(attackTicks.get(unitId) ?? -1, tick));
    }
    seenArtEntities = new Set();
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
    const guidance = waveGuidance(o);
    shell.wavePreview.textContent = guidance.preview;
    shell.waveCarry.textContent = guidance.carry;
    shell.waveTiming.textContent = guidance.timing;
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
      const stats = id ? unitStatsDisplay(o.rules, id) : null;
      roleIcon(slot, id ? unitRole(definition(id))[0] : '·');
      bindArt(slot, id ? `offer:${index}:${id}` : null, id ?? undefined);
      slot.label.textContent = id ? definitionLabel(o.rules, id) : '영입 완료';
      slot.detail.textContent = id && offer ? `${offer.rarityId ? rarityLabel(o.rules, offer.rarityId) : '—'} · 1★ · ${offer.price ?? '—'}코인 · ${stats?.role}` : '';
      slot.button.setAttribute('aria-label', id && offer
        ? `후보 ${index + 1}, ${definitionLabel(o.rules, id)}, 희귀도 ${offer.rarityId ? rarityLabel(o.rules, offer.rarityId) : '—'}, 1성, ${offer.price ?? '—'}코인, ${stats?.role}, 1성 기본 공격력 ${stats?.attack}, 공격 주기 ${stats?.attackInterval}, 사거리 반경 ${stats?.range}, ${offer.recruitPreview.ok ? '영입 가능' : RECRUIT_ERRORS[offer.recruitPreview.error.code]}`
        : `후보 ${index + 1}, 비어 있음`);
      slot.button.title = slot.button.getAttribute('aria-label') ?? '';
      if (id) slot.button.dataset.definitionId = id;
      else delete slot.button.dataset.definitionId;
      if (offer?.rarityId) slot.button.dataset.rarity = offer.rarityId;
      else delete slot.button.dataset.rarity;
    }
    for (const key of entityPlayers.keys()) if (!seenArtEntities.has(key)) entityPlayers.delete(key);
    const stats = chosen ? unitStatsDisplay(o.rules, chosen.definitionId, chosen, o.synergies)
      : chosenOffer?.definitionId ? unitStatsDisplay(o.rules, chosenOffer.definitionId) : null;
    shell.selectionPanel.hidden = !chosen && !chosenOffer;
    shell.selectedStats.hidden = !stats;
    shell.selectedName.textContent = chosen ? definitionLabel(o.rules, chosen.definitionId)
      : chosenOffer?.definitionId ? definitionLabel(o.rules, chosenOffer.definitionId) : '수호자를 선택하세요';
    shell.selectedDetail.textContent = chosen
      ? `희귀도 ${rarityLabel(o.rules, chosen.rarityId)} · ${chosen.star}★ · ${locationLabel(chosen.location)} · ${stats?.role} · ${stats?.basis}`
      : chosenOffer?.rarityId ? `희귀도 ${rarityLabel(o.rules, chosenOffer.rarityId)} · 1★ · ${chosenOffer.price ?? '—'}코인 · ${stats?.role} · ${stats?.basis}` : '';
    shell.attack.textContent = stats?.attack ?? '—';
    shell.attackSpeed.textContent = stats?.attackInterval ?? '—';
    shell.range.textContent = stats?.range ?? '—';
    statNote.hidden = !stats;
    statNote.textContent = stats?.note ?? '';
    shell.sellButton.hidden = !chosen;
    shell.sellButton.textContent = chosen ? `판매 ${chosen.sellGold}코인` : '판매';
    shell.sellButton.disabled = !canPrepare || !chosen;
    shell.recruitButton.hidden = !chosenOffer;
    shell.recruitButton.disabled = !canPrepare || !chosenOffer?.recruitPreview.ok;
    shell.recruitButton.textContent = chosenOffer ? `영입 ${chosenOffer.price ?? '—'}코인` : '영입';
    shell.recruitPreview.hidden = !chosenOffer;
    shell.recruitPreview.textContent = chosenOffer ? recruitPreviewDetails(chosenOffer.recruitPreview, o.rules, o.units) : '';
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
    // Called before render: the next observation clears attack feedback on a phase
    // transition. Recorded events remain untouched; no display wall clock.
    for (const event of events) {
      if (event.type !== 'attack') continue;
      pendingAttackTicks.set(event.unitId, Math.max(pendingAttackTicks.get(event.unitId) ?? -1, event.tick));
      const source = observation?.units.find(unit => unit.id === event.unitId);
      effects.push({ event, shownAt: event.tick,
        definition: source ? definition(source.definitionId) : undefined });
    }
    if (effects.length > MAX_ATTACK_EFFECTS) effects = effects.slice(-MAX_ATTACK_EFFECTS);
    renderScene();
  }
  function clearEffects() { effects = []; resetArt(true); renderScene(); }
  function reset() { effects = []; resetArt(true); observation = null; currentUi = {}; shell.enemyLayer.replaceChildren(); statNote.textContent = ''; }
  function dispose() { reset(); statNote.remove(); disposed = true; artAbort.abort(); artLibrary?.dispose(); }
  return { render, consume, reset, dispose, showEvents: consume, clearEffects };
}
