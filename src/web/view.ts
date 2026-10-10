import { boardPosition, pathPosition } from '../core/index.ts';
import type { Observation, PublicRules, UnitTypeId } from '../core/index.ts';

export type Selection = { kind: 'offer'; slot: number } | { kind: 'unit'; id: number } | null;
export type SchedulerViewState = Readonly<{ paused: boolean; hidden: boolean }>;
export type ViewCallbacks = Readonly<{
  onCell: (col: number, row: number) => void;
  onOffer: (slot: number) => void;
}>;

const SVG_NS = 'http://www.w3.org/2000/svg';
const roleNames: Record<UnitTypeId, string> = { single: '단일', splash: '범위' };
const roleSymbols: Record<UnitTypeId, string> = { single: '●', splash: '✦' };

function required<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing view element: ${id}`);
  return element as unknown as T;
}

function setText(element: Element, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}

function setAttribute(element: Element, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function setDisabled(button: HTMLButtonElement, disabled: boolean): void {
  if (button.disabled !== disabled) button.disabled = disabled;
}

function setHidden(element: HTMLElement, hidden: boolean): void {
  if (element.hidden !== hidden) element.hidden = hidden;
}

function svg<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name);
}

/** DOM-only projection: the shared core remains the command/rules authority. */
export function createView({ onCell, onOffer }: ViewCallbacks): {
  render: (observation: Observation, selection: Selection, scheduler: SchedulerViewState) => void;
} {
  const board = required<HTMLElement>('board');
  const offers = required<HTMLElement>('offers');
  const pathLayer = required<SVGSVGElement>('path-layer');
  const enemyLayer = required<SVGSVGElement>('enemy-layer');
  const wave = required<HTMLElement>('wave');
  const lives = required<HTMLElement>('lives');
  const gold = required<HTMLElement>('gold');
  const capacity = required<HTMLElement>('capacity');
  const phase = required<HTMLElement>('phase');
  const tick = required<HTMLElement>('tick');
  const selectionLabel = required<HTMLElement>('selection');
  const recruitCost = required<HTMLElement>('recruit-cost');
  const cancel = required<HTMLButtonElement>('cancel');
  const startWave = required<HTMLButtonElement>('start-wave');
  const pause = required<HTMLButtonElement>('pause');
  const overlay = required<HTMLElement>('pause-overlay');
  const result = required<HTMLElement>('result');
  const restart = required<HTMLButtonElement>('restart');
  const resultTitle = required<HTMLElement>('result-title');
  const resultDetail = required<HTMLElement>('result-detail');
  const cells = new Map<string, {
    button: HTMLButtonElement; token: HTMLSpanElement; star: HTMLSpanElement;
  }>();
  const offerNodes = new Map<number, {
    button: HTMLButtonElement; name: HTMLElement; detail: HTMLElement;
  }>();
  const enemyNodes = new Map<number, { group: SVGGElement; hp: SVGTextElement }>();
  let rulesKey = '';

  function configureGeometry(rules: PublicRules): void {
    const first = boardPosition(0, 0);
    const last = boardPosition(rules.board.columns - 1, rules.board.rows - 1);
    if (!first || !last) throw new Error('Core board geometry unavailable');
    const halfTile = rules.board.tileSize / 2;
    const boardLeft = first.x - halfTile;
    const boardTop = first.y - halfTile;
    const boardRight = last.x + halfTile;
    const boardBottom = last.y + halfTile;
    const xs = rules.path.vertices.map(point => point.x);
    const ys = rules.path.vertices.map(point => point.y);
    const left = Math.min(boardLeft, ...xs) - halfTile;
    const top = Math.min(boardTop, ...ys) - halfTile;
    const right = Math.max(boardRight, ...xs) + halfTile;
    const bottom = Math.max(boardBottom, ...ys) + halfTile;
    const width = right - left;
    const height = bottom - top;
    const viewBox = `${left} ${top} ${width} ${height}`;
    setAttribute(pathLayer, 'viewBox', viewBox);
    setAttribute(enemyLayer, 'viewBox', viewBox);
    board.style.left = `${(boardLeft - left) / width * 100}%`;
    board.style.top = `${(boardTop - top) / height * 100}%`;
    board.style.width = `${(boardRight - boardLeft) / width * 100}%`;
    board.style.height = `${(boardBottom - boardTop) / height * 100}%`;
    board.style.gridTemplateColumns = `repeat(${rules.board.columns}, 1fr)`;
    board.style.gridTemplateRows = `repeat(${rules.board.rows}, 1fr)`;
    offers.style.gridTemplateColumns = `repeat(${rules.offerCount}, 1fr)`;
    setAttribute(board, 'aria-label', `${rules.board.columns} 곱하기 ${rules.board.rows} 배치판`);

    const path = svg('path');
    setAttribute(path, 'd', rules.path.vertices.map((point, index) =>
      `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ') + ' Z');
    setAttribute(path, 'fill', 'none');
    setAttribute(path, 'stroke', '#e9cd91');
    setAttribute(path, 'stroke-width', String(rules.board.tileSize * 0.46));
    setAttribute(path, 'stroke-linejoin', 'round');
    pathLayer.replaceChildren(path);
    const entry = rules.path.vertices[0];
    if (entry) {
      const marker = svg('text');
      setAttribute(marker, 'x', String(entry.x));
      setAttribute(marker, 'y', String(entry.y));
      setAttribute(marker, 'font-size', String(rules.board.tileSize * 0.24));
      setAttribute(marker, 'text-anchor', 'middle');
      setAttribute(marker, 'dominant-baseline', 'central');
      setAttribute(marker, 'fill', '#4c6349');
      setText(marker, '↻');
      pathLayer.append(marker);
    }

    const activeCells = new Set<string>();
    for (let row = 0; row < rules.board.rows; row += 1) {
      for (let col = 0; col < rules.board.columns; col += 1) {
        const key = `${col},${row}`;
        activeCells.add(key);
        if (cells.has(key)) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cell';
        button.dataset.col = String(col);
        button.dataset.row = String(row);
        button.addEventListener('click', () => onCell(col, row));
        const token = document.createElement('span');
        const star = document.createElement('span');
        star.className = 'unit-star';
        const coord = document.createElement('span');
        coord.className = 'coord';
        coord.textContent = `${col + 1},${row + 1}`;
        button.append(token, star, coord);
        board.append(button);
        cells.set(key, { button, token, star });
      }
    }
    for (const [key, cell] of cells) {
      if (!activeCells.has(key)) { cell.button.remove(); cells.delete(key); }
    }
  }

  function render(observation: Observation, selection: Selection, scheduler: SchedulerViewState): void {
    const { rules } = observation;
    const nextRulesKey = `${rules.rulesId}:${rules.rulesDigest}`;
    if (rulesKey !== nextRulesKey) {
      configureGeometry(rules);
      rulesKey = nextRulesKey;
    }
    const locked = observation.phase !== 'preparation' || scheduler.paused || scheduler.hidden;
    const boardUnits = observation.units.filter(unit => unit.location.kind === 'board');
    setText(wave, `${observation.wave} / ${rules.waveCount}`);
    setText(lives, String(observation.lives));
    setText(gold, String(observation.gold));
    setText(capacity, `${boardUnits.length} / ${rules.board.capacity}`);
    setText(phase, observation.phase === 'preparation' ? '편성 시간' :
      observation.phase === 'combat' ? '전투 중 · 편성 잠금' : '경기 종료');
    setText(tick, `tick ${observation.tick}`);
    setText(recruitCost, `영입 ${rules.recruitCost} 코인`);

    for (const [key, { button, token, star }] of cells) {
      const unit = boardUnits.find(candidate => candidate.location.kind === 'board' &&
        `${candidate.location.col},${candidate.location.row}` === key);
      setDisabled(button, locked);
      const selected = selection?.kind === 'unit' && selection.id === unit?.id;
      button.classList.toggle('selected', selected);
      setAttribute(button, 'aria-pressed', String(selected));
      setHidden(token, !unit);
      setHidden(star, !unit);
      if (unit) {
        setAttribute(token, 'class', `unit-token ${unit.typeId}`);
        setText(token, roleSymbols[unit.typeId]);
        setText(star, '★'.repeat(unit.star));
        setAttribute(button, 'aria-label', `${Number(button.dataset.col) + 1}열 ${Number(button.dataset.row) + 1}행, ${roleNames[unit.typeId]} ${unit.star}성, 수호자 ${unit.id}`);
      } else {
        setAttribute(token, 'class', '');
        setText(token, '');
        setText(star, '');
        setAttribute(button, 'aria-label', `${Number(button.dataset.col) + 1}열 ${Number(button.dataset.row) + 1}행, 빈칸`);
      }
    }

    const activeOffers = new Set<number>();
    for (const offer of observation.offers) {
      activeOffers.add(offer.slot);
      let node = offerNodes.get(offer.slot);
      if (!node) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'offer';
        button.dataset.offerSlot = String(offer.slot);
        button.addEventListener('click', () => onOffer(offer.slot));
        const name = document.createElement('strong');
        const detail = document.createElement('small');
        button.append(name, detail);
        offers.append(button);
        node = { button, name, detail };
        offerNodes.set(offer.slot, node);
      }
      const selected = selection?.kind === 'offer' && selection.slot === offer.slot;
      setDisabled(node.button, locked);
      node.button.classList.toggle('selected', selected);
      setAttribute(node.button, 'aria-pressed', String(selected));
      setText(node.name, `${roleSymbols[offer.typeId]} ${roleNames[offer.typeId]}`);
      setText(node.detail, `공격 ${rules.units[offer.typeId].damage} · ${rules.recruitCost} 코인`);
      setAttribute(node.button, 'aria-label', `후보 ${offer.slot + 1}, ${roleNames[offer.typeId]}, ${rules.recruitCost} 코인`);
    }
    for (const [slot, node] of offerNodes) {
      if (!activeOffers.has(slot)) { node.button.remove(); offerNodes.delete(slot); }
    }

    const activeEnemies = new Set<number>();
    for (const enemy of observation.enemies) {
      const position = pathPosition(enemy.distance);
      if (!position) continue;
      activeEnemies.add(enemy.id);
      let node = enemyNodes.get(enemy.id);
      if (!node) {
        const group = svg('g');
        const body = svg('circle');
        setAttribute(body, 'r', String(rules.board.tileSize * 0.2));
        setAttribute(body, 'fill', '#b44e43');
        setAttribute(body, 'stroke', '#733f35');
        setAttribute(body, 'stroke-width', String(rules.board.tileSize * 0.025));
        const hp = svg('text');
        setAttribute(hp, 'font-size', String(rules.board.tileSize * 0.2));
        setAttribute(hp, 'text-anchor', 'middle');
        setAttribute(hp, 'dominant-baseline', 'central');
        setAttribute(hp, 'fill', '#fff9e9');
        setAttribute(hp, 'font-weight', '700');
        group.append(body, hp);
        enemyLayer.append(group);
        node = { group, hp };
        enemyNodes.set(enemy.id, node);
      }
      setAttribute(node.group, 'transform', `translate(${position.x} ${position.y})`);
      setText(node.hp, String(enemy.hp));
    }
    for (const [id, node] of enemyNodes) {
      if (!activeEnemies.has(id)) { node.group.remove(); enemyNodes.delete(id); }
    }

    const selectedUnit = selection?.kind === 'unit'
      ? observation.units.find(unit => unit.id === selection.id) : undefined;
    const selectedOffer = selection?.kind === 'offer'
      ? observation.offers.find(offer => offer.slot === selection.slot) : undefined;
    setText(selectionLabel, observation.phase === 'result' ? '경기 종료 · 같은 seed로 다시 도전할 수 있습니다.' :
      locked ? '편성 잠금 · 전투가 끝나면 다시 배치할 수 있습니다.' :
      selectedOffer ? `${roleNames[selectedOffer.typeId]} 후보 선택 · 빈칸을 누르면 영입합니다.` :
      selectedUnit ? `${roleNames[selectedUnit.typeId]} 수호자 선택 · 빈칸은 이동, 다른 수호자는 교환합니다.` :
      '후보를 고르고 빈칸을 누르세요. 배치된 수호자를 누르면 이동·교환할 수 있습니다.');
    setDisabled(cancel, selection === null);
    setDisabled(startWave, locked);
    setText(startWave, observation.phase === 'combat' ? '전투 진행 중' : '전투 시작');
    setDisabled(pause, observation.phase !== 'combat');
    setText(pause, scheduler.paused ? '계속하기' : '일시정지');
    setHidden(overlay, !scheduler.paused && !scheduler.hidden);
    setText(overlay, scheduler.hidden ? '탭 숨김 · 자동 일시정지' : '잠시 쉬는 중');
    setHidden(result, observation.phase !== 'result');
    setDisabled(restart, observation.phase !== 'result');
    if (observation.phase === 'result') {
      setText(resultTitle, observation.outcome === 'win' ? '수호 성공!' : '다시 도전해요');
      setText(resultDetail, `웨이브 ${observation.wave} / ${rules.waveCount} · 남은 체력 ${observation.lives} · 코인 ${observation.gold}`);
    }
  }

  return { render };
}
