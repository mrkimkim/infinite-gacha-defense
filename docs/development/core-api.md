# 공통 코어 API — Issue #12

owner 모모 · assignment-generation 1 · base `ee2fa330b148dffe1e1b8f1c59b86aaeeb6a37e1`

첫 기술 프로필 구현 체크포인트다. API-only PR #17 head `b6b38f9edcf0fc0181dfd461f677a28a37849192`의 공개 shape를 유지하고 실제 구현을 연결했다. 아래 로컬 검증은 그 head 위의 미커밋 변경에 해당하며, 게시/독립 동료 리뷰/통합/브라우저 검증은 별도다. growth는 구현하지 않았다.

## 사용 표면

브라우저·CLI는 `src/core/index.ts`에서 값과 타입을 import한다. 모두 **동기 함수**이며 Promise가 아니다. 아래 설명은 구현한 계약이다.

- `createMatch(seed, rulesId = DEFAULT_RULES_ID)`: `{ok:true,state}` 또는 `{ok:false,error}`. seed는 런타임 검증을 위해 unknown을 받는다. 기본 규칙 ID는 `technical-v1`, schemaVersion은 `1`이다. growth는 등록하지 않는다.
- `dispatch(state, command)`: 성공 `{ok:true,state,events}`, 거부 `{ok:false,state,error}`. command는 unknown을 받아 정확한 JSON shape를 검사한다. `Command` 타입도 제공하므로 어댑터는 정상 입력을 정적으로 검사할 수 있다. merge shape는 계약에 포함하되 첫 프로필에서는 거부한다.
- `advance(state, count)`: 성공 `{ok:true,state,events,executedTicks}`, 거부 `{ok:false,state,error,executedTicks:0}`. 1..10000 안전한 정수만 허용한다. 준비/결과에서는 거부하고, 전투에서 준비/결과로 전환하면 조기 종료한다.
- `observe(state)`: 깊은 복사인 `Observation`. 현재 units/enemies/offers/phase/outcome/wave/waveTick/tick/lives/gold와 공개 rules를 제공한다. seed, rngState, nextEntityId, spawnCursor, acceptedLog, replay header 및 미래 스폰/후보열을 주지 않는다.
- `getRules(rulesId = DEFAULT_RULES_ID)`: 깊은 복사인 `PublicRules`, 미등록 ID는 null. 표시/좌표에 필요한 상수만 공개하며 미래 스폰 목록은 제공하지 않는다. 실제 digest는 비공개 전체 규칙 데이터로 계산한다.
- `pathPosition(distance)`: 계약의 0..19999 정수에 대해 `{x,y}`. 구간 밖/비정수는 null이며 modulo로 적을 되살리지 않는다. 닫힌 렌더 경로는 `rules.path.vertices` 순서를 따라 마지막 점과 첫 점을 연결한다.
- `boardPosition(col,row)`: 0..3 정수 좌표의 셀 중심 `{x,y}`, 그 외 null. 어댑터에 셀 중심 수식을 복제하지 않는다.
- `canonicalState(state)`: 계약 §8 투영의 canonical JSON string.
- `stateHash(state)`: 위 문자열의 UTF-8 SHA-256 소문자 hex. 동기·순수 구현으로 Node/DOM crypto나 TextEncoder에 의존하지 않는다.
- `replay(header, entries, expectedFinalHash?)`: 성공 `{ok:true,state}`, 실패 `{ok:false,error:{code,entryIndex}}`. 입력은 unknown이며 사전 검증한다. 실패 시 state/부분 로그/RNG를 반환하지 않는다. header 오류는 entryIndex=null, entry 오류는 0부터 시작한다. 옵션 최종 해시 불일치는 entryIndex=null이다.

## 상태 소유권과 오류

반환 타입은 중첩 배열/위치/명령/로그까지 readonly이다. 코어는 성공/실패 모두 입력 상태를 변경하지 않는다. 성공 시 새 상태를 반환하며 어댑터는 성공한 `result.state`로만 현재 상태를 교체한다. 거부 시 `result.state === inputState`이고 상태 전체와 로그 내용도 그대로다. `observe`/`getRules`는 코어와 공유하는 가변 참조를 주지 않는다. 타입 단언으로 readonly를 우회하거나 MatchState를 임의 제작하는 것은 지원 어댑터 사용법이 아니다.

실패 코드는 `types.ts`의 CoreErrorCode/ReplayErrorCode가 원본이다. 오류를 코어 상태나 acceptedLog에 저장하지 않는다. ID/tick/재화 등 안전한 정수 범위를 넘는 계산은 `INTEGER_OVERFLOW`로 원자적으로 거부한다. 게임 상태의 수동 변조/저장 복구는 이 API 범위 밖이다.

## 로그와 이벤트 shape

`offers`는 `{slot,typeId}` 배열이며 slot순이다. units/enemies는 numeric id순으로 직렬화한다.

- command entry: `{type:'command',seq,atTick,command,events}`.
- advance entry: `{type:'advance',seq,startTick,executedTicks}`.
- 첫 프로필의 command ID 이벤트는 recruit의 `{type:'unitCreated',id,typeId,star:1,location}`뿐이다. move/swap/startWave 성공의 events는 빈 배열이다. 거부 명령은 로그가 없다. growth 합성 이벤트는 성장 작업에서 추가한다.
- advance 반환 CombatEvent는 화면/검증을 위한 생성·공격·처치·누수·웨이브/결과 알림이다. acceptedLog에는 넣지 않는다. spawn/attack/defeat/leak의 tick은 그 tick 시작 시점, waveCompleted/matchEnded는 계약의 tick 증가 이후 시점으로 정의한다. events 배열은 실제 실행 순서이다.

리플레이는 header shape/schema/규칙/digest/seed와 전체 entries shape/seq 연속성을 **경기 생성 전** 검사한다. 명령과 이벤트를 다시 계산하고 비교하며 로그가 ID나 상태를 강제 삽입하지 않는다. advance batching이 달라지면 acceptedLog가 달라도 canonicalState는 같아야 한다.

## 규칙 digest와 이식성

실제 규칙 데이터는 모집·유닛·적·각 웨이브·경로·상한·시간·PRNG 정의 및 schemaVersion/rulesId를 한 곳에 보관한다. 이 전체 객체에서 rulesDigest 자체와 표시 메타데이터만 제외하고 객체 키 ASCII 정렬/배열 원순서/공백 없는 JSON으로 직렬화한 UTF-8 SHA-256을 규칙 digest로 쓴다. 공개 rules 투영만 해시하지 않는다. 같은 rulesId로 데이터를 조용히 변경하지 않는다. 현재 `technical-v1` 전체 규칙 digest는 `2cb7551c39c4cdbbb31e0003a74c70148caf7c9b15e2e6f8d422c4c7648578bd`다. `rules.ts`의 전체 데이터는 실행 시 깊게 freeze한다. 테스트에서 독립 작성한 기대 규칙 투영/직렬화와 Node crypto로 digest를 교차 검증한다.

상태 canonical 투영은 계약의 정확한 17개 루트 키를 모두 포함하며 acceptedLog만 제외한다. 규칙 데이터 및 상태 해시는 코어 밖 IO 없이 계산한다. 해시는 tick 판정 안에서 호출하지 않는다. 벽시계, Date, Math.random, DOM, Node API를 사용하지 않는다.

`tsconfig.core.json`은 루트 strict 옵션을 상속하되 `lib:["ES2022"]`, `types:[]`, `include:["src/core/**/*.ts"]`로 코어의 Node/DOM 오염을 막는다. 코어 확인 명령은 `tsc --noEmit -p tsconfig.core.json`이다. package/lock/CI/web/cli는 이 작업에서 변경하지 않는다.

## 로컬 검증 — 2026-10-10

실행 환경은 Node 24.19.0이다. 기존 검토 설치 `/tmp`의 dependency tree를 로컬 ignored `node_modules/`에서 재사용했으며 양쪽 package-lock SHA-256이 동일함을 확인했다. package/lock/CI 파일은 변경하지 않았다.

- `node --test tests/core/*.test.ts`: **42 PASS**, 0 FAIL. 코어 전용 테스트는 현재 루트 `npm test`에 자동 포함되지 않으므로 이 명령을 별도로 실행해야 한다.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.core.json`: PASS, ES2022만 허용하고 Node/DOM ambient types 없음.
- `npm run typecheck`: PASS. 테스트와 기존 tooling/Vite 설정까지 포함한 전체 타입 검사.
- `npm run check`: PASS. 전체 타입 검사 + 기존 tooling 테스트 3개 + tooling ES 번들. 게임 UI 빌드 성공을 뜻하지 않는다.
- `git diff --check`: PASS.
- core 소스의 벽시계/Math.random/Node import/DOM/network/timer/dynamic import 패턴 검색: 0건. 실제 각 import는 코어 내부 상대 모듈뿐이다.

코어 검사는 다음을 포함한다.

- strict unknown command/replay shape: 추가/누락 키, NaN/Infinity/소수, 잘못된 ID/좌표, sparse/추가 속성 배열, accessor/hidden/symbol/custom prototype 거부.
- 거부 시 frozen input 전체 불변/동일 참조, 성공 시 새 상태 및 command/events/기존 acceptedLog의 깊은 참조 분리, observe/public rules 복사.
- 경로 8개 경계와 16개 셀, 정확/초과 누수 1회, 처치가 이동보다 먼저, lives=0의 패배 우선.
- 사거리/폭발 경계 포함, 거리/ID 동률, 유닛 ID 순서와 처치 후 재표적, 공격 범위 밖 폭발 부수 대상, 쿨다운 주기, 벤치 비활성 진단 fixture.
- 동일 seed 재현, 무효 입력 삽입 후 미래 RNG/ID 불변, advance batching과 조기 종료 상태 동일성, 로그 차이는 별도 인정. seed1..20 고정 정책에서 각 웨이브 경계 canonical bytes와 전체 전투 이벤트열 및 두 batching의 최종 replay를 비교한다(7 win/13 loss는 회귀 스냅샷이며 밸런스 기준 아님).
- replay header/전체 nested entry 사전 검증, 연속 seq, tick/명령/이벤트/실행 tick/최종 해시 변조 거부 및 부분 상태 없음.
- SHA-256 empty/abc/다중 block/million-a 알려진 벡터, 55/56/63/64/65 bytes를 포함하는 261개 padding 길이, Unicode scalar 경계/보충 문자/짝 없는 surrogate, 독립 Node crypto 대조.
- canonical 정확한 17개 루트 필드, 객체 키 순서/엔티티 ID 순서, 로그 제외, 전체 규칙 digest 독립 투영/Node crypto 대조.

정상 API만 사용한 재현 사례:

1. seed 2, 첫 준비에 (0,0)/(3,0)/(3,3) offerSlot0 영입, 두 번째 준비에 (0,3) offerSlot0 영입. 각 준비 startWave 후 advance(10000). wave5 win, tick1069, lives3, gold10, 로그14개. 상태 해시 `b7597d05f3c0333256fddf65841b6949cefd99d20ff65256c0ac28dc5770f5be`.
2. seed 1, (1,1) offerSlot0 하나만 영입, 각 준비 startWave 후 advance(10000). wave3 loss, tick740, lives0, gold10, 로그7개. 상태 해시 `3d6ecc06a74af31d14f1d3775efb223bf528f92501da8250d0eab87a5fc6b819`.

두 사례 모두 원본 acceptedLog와 최종 해시로 replay 일치를 확인했다. 경계 검사의 임의 fixture는 정상 경기/밸런스 증거와 분리했다. 이 자동 시뮬레이션은 재미/승률/경제 전환 검증이나 사람 플레이가 아니다.

브라우저·Node 코어 bytes 교차 실행, 실제 UI 시작→결과→재시작, 어댑터 pause/hidden/stale callback, 사람 플레이는 이 코어 작업에서 **NOT_RUN**이다. 독립 동료 리뷰 및 실제 통합 SHA 재검증 전에는 verified로 표시하지 않는다.


## 리뷰 반영: merge 사전 형식 검사

[리더 PR #17 검토 질문](https://github.com/mrkimkim/infinite-gacha-defense/pull/17#issuecomment-6094047783)과 계약 §3의 `ids` 중복 불가/`keepId` 포함 조건을 반영했다. `ids`는 서로 다른 양의 안전한 정수 정확히 3개이며 `keepId`가 그중 하나여야 유효한 명령 형식이다. 위반은 dispatch의 `BAD_FORMAT`, replay 전체 사전 검사에서 해당 entryIndex의 `BAD_FORMAT`이다. 정상 형식의 merge는 첫 기술 프로필에서 계속 `UNSUPPORTED_COMMAND`로 거부되며, replay 적용 시 `COMMAND_REJECTED`다.

회귀 검사에는 frozen 입력의 동일 참조/전체 불변, 앞 entry의 tick 불일치보다 뒤 malformed merge의 사전 검사 오류가 우선하는 경우, 정상 형식의 미지원 merge 거부를 포함한다. 이 수정은 공개 API·승인 규칙 수치·규칙 digest를 바꾸지 않는다. 검증은 구현 head `0918459aeb7684ab850da19627d3f4969f044517` 위의 미커밋 수정에서 수행했고, 새 게시 SHA의 동료 재검토는 별도다.
