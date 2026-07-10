import { APP_VERSION } from "./app-config.js?v=20260710-6";
import { initAudio, playSfx } from "./audio.js";
import { mountErrorOverlay, mountVersionBadge } from "./devtools.js";
import { saveGame, loadGame, clearGame } from "./storage.js";
import { PASTEL as palette } from "./palettes.js";
import { getAiIntent } from "./ai.js";
import { chooseWinnerReward, createGame, loserAction, masterCard, playCard, reviveGame, setInputLocked } from "./engine.js";
import { render } from "./ui.js?v=20260710-6";

const gameArea = document.querySelector("#game-area");
const actionBar = document.querySelector("#action-bar");
mountErrorOverlay();
mountVersionBadge();
initAudio();

const restored = reviveGame(loadGame({ acceptOldVersion: false, maxAgeMs: 30 * 24 * 3600e3 }));
const saved = restored?.players.some((player) => player.neutral) ? null : restored;
let state = saved || createGame({ playerCount: 2 });
let ui = { screen: saved ? "game" : "start", panel: null, selectedPlayers: state.settings?.playerCount || 2, hasSave: Boolean(saved) };
let aiTimer = null;
let aiRunning = false;

function stableSave() { saveGame({ ...state, inputLocked: false }); ui.hasSave = true; }
function draw() { gameArea.innerHTML = render(state, ui); actionBar.innerHTML = ui.screen === "game" ? `<button data-action="toggle-cards">🂠 내 카드</button><button data-action="toggle-market">🥋 기술</button><button data-action="toggle-log">📜 기록</button><button data-action="show-start">☰ 메뉴</button>` : ""; }
function setState(next, { save = true } = {}) { state = next; draw(); if (save) stableSave(); runAiIfNeeded(); }
function startGame(playerCount) { clearTimeout(aiTimer); aiRunning = false; clearGame(); state = createGame({ playerCount }); ui = { ...ui, screen: "game", panel: null, selectedPlayers: playerCount, hasSave: true }; setState(state); }

function dispatch(action) {
  if (action.type === "PLAY_CARD") { setState(playCard(state, action.playerId, action.cardId)); playSfx(palette, "tap"); }
  else if (action.type === "WINNER_REWARD") { setState(chooseWinnerReward(state, action.rewardType)); playSfx(palette, "confirm"); }
  else if (action.type === "MASTER_CARD") { setState(masterCard(state, action.cardId)); playSfx(palette, "confirm"); }
  else if (action.type === "LOSER_ACTION") { setState(loserAction(state, action.playerId, action.action)); playSfx(palette, "tap"); }
}

function runAiIfNeeded() {
  if (ui.screen !== "game" || aiRunning) return;
  const intent = getAiIntent(state);
  if (!intent) return;
  aiRunning = true;
  setState(setInputLocked(state, true), { save: false });
  aiTimer = setTimeout(() => {
    state = setInputLocked(state, false); aiRunning = false;
    if (intent.kind === "play-card") dispatch({ type: "PLAY_CARD", playerId: intent.playerId, cardId: intent.cardId });
    if (intent.kind === "winner-reward") dispatch({ type: "WINNER_REWARD", rewardType: intent.type });
    if (intent.kind === "master-card") dispatch({ type: "MASTER_CARD", cardId: intent.cardId });
    if (intent.kind === "loser-action") dispatch({ type: "LOSER_ACTION", playerId: intent.playerId, action: intent.action });
  }, state.rules.aiDelayMs / state.settings.animationSpeed);
}

function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (state.inputLocked && !["toggle-cards", "toggle-market", "toggle-log", "show-start", "close-panel"].includes(action)) return;
  if (action === "select-players") { ui.selectedPlayers = Number(button.dataset.count); draw(); }
  if (action === "start-game") startGame(ui.selectedPlayers);
  if (action === "continue-game") { ui.screen = "game"; ui.panel = null; draw(); runAiIfNeeded(); }
  if (action === "show-start") { ui.screen = "start"; ui.panel = null; clearTimeout(aiTimer); aiRunning = false; draw(); }
  if (action === "toggle-market") { ui.panel = ui.panel === "market" ? null : "market"; draw(); }
  if (action === "toggle-cards") { ui.panel = ui.panel === "cards" ? null : "cards"; draw(); }
  if (action === "toggle-log") { ui.panel = ui.panel === "log" ? null : "log"; draw(); }
  if (action === "close-panel") { ui.panel = null; draw(); }
  if (action === "play-card") dispatch({ type: "PLAY_CARD", playerId: button.dataset.playerId, cardId: button.dataset.cardId });
  if (action === "winner-fame") dispatch({ type: "WINNER_REWARD", rewardType: "fame" });
  if (action === "winner-mastery") dispatch({ type: "WINNER_REWARD", rewardType: "mastery" });
  if (action === "master-card") dispatch({ type: "MASTER_CARD", cardId: button.dataset.cardId });
  if (action === "buy") dispatch({ type: "LOSER_ACTION", playerId: button.dataset.playerId, action: { type: "buy", cardDefinitionId: button.dataset.cardDefinitionId } });
  if (action === "train-fame" || action === "rest") { const human = state.players.find((player) => player.human); dispatch({ type: "LOSER_ACTION", playerId: human.id, action: { type: action === "train-fame" ? "train-fame" : "rest" } }); }
  if (action === "new-game") startGame(state.settings?.playerCount || 2);
  if (action === "toggle-rules") gameArea.querySelector("#rules-modal")?.showModal();
  if (action === "close-rules") gameArea.querySelector("#rules-modal")?.close();
}

gameArea.addEventListener("click", handleClick);
actionBar.addEventListener("click", handleClick);

if (!CSS.supports("height", "100dvh")) { const setVh = () => { document.body.style.height = `${window.innerHeight}px`; }; setVh(); window.addEventListener("resize", setVh); }
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`, { updateViaCache: "none" }).then((registration) => registration.update());
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (sessionStorage.getItem("sw-reloaded") === APP_VERSION) return;
    sessionStorage.setItem("sw-reloaded", APP_VERSION);
    location.reload();
  });
}
draw();
if (ui.screen === "game") runAiIfNeeded();
