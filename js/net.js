// Firebase RTDB 온라인 동기화 — 공유 프로젝트 입주 + hammynap/uritichu 교훈의 표준판.
// 핵심 원칙:
//  1) DB 경로는 항상 `games/${APP_ID}/rooms/` 네임스페이스 (공유 프로젝트에 7개 게임 입주,
//     게임별로 서로 다른 하위 트리를 쓰므로 규칙도 게임별로 나눠서 붙일 수 있다)
//  2) 쓰기 전 undefined → null 정화 (Firebase는 undefined 거부)
//  3) seq 가드 — 오래된 쓰기가 새 상태를 덮어쓰지 못하게
//  4) 화면은 서버 확정 상태만 렌더 (낙관적 렌더 금지)
//  5) 새로고침 시 방을 즉시 파괴하지 않음 — 유예 + 재입장
//
// ── 동기화 프로토콜(중요, 엔진 낙관적 로컬 dispatch와의 정합) ─────────────
// 이 게임의 엔진(engine.js)은 매 dispatch마다 로컬에서 즉시 새 state를 계산하는
// "낙관적" 리듀서다. 두 참가자가 동시에 로컬에서 각자 엔진을 굴리면 같은 duel에
// 대해 서로 다른 state가 나올 수 있어 레이스가 생긴다. 그래서 이 게임은:
//
//   - 호스트(방장, player-1)만 엔진 뮤테이터(playCard/loserAction/...)를 호출하고
//     그 결과 state를 seq 가드 트랜잭션으로 room에 쓴다 (writeState).
//   - 게스트(참가자, player-2)는 엔진을 절대 로컬로 돌리지 않는다. 대신 자신의
//     행동을 room.pendingAction에 요청으로 적어 넣기만 한다 (sendAction).
//   - 호스트는 room 구독 콜백에서 pendingAction을 발견하면 그것을 자신의 엔진에
//     적용하고(엔진 자체의 phase/actingPlayerId 검증이 그대로 가드 역할을 한다),
//     결과를 writeState로 반영한 뒤 pendingAction을 지운다 (clearPendingAction).
//   - 게스트의 화면은 오직 room.state(서버 확정 상태)만 렌더한다. 절대 로컬로
//     엔진을 앞서 실행하지 않는다 — 이래야 두 화면이 항상 같은 state로 수렴한다.
//
// 즉 "단일 진실 소스는 항상 호스트의 로컬 state, room.state는 그 미러"라는
// 단일 이벤트 큐 원칙을 온라인에도 그대로 적용한 것이다.
import { APP_ID, FIREBASE_CONFIG } from "./app-config.js";
import { saveRejoin, loadRejoin, clearRejoin } from "./storage.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, get, set, update, onValue, off,
  onDisconnect, runTransaction, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let db = null;
function ensureDb() {
  if (!db) db = getDatabase(initializeApp(FIREBASE_CONFIG));
  return db;
}

const roomsPath = (code) => `games/${APP_ID}/rooms/${code}`;

function makeActionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── (2) undefined 정화: 모든 쓰기는 이 함수를 통과시킬 것 ────────────
export function sanitize(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitize);
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = sanitize(v);
  return out;
}

export function makeRoomCode(len = 5) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 혼동 문자 제외
  return Array.from({ length: len }, () => chars[(Math.random() * chars.length) | 0]).join("");
}

export async function createRoom(hostPlayer) {
  const code = makeRoomCode();
  const room = sanitize({
    seq: 0,
    createdAt: serverTimestamp(),
    phase: "lobby",
    players: { [hostPlayer.id]: { ...hostPlayer, online: true } },
    state: null,
    pendingAction: null,
  });
  await set(ref(ensureDb(), roomsPath(code)), room);
  saveRejoin({ code, playerId: hostPlayer.id });
  return code;
}

export async function joinRoom(code, player) {
  const snap = await get(ref(ensureDb(), roomsPath(code)));
  if (!snap.exists()) throw new Error("방을 찾을 수 없습니다: " + code);
  await update(
    ref(ensureDb(), `${roomsPath(code)}/players/${player.id}`),
    sanitize({ ...player, online: true })
  );
  saveRejoin({ code, playerId: player.id });
}

// ── (3) seq 가드 쓰기: 상태 저장은 반드시 이 함수로 ─────────────────
// 트랜잭션으로 "내가 읽은 seq보다 서버가 앞서 있으면 포기"를 보장한다.
export async function writeState(code, baseSeq, nextState) {
  const result = await runTransaction(ref(ensureDb(), roomsPath(code)), (cur) => {
    if (!cur) return cur; // 방 없음
    if ((cur.seq || 0) !== baseSeq) return undefined; // 이미 앞선 상태 → 포기
    return { ...cur, seq: baseSeq + 1, state: sanitize(nextState) };
  });
  return result.committed; // false면 호출측이 최신 상태 기준으로 재시도
}

// ── (3-b) 게스트 행동 요청: 게스트는 절대 엔진을 로컬로 돌리지 않고
// 이 함수로 "이런 행동을 하고 싶다"만 room.pendingAction에 적어 넣는다.
// 실제 반영(엔진 적용 + writeState)은 호스트만 한다. id는 호스트가 같은
// 요청을 중복 적용하지 않도록 하는 dedupe 키다.
export async function sendAction(code, action) {
  const id = makeActionId();
  await update(
    ref(ensureDb(), `${roomsPath(code)}/pendingAction`),
    sanitize({ id, action, requestedAt: serverTimestamp() })
  );
  return id;
}

// 호스트가 pendingAction을 엔진에 적용하고 writeState까지 마친 뒤 호출한다.
export async function clearPendingAction(code) {
  await update(ref(ensureDb(), roomsPath(code)), { pendingAction: null });
}

// 명시적으로 방을 나갈 때: onDisconnect 유예를 기다리지 않고 즉시 오프라인 표시.
export async function leaveRoom(code, playerId) {
  await update(
    ref(ensureDb(), `${roomsPath(code)}/players/${playerId}`),
    { online: false, lastSeen: serverTimestamp() }
  );
  clearRejoin();
}

// Firebase RTDB는 빈 배열([])을 쓰면 그 키가 통째로 사라진다 — 읽을 때는
// undefined로 돌아온다. duel.plays/log와 각 플레이어의 deck/hand/rest/
// mastered/consumed/played는 게임 도중 실제로 자주 빈 배열이 되는 필드라서
// (새 대회 시작 직후 duel.plays, 게임 시작 직후 log 등), room.state를 그대로
// 렌더하면 ui.js의 무가드 .length/.map 호출이 게스트 화면에서만 터진다
// (호스트는 로컬 in-memory state를 그대로 쓰므로 이 라운드트립을 안 거친다).
// subscribeRoom이 콜백에 넘기기 전에 이 필드들을 복원해 둔다.
function hydratePlayer(player) {
  if (!player) return player;
  player.deck = player.deck || [];
  player.hand = player.hand || [];
  player.rest = player.rest || [];
  player.mastered = player.mastered || [];
  player.consumed = player.consumed || [];
  player.played = player.played || [];
  return player;
}

function hydrateRoomState(state) {
  if (!state) return state;
  state.log = state.log || [];
  if (state.duel) state.duel.plays = state.duel.plays || [];
  if (state.pending) {
    state.pending.masteryCards = state.pending.masteryCards || [];
    state.pending.loserQueue = state.pending.loserQueue || [];
  }
  if (Array.isArray(state.players)) state.players.forEach(hydratePlayer);
  return state;
}

// ── (4) 구독: 콜백이 받은 서버 상태만 렌더할 것 ─────────────────────
// onValue는 여러 변경이 합쳐져(coalesced) 올 수 있다 — 이벤트 로그/리플레이는
// diff가 아니라 상태에 포함된 누적 기록으로 관리할 것.
export function subscribeRoom(code, onRoom) {
  const r = ref(ensureDb(), roomsPath(code));
  onValue(r, (snap) => {
    const room = snap.val();
    if (room) hydrateRoomState(room.state);
    onRoom(room);
  });
  return () => off(r);
}

// ── (5) presence: 즉시 삭제 금지, 오프라인 표시만 (재입장 유예) ───────
export function setupPresence(code, playerId) {
  const p = ref(ensureDb(), `${roomsPath(code)}/players/${playerId}`);
  update(p, { online: true, lastSeen: serverTimestamp() });
  onDisconnect(p).update({ online: false, lastSeen: serverTimestamp() });
  // 방 정리는 호스트가 "전원 오프라인 + 유예시간 경과"일 때만 수행한다.
}

export async function tryRejoin() {
  const info = loadRejoin();
  if (!info) return null;
  const snap = await get(ref(ensureDb(), roomsPath(info.code)));
  if (!snap.exists()) {
    clearRejoin();
    return null;
  }
  return { ...info, room: snap.val() };
}
