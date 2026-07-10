import { APP_VERSION } from "./app-config.js";
import { initAudio, playSfx } from "./audio.js";
import { mountErrorOverlay, mountVersionBadge } from "./devtools.js";
import { saveGame, loadGame, clearGame } from "./storage.js";
import { PASTEL as palette } from "./palettes.js";
import { getAiIntent } from "./ai.js";
import { chooseWinnerReward, createGame, loserAction, masterCard, playCard, reviveGame, setInputLocked } from "./engine.js";
import { render } from "./ui.js";

const gameArea = document.querySelector("#game-area");
const actionBar = document.querySelector("#action-bar");

mountErrorOverlay();
mountVersionBadge();
initAudio();

let state = reviveGame(loadGame({ acceptOldVersion: false, maxAgeMs: 30 * 24 * 3600e3 })) || createGame({ playerCount: 2 });
let aiTimer = null;
let aiRunning = false;

function stableSave() {
  saveGame({ ...state, inputLocked: false });
}

function setState(next, { save = true } = {}) {
  state = next;
  draw();
  if (save) stableSave();
  runAiIfNeeded();
}

function dispatch(action) {
  if (action.type === "PLAY_CARD") {
    setState(playCard(state, action.playerId, action.cardId));
    playSfx(palette, "tap");
  } else if (action.type === "WINNER_REWARD") {
    setState(chooseWinnerReward(state, action.rewardType));
    playSfx(palette, "confirm");
  } else if (action.type === "MASTER_CARD") {
    setState(masterCard(state, action.cardId));
    playSfx(palette, "confirm");
  } else if (action.type === "LOSER_ACTION") {
    setState(loserAction(state, action.playerId, action.action));
    playSfx(palette, "tap");
  } else if (action.type === "NEW_GAME") {
    clearTimeout(aiTimer);
    aiRunning = false;
    clearGame();
    setState(createGame({ playerCount: state.settings?.playerCount || 2 }));
  }
}

function draw() {
  gameArea.innerHTML = render(state);
  actionBar.innerHTML = "";
}

function runAiIfNeeded() {
  if (aiRunning) return;
  const intent = getAiIntent(state);
  if (!intent) return;
  aiRunning = true;
  setState(setInputLocked(state, true), { save: false });
  aiTimer = setTimeout(() => {
    state = setInputLocked(state, false);
    aiRunning = false;
    if (intent.kind === "play-card") dispatch({ type: "PLAY_CARD", playerId: intent.playerId, cardId: intent.cardId });
    if (intent.kind === "winner-reward") dispatch({ type: "WINNER_REWARD", rewardType: intent.type });
    if (intent.kind === "master-card") dispatch({ type: "MASTER_CARD", cardId: intent.cardId });
    if (intent.kind === "loser-action") dispatch({ type: "LOSER_ACTION", playerId: intent.playerId, action: intent.action });
    runAiIfNeeded();
  }, state.rules.aiDelayMs / state.settings.animationSpeed);
}

gameArea.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (state.inputLocked && action !== "new-game") return;
  if (action === "play-card") dispatch({ type: "PLAY_CARD", playerId: button.dataset.playerId, cardId: button.dataset.cardId });
  if (action === "winner-fame") dispatch({ type: "WINNER_REWARD", rewardType: "fame" });
  if (action === "winner-mastery") dispatch({ type: "WINNER_REWARD", rewardType: "mastery" });
  if (action === "master-card") dispatch({ type: "MASTER_CARD", cardId: button.dataset.cardId });
  if (action === "buy") dispatch({ type: "LOSER_ACTION", playerId: button.dataset.playerId, action: { type: "buy", cardDefinitionId: button.dataset.cardDefinitionId } });
  if (action === "train-fame") {
    const human = state.players.find((player) => player.human);
    dispatch({ type: "LOSER_ACTION", playerId: human.id, action: { type: "train-fame" } });
  }
  if (action === "rest") {
    const human = state.players.find((player) => player.human);
    dispatch({ type: "LOSER_ACTION", playerId: human.id, action: { type: "rest" } });
  }
  if (action === "new-game") dispatch({ type: "NEW_GAME" });
  if (action === "toggle-rules") gameArea.querySelector("#rules-modal")?.showModal();
  if (action === "close-rules") gameArea.querySelector("#rules-modal")?.close();
});

const setVh = () => {
  document.body.style.height = `${window.innerHeight}px`;
};
if (!CSS.supports("height", "100dvh")) {
  setVh();
  window.addEventListener("resize", setVh);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (sessionStorage.getItem("sw-reloaded")) return;
    sessionStorage.setItem("sw-reloaded", "1");
    location.reload();
  });
  window.addEventListener("load", () => setTimeout(() => sessionStorage.removeItem("sw-reloaded"), 3000));
}

draw();
runAiIfNeeded();
