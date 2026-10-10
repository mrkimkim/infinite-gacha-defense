# 실제 브라우저 통합 하네스

Issue14 generation2. browser-verify.mjs는 환경에 이미 있는 Playwright/Chromium을 사용합니다. npm 의존성 설치·배포·터널을 만들지 않습니다. 다른 환경에 없다면 해당 검증은 BLOCKED입니다. 프로젝트 테스트는 Node에서 돌아가며 이 브라우저 하네스는 별도 실행합니다.

## 정확한 세 소스 결합

별도 검증 디렉터리를 만들고 리더 PR의 정확한 commit 전체에 모모 commit의 src/core 및 tsconfig.core.json, 키키 commit의 index.html/src/web/tests/web만 git archive로 추출합니다. 원본 source bytes를 수정하지 않습니다. 각 파일의 git hash-object가 각 source commit의 blob과 일치하는지 확인하고 세 SHA를 실행 기록에 남깁니다. 이 임시 결합은 main 병합이나 승인된 production 빌드가 아닙니다.

현재 준비 기준: core b6b38f9edcf0fc0181dfd461f677a28a37849192, web945f977ec90f6c3d0927d3ecc928269d709fcfce, CLI fbcb12ffa95a9051b2cf6e152ca7bece54007d99. 하네스 자체 SHA는 이 파일을 게시한 PR 체크포인트를 따릅니다. 이후 core가 구현되면 이전 stub SHA를 재사용하지 말고 실제 구현 SHA를 기록합니다.

검증 디렉터리에서 npm ci --ignore-scripts, npm run check, npm run typecheck:core, npm run build를 실행합니다. Vite를127.0.0.1에서 띄운 뒤 `node tests/integration/browser-verify.mjs http://127.0.0.1:4173/`를 실행하고 종료 후 서버를 닫습니다. exit2/BLOCKED는 게임 PASS가 아닙니다. stdout JSON과 exact sources를 함께 보존합니다.

## 증거 범위

하네스는 실제 DOM 클릭과 실제 core/crypto를 사용합니다. snapshot textarea에서 같은 시점의 canonical bytes/header/entries를 받아 Node CLI replay 및 표준 SHA-256과 대조합니다. 입력 단계별 검사와 종료해시를 구분합니다. RAF·document.hidden만 테스트용으로 제어하며 이는 실제 OS 탭 전환이나 일반 벽시계 플레이 증거가 아닙니다. 모의 코어를 UI에 삽입하지 않습니다.

준비된 검사는 반복 영입/이동/교환/거부선택/Escape/거부 뒤 focus,250ms 포함·초과·음수dt,수동pause 상태의 hidden 복귀, stale RAF,결과/같은seed재시작,지연 WebCrypto 결과의 새 경기 덮어쓰기 방지입니다. 코어stub이면 게임 진입 전에 진단과 disabled controls만 확인하고 BLOCKED로 종료합니다.

추가 필수 검증: 실제 OS hidden/visible 전환,390/넓은 화면 touch/keyboard와 모든16칸 hitbox,승리와패배 각각의 경로,실제 RAF 성능과 저FPS 시간폐기,개별tick/event 대조 및 batching 별도 비교,연속 snapshot 역순 완료,사람 플레이. 하네스 한 번 성공만으로 이 항목을 통과 처리하지 않습니다. stdout PASS도 이 스크립트의 명시 검사 범위에 한정됩니다.

## 준비 실행 결과

browser-preparation-evidence.json에 정확한 세 SHA와 수행 결과를 기록했습니다. source blob12개 일치, 타입/core타입 검사·두 번들 성공, 어댑터/도구62 PASS·실제코어1 BLOCKED skip입니다. 실제 Chromium151.0.7922.173에서 진단과 비활성 버튼만 검사한 뒤 하네스 exit2/BLOCKED로 종료했습니다. 준비된 게임 DOM/RAF/해시 분기는 아직 실행되지 않았으므로 하네스 자체도 그 분기의 성공을 주장하지 않습니다. 서버와 브라우저를 종료했습니다.

## 실제 코어 실행 — 후속 검증

정확한 core0918459aeb7684ab850da19627d3f4969f044517/web5e83f3e4e488848eb0e7e14e32712020dbe5e679/CLI c05e52dd80d1a4e4f92448ce35334af5f7e58cd6 결합에서 source21blob 일치,104 PASS/0 SKIP,타입/core타입/도구 및 브라우저 build PASS입니다. 실제 Chromium151에서 준비·이동·교환·거부·시간경계·pause/hidden·staleRAF·지연crypto·패배1152tick/승리960tick·각재시작을 검사했습니다.11개 snapshot의 canonical bytes/hash/acceptedLog를 Node CLI replay와 대조했습니다. 결과 JSON과 직접 열어 본390px 승패 화면은 evidence/에 있습니다.

첫 실행은 접힌 재현 패널을 열지 않은 하네스 결함으로 실패했고 UI 패널을 여는 조작을 추가해 수정했습니다. 제어RAF 검사에서는 Playwright 안정화 대기를 피하기 위해 force click을 사용했습니다. 별도의 원래RAF 실행에서 강제하지 않은 후보클릭/칸doubleclick/Escape/전투/pause 및350ms tick불변을 확인했습니다. 제어 document.hidden 검사는 실제 OS 탭 전환과 다릅니다. 승리 배치는 seed1의 합법 중앙 배치를 오프라인 탐색해 정한 회귀fixture로, 일반/숙련 봇이나 재미 검증이 아닙니다. 전체tick별 브라우저대조·실제OS숨김·사람플레이는 여전히 미실시입니다. core/web 소스는 수정하지 않았습니다.

## 최신 코드 재검사
core6d85bf91708dd5344ac1a2bffdfe903b38309698의 merge shape/preflight 수정, web8ac4b7161258ecadf43cf51fd160f67b70a46798의 restart fatal경계/waveCount 및 실제core회귀 diff를 직접 읽었습니다. CLI/하네스426fe21ba846a4cd4dcc3c5018d8b5cd272718e7와 원본 그대로 결합해22blob을 검증했습니다.113PASS/0FAIL/0SKIP,fullcheck/coretype/build 및 실제브라우저승패·재시작·11snapshot Node대조를 재실행해 모두 통과했습니다. 검사후 두 원격head는 지정SHA와 동일했습니다. 새 증거는 evidence/final-browser-results.json, final-win-390.png, final-loss-390.png입니다. 원래RAF350ms smoke는 이전 실행 증거이며 이번 재실행으로 소급하지 않습니다. 두 실제DOT 최신SHA리뷰/root통합은 별도이며 병합하지 않았습니다.
