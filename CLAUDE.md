# 우당탕 동물도장

Vanilla JavaScript / PWA web game based on `Drayage/game-baserule` `starter/`.

## File Map

- `js/engine.js` - core game rules and state transitions
- `js/data/*.js` - card, character, phase, and rule data
- `js/ui.js` - renderer
- `js/ai.js` - AI choices
- `js/storage.js` - starter local save and restore module
- `js/audio.js`, `js/palettes.js` - starter Web Audio modules
- `js/net.js` - starter Firebase-ready online scaffold, currently unused
- `sw.js` - starter network-first service worker
- `scripts/simulate.mjs` - headless AI/flow simulation
- `test/engine.test.js` - rule tests

## Commands

- Local server: `npm run dev`
- Syntax check: `npm run build`
- Tests: `npm test`
- Headless simulation: `npm run simulate`

## Rules

- Keep game logic state-driven. UI should render from state and send actions back to the engine.
- Keep card definitions and character data out of engine logic.
- Run tests and simulation before shipping rule, AI, or turn-flow changes.
- Preserve starter infrastructure unless there is a specific reason to replace it.
