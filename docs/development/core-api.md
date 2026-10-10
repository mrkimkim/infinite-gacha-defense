# 공통 코어 API 초안 — Issue #12

owner 모모 · assignment-generation 1 · base `ee2fa330b148dffe1e1b8f1c59b86aaeeb6a37e1`

이 체크포인트는 어댑터 연결을 위한 **타입/exports만 있는 초안**이다. `src/core/index.ts`의 모든 함수는 현재 `CORE_NOT_IMPLEMENTED`를 throw한다. 게임 생성·명령·전투·해시·재생은 아직 실행할 수 없다. 테스트 통과나 게임 완성을 뜻하지 않는다. 동료는 공개 shape에 대한 이견을 이 단계에서 알려 달라.

## 사용 표면

브라우저·CLI는 `src/core/index.ts`에서 값과 타입을 import한다. 모두 **동기 함수**이며 Promise가 아니다. 아래 설명은 구현할 계약이다.

- `createMatch(seed, rulesId = DEFAULT_RULES_ID)`: `{ok:true,state}` 또는 `{ok:false,error}`. seed는 런타임 검증을 위해 unknown을 받는다. 기본 규칙 ID 제안은 `technical-v1`, schemaVersion은 `1`이다. growth는 등록하지 않는다.
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

실패 코드는 `types.ts`의 CoreErrorCode/ReplayErrorCode가 원본이다. 오류를 코어 상태나 acceptedLog에 저장하지 않는다. ID/tick/재화 등 안전한 정수 범위를 넘는 계산은 `INTEGER_OVERFLOW`로 원자적으로 거부할 계획이다. 게임 상태의 수동 변조/저장 복구는 이 API 범위 밖이다.

## 로그와 이벤트 shape 제안

`offers`는 `{slot,typeId}` 배열이며 slot순이다. units/enemies는 numeric id순으로 직렬화한다.

- command entry: `{type:'command',seq,atTick,command,events}`.
- advance entry: `{type:'advance',seq,startTick,executedTicks}`.
- 첫 프로필의 command ID 이벤트는 recruit의 `{type:'unitCreated',id,typeId,star:1,location}`뿐이다. move/swap/startWave 성공의 events는 빈 배열이다. 거부 명령은 로그가 없다. growth 합성 이벤트는 성장 작업에서 추가한다.
- advance 반환 CombatEvent는 화면/검증을 위한 생성·공격·처치·누수·웨이브/결과 알림이다. acceptedLog에는 넣지 않는다. spawn/attack/defeat/leak의 tick은 그 tick 시작 시점, waveCompleted/matchEnded는 계약의 tick 증가 이후 시점으로 정의한다. events 배열은 실제 실행 순서이다.

리플레이는 header shape/schema/규칙/digest/seed와 전체 entries shape/seq 연속성을 **경기 생성 전** 검사한다. 명령과 이벤트를 다시 계산하고 비교하며 로그가 ID나 상태를 강제 삽입하지 않는다. advance batching이 달라지면 acceptedLog가 달라도 canonicalState는 같아야 한다.

## 규칙 digest와 이식성

실제 규칙 데이터는 모집·유닛·적·각 웨이브·경로·상한·시간·PRNG 정의 및 schemaVersion/rulesId를 한 곳에 보관한다. 이 전체 객체에서 rulesDigest 자체와 표시 메타데이터만 제외하고 객체 키 ASCII 정렬/배열 원순서/공백 없는 JSON으로 직렬화한 UTF-8 SHA-256을 규칙 digest로 쓴다. 공개 rules 투영만 해시하지 않는다. 같은 rulesId로 데이터를 조용히 변경하지 않는다. 실제 digest 값과 표준 SHA-256 검증 벡터는 구현 체크포인트에서 제공한다.

상태 canonical 투영은 계약의 정확한 17개 루트 키를 모두 포함하며 acceptedLog만 제외한다. 규칙 데이터 및 상태 해시는 코어 밖 IO 없이 계산한다. 해시는 tick 판정 안에서 호출하지 않는다. 벽시계, Date, Math.random, DOM, Node API를 사용하지 않는다.

`tsconfig.core.json`은 루트 strict 옵션을 상속하되 `lib:["ES2022"]`, `types:[]`, `include:["src/core/**/*.ts"]`로 코어의 Node/DOM 오염을 막는다. 향후 코어 확인 명령은 `tsc --noEmit -p tsconfig.core.json`이다. package/lock/CI/web/cli는 이 작업에서 변경하지 않는다.

## 현재 검증 범위

API 타입과 stub의 정적 검사만 해당한다. 계약 수치/전투/PRNG/SHA-256/replay/브라우저 플레이 검사는 구현 전이므로 NOT_RUN이다. 스텁을 실제 게임처럼 호출하거나 예시 결과를 실제 검증으로 보고하지 않는다.
