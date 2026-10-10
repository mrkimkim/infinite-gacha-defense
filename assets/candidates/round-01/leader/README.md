# 리더 후보 round-01 — 전송 무결성 차단

Issue #4 / generation 1 / branch leader/art-round-01. 후보이며 production 채택·동료 승인 없음.

네 PNG는 부모가 제공한 Git blob을 그대로 연결했습니다. 별도 clone에서 blob SHA 일치를 확인했지만 **모두 Pillow verify/load에서 Truncated File Read**로 실패했습니다. 원본 metadata의 1.19–2.44MB보다 실제 blob은 약786,444 bytes로 짧고 SHA-256도 다릅니다. 완전한 원본과 byte-for-byte 같다는 주장을 하지 않습니다.

- preview.html: 실제 img/CSS grid 조립. 6×6, 민트 외곽20칸과 크림 내부16칸. 864×864/144px, 360×360/60px.
- 기본 기물 canvas는116/48px, source pivot(627,1183)을 tile anchor(0.5,0.875)에 맞춤. creator-reported alpha≥16 bounds 폭1028/1254로 계산하면 큰 canvas116의 가시폭은 약95px.
- 비교 버튼은 소스 픽셀을 바꾸지 않고 가시폭이 tile의80%가 되도록 CSS canvas 폭을 약140.5/58.6px로 조정합니다. 실제 alpha 확인은 원본 복구 후 다시 해야 합니다.
- 회전 모서리와 직선의 방향성 bevel 광원, 무거운 질감, 기물의 faint alpha noise는 알려진 원본 한계입니다. 지금 전달본은 정상 디코딩되지 않아 작은 크기·이음새·실루엣의 실제 시각 승인을 할 수 없습니다.
- generation-prompts.json에는 원문 프롬프트를 보존하고 executor 절대경로만 제거했습니다. 처음 corner는 superseded 기록이며 게시 PNG는 v2만 사용합니다.
- asset-manifest.json의 creator_reported_*는 제작자의 원본 검사이며 이 조립 실행의 검사가 아닙니다. decode-report.json은 실제 전달본 검사입니다.
- PNG 픽셀 편집·잘린 PNG의 관대한 복구·가짜 전체 보드 이미지를 만들지 않습니다. 실제 Chromium localhost 렌더를 두 크기로 캡처해 comparison-864-incomplete-source.png와 comparison-360-incomplete-source.png에 보관했습니다. 직접 확인한 화면은 바닥 대부분과 기물 몸통이 빠진 불완전 렌더입니다. 정상 비교/시각 승인은 차단되어 있습니다.

실행: 이 폴더에서 정적 HTTP 서버를 켜고 preview.html을 여세요. 외부 CDN/의존성 없음. Chromium decode()는 잘린 파일도 성공으로 반환했습니다. browser-report.json의 성공은 온전한 이미지 증거가 아니며 Pillow 실패와 실제 스크린샷이 우선합니다. 전체 라이선스 부여나 IP 법률 검토를 주장하지 않습니다. 사용자 승인된 원본 AI 후보의 프로젝트 내 공개 검토 범위입니다.
