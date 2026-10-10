import './v2-style.css';

/** DOM handles only. Rules, prices, units and commands belong to the controller/core. */
export interface V2SlotRefs {
  readonly button: HTMLButtonElement;
  readonly token: HTMLSpanElement;
  readonly label: HTMLSpanElement;
  readonly detail: HTMLSpanElement;
}

export interface V2ShellRefs {
  readonly root: HTMLElement;
  readonly phase: HTMLElement;
  readonly wave: HTMLElement;
  readonly gold: HTMLElement;
  readonly enemyPressure: HTMLElement;
  readonly capacity: HTMLElement;
  readonly enemyCount: HTMLElement;
  readonly bossTime: HTMLElement;
  readonly segmentTime: HTMLElement;
  readonly wavePreview: HTMLElement;
  readonly arena: HTMLElement;
  readonly board: HTMLElement;
  /** Row-major order: index = row * 4 + column. */
  readonly boardCells: readonly V2SlotRefs[];
  readonly enemyLayer: SVGSVGElement;
  readonly bench: HTMLElement;
  readonly benchSlots: readonly V2SlotRefs[];
  readonly benchCount: HTMLElement;
  readonly offers: HTMLElement;
  readonly offerSlots: readonly V2SlotRefs[];
  readonly rerollButton: HTMLButtonElement;
  readonly rerollCost: HTMLElement;
  readonly selectionPanel: HTMLElement;
  readonly selectedName: HTMLElement;
  readonly selectedDetail: HTMLElement;
  readonly selectedStats: HTMLDListElement;
  readonly attack: HTMLElement;
  readonly attackSpeed: HTMLElement;
  readonly range: HTMLElement;
  readonly recruitButton: HTMLButtonElement;
  readonly recruitPreview: HTMLElement;
  readonly sellButton: HTMLButtonElement;
  readonly cancelButton: HTMLButtonElement;
  readonly synergies: HTMLDetailsElement;
  readonly synergyList: HTMLUListElement;
  readonly synergyCount: HTMLElement;
  readonly startButton: HTMLButtonElement;
  readonly pauseButton: HTMLButtonElement;
  readonly message: HTMLElement;
}

/**
 * Mount an inert v2 screen. No session is created and no game action is simulated.
 * The caller owns event listeners, state projection and enabling legal actions.
 * Reveal selectionPanel only for a selected unit or offer; clear it when selection ends.
 * Arena world bounds are -1000..5000 on each axis; board bounds are 0..4000.
 * A second mount replaces this host's children; keep only the latest returned refs.
 */
export function createV2Shell(root: HTMLElement): V2ShellRefs {
  root.classList.add('v2-shell');
  root.innerHTML = `
    <header class="v2-header">
      <div><p class="v2-kicker">기술 실험 · 임시 기물 · 밸런스 미확정</p><h1>무한의 가챠 디펜스</h1></div>
      <span class="v2-phase" data-v2="phase">연결 대기</span>
    </header>
    <dl class="v2-resources" aria-label="게임 현황">
      <div><dt>웨이브</dt><dd data-v2="wave">—</dd></div>
      <div><dt>코인</dt><dd data-v2="gold">—</dd></div>
      <div><dt>잔존 / 한계</dt><dd data-v2="enemy-pressure">—</dd></div>
      <div><dt>배치</dt><dd data-v2="capacity">—</dd></div>
    </dl>
    <div class="v2-workspace">
      <section class="v2-battle" aria-label="전장과 대기석">
        <div class="v2-battle-toolbar">
          <details class="v2-synergies" data-v2="synergies">
            <summary>시너지 <strong data-v2="synergy-count">—</strong><span aria-hidden="true">⌄</span></summary>
            <div class="v2-synergy-body"><h2>활성 시너지</h2><ul data-v2="synergy-list"><li>연결 후 표시됩니다.</li></ul></div>
          </details>
          <div class="v2-combat-status"><span>남은 적 <strong data-v2="enemy-count">—</strong></span><span>전투 남은 시간 <strong data-v2="segment-time">—</strong></span><span>보스 남은 시간 <strong data-v2="boss-time">—</strong></span></div>
          <div class="v2-play-actions"><button type="button" class="v2-button v2-primary" data-v2="start" disabled>전투 시작</button><button type="button" class="v2-button" data-v2="pause" disabled>일시정지</button></div>
        </div>
        <div class="v2-arena" data-v2="arena">
          <svg class="v2-path" viewBox="-1000 -1000 6000 6000" aria-hidden="true"><path d="M -500 -500 H 4500 V 4500 H -500 Z" /></svg>
          <span class="v2-placeholder-label">임시 그래픽</span>
          <svg class="v2-enemy-layer" data-v2="enemy-layer" viewBox="-1000 -1000 6000 6000" aria-label="적 이동 경로" role="img"></svg>
          <div class="v2-board" data-v2="board" role="group" aria-label="4행 4열 배치판"></div>
        </div>
        <p class="v2-wave-preview"><span>다음 웨이브</span><strong data-v2="wave-preview">연결 후 표시됩니다.</strong></p>
        <div class="v2-section-heading"><h2>대기석 <span class="v2-muted">8칸</span></h2><span data-v2="bench-count">— / 8</span></div>
        <div class="v2-bench" data-v2="bench" role="group" aria-label="대기석 8칸"></div>
      </section>
      <div class="v2-side">
        <section class="v2-panel v2-shop-panel" aria-label="수호자 상점">
          <div class="v2-shop-heading"><div><p class="v2-kicker">오늘의 만남</p><h2>수호자 상점</h2></div><button type="button" class="v2-button v2-reroll" data-v2="reroll" disabled>새로고침 <span data-v2="reroll-cost">—</span></button></div>
          <div class="v2-offers" data-v2="offers" role="group" aria-label="영입 후보 3명"></div>
        </section>
        <section class="v2-panel v2-selection-panel" data-v2="selection-panel" aria-label="선택한 수호자" hidden>
          <div class="v2-selection-heading"><h2 data-v2="selected-name">수호자를 선택하세요</h2><span data-v2="selected-detail">선택 없음</span><button type="button" class="v2-button" data-v2="cancel" disabled>선택 취소</button></div>
          <dl class="v2-unit-stats" data-v2="selected-stats"><div><dt>공격력</dt><dd data-v2="attack">—</dd></div><div><dt>공격 속도</dt><dd data-v2="attack-speed">—</dd></div><div><dt>사거리</dt><dd data-v2="range">—</dd></div></dl>
          <div data-v2="recruit-preview" class="v2-recruit-preview" hidden></div>
          <div class="v2-unit-actions"><button type="button" class="v2-button v2-primary" data-v2="recruit" disabled hidden>영입</button><button type="button" class="v2-button" data-v2="sell" disabled>판매</button></div>
        </section>
        <p class="v2-message" data-v2="message" role="status" aria-live="polite" aria-atomic="true">화면 준비 완료 · 게임 연결 전에는 조작할 수 없습니다.</p>
      </div>
    </div>`;

  function ref<T extends Element = HTMLElement>(name: string): T {
    const node = root.querySelector<T>(`[data-v2="${name}"]`);
    if (!node) throw new Error(`Missing v2 shell element: ${name}`);
    return node;
  }

  function slots(host: HTMLElement, count: number, kind: 'board' | 'bench' | 'offer'): V2SlotRefs[] {
    return Array.from({ length: count }, (_, index) => {
      const button = root.ownerDocument.createElement('button');
      button.type = 'button';
      button.className = `v2-slot v2-${kind}-slot`;
      button.disabled = true;
      button.dataset.slot = String(index);
      const location = kind === 'board'
        ? `${Math.floor(index / 4) + 1}행 ${index % 4 + 1}열`
        : `${kind === 'bench' ? '대기석' : '영입 후보'} ${index + 1}`;
      button.setAttribute('aria-label', `${location}, 게임 연결 대기`);
      const token = root.ownerDocument.createElement('span');
      token.className = 'v2-slot-token';
      token.setAttribute('aria-hidden', 'true');
      token.textContent = kind === 'offer' ? '◇' : '·';
      const label = root.ownerDocument.createElement('span');
      label.className = 'v2-slot-label';
      label.textContent = kind === 'offer' ? `후보 ${index + 1}` : '';
      const detail = root.ownerDocument.createElement('span');
      detail.className = 'v2-slot-detail';
      detail.textContent = kind === 'offer' ? '연결 대기' : '';
      button.append(token, label, detail);
      host.append(button);
      return { button, token, label, detail };
    });
  }

  const board = ref('board');
  const bench = ref('bench');
  const offers = ref('offers');
  return {
    root, phase: ref('phase'), wave: ref('wave'), gold: ref('gold'), enemyPressure: ref('enemy-pressure'),
    capacity: ref('capacity'), enemyCount: ref('enemy-count'), bossTime: ref('boss-time'), segmentTime: ref('segment-time'),
    wavePreview: ref('wave-preview'), arena: ref('arena'), board,
    boardCells: slots(board, 16, 'board'), enemyLayer: ref<SVGSVGElement>('enemy-layer'),
    bench, benchSlots: slots(bench, 8, 'bench'), benchCount: ref('bench-count'),
    offers, offerSlots: slots(offers, 3, 'offer'),
    rerollButton: ref<HTMLButtonElement>('reroll'), rerollCost: ref('reroll-cost'),
    selectionPanel: ref('selection-panel'), selectedName: ref('selected-name'), selectedDetail: ref('selected-detail'),
    selectedStats: ref<HTMLDListElement>('selected-stats'), attack: ref('attack'),
    attackSpeed: ref('attack-speed'), range: ref('range'),
    recruitButton: ref<HTMLButtonElement>('recruit'), recruitPreview: ref('recruit-preview'),
    sellButton: ref<HTMLButtonElement>('sell'), cancelButton: ref<HTMLButtonElement>('cancel'),
    synergies: ref<HTMLDetailsElement>('synergies'), synergyList: ref<HTMLUListElement>('synergy-list'), synergyCount: ref('synergy-count'),
    startButton: ref<HTMLButtonElement>('start'), pauseButton: ref<HTMLButtonElement>('pause'),
    message: ref('message'),
  };
}
