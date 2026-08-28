import { APP_VERSION } from "./app-config.js";
import { initAudio, playSfx } from "./audio.js";
import { mountErrorOverlay, mountVersionBadge } from "./devtools.js";
import { saveGame, loadGame, clearGame } from "./storage.js";
import { PASTEL as palette } from "./palettes.js";
import { getAiIntent } from "./ai.js";
import { chooseWinnerReward, createGame, loserAction, masterCard, playCard, reviveGame, setInputLocked } from "./engine.js";
import { viewFor } from "./view.js";
import { render } from "./ui.js";

const gameArea = document.querySelector("#game-area");
const actionBar = document.querySelector("#action-bar");

mountErrorOverlay();
mountVersionBadge();
initAudio();

let state = reviveGame(loadGame({ acceptOldVersion: false, maxAgeMs: 30 * 24 * 3600e3 })) || createGame({ playerCount: 2 });
let aiTimer = null;
let aiRunning = false;

// ── 온라인 대전 ────────────────────────────────────────────────────────
// 프로토콜은 js/net.js 상단 주석 참고: 호스트만 엔진을 굴리고 room.state로
// 결과를 방송한다. 게스트는 절대 로컬로 엔진을 돌리지 않고 room.pendingAction으로
// 행동을 요청한 뒤, room.state가 갱신되기를 기다린다.
// net.js는 Firebase SDK를 CDN에서 불러오므로, 사용자가 실제로 온라인을 선택했을
// 때만 동적 import 한다 (오프라인/로컬 플레이는 네트워크 요청이 전혀 없어야 한다).
let netModule = null;
async function getNet() {
  if (!netModule) netModule = await import("./net.js");
  return netModule;
}

// online: null(오프라인) | { code, myPlayerId, isHost, unsubscribe }
let online = null;
let onlineUi = { mode: "offline" };
let hostSeq = 0;
let lastAppliedActionId = null;

function myPlayerId() {
  return online ? online.myPlayerId : undefined; // undefined면 ui.js가 human 플래그로 대체
}

function stableSave() {
  if (online) return; // 온라인 방 상태는 로컬 단일플레이 저장칸에 섞지 않는다.
  saveGame({ ...state, inputLocked: false });
}

function draw() {
  const viewState = online ? viewFor(state, myPlayerId()) : state;
  gameArea.innerHTML = render(viewState, myPlayerId(), onlineUi);
  actionBar.innerHTML = "";
}

function setState(next, { save = true } = {}) {
  state = next;
  draw();
  if (save) stableSave();
  runAiIfNeeded();
}

function applyAction(action) {
  if (action.type === "PLAY_CARD") return playCard(state, action.playerId, action.cardId);
  if (action.type === "WINNER_REWARD") return chooseWinnerReward(state, action.rewardType);
  if (action.type === "MASTER_CARD") return masterCard(state, action.cardId);
  if (action.type === "LOSER_ACTION") return loserAction(state, action.playerId, action.action);
  return state;
}

function playSfxFor(action) {
  if (action.type === "PLAY_CARD" || action.type === "LOSER_ACTION") playSfx(palette, "tap");
  else if (action.type === "WINNER_REWARD" || action.type === "MASTER_CARD") playSfx(palette, "confirm");
}

// 로컬(오프라인) 또는 호스트가 자신의 엔진으로 계산한 다음 상태를 반영하고,
// 호스트라면 그 결과를 방(room)에도 seq 가드 트랜잭션으로 방송한다.
// 연달아 여러 행동이 빠르게 적용될 수 있으므로(호스트 본인의 연속 클릭 + 게스트가
// 보낸 행동 적용이 겹치는 경우), 쓰기를 writeQueue로 직렬화해서 baseSeq를 항상
// "그 시점의 최신 hostSeq"로 읽게 한다 — 그렇지 않으면 뒤 쓰기가 앞 쓰기와 같은
// baseSeq를 써서 seq 가드에 튕겨나가고 상태가 유실될 수 있다.
let writeQueue = Promise.resolve();
function applyAndBroadcast(next) {
  setState(next);
  if (!online || !online.isHost) return;
  const code = online.code;
  writeQueue = writeQueue.then(async () => {
    if (!online || online.code !== code) return;
    try {
      const net = await getNet();
      const baseSeq = hostSeq;
      const committed = await net.writeState(code, baseSeq, next);
      if (!online || online.code !== code) return;
      if (committed) hostSeq = baseSeq + 1;
      else console.error("[online] 상태 저장 충돌 — 다음 변경 때 최신 seq로 재시도됩니다.");
    } catch (err) {
      console.error("[online] 상태 저장 실패", err);
    }
  });
}

function dispatch(action) {
  if (action.type === "NEW_GAME") {
    clearTimeout(aiTimer);
    aiRunning = false;
    if (online && !online.isHost) return; // 게스트는 새 게임을 시작할 수 없다 (호스트만)
    if (online && online.isHost) {
      const fresh = createGame({ playerCount: 2, humanSeatIndexes: [0, 1] });
      applyAndBroadcast(fresh);
    } else {
      clearGame();
      setState(createGame({ playerCount: state.settings?.playerCount || 2 }));
    }
    return;
  }

  if (online && !online.isHost) {
    // 게스트: 로컬 엔진을 돌리지 않고 호스트에게 행동을 요청만 한다.
    getNet().then((net) => net.sendAction(online.code, action)).catch((err) => console.error("[online] 행동 전송 실패", err));
    return;
  }

  const next = applyAction(action);
  if (next === state) return; // 유효하지 않은/변화 없는 행동
  playSfxFor(action);
  if (online && online.isHost) applyAndBroadcast(next);
  else setState(next);
}

function runAiIfNeeded() {
  if (online && !online.isHost) return; // 게스트는 로컬 AI를 절대 돌리지 않는다 (호스트가 대신 굴리고 방송)
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

// ── 온라인 방 연결 ────────────────────────────────────────────────────
function redrawOnlineOnly() {
  draw();
}

function onHostRoomUpdate(room) {
  if (!online || !room) return;
  const guest = room.players?.["player-2"];
  onlineUi = { mode: "host", code: online.code, ready: Boolean(guest), opponentOnline: guest?.online };

  if (room.pendingAction && room.pendingAction.id && room.pendingAction.id !== lastAppliedActionId) {
    lastAppliedActionId = room.pendingAction.id;
    const incoming = room.pendingAction.action;
    if (incoming) {
      const next = applyAction(incoming);
      if (next !== state) {
        playSfxFor(incoming);
        applyAndBroadcast(next);
      }
    }
    getNet().then((net) => net.clearPendingAction(online.code)).catch(() => {});
  }
  redrawOnlineOnly();
}

function onGuestRoomUpdate(room) {
  if (!online || !room) return;
  const host = room.players?.["player-1"];
  onlineUi = { mode: "guest", code: online.code, ready: Boolean(host), opponentOnline: host?.online };
  if (room.state) state = room.state; // 서버 확정 상태만 렌더 — 게스트는 로컬로 엔진을 앞서가지 않는다.
  draw();
}

async function startHostRoom() {
  onlineUi = { mode: "connecting" };
  draw();
  try {
    const net = await getNet();
    const code = await net.createRoom({ id: "player-1", name: "방장" });
    const fresh = createGame({ playerCount: 2, humanSeatIndexes: [0, 1] });
    online = { code, myPlayerId: "player-1", isHost: true, unsubscribe: null };
    hostSeq = 0;
    lastAppliedActionId = null;
    await net.writeState(code, 0, fresh);
    hostSeq = 1;
    state = fresh;
    online.unsubscribe = net.subscribeRoom(code, onHostRoomUpdate);
    net.setupPresence(code, "player-1");
    onlineUi = { mode: "host", code, ready: false };
    draw();
  } catch (err) {
    online = null;
    onlineUi = { mode: "offline", error: "방을 만들지 못했습니다: " + (err?.message || err) };
    draw();
  }
}

async function startGuestJoin(code) {
  if (!code) {
    onlineUi = { mode: "offline", error: "참가 코드를 입력하세요.", joinDraft: code };
    draw();
    return;
  }
  onlineUi = { mode: "connecting" };
  draw();
  try {
    const net = await getNet();
    await net.joinRoom(code, { id: "player-2", name: "참가자" });
    online = { code, myPlayerId: "player-2", isHost: false, unsubscribe: null };
    lastAppliedActionId = null;
    online.unsubscribe = net.subscribeRoom(code, onGuestRoomUpdate);
    net.setupPresence(code, "player-2");
    onlineUi = { mode: "guest", code, ready: false };
    draw();
  } catch (err) {
    online = null;
    onlineUi = { mode: "offline", error: err?.message || "방에 입장하지 못했습니다.", joinDraft: code };
    draw();
  }
}

function leaveOnline() {
  clearTimeout(aiTimer);
  aiRunning = false;
  if (online) {
    const { code, myPlayerId: pid, unsubscribe } = online;
    if (unsubscribe) unsubscribe();
    getNet().then((net) => net.leaveRoom(code, pid)).catch(() => {});
  }
  online = null;
  onlineUi = { mode: "offline" };
  state = reviveGame(loadGame({ acceptOldVersion: false, maxAgeMs: 30 * 24 * 3600e3 })) || createGame({ playerCount: 2 });
  draw();
  runAiIfNeeded();
}

gameArea.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const alwaysAllowed = ["new-game", "toggle-online", "close-online", "online-create", "online-join", "leave-online"];
  if (state.inputLocked && !alwaysAllowed.includes(action)) return;
  if (action === "play-card") dispatch({ type: "PLAY_CARD", playerId: button.dataset.playerId, cardId: button.dataset.cardId });
  if (action === "winner-fame") dispatch({ type: "WINNER_REWARD", rewardType: "fame" });
  if (action === "winner-mastery") dispatch({ type: "WINNER_REWARD", rewardType: "mastery" });
  if (action === "master-card") dispatch({ type: "MASTER_CARD", cardId: button.dataset.cardId });
  if (action === "buy") dispatch({ type: "LOSER_ACTION", playerId: button.dataset.playerId, action: { type: "buy", cardDefinitionId: button.dataset.cardDefinitionId } });
  if (action === "train-fame") {
    const me = state.players.find((player) => player.id === (myPlayerId() ?? state.players.find((p) => p.human)?.id));
    dispatch({ type: "LOSER_ACTION", playerId: me.id, action: { type: "train-fame" } });
  }
  if (action === "rest") {
    const me = state.players.find((player) => player.id === (myPlayerId() ?? state.players.find((p) => p.human)?.id));
    dispatch({ type: "LOSER_ACTION", playerId: me.id, action: { type: "rest" } });
  }
  if (action === "new-game") dispatch({ type: "NEW_GAME" });
  if (action === "toggle-rules") gameArea.querySelector("#rules-modal")?.showModal();
  if (action === "close-rules") gameArea.querySelector("#rules-modal")?.close();
  if (action === "toggle-online") gameArea.querySelector("#online-modal")?.showModal();
  if (action === "close-online") gameArea.querySelector("#online-modal")?.close();
  if (action === "online-create") startHostRoom();
  if (action === "online-join") {
    const input = gameArea.querySelector("#online-code-input");
    const code = (input?.value || "").trim().toUpperCase();
    startGuestJoin(code);
  }
  if (action === "leave-online") leaveOnline();
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
