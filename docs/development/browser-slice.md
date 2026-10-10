# 첫 브라우저 기술 슬라이스

Issue [#13](https://github.com/mrkimkim/infinite-gacha-defense/issues/13), owner 키키, assignment-generation 1. 기준 `ee2fa330b148dffe1e1b8f1c59b86aaeeb6a37e1`, branch `kiki/browser-slice-v1`.

## 최신 검증 상태 · 2026-10-10 05:05 UTC

실행 가능한 코어 `0918459aeb7684ab850da19627d3f4969f044517`와 CLI `c05e52dd80d1a4e4f92448ce35334af5f7e58cd6`를 별도 폴더에 무수정 결합했다. web `5e83f3e4e488848eb0e7e14e32712020dbe5e679` 기준 `npm run check` **104 PASS / 0 SKIP**, 코어 전용 타입 검사 및 실제 web build가 통과했다. 아래 API stub/미게시 기록은 이전 단계의 역사이며 현재 코어 연결 차단은 해제됐다. 이 별도 조합은 아직 main 통합 SHA가 아니다.

후속 web 수정은 restart의 예상 밖 throw도 같은 fatal 경계로 처리하고, 기술 실험 배지/성공 안내의 웨이브 수를 공개 rules.waveCount에서 읽는다. 타입 검사 및 실제 코어와 결합한 빌드를 재통과했다. 정적/Node/번들 검증과 실제 브라우저 플레이 차단은 구분한다.

## 범위

정면 4×4 준비 → 후보 영입/배치/이동/교환 → 전투 → 5웨이브 결과 → 같은 seed 재시작의 브라우저 어댑터다. 승인 계약의 첫 기술 프로필만 사용한다. 실제 규칙, 경제, 명령 검증, 표적/경로/전투는 `src/core/index.ts`의 공통 코어를 사용하며 복제하지 않는다. 코어 API 연결 및 실제 실행 검증이 끝나기 전에는 완주했다고 보고하지 않는다.

임시 도형은 역할·선택·명령 입력을 검증하기 위한 placeholder다. `assets/candidates`를 production으로 승인하거나 게임용 최종 아트로 사용하지 않는다. UI의 글자·숫자·성·체력은 런타임 레이어다.

## 시간 어댑터

`createScheduler`는 코어가 소유한 `tickMs`를 입력받는다. 고정 시간 단위를 모아서 `advance`를 호출하며 전투 dt나 게임 규칙을 수정하지 않는다. 경기 identity는 immutable 코어 State 참조가 아닌 **한 경기 동안 유지하는 wrapper**다. 새 경기에서는 wrapper를 바꾼다.

- 수동 pause와 hidden은 별도 상태이며 둘 중 하나만 참이어도 진행하지 않는다.
- pause/hidden/phase/match 경계에서 accumulator와 timestamp를 버리고 epoch를 갱신한다.
- 취소된 callback·중복 callback·오래된 경기 callback은 호출되어도 진행하지 않는다.
- 재개 후 첫 frame은 timestamp만 잡고 tick 0. `dt < 0` 또는 `dt > 250ms`는 누적시간을 버린다. 정확히 250ms는 정상이다.
- preparation/result에서 시간 진행 없음. 다음 웨이브는 명시적 입력으로 시작한다.
- `advance` 예외는 scheduler를 폐기하고 재throw한다. 이 인스턴스를 다시 시작하지 않는다.
- 입력 dispatch 또는 경기 교체 뒤 `sync()`로 경계를 반영한다. callback 안에서도 identity/phase를 재검사한다.

## 검증 상태

키키 클라우드 Node v24.19.0에서 `node --test tests/web/scheduler.test.ts`의 fakeRAF 35개가 통과했다. 취소된 콜백을 실제로 다시 호출하는 fake를 사용한다. 고정 tick/잔여시간, 250ms 포함/초과, 비정상 timestamp, pause/hidden 순서, phase/새 경기 전환, duplicate callback, immutable inner state 교체, 예외 중단, tickMs 입력 검증을 포함한다. **fakeRAF 검사는 실제 브라우저 플레이 증거가 아니다.**

통합 도구 base는 별도 detached checkout에서 `npm ci --ignore-scripts` 후 `npm run check`가 통과했다(도구 테스트3개/타입검사/도구 번들). 당시 실제 index.html이 없어서 기본 game build는 예상대로 실패했다. 이 결과를 이 브랜치 최종 build 검증으로 대체하지 않는다.

브라우저 연결 점검: 키키의 클라우드 CUA Chrome에서 공개 HTTPS 탐색·클릭은 성공했다. 로컬 셸의 Vite dev가 ready를 출력했으나 같은 시각 CUA에서 `http://127.0.0.1:4173/tools/tooling-probe.ts`는 `ERR_CONNECTION_REFUSED`. 별도 headless Chromium은 socket 제한으로 실행되지 않았다. 실제 게임 로컬 연결·완주·승패·숨김/재개 조작은 아직 **BLOCKED/NOT_RUN**이다. 리더에게 승인된 공용 preview 경로를 요청했으며 임의 배포나 보안 설정 변경은 하지 않았다.

사람 플레이는 미실시다. DOT의 UI 조작이나 봇 결과를 사람 피드백·재미 검증으로 부르지 않는다.

## 공개 API 결합 검사

모모 API checkpoint `b6b38f9edcf0fc0181dfd461f677a28a37849192`를 별도 임시 결합 폴더에 추출하고 이 브랜치의 web/index/tests를 얹었다. 코어 소스는 수정하지 않았다. 이 조합의 `npm run typecheck`, `npm run build`, fakeRAF 35개가 통과했다. API 함수가 아직 모두 throw인 스텁이므로 **빌드 성공은 게임 동작 성공이 아니다.** 자기 브랜치의 core 누락을 감추기 위한 가짜 구현은 넣지 않는다. 실행 가능한 코어가 게시되면 새 SHA로 다시 검사한다.

재현 데이터는 현재 페이지 세션의 메모리에만 있다. 같은 seed 재시작 전 이전 경기의 authoritative header/entries를 보존한다. 파일 저장 버튼으로 JSON을 사용자가 내려받을 수 있다. 새로고침/탭 종료를 넘기는 지속 저장은 이번 범위가 아니다. 별도의 상태 기록 버튼은 실제 canonical bytes를 browser crypto.subtle로 SHA-256하고 해당 tick을 함께 보여 준다. 비동기 결과는 새 경기 또는 더 최신 기록 요청을 덮어쓰지 않는다.

입력 세션은 `tests/web/session.test.ts`의 22개 명시적 CoreApi test double 검사도 통과했다. frozen 상태/스크립트된 반환을 쓰며 실제 core 게임 규칙 구현을 대신하지 않는다. 선택·취소, 정확한 recruit/move/swap 명령, 빠른 두 번째 클릭에서 중복 구매하지 않음, 실패 시 상태/선택 유지, phase 제한, 재시작 실패/재시도, 보존→새 wrapper 순서, 오래된 wrapper 입력/advance 무시를 검사한다. 합계 어댑터 테스트 57개, 타입 검사 및 스텁 API와 결합한 브라우저 번들이 통과했다. 실제 코어 통합 검사는 아직 별도다.

예상하지 못한 전투/입력 예외는 치명 오류로 고정하고 편성·시작·pause·재시작을 잠근다. 멈춘 scheduler에서 ‘재개했다’고 잘못 안내하지 않으며 기록 저장 후 수동 새로고침이 필요함을 표시한다. 이 예외 안내와 결과→새 경기 안내 수정은 코드 경로 검토와 타입/빌드 검사를 거쳤지만 실제 DOM 이벤트로 재현한 증거는 아직 없다.

### 실제 코어와 연결한 세션 회귀

`session-core.test.ts`는 실제 코어0918459에 연결한7개 Node 검사다. recruit→move→swap, 거부 시 full state/선택 불변, seed1의 승리/패배 고정 시나리오, Node SHA-256 대조, 실제 replay/archive, 같은 seed 재시작과 오래된 wrapper 거부, advance1/5 상태 동등성을 포함한다.

관측 후 고정한 회귀 시나리오: 준비 때 공개 observe만 보고 중앙 네 위치를 채우며 보이는 single 후보를 우선하는 smoke는 seed1/tick970/lives9 승리. 첫 offer0을(0,0)에 한 번만 영입하는 smoke는 seed1/tick500/wave2 패배. 이는 일반/숙련 사람 정책이나 밸런스 기대값이 아니며 실제 브라우저 입력을 대신하지 않는다. 완주/결과를 Node에서 검사하는 고정 회귀다.

restart 시 예상 밖 createMatch throw에서도 이전 match/로그/archive가 보존되는 test double 검사1개를 추가했다. 현재 web은 fakeRAF35 + 입력double23 + 실제core연결7 = **65개**다. 실제 DOM의 restart 예외 안내 유지와 crypto 완료 시점은 리더의 별도 브라우저 검사가 필요하다.
