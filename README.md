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
