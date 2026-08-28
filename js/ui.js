import { CARD_DEFINITIONS, MARKET_CARD_IDS, cardDef } from "./data/cards.js";
import { PHASES, ZONES } from "./data/constants.js";
import { getMasteryCandidates } from "./engine.js";

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]);

function cardHtml(card, { disabled = false, action = "", compact = false } = {}) {
  const def = cardDef(card);
  const classes = ["card", compact ? "compact" : "", def.exhausts ? "exhaust" : "", def.ability === "combo" ? "combo" : "", disabled ? "disabled" : ""]
    .filter(Boolean)
    .join(" ");
  return `
    <button class="${classes}" ${disabled ? "disabled" : ""} ${action}>
      <span class="card-topline">${def.ability === "combo" ? "콤보" : def.exhausts ? "소모" : "기술"}</span>
      <strong>${esc(def.name)}</strong>
      <span class="power">${def.power}</span>
      <small>${esc(def.text)}</small>
    </button>`;
}

function playerPanel(state, player, viewerId) {
  const isMe = player.id === viewerId;
  const isActing = state.actingPlayerId === player.id && state.phase === PHASES.WAITING_FOR_CARD;
  const isVanguard = state.vanguardPlayerId === player.id;
  const isLoserAction = state.pending.loserActionPlayerId === player.id;
  const play = state.duel.plays.find((item) => item.playerId === player.id);
  return `
    <section class="player ${isMe ? "me" : ""} ${isActing ? "acting" : ""} ${isLoserAction ? "choosing" : ""}" style="--accent:${player.color}">
      <div class="avatar">${player.portrait}</div>
      <div class="player-main">
        <div class="player-title">
          <strong>${isMe ? "나 · " : ""}${esc(player.name)}</strong>
          ${isMe ? `<span class="badge me-badge">나</span>` : ""}
          ${isVanguard ? `<span class="badge">선봉</span>` : ""}
          ${player.neutral ? `<span class="badge neutral">자동</span>` : ""}
        </div>
        <div class="meters">
          <span>명성 <b>${player.fame}</b></span>
          <span>경험치 <b>${player.neutral ? "-" : player.experience}</b></span>
          <span>덱 <b>${player.deck.length}</b></span>
          <span>휴식 <b>${player.rest.length}</b></span>
          <span>제거 <b>${player.mastered.length + player.consumed.length}</b></span>
        </div>
      </div>
      <div class="player-side">
        <span>${player.neutral ? "사범 덱" : `손패 ${player.hand.length}`}</span>
        <b>${play ? `위력 ${play.totalPower}` : isActing ? "차례" : "대기"}</b>
      </div>
    </section>`;
}

function arenaHtml(state, viewerId) {
  const winner = state.duel.winnerId ? state.players.find((player) => player.id === state.duel.winnerId) : null;
  const plays = state.duel.plays.map((play) => {
    const player = state.players.find((item) => item.id === play.playerId);
    return `
      <div class="play-stack ${winner?.id === player.id ? "winner" : ""}">
        <div class="play-owner">${play.order + 1}. ${player.id === viewerId ? "나" : esc(player.name)}</div>
        <div class="combo-line">${play.cards.map((card) => cardHtml(card, { disabled: true, compact: true })).join("")}</div>
        <div class="final-power">최종 위력 ${play.totalPower}</div>
      </div>`;
  }).join("");
  return `
    <section class="arena">
      <div class="section-title">
        <h2>대련장</h2>
        <span>현재 최고 위력 ${state.duel.highestPower}</span>
      </div>
      <div class="plays">${plays || `<div class="empty">선봉의 첫 기술을 기다리는 중</div>`}</div>
      ${winner ? `<div class="victory">대련 승리: ${winner.id === viewerId ? "나" : `${winner.portrait} ${esc(winner.name)}`}</div>` : ""}
    </section>`;
}

function handHtml(state, viewerId) {
  const me = state.players.find((player) => player.id === viewerId);
  const canPlay = state.phase === PHASES.WAITING_FOR_CARD && state.actingPlayerId === me.id && !state.inputLocked;
  return `
    <section class="hand-panel">
      <div class="section-title">
        <h2>내 손패</h2>
        <span>${canPlay ? "낼 기술을 고르세요" : "차례를 기다리는 중"}</span>
      </div>
      <div class="hand">
        ${me.hand.map((card) => cardHtml(card, {
          disabled: !canPlay,
          action: `data-action="play-card" data-player-id="${me.id}" data-card-id="${card.id}"`
        })).join("") || `<div class="empty">손패가 비었습니다.</div>`}
      </div>
    </section>`;
}

function marketCardHtml(state, activeLoser, id, { modal = false } = {}) {
  const def = CARD_DEFINITIONS[id];
  const stock = state.market[id];
  const canBuy = Boolean(activeLoser) && stock > 0 && activeLoser.experience >= def.cost && !activeLoser.boughtThisDuel && !state.inputLocked;
  const reason = stock <= 0 ? "재고 없음" : !activeLoser ? "대기" : activeLoser.experience < def.cost ? "경험치 부족" : activeLoser.boughtThisDuel ? "이미 수련함" : "수련 가능";
  return `
    <button class="market-card ${modal ? "modal-market-card" : ""} ${def.exhausts ? "exhaust" : ""}" ${canBuy ? "" : "disabled"}
      data-action="buy" data-player-id="${activeLoser?.id || ""}" data-card-definition-id="${id}">
      <strong>${esc(def.name)}</strong>
      <span class="market-power">위력 ${def.power}</span>
      <span>비용 ${def.cost} · 재고 ${stock}</span>
      <small>${esc(def.text)} · ${reason}</small>
    </button>`;
}

function marketHtml(state, viewerId) {
  const activeLoser = state.players.find((player) => player.id === state.pending.loserActionPlayerId);
  const meCanBuy = state.phase === PHASES.WAITING_FOR_LOSER_ACTION && activeLoser?.id === viewerId && !state.inputLocked;
  return `
    <section class="market">
      <div class="section-title">
        <h2>기술 수련소</h2>
        <span>${meCanBuy ? `${activeLoser.experience} 경험치` : "패배 보상 때 수련 가능"}</span>
      </div>
      <div class="market-grid">${MARKET_CARD_IDS.map((id) => marketCardHtml(state, meCanBuy ? activeLoser : null, id)).join("")}</div>
    </section>`;
}

function modalHtml(state, viewerId) {
  const human = state.players.find((player) => player.id === viewerId);
  if (state.inputLocked) {
    return `<div class="modal"><div class="modal-box small"><h2>진행 중</h2><p>AI가 행동하는 중입니다.</p></div></div>`;
  }
  if (state.phase === PHASES.WAITING_FOR_WINNER_REWARD && state.duel.winnerId === human.id) {
    const play = state.duel.plays.find((item) => item.playerId === human.id);
    const candidates = getMasteryCandidates(state, human.id);
    return `
      <div class="modal"><div class="modal-box">
        <h2>승자 보상</h2>
        <p>명성을 얻거나 기술 체득(덱에서 제거)을 선택합니다.</p>
        <div class="modal-actions">
          <button data-action="winner-fame">명성 +${play.totalPower}</button>
          <button data-action="winner-mastery" ${candidates.length ? "" : "disabled"}>기술 체득(덱에서 제거)</button>
        </div>
        ${candidates.length ? "" : `<small>제거 가능한 카드가 없거나 재사용 카드 최소 ${state.rules.minimumReusableCardsAfterMastery}장 제한에 걸렸습니다.</small>`}
      </div></div>`;
  }
  if (state.phase === PHASES.WAITING_FOR_MASTERY_CARD && state.duel.winnerId === human.id) {
    const candidates = getMasteryCandidates(state, human.id);
    return `
      <div class="modal"><div class="modal-box wide">
        <h2>기술 체득(덱에서 제거)</h2>
        <p>선택한 카드는 다시 덱으로 돌아오지 않습니다.</p>
        <div class="mastery-list">
          ${candidates.map((card) => `
            <button data-action="master-card" data-card-id="${card.id}">
              <strong>${esc(card.name)}</strong>
              <span>위력 ${card.power}</span>
              <span>${card.zone === ZONES.REST ? "휴식 더미" : "이번 대련"}</span>
              <small>제거 후 재사용 카드 ${card.remainingReusable}장</small>
            </button>`).join("")}
        </div>
      </div></div>`;
  }
  if (state.phase === PHASES.WAITING_FOR_LOSER_ACTION && state.pending.loserActionPlayerId === human.id) {
    return `
      <div class="modal"><div class="modal-box shop-modal">
        <h2>패배 보상</h2>
        <p>실전 경험을 얻었습니다. 기술을 1장 수련하거나, 명성 훈련을 하거나, 쉬어갈 수 있습니다.</p>
        <div class="shop-summary"><b>내 경험치 ${human.experience}</b><span>이번 대련에서 구매는 최대 1장</span></div>
        <div class="modal-market-grid">${MARKET_CARD_IDS.map((id) => marketCardHtml(state, human, id, { modal: true })).join("")}</div>
        <div class="modal-actions">
          <button data-action="train-fame" ${human.experience >= state.rules.trainingExperienceCost ? "" : "disabled"}>경험치 5 → 명성 1</button>
          <button data-action="rest">쉬어가기</button>
        </div>
      </div></div>`;
  }
  if (state.phase === PHASES.GAME_OVER) {
    const winner = state.players.find((player) => player.id === state.winnerId);
    return `
      <div class="modal"><div class="modal-box">
        <h2>우승!</h2>
        <p>${winner.portrait} ${winner.id === viewerId ? "나" : esc(winner.name)}이 숲속 최고의 무술가가 되었습니다.</p>
        <button data-action="new-game">새 대회</button>
      </div></div>`;
  }
  return "";
}

function onlineModalHtml(online = { mode: "offline" }) {
  if (online.mode === "connecting") {
    return `<h2>온라인 대전</h2><p>연결하는 중입니다...</p><button data-action="close-online">닫기</button>`;
  }
  if (online.mode === "host" || online.mode === "guest") {
    const roleLabel = online.mode === "host" ? "방장" : "참가자";
    const statusText = !online.ready
      ? "상대를 기다리는 중입니다. 코드를 공유하세요."
      : online.opponentOnline === false
        ? "상대의 연결이 끊겼습니다. 재접속을 기다리는 중..."
        : "상대와 연결되었습니다.";
    return `
      <h2>온라인 대전 · ${roleLabel}</h2>
      <p>참가 코드</p>
      <p class="room-code">${esc(online.code)}</p>
      <p>${statusText}</p>
      <div class="modal-actions">
        <button data-action="leave-online">온라인 대전 나가기</button>
        <button data-action="close-online">닫기</button>
      </div>`;
  }
  return `
    <h2>온라인 대전</h2>
    <p>다른 기기에 있는 상대와 실시간으로 대전합니다. (실제 대전에는 Firebase 설정이 필요합니다.)</p>
    <div class="modal-actions">
      <button data-action="online-create">방 만들기</button>
    </div>
    <div class="online-join-row">
      <input type="text" id="online-code-input" maxlength="8" autocapitalize="characters" placeholder="참가 코드 입력" value="${esc(online.joinDraft || "")}" />
      <button data-action="online-join">입장하기</button>
    </div>
    ${online.error ? `<p class="online-error">${esc(online.error)}</p>` : ""}
    <button data-action="close-online">닫기</button>`;
}

export function render(state, viewerId, online) {
  const resolvedViewerId = viewerId ?? state.players.find((player) => player.human)?.id;
  const vanguard = state.players.find((player) => player.id === state.vanguardPlayerId);
  const me = state.players.find((player) => player.id === resolvedViewerId);
  const statusText = state.phase === PHASES.WAITING_FOR_CARD
    ? state.actingPlayerId === me.id ? "내 차례" : "상대 차례"
    : state.phase === PHASES.WAITING_FOR_LOSER_ACTION && state.pending.loserActionPlayerId === me.id ? "내 패배 보상"
    : state.phase === PHASES.WAITING_FOR_WINNER_REWARD && state.duel.winnerId === me.id ? "내 승자 보상"
    : "진행 중";
  return `
    <main class="app">
      <header class="topbar">
        <div>
          <h1>우당탕 동물도장</h1>
          <p>이기면 명성, 지면 경험. 먼저 명성 50에 도달하면 우승.</p>
        </div>
        <div class="top-actions">
          <span class="status-pill">${statusText}</span>
          <span>수련 ${state.trainingCycle}</span>
          <span>대련 ${state.duelNumber}</span>
          <span>선봉 ${vanguard?.id === resolvedViewerId ? "나" : `${vanguard?.portrait} ${esc(vanguard?.name || "")}`}</span>
          <button data-action="new-game">새 게임</button>
          <button data-action="toggle-online">${online && online.mode !== "offline" ? "온라인 방" : "온라인"}</button>
          <button data-action="toggle-rules">규칙</button>
        </div>
      </header>
      <section class="players">${state.players.map((player) => playerPanel(state, player, resolvedViewerId)).join("")}</section>
      <section class="main-column">
        ${arenaHtml(state, resolvedViewerId)}
        ${handHtml(state, resolvedViewerId)}
        ${marketHtml(state, resolvedViewerId)}
      </section>
      <aside class="log"><h2>도장 기록</h2>${state.log.map((item) => `<p>${esc(item.message)}</p>`).join("")}</aside>
      <dialog id="rules-modal">
        <h2>규칙 요약</h2>
        <p>가장 높은 최종 위력이 승리합니다. 동점이면 나중에 낸 참가자가 이깁니다.</p>
        <p>승자는 명성 획득 또는 기술 체득(덱에서 제거)을 선택합니다.</p>
        <p>패자는 최종 위력만큼 경험치를 얻고 기술 수련, 명성 훈련, 쉬어가기를 선택합니다.</p>
        <button data-action="close-rules">닫기</button>
      </dialog>
      <dialog id="online-modal">${onlineModalHtml(online)}</dialog>
      ${modalHtml(state, resolvedViewerId)}
    </main>`;
}
