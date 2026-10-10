# 실행 도구 — Issue #9

> 최신 검증: core6d85bf9 및 web8ac4b71 조합에서113PASS/0SKIP, 실제 브라우저 승패·재시작·11snapshot Node대조를 완료했습니다. 아래 stub/API대기 설명은 당시 체크포인트 이력이며 현재 기능 상태가 아닙니다. 후속 web a3bd7af의 hover·결과 안내와 지연crypto 보완 검증은 [통합 검증 기록](https://github.com/mrkimkim/infinite-gacha-defense/pull/15)을 따릅니다. 실제 main 통합 검증/사람플레이와 구분합니다.


상태: 도구 골격. 게임 코어·브라우저 UI·CLI 게임·게임 테스트는 아직 구현하지 않습니다. owner 리더, generation1, base77fdb8e715304b264b89dbdc437687377c6d9ad1.

## 설치
Node24.19.0 / 로컬 npm11.9.0 기준. PR #10 CI 실측 npm은11.17.0입니다. packageManager 필드는 CI npm을 강제하지 않습니다. [실측 정정](https://github.com/mrkimkim/infinite-gacha-defense/pull/10#issuecomment-6093627289)과 [모모 독립 재설치 리뷰](https://github.com/mrkimkim/infinite-gacha-defense/pull/10#issuecomment-6093791023)를 근거로 두 환경을 구분하며 새 npm 설치/강제고정은 하지 않습니다. Node24 계열 >=24.19.0을 사용합니다. 공식 npm registry에서 확인한 TypeScript7.0.2, Vite8.3.4, @types/node24.19.2를 exact version과 lockfile v3로 고정합니다. 런타임 의존성과 UI 프레임워크는 없습니다.
```sh
npm ci --ignore-scripts
npm run check
```
npm cache 경로가 쓰기 불가능한 제한 환경에서는 명령에 --cache /tmp/gacha-npm-cache를 붙일 수 있습니다. 홈·자격 증명 변경은 필요 없습니다. 패키지 lifecycle scripts를 실행하지 않는 설치로 실제 도구가 동작하는지 검증합니다.

## 실제 스크립트
| 명령 | 현재 의미 |
|---|---|
| npm run typecheck | tools/tests 및 Vite 설정의 strict/unused 검사. 향후 src/**/*.ts도 포함 |
| npm test | tools/run-tests.ts가 tests/**/*.test.ts를 발견해 Node 내장 runner로 실행. 각 suite의 파일 수와 부재 시 NOT_RUN 출력 |
| npm run typecheck:core | 게시된 tsconfig.core.json으로 별도 코어 타입 경계 검사. 현재 파일 부재 시 실행 실패하며 CI는 명시적 NOT_RUN |
| npm run build:tooling | tools/tooling-probe.ts만 브라우저용 ES 모듈로 번들링. .tooling-dist 출력 |
| npm run check | 위 세 명령을 순차 실행 |
| npm run dev | 로컬127.0.0.1 Vite 서버. 현재 /tools/tooling-probe.ts 변환 확인 가능; 게임 화면 없음 |
| npm run build | 미래 루트 index.html 진입점의 실제 브라우저 빌드. 현재 index.html이 없어 실패하는 것이 정상 |
| npm run preview | 나중에 npm run build로 만든 dist를 로컬 확인. 현재 dist/게임 없음 |

TypeScript 타입 검사와 noUnused 규칙을 결합하며 별도 lint 프레임워크를 추가하지 않습니다. Node 타입 제거 실행 자체는 타입 검사가 아니므로 typecheck를 생략하지 않습니다. Vite 빌드 역시 타입 검사를 대체하지 않습니다.
공유 코어를 Node에서도 직접 실행하려면 상대 TS import에 .ts 확장자를 사용하고 erasable TypeScript 문법을 사용합니다. 타입/규칙을 브라우저·CLI에 복사하라는 뜻이 아닙니다. Node/DOM API를 코어에 허용하는 설계 결정도 아니며 코어 경계 검증은 해당 구현 작업에서 추가합니다.

## 검증 범위와 후속 통합
도구 smoke는 (1) native Node TS와 Vite ES bundle의 동일 export, (2) Vite dev TS 변환, (3) exact direct versions/공식 registry lock integrity를 확인합니다. 게임 규칙·결정성·봇·브라우저 실제 조작·재미 검증 증거가 아닙니다.
첫 실제 src/core·src/web·src/cli·index.html은 각 배정 작업에서 작성합니다. 게임 테스트가 생기면 npm test의 대상을 별도 검토해 확장해야 합니다. 현재 도구 테스트만 통과했다고 미래 게임 테스트까지 실행된 것으로 보고하지 않습니다.
index.html이 생기면 CI의 실제 게임 build 단계가 실행됩니다. 완주·패배·재시작·Node/브라우저 상태 동일성 등은 후속 실제 검증이 필요합니다. CI 스크립트 추가와 GitHub 호스팅 실행 성공은 별개로 보고합니다.

## CI 경계
pull_request와 main push에서만 실행합니다. contents:read, checkout credential 미보존, full SHA action pin, npm ci --ignore-scripts, 타입/unused·도구 test·도구 build를 수행합니다. 배포·비밀·write token·pull_request_target은 없습니다. 루트 게임 진입점이 없으면 명시적 notice로 미검증을 알립니다.

## 로컬 검증 기록 (2026-10-10)
Node24.19.0 / npm11.9.0에서 lockfile 기반 npm ci --ignore-scripts 후 npm run check가 성공했습니다. 타입 검사, 도구 테스트3개, 도구 ES 번들이 통과했습니다. npm audit 결과 알려진 취약점0개입니다.
실제 headless Chromium에서 localhost Vite 서버의 /tools/tooling-probe.ts를 dynamic import하여 한국어 label과 [1,2,3] export를 확인했습니다. 이는 브라우저 모듈 로딩 smoke이며 게임 화면·조작 검증이 아닙니다. 검사 후 서버를 종료했습니다.
npm run build는 Cannot resolve entry module index.html로 실패했습니다. 아직 게임 진입점이 없다는 예상된 제한이며 게임 빌드 성공으로 보고하지 않습니다. 호스팅 CI 결과는 PR에서 별도로 확인해야 합니다.

## 공식 근거
- [TypeScript 설치](https://www.typescriptlang.org/download/)
- [Node TypeScript 실행과 타입 제거](https://nodejs.org/api/typescript.html)
- [Vite 시작 및 빌드](https://vite.dev/guide/)
- [actions/checkout](https://github.com/actions/checkout), [actions/setup-node](https://github.com/actions/setup-node)
버전은2026-10-10 공식 registry npm view 및 공식 Git 태그 조회로 확인했습니다.

## Issue #14 연결 준비 — generation2
현재 base ee2fa330b148dffe1e1b8f1c59b86aaeeb6a37e1에는 코어/API·게임 진입점이 없습니다. src/cli/README.md는 미구현 CLI 규격이며 tests/integration/fixtures는 명세 기반 입력/기대값 준비입니다. npm test는 모든 하위 suite를 발견하도록 확장했지만 없는 게임 테스트를 통과로 세지 않습니다. 코어 전용 tsconfig는 Issue #12 소유이며 CI는 파일이 게시되면 별도 검사합니다. 전체 check/build와 실제 Node/브라우저 게임 해시 대조는 API 연결 후 수행합니다. 앞 절의 tooling3개 검증 기록은 과거 도구 검증으로 보존합니다.

## API 연결 체크포인트
PR #17 head b6b38f9edcf0fc0181dfd461f677a28a37849192의 동기 CoreApi에 CLI를 연결했습니다. `npm run cli -- run --input file.json` 또는 `npm run cli -- replay --input -`를 사용합니다. stdout JSON 한 건 보장이 필요한 자동화는 npm 자체 배너를 피하도록 `node src/cli/main.ts ...` 또는 `npm run --silent cli -- ...`를 사용합니다. API stub은 exit1/CORE_NOT_IMPLEMENTED이며 게임 성공이 아닙니다. 입력/옵션 오류2, 코어 거부3, 내부/해시 불일치1입니다. 코어 파일은 이 PR에 포함하지 않으며 main에 API가 없으면 타입검사가 미해결 import로 막힙니다. 별도 검증 디렉터리에 정확한 API SHA와 리더 파일을 합쳐 검사한 결과를 PR에 기록합니다. 실제 core fixture는 모듈 부재 또는 명시적인 API stub일 때 BLOCKED skip을 남기며 구현이 들어오면 실행됩니다.
