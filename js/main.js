import { APP_VERSION } from "./app-config.js?v=20260710-10";
import { getAudioSettings, initAudio, playSfx, setAudioEnabled, startBgm, stopBgm } from "./audio.js";
import { mountErrorOverlay, mountVersionBadge } from "./devtools.js";
import { saveGame, loadGame, clearGame } from "./storage.js";
import { ANIMAL_DOJO as palette } from "./palettes.js";
import { getAiIntent } from "./ai.js";
import { createGame, reviveGame, setInputLocked } from "./engine.js";
import { actionFromAiIntent, applyGameAction, GAME_ACTIONS } from "./game-actions.js";
import { render } from "./ui.js?v=20260710-10";

const gameArea = document.querySelector("#game-area");
const actionBar = document.querySelector("#action-bar");
mountErrorOverlay();
mountVersionBadge();
initAudio();

const restored = reviveGame(loadGame({ acceptOldVersion: false, maxAgeMs: 30 * 24 * 3600e3 }));
const saved = restored?.players.some((player) => player.neutral) ? null : restored;
let state = saved || createGame({ playerCount: 2 });
let ui = { screen: saved ? "game" : "start", panel: null, selectedPlayers: state.settings?.playerCount || 2, selectedTargetFame: state.rules?.targetFame || 50, milestoneMode: state.rules?.milestoneMode ?? true, audio: getAudioSettings(), hasSave: Boolean(saved) };
let aiTimer = null;
let aiRunning = false;

function stableSave() { saveGame({ ...state, inputLocked: false }); ui.hasSave = true; }
function draw() { gameArea.innerHTML = render(state, ui); actionBar.innerHTML = ui.screen === "game" ? `<button data-action="toggle-cards">🂠 내 카드</button><button data-action="toggle-market">🥋 기술</button><button data-action="toggle-log">📜 기록</button><button data-action="toggle-settings">⚙️ 설정</button>` : ""; }
function setState(next, { save = true } = {}) { state = next; draw(); if (save) stableSave(); runAiIfNeeded(); }
function startGame(playerCount) { clearTimeout(aiTimer); aiRunning = false; clearGame(); state = createGame({ playerCount, targetFame: ui.selectedTargetFame, milestoneMode: ui.milestoneMode }); ui = { ...ui, screen: "game", panel: null, selectedPlayers: playerCount, hasSave: true }; setState(state); if (ui.audio.bgmEnabled) startBgm(palette); }

function dispatch(action) {
  const next = applyGameAction(state, action);
  if (next === state) return;
  setState(next);
  playSfx(palette, action.type === GAME_ACTIONS.PLAY_CARD || action.type === GAME_ACTIONS.LOSER_ACTION ? "tap" : "confirm");
}

function runAiIfNeeded() {
  if (ui.screen !== "game" || aiRunning) return;
  const intent = getAiIntent(state);
  if (!intent) return;
  aiRunning = true;
  setState(setInputLocked(state, true), { save: false });
  aiTimer = setTimeout(() => {
    state = setInputLocked(state, false); aiRunning = false;
    const action = actionFromAiIntent(intent);
    if (action) dispatch(action);
  }, state.rules.aiDelayMs / state.settings.animationSpeed);
}

function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (ui.screen === "game" && ui.audio.bgmEnabled) startBgm(palette);
  if (state.inputLocked && !["toggle-cards", "toggle-market", "toggle-log", "toggle-settings", "toggle-bgm", "toggle-sfx", "show-start", "close-panel"].includes(action)) return;
  if (action === "select-players") { ui.selectedPlayers = Number(button.dataset.count); draw(); }
  if (action === "select-target") { ui.selectedTargetFame = Number(button.dataset.score); draw(); }
  if (action === "toggle-milestone-mode") { ui.milestoneMode = !ui.milestoneMode; draw(); }
  if (action === "start-game") startGame(ui.selectedPlayers);
  if (action === "continue-game") { ui.screen = "game"; ui.panel = null; draw(); if (ui.audio.bgmEnabled) startBgm(palette); runAiIfNeeded(); }
  if (action === "show-start") { ui.screen = "start"; ui.panel = null; clearTimeout(aiTimer); aiRunning = false; stopBgm(); draw(); }
  if (action === "toggle-market") { ui.panel = ui.panel === "market" ? null : "market"; draw(); }
  if (action === "toggle-cards") { ui.panel = ui.panel === "cards" ? null : "cards"; draw(); }
  if (action === "toggle-log") { ui.panel = ui.panel === "log" ? null : "log"; draw(); }
  if (action === "toggle-settings") { ui.panel = ui.panel === "settings" ? null : "settings"; draw(); }
  if (action === "toggle-bgm") { ui.audio = setAudioEnabled("bgm", !ui.audio.bgmEnabled); if (ui.audio.bgmEnabled && ui.screen === "game") startBgm(palette); else stopBgm(); draw(); }
  if (action === "toggle-sfx") { ui.audio = setAudioEnabled("sfx", !ui.audio.sfxEnabled); draw(); }
  if (action === "close-panel") { ui.panel = null; draw(); }
  if (action === "play-card") dispatch({ type: "PLAY_CARD", playerId: button.dataset.playerId, cardId: button.dataset.cardId });
  if (action === "winner-fame") dispatch({ type: "WINNER_REWARD", rewardType: "fame" });
  if (action === "winner-mastery") dispatch({ type: "WINNER_REWARD", rewardType: "mastery" });
  if (action === "master-card") dispatch({ type: "MASTER_CARD", cardId: button.dataset.cardId });
  if (action === "buy") dispatch({ type: "LOSER_ACTION", playerId: button.dataset.playerId, action: { type: "buy", cardDefinitionId: button.dataset.cardDefinitionId } });
  if (action === "train-fame" || action === "rest") { const human = state.players.find((player) => player.human); dispatch({ type: "LOSER_ACTION", playerId: human.id, action: { type: action === "train-fame" ? "train-fame" : "rest" } }); }
  if (action === "continue-duel") { const human = state.players.find((player) => player.human); dispatch({ type: "CONFIRM_DUEL_RECAP", playerId: human.id }); }
  if (action === "milestone-master") dispatch({ type: "MILESTONE_MASTERY", playerId: button.dataset.playerId, cardId: button.dataset.cardId });
  if (action === "milestone-fallback-card") dispatch({ type: "MILESTONE_FALLBACK", playerId: button.dataset.playerId, cardId: button.dataset.cardId });
  if (action === "milestone-fallback-skip") dispatch({ type: "MILESTONE_FALLBACK", playerId: button.dataset.playerId, cardId: null });
  if (action === "new-game") startGame(state.settings?.playerCount || 2);
  if (action === "toggle-rules") gameArea.querySelector("#rules-modal")?.showModal();
  if (action === "close-rules") gameArea.querySelector("#rules-modal")?.close();
}

function handleChange(event) {
  if (event.target.dataset.setting !== "target-fame") return;
  const value = Number(event.target.value);
  if (!Number.isFinite(value) || event.target.value.trim() === "") return;
  ui.selectedTargetFame = Math.max(12, Math.min(100, value));
  event.target.value = String(ui.selectedTargetFame);
  draw();
}

function handleInput(event) {
  if (event.target.dataset.setting !== "target-fame") return;
  const value = Number(event.target.value);
  if (Number.isFinite(value) && event.target.value.trim() !== "") ui.selectedTargetFame = Math.max(12, Math.min(100, value));
}

gameArea.addEventListener("click", handleClick);
gameArea.addEventListener("change", handleChange);
gameArea.addEventListener("input", handleInput);
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
