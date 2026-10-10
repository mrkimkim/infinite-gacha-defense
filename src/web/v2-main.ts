import type { CoreApi, CommandEvent, Location, RulesId } from '../core-v2/index.ts';
import './v2-art.css';
import { createV2Session } from './v2-session.ts';
import { createV2Shell } from './v2-shell.ts';
import { createV2Renderer } from './v2-view.ts';
import { createScheduler } from './scheduler.ts';
import { createLatestTaskGate } from './latest-task.ts';

const ERRORS: Readonly<Record<string, string>> = {
  BAD_PHASE: '전투 중에는 편성을 바꿀 수 없습니다.',
  BAD_LOCATION: '유효한 배치 위치를 선택하세요.', BAD_SLOT: '후보 칸을 다시 선택하세요.',
  OFFER_EMPTY: '이미 영입한 칸입니다. 상점을 새로고침하세요.',
  LOCATION_OCCUPIED: '이미 수호자가 있는 위치입니다.', NO_RECRUIT_SPACE: '영입 또는 자동승급 결과를 놓을 대기석이 없습니다.',
  INSUFFICIENT_GOLD: '코인이 부족합니다.', NO_BOARD_UNITS: '대기석의 수호자를 보드에 배치하세요.',
  UNIT_NOT_FOUND: '수호자를 다시 선택하세요.', STALE_INPUT: '이전 경기의 입력을 무시했습니다.',
  NO_SELECTION: '후보나 수호자를 먼저 선택하세요.', SAME_LOCATION: '현재 위치와 같습니다.',
};

/** Requires the reviewed runtime implementation. This module supplies no engine fallback. */
export function mountV2Game(root: HTMLElement, api: CoreApi, seed: number, rulesId: RulesId) {
  const rules = api.getRules(rulesId);
  if (!rules) throw new Error('UNKNOWN_RULES');
  const session = createV2Session(seed, rulesId, api);
  const shell = createV2Shell(root);
  const view = createV2Renderer(shell, api);
  const abort = new AbortController();
  let disposed = false;
  let fatal = false;
  let resultAnnounced = false;
  let message = '후보를 선택해 구매 예고를 확인하고 영입하세요. 같은 수호자 3명은 자동승급합니다.';
  const hashGate = createLatestTaskGate(() => session.match);
  const extra = root.ownerDocument.createElement('div');
  extra.className = 'v2-extra';
  extra.innerHTML = `<section class="v2-result" hidden aria-labelledby="v2-result-title"><h2 id="v2-result-title"></h2><p data-extra="result-detail"></p><button type="button" class="v2-button v2-primary" data-extra="restart">같은 seed로 다시 도전</button></section>
    <button type="button" class="v2-button" data-extra="preparation-restart">경기 다시 시작</button><div class="v2-confirm-panel" data-extra="restart-confirm" hidden></div>
    <details class="v2-diagnostics"><summary>규칙과 재현 기록</summary><p>단독 영입은 대기석으로, 같은 정의·같은 별 3명은 자동승급합니다. 전투 중 편성은 잠기며 탭을 숨기면 멈춥니다. 희귀도와 별 성급은 별개입니다. 확률·가격·기물은 미확정 기술 실험값입니다. 원형·선·기호는 아직 임시 그래픽입니다.</p><p data-extra="identity"></p><p data-extra="hash">상태 해시: 아직 기록하지 않음</p><div class="v2-diagnostic-actions"><button type="button" class="v2-button" data-extra="snapshot">현재 상태 기록</button><button type="button" class="v2-button" data-extra="export">현재 리플레이 저장</button><button type="button" class="v2-button" data-extra="previous" disabled>이전 경기 저장</button></div><p data-extra="archives"></p><textarea data-extra="evidence" readonly rows="4" aria-label="v2 경기 재현 데이터"></textarea></details>`;
  root.append(extra);
  function ref<T extends Element = HTMLElement>(key: string): T {
    const element = extra.querySelector<T>(`[data-extra="${key}"]`);
    if (!element) throw new Error(`Missing ${key}`);
    return element;
  }
  const result = extra.querySelector<HTMLElement>('.v2-result')!;
  const resultTitle = extra.querySelector<HTMLElement>('#v2-result-title')!;
  const restart = ref<HTMLButtonElement>('restart');
  const evidence = ref<HTMLTextAreaElement>('evidence');
  const preparationRestart = ref<HTMLButtonElement>('preparation-restart');
  const restartConfirm = ref('restart-confirm');
  const picker = root.ownerDocument.createElement('section');
  picker.className = 'v2-confirm-panel'; picker.hidden = true;
  shell.selectionPanel.append(picker);
  let closePending: (() => void) | null = null;
  function closeChoice() { picker.replaceChildren(); picker.hidden = true; restartConfirm.replaceChildren(); restartConfirm.hidden = true; closePending = null; }
  function stopWithError(error: unknown) {
    fatal = true;
    message = `경기를 중단했습니다: ${error instanceof Error ? error.message : String(error)}. 기록을 저장할 수 있습니다.`;
    scheduler.dispose(); hashGate.invalidate(); closeChoice();
    // A broken observe/render path must not be called again to report its error.
    shell.root.classList.add('v2-fatal');
    shell.phase.textContent = '오류 · 정지';
    shell.message.textContent = message;
    shell.root.querySelectorAll<HTMLButtonElement>('.v2-workspace button').forEach(button => { button.disabled = true; });
    restart.disabled = true;
  }
  function render() {
    if (disposed || fatal) return;
    const observed = session.observe();
    const selection = session.selection;
    const status = scheduler.getStatus();
    view.render(observed, {
      unitId: selection?.kind === 'unit' ? selection.id : null,
      offerSlot: selection?.kind === 'offer' ? selection.slot : null,
      paused: status.paused, hidden: status.hidden, fatal, message,
    });
    result.hidden = observed.phase !== 'result';
    resultTitle.textContent = observed.outcome === 'win' ? '수호 성공!' : '다시 도전해요';
    const reasons = { accumulation: '몬스터가 한계 수에 도달했습니다.', bossTimeout: '보스 제한시간이 끝났습니다.', finalTimeout: '마지막 적을 시간 안에 정리하지 못했습니다.', cleared: '모든 웨이브를 막았습니다.' };
    ref('result-detail').textContent = `${observed.wave} / ${rules!.waveCount} 웨이브 · ${observed.outcomeReason ? reasons[observed.outcomeReason] : ''}`;
    restart.disabled = fatal || observed.phase !== 'result';
    preparationRestart.hidden = observed.phase !== 'preparation';
    preparationRestart.disabled = fatal || session.match.state.acceptedLog.length === 0;
    ref('identity').textContent = `seed ${seed} · ${rulesId} · ${rules!.rulesDigest}`;
    ref('archives').textContent = `보존된 이전 경기: ${session.archives.length} · 현재 페이지 세션에서만 유지됩니다.`;
    ref<HTMLButtonElement>('previous').disabled = session.archives.length === 0;
    if (observed.phase === 'result' && !resultAnnounced) {
      resultAnnounced = true;
      result.scrollIntoView({ block: 'nearest' });
      restart.focus({ preventScroll: true });
    } else if (observed.phase !== 'result') resultAnnounced = false;
  }
  function notice(events: readonly CommandEvent[]): string {
    const primary = events[0];
    if (!primary) return '선택을 바꿨습니다.';
    switch (primary.type) {
      case 'recruited': return primary.upgrades.length ? `${primary.upgrades.length}단계 자동승급 · ${primary.result.star}성 수호자를 선택했습니다.` : '영입한 수호자를 선택했습니다. 보드 칸을 눌러 배치하세요.';
      case 'sold': return `판매했습니다. 코인 +${primary.goldDelta}`;
      case 'waveStarted': return '전투가 시작됐습니다. 선택한 수호자의 사거리는 확인할 수 있습니다.';
      case 'rerolled': return '새 후보 세 명을 만났습니다.';
      default: return '편성을 바꿨습니다.';
    }
  }
  function action(run: () => { ok: true; events?: readonly CommandEvent[] } | { ok: false; code: string }) {
    if (disposed || fatal) return;
    try {
      const response = run();
      message = response.ok ? notice(response.events ?? []) : (ERRORS[response.code] ?? `선택을 반영하지 못했습니다: ${response.code}`);
      if (response.ok) closeChoice();
      scheduler.sync(); render();
    } catch (error) { stopWithError(error); }
  }
  const scheduler = createScheduler({
    tickMs: rules.tickMs, getMatch: () => session.match, getPhase: match => match.state.phase,
    advance: (match, ticks) => {
      try {
        const response = session.advance(match, ticks);
        if (response) {
          view.showEvents(response.events);
          const completed = response.events.find(event => event.type === 'waveCompleted');
          if (completed?.type === 'waveCompleted') message = `웨이브 완료 · 남은 적 ${completed.carriedEnemyIds.length} · 코인 +${completed.goldDelta}`;
          const ended = response.events.find(event => event.type === 'matchEnded');
          if (ended?.type === 'matchEnded') {
            const reason = { accumulation: '몬스터가 한계 수에 도달했습니다.', bossTimeout: '보스 제한시간이 끝났습니다.', finalTimeout: '마지막 적을 시간 안에 정리하지 못했습니다.', cleared: '모든 웨이브를 막았습니다.' };
            message = `${ended.outcome === 'win' ? '수호 성공!' : '방어 실패.'} ${reason[ended.reason]}`;
          }
          if (session.match.state.phase !== 'combat') { closeChoice(); }
          render();
        }
      } catch (error) { stopWithError(error); }
    },
    requestFrame: callback => requestAnimationFrame(callback), cancelFrame: handle => cancelAnimationFrame(handle),
    initiallyHidden: document.hidden,
  });
  const on = (element: EventTarget, type: string, callback: EventListener) => element.addEventListener(type, event => {
    if (disposed) return;
    try { callback(event); } catch (error) { stopWithError(error); }
  }, { signal: abort.signal });
  const selectLocation = (location: Location) => {
    const owner = session.match;
    action(() => session.selectLocation(location, owner));
  };
  shell.boardCells.forEach((cell, index) => on(cell.button, 'click', () => selectLocation({ kind: 'board', col: index % 4, row: Math.floor(index / 4) })));
  shell.benchSlots.forEach((slot, index) => on(slot.button, 'click', () => selectLocation({ kind: 'bench', slot: index })));
  shell.offerSlots.forEach((slot, index) => on(slot.button, 'click', () => { action(() => session.selectOffer(index)); }));
  on(shell.cancelButton, 'click', () => { if (fatal || disposed) return; closePending?.(); closeChoice(); session.cancel(); message = '선택을 취소했습니다.'; render(); });
  on(document, 'keydown', event => { if (!fatal && !disposed && (event as KeyboardEvent).key === 'Escape') { closePending?.(); closeChoice(); session.cancel(); message = '선택을 취소했습니다.'; render(); } });
  on(shell.recruitButton, 'click', () => action(() => session.recruitSelected()));
  on(shell.rerollButton, 'click', () => action(() => session.reroll()));
  on(shell.startButton, 'click', () => { action(() => session.start()); });
  on(shell.pauseButton, 'click', () => { if (fatal) return; scheduler.setPaused(!scheduler.getStatus().paused); message = scheduler.getStatus().paused ? '일시정지했습니다.' : '전투를 재개했습니다.'; render(); });
  function choiceButton(text: string, callback: () => void) {
    const button = root.ownerDocument.createElement('button'); button.type = 'button';
    button.className = 'v2-button'; button.textContent = text; on(button, 'click', callback); return button;
  }
  on(shell.sellButton, 'click', () => {
    const selected = session.selection;
    if (selected?.kind !== 'unit' || session.observe().phase !== 'preparation') return;
    const owner = session.match;
    const unit = session.observe().units.find(value => value.id === selected.id);
    if (!unit) return;
    closeChoice(); picker.hidden = false;
    const prompt = root.ownerDocument.createElement('p');
    prompt.textContent = `이 수호자를 판매할까요? 코인 +${unit.sellGold}. 되돌릴 수 없습니다.`;
    picker.append(prompt, choiceButton('판매 확정', () => action(() => session.sell(unit.id, owner))), choiceButton('취소', () => { closeChoice(); render(); }));
    closePending = () => closeChoice();
  });
  function restartMatch(owner = session.match) {
    action(() => {
      const response = session.restart(owner);
      if (response.ok) {
        hashGate.invalidate(); evidence.value = ''; ref('hash').textContent = '상태 해시: 아직 기록하지 않음';
        view.clearEffects(); scheduler.setPaused(false); shell.root.scrollIntoView({ block: 'start' });
      }
      return response;
    });
    if (owner !== session.match) shell.offerSlots[0]!.button.focus();
  }
  on(restart, 'click', () => restartMatch());
  on(preparationRestart, 'click', () => {
    if (fatal || session.observe().phase !== 'preparation') return;
    const owner = session.match;
    closeChoice(); restartConfirm.hidden = false;
    const prompt = root.ownerDocument.createElement('p');
    prompt.textContent = '현재 경기 기록을 보관하고 같은 조건으로 새 경기를 시작할까요?';
    const confirm = choiceButton('새 경기 시작', () => restartMatch(owner));
    const cancel = () => { closeChoice(); preparationRestart.focus(); };
    restartConfirm.append(prompt, confirm, choiceButton('취소', cancel));
    closePending = cancel; confirm.focus();
  });
  on(document, 'visibilitychange', () => { scheduler.setHidden(document.hidden); render(); });
  on(window, 'pagehide', () => { scheduler.setHidden(true); render(); });
  on(window, 'pageshow', () => { scheduler.setHidden(document.hidden); render(); });
  on(ref('snapshot'), 'click', () => {
    hashGate.invalidate();
    try {
      const canonicalState = session.canonical(); const record = session.record(); const tick = session.match.state.tick;
      ref('hash').textContent = '상태 해시 계산 중';
      void hashGate.run(async () => {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalState));
        const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        if (hash !== record.finalHash) throw new Error('코어/브라우저 상태 해시 불일치');
        return { canonicalState, stateHash: hash, ...record };
      }, value => { ref('hash').textContent = `기록 tick ${tick} · SHA-256 ${value.stateHash}`; evidence.value = JSON.stringify(value, null, 2); }, error => { ref('hash').textContent = `해시 기록 실패: ${String(error)}`; });
    } catch (error) { ref('hash').textContent = `기록 실패: ${String(error)}`; }
  });
  function download(value: unknown, name: string) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const anchor = root.ownerDocument.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  on(ref('export'), 'click', () => { try { download(session.record(), `gacha-v2-${seed}.json`); } catch (error) { message = `저장 실패: ${String(error)}`; render(); } });
  on(ref('previous'), 'click', () => { const old = session.archives.at(-1); if (old) download(old, `gacha-v2-previous-${seed}.json`); });
  try { render(); } catch (error) { stopWithError(error); }
  return { dispose() { disposed = true; scheduler.dispose(); hashGate.dispose(); abort.abort(); view.dispose(); } };
}
