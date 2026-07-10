import { APP_VERSION } from "./app-config.js?v=20260711-5";
import { getAudioSettings, initAudio, playSfx, setAudioEnabled, startBgm, stopBgm } from "./audio.js";
import { mountErrorOverlay, mountVersionBadge } from "./devtools.js";
import { saveGame, loadGame, clearGame, clearRejoin, loadRejoin } from "./storage.js";
import { ANIMAL_DOJO as palette } from "./palettes.js";
import { getAiIntent } from "./ai.js";
import { createGame, reviveGame, setInputLocked } from "./engine.js";
import { actionFromAiIntent, applyGameAction, GAME_ACTIONS } from "./game-actions.js";
import { getSoundEvents } from "./sound-events.js";
import { render } from "./ui.js?v=20260711-5";

const gameArea = document.querySelector("#game-area");
const actionBar = document.querySelector("#action-bar");
mountErrorOverlay();
mountVersionBadge();
initAudio();

const restored = reviveGame(loadGame({ acceptOldVersion: false, maxAgeMs: 30 * 24 * 3600e3 }));
const saved = restored?.players.some((player) => player.neutral) ? null : restored;
let state = saved || createGame({ playerCount: 2 });
let ui = { screen: saved ? "game" : "start", panel: null, playMode: "offline", selectedPlayers: state.settings?.playerCount || 2, selectedTargetFame: state.rules?.targetFame || 50, milestoneMode: state.rules?.milestoneMode ?? true, audio: getAudioSettings(), hasSave: Boolean(saved), hasRejoin: Boolean(loadRejoin()), roomCodeInput: "", onlineBusy: false, onlineError: "", onlineRoom: null, onlineCode: "", onlineIsHost: false };
let aiTimer = null;
let aiRunning = false;
let onlineSession = null;
let unsubscribeOnline = null;
let netModulePromise = null;

function stableSave() { if (onlineSession) return; saveGame({ ...state, inputLocked: false }); ui.hasSave = true; }
function localPlayerId() { return onlineSession?.playerId || state.players.find((player) => player.human)?.id; }
function renderState() { if (!onlineSession) return state; const view = structuredClone(state); view.players.forEach((player) => { player.human = player.id === onlineSession.playerId; player.ai = false; }); view.inputLocked = view.inputLocked || ui.onlineBusy; return view; }
function draw() { gameArea.innerHTML = render(renderState(), ui); actionBar.innerHTML = ui.screen === "game" ? `<button data-action="toggle-cards">🂠 내 카드</button><button data-action="toggle-market">🥋 기술</button><button data-action="toggle-log">📜 기록</button><button data-action="toggle-settings">⚙️ 설정</button>` : ""; }
function setState(next, { save = true } = {}) { state = next; draw(); if (save) stableSave(); runAiIfNeeded(); }
function startGame(playerCount) { clearTimeout(aiTimer); aiRunning = false; onlineSession = null; clearGame(); state = createGame({ playerCount, targetFame: ui.selectedTargetFame, milestoneMode: ui.milestoneMode }); ui = { ...ui, screen: "game", panel: null, playMode: "offline", selectedPlayers: playerCount, hasSave: true }; setState(state); if (ui.audio.bgmEnabled) startBgm(palette); }

function getNet() {
  if (!netModulePromise) netModulePromise = import("./net.js");
  return netModulePromise;
}

function createClientId() {
  return crypto.randomUUID?.() || `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeOnlineGame() {
  const game = createGame({ playerCount: ui.selectedPlayers, targetFame: ui.selectedTargetFame, milestoneMode: ui.milestoneMode });
  game.players.forEach((player) => { player.human = true; player.ai = false; });
  game.settings.online = true;
  return game;
}

async function connectOnlineRoom(code, playerId, isHost) {
  const net = await getNet();
  unsubscribeOnline?.();
  onlineSession = { code, playerId, isHost, seq: -1 };
  ui = { ...ui, playMode: "online", screen: "lobby", onlineCode: code, onlineIsHost: isHost, onlineBusy: true, onlineError: "", hasRejoin: true };
  draw();
  net.setupPresence(code, playerId);
  unsubscribeOnline = net.subscribeRoom(code, (room) => {
    if (!onlineSession || onlineSession.code !== code) return;
    if (!room) { ui.onlineBusy = false; ui.onlineError = "방이 종료되었거나 삭제되었습니다."; draw(); return; }
    const previous = state;
    const previousSeq = onlineSession.seq;
    const revived = reviveGame(room.state);
    if (revived) state = revived;
    onlineSession.seq = Number(room.seq || 0);
    ui.onlineRoom = room;
    ui.onlineBusy = false;
    ui.onlineError = "";
    ui.screen = room.phase === "playing" || room.phase === "ended" ? "game" : "lobby";
    if (previousSeq >= 0 && onlineSession.seq > previousSeq && room.state?.networkLastAction && revived) playTransitionSounds(previous, revived, room.state.networkLastAction);
    draw();
    if (ui.screen === "game" && ui.audio.bgmEnabled) startBgm(palette);
    if (ui.screen === "game") runAiIfNeeded();
  });
}

async function createOnlineRoom() {
  ui.onlineBusy = true; ui.onlineError = ""; draw();
  try {
    const net = await getNet();
    const game = makeOnlineGame();
    const host = { id: "player-1", clientId: createClientId(), name: game.players[0].name, seat: 0, ready: true };
    const code = await net.createRoom(host, game);
    state = game;
    await connectOnlineRoom(code, host.id, true);
  } catch (error) { ui.onlineBusy = false; ui.onlineError = `방을 만들지 못했습니다: ${error.message}`; draw(); }
}

async function joinOnlineRoom(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,6}$/.test(normalized)) { ui.onlineError = "4~6자리 참가 코드를 확인하세요."; draw(); return; }
  ui.onlineBusy = true; ui.onlineError = ""; draw();
  try {
    const net = await getNet();
    const joined = await net.joinRoom(normalized, { clientId: createClientId() });
    await connectOnlineRoom(normalized, joined.id, false);
  } catch (error) { ui.onlineBusy = false; ui.onlineError = `참가하지 못했습니다: ${error.message}`; draw(); }
}

async function rejoinOnlineRoom() {
  ui.onlineBusy = true; ui.onlineError = ""; draw();
  try {
    const net = await getNet();
    const rejoin = await net.tryRejoin();
    if (!rejoin) throw new Error("다시 연결할 방이 없습니다.");
    await connectOnlineRoom(rejoin.code, rejoin.playerId, rejoin.playerId === "player-1");
  } catch (error) { ui.onlineBusy = false; ui.onlineError = error.message; ui.hasRejoin = false; draw(); }
}

async function updateOnlineSeatAi(seat, enabled) {
  if (!onlineSession?.isHost) return;
  ui.onlineBusy = true; ui.onlineError = ""; draw();
  try { await (await getNet()).setSeatAi(onlineSession.code, Number(seat), enabled); }
  catch (error) { ui.onlineBusy = false; ui.onlineError = error.message; draw(); }
}

async function leaveOnlineRoom() {
  const session = onlineSession;
  unsubscribeOnline?.(); unsubscribeOnline = null; onlineSession = null;
  if (session) { try { await (await getNet()).leaveRoom(session.code, session.playerId); } catch {} }
  clearRejoin(); stopBgm();
  ui = { ...ui, screen: "start", panel: null, playMode: "online", onlineRoom: null, onlineCode: "", onlineIsHost: false, onlineBusy: false, onlineError: "", hasRejoin: false };
  draw();
}

function queueSfx(name, delay = 0) {
  if (delay) setTimeout(() => playSfx(palette, name), delay);
  else playSfx(palette, name);
}

function playTransitionSounds(previous, next, action) {
  getSoundEvents(previous, next, action).forEach((name, index) => queueSfx(name, index * 240));
}

async function dispatch(action) {
  const previous = state;
  const next = applyGameAction(state, action);
  if (next === state) return;
  if (onlineSession) {
    ui.onlineBusy = true; ui.onlineError = ""; draw();
    try {
      const committed = await (await getNet()).writeState(onlineSession.code, onlineSession.seq, { ...next, inputLocked: false }, action);
      if (!committed) throw new Error("상대 행동이 먼저 처리되었습니다. 최신 상태를 다시 받습니다.");
    } catch (error) { ui.onlineBusy = false; ui.onlineError = error.message; draw(); }
    return;
  }
  setState(next);
  playTransitionSounds(previous, next, action);
}

function runAiIfNeeded() {
  if ((onlineSession && !onlineSession.isHost) || ui.screen !== "game" || aiRunning) return;
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
  if ((state.inputLocked || ui.onlineBusy) && !["toggle-cards", "toggle-market", "toggle-log", "toggle-settings", "toggle-bgm", "toggle-sfx", "show-start", "close-panel", "leave-online-room"].includes(action)) return;
  if (action === "select-play-mode") { ui.playMode = button.dataset.mode; ui.onlineError = ""; draw(); }
  if (action === "select-players") { ui.selectedPlayers = Number(button.dataset.count); draw(); }
  if (action === "select-target") { ui.selectedTargetFame = Number(button.dataset.score); draw(); }
  if (action === "toggle-milestone-mode") { ui.milestoneMode = !ui.milestoneMode; draw(); }
  if (action === "create-online-room") createOnlineRoom();
  if (action === "join-online-room") joinOnlineRoom(ui.roomCodeInput);
  if (action === "rejoin-online-room") rejoinOnlineRoom();
  if (action === "add-online-ai") updateOnlineSeatAi(button.dataset.seat, true);
  if (action === "remove-online-ai") updateOnlineSeatAi(button.dataset.seat, false);
  if (action === "start-online-game" && onlineSession?.isHost) { ui.onlineBusy = true; draw(); getNet().then((net) => net.setRoomPhase(onlineSession.code, "playing")).catch((error) => { ui.onlineBusy = false; ui.onlineError = error.message; draw(); }); }
  if (action === "copy-room-code" && ui.onlineCode) navigator.clipboard?.writeText(ui.onlineCode);
  if (action === "leave-online-room") leaveOnlineRoom();
  if (action === "start-game") startGame(ui.selectedPlayers);
  if (action === "continue-game") { ui.screen = "game"; ui.panel = null; draw(); if (ui.audio.bgmEnabled) startBgm(palette); runAiIfNeeded(); }
  if (action === "show-start") { if (onlineSession) leaveOnlineRoom(); else { ui.screen = "start"; ui.panel = null; clearTimeout(aiTimer); aiRunning = false; stopBgm(); draw(); } }
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
  if (action === "train-fame" || action === "rest") dispatch({ type: "LOSER_ACTION", playerId: localPlayerId(), action: { type: action === "train-fame" ? "train-fame" : "rest" } });
  if (action === "continue-duel") dispatch({ type: "CONFIRM_DUEL_RECAP", playerId: localPlayerId() });
  if (action === "milestone-master") dispatch({ type: "MILESTONE_MASTERY", playerId: button.dataset.playerId, cardId: button.dataset.cardId });
  if (action === "milestone-fallback-card") dispatch({ type: "MILESTONE_FALLBACK", playerId: button.dataset.playerId, cardId: button.dataset.cardId });
  if (action === "milestone-fallback-skip") dispatch({ type: "MILESTONE_FALLBACK", playerId: button.dataset.playerId, cardId: null });
  if (action === "new-game") { if (onlineSession) leaveOnlineRoom(); else startGame(state.settings?.playerCount || 2); }
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
  if (event.target.dataset.setting === "room-code") { ui.roomCodeInput = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); event.target.value = ui.roomCodeInput; return; }
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
if (ui.hasRejoin) {
  ui.screen = "start";
  ui.playMode = "online";
  draw();
  rejoinOnlineRoom();
} else {
  draw();
  if (ui.screen === "game") runAiIfNeeded();
}
