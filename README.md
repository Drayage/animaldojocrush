# 우당탕 동물도장

귀여운 동물 무술 대회를 테마로 한 덱빌딩 카드게임입니다.

이 프로젝트는 `Drayage/game-baserule` 저장소의 `starter/` 구조를 기반으로 시작했습니다. PWA, 저장, 사운드, 개발 도구, 서비스워커, 시뮬레이터 골격은 starter 방식을 유지합니다.

## 실행

```bash
npm run dev
```

브라우저에서 `http://127.0.0.1:5173`으로 접속합니다.

## 검증

```bash
npm run build
npm test
npm run simulate
```

## 구조

- `js/engine.js` - 게임 규칙과 상태 전환
- `js/data/*.js` - 카드, 캐릭터, 규칙 상수
- `js/ui.js` - 화면 렌더링
- `js/ai.js` - AI 선택 로직
- `js/storage.js` - starter 저장/복원 모듈
- `js/audio.js`, `js/palettes.js` - starter Web Audio 모듈
- `js/net.js` - starter Firebase 온라인 준비 모듈
- `sw.js` - starter service worker
- `scripts/simulate.mjs` - headless AI/플로우 시뮬레이터
- `test/engine.test.js` - 핵심 규칙 테스트

## Firebase 온라인 준비

웹 앱 설정은 `js/app-config.js`에 있으며 방 데이터는 다른 게임과 분리된
`animaldojocrush_rooms/{code}` 경로를 사용합니다.

현재 Firebase 규칙에는 이 경로가 없으므로 Firebase 콘솔의 Realtime Database
규칙에 `firebase-rules-animaldojocrush.snippet.json`의 항목을 `rules` 아래에
병합해야 합니다. 이 규칙은 개발용 공개 방 규칙이므로 실제 공개 서비스에서는
익명 인증과 방 참가자별 쓰기 권한 검증을 추가해야 합니다.

### 온라인 플레이

1. 메인 화면에서 `온라인 2~4인`을 선택합니다.
2. 방장이 총 좌석 2~4명, 목표 명성, 선착 보상을 정하고 방을 만듭니다.
3. 친구는 방 코드를 입력해 빈 좌석에 참가합니다.
4. 방장은 남은 빈 좌석에 AI를 추가하거나 제거할 수 있습니다.
5. 모든 좌석이 사람 또는 AI로 채워지면 방장이 대회를 시작합니다.

온라인 AI 행동은 방장 기기에서만 계산하고 Firebase 트랜잭션으로 공유합니다.
