# CLI 연결 규격 — Issue #14, generation 2

상태: API 연결 전 준비 문서. 아래 명령은 제안된 CLI 사용법이며 아직 실행 가능한 npm script가 아닙니다. 코어의 실제 exports/반환형은 모모의 src/core/index.ts와 core-api.md 게시 후에만 연결합니다.

## 사용자 입출력

- `npm run cli -- run --input <path|->`: seed, rulesId, 순서 있는 command/advance 요청을 JSON 파일 또는 stdin에서 읽습니다. 코어 dispatch/advance에 전달하고 수락 로그와 최종 상태 요약을 반환합니다.
- `npm run cli -- replay --input <path|->`: 코어가 정의한 header/entries와 선택적 expectedFinalHash를 읽어 코어 replay에 전달합니다. 어댑터가 이벤트나 RNG를 덮어쓰지 않습니다.
- stdout은 결과 JSON 한 건만 출력합니다. 진행 안내는 stderr에만 기록합니다. 입력 파일을 변경하거나 임의 경로에 로그를 저장하지 않습니다.
- 성공 exit0: `{ok:true,summary,canonicalState,stateHash,header,entries}`. canonicalState는 코어가 반환한 문자열을 그대로 보존하고 Node crypto가 해당 UTF-8 bytes의 SHA-256 소문자 hex를 계산합니다. summary는 결과를 읽기 쉽게 뽑은 값이며 해시 원본이 아닙니다.
- 실패 exit2: 옵션/파일 읽기/JSON 입력 형식 오류. exit3: 코어 생성·명령·advance·replay 거부 또는 최종 해시 불일치. exit1: 예상하지 못한 내부 오류. 실패 출력은 `{ok:false,error:{code,...}}`이며 부분 state/header/entries를 성공 결과처럼 반환하지 않습니다.
- 거부 입력을 시험하는 테스트 fixture와 일반 run 입력을 분리합니다. 일반 run은 첫 거부에서 실패합니다. replay authoritative entries에 거부 명령을 넣지 않습니다.

필드·오류 매핑은 CLI 어댑터 제안입니다. core API를 새로 정의하는 문서가 아니며 게시된 코어의 실제 반환형을 확인해 매핑을 확정합니다. header/rulesDigest/이벤트는 코어의 단일 원본을 사용합니다.

## 정보 경계와 증거

CLI가 seed를 받는 것과 봇이 seed를 보는 것은 다릅니다. 봇이 추가되면 함수에는 observe 결과만 전달하고 내부 state/header/seed/rngState를 전달하지 않습니다. 코어 판정·가챠·경로·경제를 CLI에 복제하지 않습니다. 이번 기본 smoke 정책을 일반/숙련 정책이나 재미 검증으로 부르지 않습니다.

통합은 tests/integration/fixtures의 독립 시나리오를 실제 core API에 매핑한 후 시작합니다. Node 반복 실행, 같은 명령의 실제 브라우저 코어 실행, 매 단계 canonical bytes/해시/수락 로그 비교를 구분해 기록합니다. advance batching 비교에서는 canonical 상태를 비교하고 raw log 동일성은 요구하지 않습니다. 실제 UI 조작은 별도 증거입니다.
