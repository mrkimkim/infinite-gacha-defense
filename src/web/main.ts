import './style.css';
import { createSession } from './session.ts';
import type { InputResult, ReplayRecord } from './session.ts';
import { createScheduler } from './scheduler.ts';
import { createView } from './view.ts';

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: ${id}`);
  return node as T;
}
const message = element('message');
function say(text: string, error = false) {
  message.textContent = text;
  message.classList.toggle('error', error);
}
const errors: Record<string, string> = {
  BAD_FORMAT: '입력 형식이 맞지 않습니다.', BAD_SEED: 'seed 값이 올바르지 않습니다.',
  UNKNOWN_RULES: '지원하지 않는 규칙입니다.', BAD_PHASE: '지금은 이 동작을 할 수 없습니다.',
  BAD_LOCATION: '배치할 수 없는 위치입니다.', LOCATION_OCCUPIED: '이미 수호자가 있는 칸입니다.',
  CAPACITY_REACHED: '배치 상한에 도달했습니다. 준비 중 이동과 교환은 가능합니다.',
  INSUFFICIENT_GOLD: '코인이 부족합니다.', UNIT_NOT_FOUND: '선택한 수호자를 찾을 수 없습니다.',
  SAME_LOCATION: '현재 위치와 같습니다.', DUPLICATE_ID: '서로 다른 수호자를 선택해 주세요.',
  NO_BOARD_UNITS: '수호자를 하나 이상 영입해서 배치해 주세요.',
  UNSUPPORTED_COMMAND: '이 기술 실험에서 지원하지 않는 기능입니다.',
  BAD_COUNT: '진행 시간 요청이 올바르지 않습니다.', INTEGER_OVERFLOW: '안전한 수치 범위를 벗어났습니다.',
  STALE_INPUT: '이전 경기의 입력을 무시했습니다.', NO_SELECTION: '영입 후보나 배치된 수호자를 먼저 선택하세요.',
};

function boot() {
  const seed = 1;
  const session = createSession(seed);
  const view = createView({ onCell: (col, row) => input(() => session.selectCell(col, row)),
    onOffer: (slot) => input(() => session.selectOffer(slot)) });
  const initial = session.observe();
  let lastPhase = initial.phase;
  let captureEpoch = 0;
  let fatalError: string | null = null;
  function showFatal() {
    if (fatalError === null) return;
    say(`진행을 중단했습니다: ${fatalError}. 재현 기록을 저장한 뒤 페이지를 새로고침해 주세요.`, true);
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      '#board button, #offers button, #start-wave, #pause, #restart, #cancel')) button.disabled = true;
  }
  const scheduler = createScheduler({
    tickMs: initial.rules.tickMs,
    getMatch: () => session.match,
    getPhase: (match) => match.state.phase,
    advance: (match, ticks) => {
      try {
        session.advance(match, ticks);
        render();
      } catch (error) {
        fatalError = error instanceof Error ? error.message : String(error);
        showFatal();
        throw error;
      }
    },
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    initiallyHidden: document.hidden,
  });

  function render() {
    if (fatalError !== null) { showFatal(); return; }
    const observation = session.observe();
    view.render(observation, session.selection, scheduler.getStatus());
    element('identity').textContent = `seed ${seed} · ${initial.rules.rulesId} · ${initial.rules.rulesDigest}`;
    element('archive-count').textContent = `보존된 이전 경기: ${session.archives.length} (현재 페이지 세션 안에서만 보존)`;
    element<HTMLButtonElement>('export-previous').disabled = session.archives.length === 0;
    if (lastPhase !== observation.phase) {
      if (lastPhase === 'combat' && observation.phase === 'preparation') say('웨이브를 막았습니다. 배치를 바꾸거나 수호자를 영입하세요.');
      if (observation.phase === 'result') say(observation.outcome === 'win' ? '5웨이브 기술 실험을 완주했습니다.' : '적을 놓쳐 체력이 모두 소진됐습니다. 다음 배치를 시험해 보세요.');
      lastPhase = observation.phase;
    }
  }
  function input(action: () => InputResult) {
    if (document.hidden || fatalError !== null) return;
    try {
      const result = action();
      say(result.ok ? '선택을 반영했습니다.' : errors[result.code] ?? result.code, !result.ok);
      scheduler.sync();
      render();
    } catch (error) {
      fatalError = error instanceof Error ? error.message : String(error);
      scheduler.dispose();
      showFatal();
    }
  }
  element('start-wave').addEventListener('click', () => input(() => session.start()));
  element('cancel').addEventListener('click', () => { if (fatalError !== null) return; session.cancel(); render(); say('선택을 취소했습니다.'); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && fatalError === null) { session.cancel(); render(); say('선택을 취소했습니다.'); }
  });
  element('pause').addEventListener('click', () => {
    if (fatalError !== null || session.observe().phase !== 'combat') return;
    scheduler.setPaused(!scheduler.getStatus().paused);
    render();
    say(scheduler.getStatus().paused ? '일시정지했습니다.' : '전투를 재개했습니다.');
  });
  document.addEventListener('visibilitychange', () => { scheduler.setHidden(document.hidden); render(); });
  window.addEventListener('pagehide', () => scheduler.setHidden(true));
  window.addEventListener('pageshow', () => { scheduler.setHidden(document.hidden); render(); });
  element('restart').addEventListener('click', () => {
    if (fatalError !== null) return;
    const result = session.restart();
    if (result.ok) {
      captureEpoch += 1;
      scheduler.sync();
      scheduler.setPaused(false);
      element('hash').textContent = '상태 해시: 아직 계산하지 않음';
      element<HTMLTextAreaElement>('evidence').value = '';
      say('이전 경기 기록을 보존했습니다. 같은 seed로 배치를 다시 시험하세요.');
    } else say(errors[result.code] ?? result.code, true);
    render();
  });

  async function capture() {
    const epoch = ++captureEpoch;
    const match = session.match;
    const canonicalState = session.canonical();
    const replay = session.record();
    const bytes = new TextEncoder().encode(canonicalState);
    let digest: ArrayBuffer;
    try { digest = await crypto.subtle.digest('SHA-256', bytes); }
    catch (error) {
      if (epoch === captureEpoch && session.match === match && fatalError === null) say(`해시 기록 실패: ${String(error)}`, true);
      return;
    }
    const stateHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    if (session.match !== match || epoch !== captureEpoch) return; // Late crypto work must not overwrite a restarted game.
    const atTick = JSON.parse(canonicalState) as { tick: number };
    element('hash').textContent = `기록 시점 tick ${atTick.tick} · SHA-256 ${stateHash}`;
    element<HTMLTextAreaElement>('evidence').value = JSON.stringify({ canonicalState, stateHash, ...replay }, null, 2);
  }
  function download(replay: ReplayRecord, suffix: string) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(replay, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `gacha-${initial.rules.rulesId}-seed${seed}-${suffix}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  element('snapshot').addEventListener('click', () => { void capture().catch((error: unknown) => { if (fatalError === null) say(`해시 기록 실패: ${String(error)}`, true); }); });
  element('export').addEventListener('click', () => download(session.record(), 'current'));
  element('export-previous').addEventListener('click', () => {
    const replay = session.archives.at(-1);
    if (replay) download(replay, `previous-${session.archives.length}`);
  });
  render();
  say('후보를 고르고 빈칸을 누르면 영입합니다. 수호자를 배치한 뒤 전투를 시작하세요.');
}
try { boot(); } catch (error) {
  say(`게임 연결 전: ${error instanceof Error ? error.message : String(error)}. 실제 코어 구현을 기다리고 있습니다.`, true);
  element('phase').textContent = '코어 미연결';
  for (const id of ['snapshot', 'export', 'start-wave', 'pause', 'restart']) element<HTMLButtonElement>(id).disabled = true;
}
