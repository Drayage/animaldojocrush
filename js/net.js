// Firebase RTDB 온라인 동기화 — 공유 프로젝트 입주 + hammynap/uritichu 교훈의 표준판.
// 핵심 원칙:
//  1) DB 경로는 항상 `${APP_ID}_rooms/` 네임스페이스 (공유 프로젝트에 여러 게임 입주)
//  2) 쓰기 전 undefined → null 정화 (Firebase는 undefined 거부)
//  3) seq 가드 — 오래된 쓰기가 새 상태를 덮어쓰지 못하게
//  4) 화면은 서버 확정 상태만 렌더 (낙관적 렌더 금지)
//  5) 새로고침 시 방을 즉시 파괴하지 않음 — 유예 + 재입장
import { FIREBASE_CONFIG, FIREBASE_ROOM_PATH } from "./app-config.js";
import { saveRejoin, loadRejoin, clearRejoin } from "./storage.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, get, update, onValue, off,
  onDisconnect, runTransaction, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let db = null;
function ensureDb() {
  if (!db) db = getDatabase(initializeApp(FIREBASE_CONFIG));
  return db;
}

const roomsPath = (code) => `${FIREBASE_ROOM_PATH}/${code}`;

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

export async function createRoom(hostPlayer, initialState) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeRoomCode();
    const room = sanitize({
      seq: 0,
      createdAt: Date.now(),
      phase: "lobby",
      players: { [hostPlayer.id]: { ...hostPlayer, online: true } },
      state: initialState,
    });
    const result = await runTransaction(ref(ensureDb(), roomsPath(code)), (current) => current ? undefined : room);
    if (!result.committed) continue;
    saveRejoin({ code, playerId: hostPlayer.id });
    return code;
  }
  throw new Error("빈 방 코드를 만들지 못했습니다. 잠시 후 다시 시도하세요.");
}

export async function joinRoom(code, player) {
  const roomRef = ref(ensureDb(), roomsPath(code));
  // A fresh browser has no local room cache. Warm it before the transaction so
  // the first update callback does not mistake an unknown room for a missing one.
  const roomSnapshot = await get(roomRef);
  if (!roomSnapshot.exists() || roomSnapshot.val()?.phase !== "lobby") {
    throw new Error("참가할 수 없는 방입니다. 코드와 대기 상태를 확인하세요.");
  }
  const initialRoom = roomSnapshot.val();
  const result = await runTransaction(roomRef, (current) => {
    // Firebase may invoke a transaction with an empty local cache first. The
    // server still performs the hash check and retries with its latest value.
    current ||= initialRoom;
    if (!current || current.phase !== "lobby") return undefined;
    const players = current.players || {};
    const existing = Object.values(players).find((item) => item.clientId === player.clientId);
    if (existing) return current;
    const playerCount = current.state?.settings?.playerCount || 2;
    const occupied = new Set(Object.values(players).map((item) => item.seat));
    const seat = Array.from({ length: playerCount }, (_, index) => index).find((index) => !occupied.has(index));
    if (seat === undefined) return undefined;
    const id = `player-${seat + 1}`;
    const name = current.state?.players?.[seat]?.name || `참가자 ${seat + 1}`;
    const joined = sanitize({ ...player, id, name, seat, ready: true, online: true });
    const state = sanitize(current.state);
    state.players[seat] = { ...state.players[seat], human: true, ai: false };
    return { ...current, seq: (current.seq || 0) + 1, state, players: { ...players, [id]: joined } };
  });
  if (!result.committed) throw new Error("참가할 수 없는 방입니다. 코드와 대기 상태를 확인하세요.");
  const joined = Object.values(result.snapshot.val()?.players || {}).find((item) => item.clientId === player.clientId);
  if (!joined) throw new Error("온라인 좌석을 배정하지 못했습니다.");
  saveRejoin({ code, playerId: joined.id });
  return joined;
}

export async function setRoomPhase(code, phase) {
  if (!/^(playing|ended)$/.test(phase)) throw new Error("잘못된 방 상태입니다.");
  await update(ref(ensureDb(), roomsPath(code)), { phase });
}

export async function setSeatAi(code, seat, enabled) {
  const result = await runTransaction(ref(ensureDb(), roomsPath(code)), (current) => {
    if (!current || current.phase !== "lobby" || seat <= 0) return undefined;
    const playerCount = current.state?.settings?.playerCount || 2;
    if (seat >= playerCount) return undefined;
    const players = { ...(current.players || {}) };
    const occupant = Object.values(players).find((player) => player.seat === seat);
    if (occupant && occupant.online !== false) return undefined;
    if (occupant) delete players[occupant.id];
    const state = sanitize(current.state);
    state.players[seat] = { ...state.players[seat], human: !enabled, ai: Boolean(enabled) };
    state.networkLastAction = null;
    return { ...current, seq: (current.seq || 0) + 1, state, players };
  });
  if (!result.committed) throw new Error("이 좌석은 현재 변경할 수 없습니다.");
}

// ── (3) seq 가드 쓰기: 상태 저장은 반드시 이 함수로 ─────────────────
// 트랜잭션으로 "내가 읽은 seq보다 서버가 앞서 있으면 포기"를 보장한다.
export async function writeState(code, baseSeq, nextState, action) {
  const result = await runTransaction(ref(ensureDb(), roomsPath(code)), (cur) => {
    if (!cur) return cur; // 방 없음
    if ((cur.seq || 0) !== baseSeq) return undefined; // 이미 앞선 상태 → 포기
    return {
      ...cur,
      seq: baseSeq + 1,
      phase: nextState.phase === "GAME_OVER" ? "ended" : cur.phase,
      state: sanitize({ ...nextState, networkLastAction: action }),
    };
  });
  return result.committed; // false면 호출측이 최신 상태 기준으로 재시도
}

// ── (4) 구독: 콜백이 받은 서버 상태만 렌더할 것 ─────────────────────
// onValue는 여러 변경이 합쳐져(coalesced) 올 수 있다 — 이벤트 로그/리플레이는
// diff가 아니라 상태에 포함된 누적 기록으로 관리할 것.
export function subscribeRoom(code, onRoom) {
  const r = ref(ensureDb(), roomsPath(code));
  onValue(r, (snap) => onRoom(snap.val()));
  return () => off(r);
}

// ── (5) presence: 즉시 삭제 금지, 오프라인 표시만 (재입장 유예) ───────
export function setupPresence(code, playerId) {
  const p = ref(ensureDb(), `${roomsPath(code)}/players/${playerId}`);
  const disconnect = onDisconnect(p);
  disconnect.update({ online: false, lastSeen: serverTimestamp() })
    .then(() => update(p, { online: true, lastSeen: serverTimestamp() }));
  // 방 정리는 호스트가 "전원 오프라인 + 유예시간 경과"일 때만 수행한다.
}

export async function leaveRoom(code, playerId) {
  await runTransaction(ref(ensureDb(), roomsPath(code)), (current) => {
    if (!current) return current;
    if (current.phase !== "lobby") {
      return {
        ...current,
        players: {
          ...(current.players || {}),
          [playerId]: { ...(current.players?.[playerId] || {}), online: false, lastSeen: Date.now() },
        },
      };
    }
    if (playerId === "player-1") return null;
    const players = { ...(current.players || {}) };
    const leaving = players[playerId];
    delete players[playerId];
    const state = sanitize(current.state);
    if (leaving?.seat !== undefined) state.players[leaving.seat] = { ...state.players[leaving.seat], human: true, ai: false };
    return { ...current, seq: (current.seq || 0) + 1, state, players };
  });
  clearRejoin();
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
