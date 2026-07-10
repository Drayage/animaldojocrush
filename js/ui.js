import { CARD_DEFINITIONS, MARKET_CARD_IDS, cardDef } from "./data/cards.js";
import { PHASES, ZONES } from "./data/constants.js";
import { getMasteryCandidates } from "./engine.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
})[char]);

const CARD_ART = Object.freeze({
  start_1: "🐾",
  start_2: "🛡️",
  start_3: "🌀",
  start_4: "⬇️",
  start_5: "📣",
  combo_stance: "🔗",
  bunny_kick: "🦶",
  tail_spin: "🌪️",
  maple_combo: "🍁",
  headbutt: "💥",
  tiger_dash: "💨",
  legend_fist: "✨"
});

function effectMarker(definition) {
  if (definition.ability === "combo") return `<span class="effect-sticker combo-sticker" aria-label="연계 효과">🔗 연계</span>`;
  if (definition.exhausts) return `<span class="effect-sticker exhaust-sticker" aria-label="소모 효과">⚡ 소모</span>`;
  return `<span class="effect-sticker-placeholder" aria-hidden="true"></span>`;
}

function cardHtml(card, { disabled = false, action = "", compact = false, staticCard = false } = {}) {
  const definition = cardDef(card);
  const description = `${definition.name}, 위력 ${definition.power}. ${definition.text}`;
  const tag = staticCard ? "div" : "button";
  return `
    <${tag} class="technique-card ${staticCard ? "static-card" : ""} ${compact ? "compact" : ""} ${definition.exhausts ? "exhaust" : ""} ${definition.ability === "combo" ? "combo" : ""}"
      ${!staticCard && disabled ? "disabled" : ""} ${action} title="${esc(definition.text)}" aria-label="${esc(description)}">
      ${effectMarker(definition)}
      <span class="power-badge" aria-label="위력 ${definition.power}">${definition.power}</span>
      <span class="card-art" aria-hidden="true">${CARD_ART[definition.id] || "🥋"}</span>
      <strong class="card-name">${esc(definition.name)}</strong>
    </${tag}>`;
}

function rulesDialog() {
  return `<dialog id="rules-modal"><h2>게임 규칙</h2><p><b>1.</b> 선봉부터 기술 카드 1장씩 공개합니다.</p><p><b>2.</b> 가장 높은 위력이 승리하며, 동점이면 나중에 낸 참가자가 이깁니다.</p><p><b>3.</b> 승자는 명성을 얻거나 기술 체득(덱에서 제거)을 선택합니다.</p><p><b>4.</b> 패자는 경험치를 얻어 새 기술을 수련합니다.</p><p><b>5.</b> 먼저 명성 50에 도달하면 우승합니다.</p><button data-action="close-rules">확인</button></dialog>`;
}

function startScreen(state, ui) {
  return `<main class="start-screen"><section class="hero-card"><div class="hero-animals">🐰 🐱 🐻 🦝</div><p class="eyebrow">FOREST MARTIAL ARTS</p><h1>우당탕<br>동물도장</h1><p>대련에서 이기면 명성을 얻고,<br>지면 경험을 얻는다.</p></section><section class="start-card"><h2>새 대회</h2><p>플레이 인원을 선택하세요. 나머지 참가자는 일반 AI가 맡습니다.</p><div class="player-count">${[2, 3, 4].map((count) => `<button class="${ui.selectedPlayers === count ? "selected" : ""}" data-action="select-players" data-count="${count}">${count}인</button>`).join("")}</div><button class="primary big" data-action="start-game">대회 시작</button>${ui.hasSave ? `<button class="secondary big" data-action="continue-game">이어하기</button>` : ""}<button class="text-button" data-action="toggle-rules">규칙 보기</button></section>${rulesDialog()}</main>`;
}

function seatAssignments(state) {
  const human = state.players.find((player) => player.human);
  const opponents = state.players.filter((player) => !player.human);
  const assignments = new Map([[human.id, "bottom"]]);

  if (state.settings?.playerCount === 2) {
    assignments.set(opponents[0].id, "top");
  } else if (opponents.length === 2) {
    assignments.set(opponents[0].id, "top-left");
    assignments.set(opponents[1].id, "top-right");
  } else {
    assignments.set(opponents[0]?.id, "top-left");
    assignments.set(opponents[1]?.id, "top");
    assignments.set(opponents[2]?.id, "top-right");
  }
  return assignments;
}

function playerPanel(state, player, seat) {
  const acting = state.phase === PHASES.WAITING_FOR_CARD && state.actingPlayerId === player.id;
  const choosing = state.pending.loserActionPlayerId === player.id
    || (state.duel.winnerId === player.id && [PHASES.WAITING_FOR_WINNER_REWARD, PHASES.WAITING_FOR_MASTERY_CARD].includes(state.phase));
  const status = acting ? "현재 차례" : choosing ? "선택 중" : "";
  return `
    <article class="fighter seat-${seat} ${player.human ? "me" : ""} ${acting ? "acting" : ""} ${choosing ? "choosing" : ""}" style="--accent:${player.color}" data-seat="${seat}">
      <div class="avatar" aria-hidden="true">${player.portrait}</div>
      <div class="fighter-info">
        <div class="fighter-name"><strong>${player.human ? "나 · " : ""}${esc(player.name)}</strong>${state.vanguardPlayerId === player.id ? `<span class="badge vanguard">선봉</span>` : ""}${status ? `<span class="badge turn-badge">${status}</span>` : ""}</div>
        <div class="stats" aria-label="참가자 상태">
          <span title="명성">⭐ <b>${player.fame}</b></span>
          <span title="경험치">🔵 <b>${player.neutral ? "-" : player.experience}</b></span>
          <span title="덱">🂠 <b>${player.deck.length}</b></span>
          <span title="휴식 더미">💤 <b>${player.rest.length}</b></span>
          ${!player.human ? `<span title="손패">✋ <b>${player.neutral ? "-" : player.hand.length}</b></span>` : ""}
        </div>
      </div>
    </article>`;
}

function arenaSlot(state, player, seat) {
  const play = state.duel.plays.find((item) => item.playerId === player.id);
  if (!play) return "";
  const isWinner = state.duel.winnerId === player.id;
  return `
    <div class="duel-slot slot-${seat} ${isWinner ? "winner" : ""}">
      <div class="duel-owner"><span>${player.portrait}</span><strong>${player.human ? "나" : esc(player.name)}</strong></div>
      <div class="played-cards">${play.cards.map((card) => cardHtml(card, { compact: true, staticCard: true })).join("")}</div>
      <strong class="duel-power" aria-label="최종 위력 ${play.totalPower}">${play.totalPower}</strong>
    </div>`;
}

function arenaHtml(state, seats) {
  const winner = state.players.find((player) => player.id === state.duel.winnerId);
  const slots = state.players.map((player) => arenaSlot(state, player, seats.get(player.id))).join("");
  const centerText = winner ? `${winner.portrait} 대련 승리` : state.duel.plays.length ? `현재 최고 ${state.duel.highestPower}` : "대련 준비";
  return `
    <section class="arena" aria-label="중앙 대련장">
      <div class="arena-heading"><span>대련 ${state.duelNumber}</span><strong>대련장</strong></div>
      <div class="dojo-floor">
        ${slots}
        <div class="arena-status ${winner ? "victory" : ""}"><span>${centerText}</span>${!winner && state.duel.plays.length ? `<b>${state.duel.highestPower}</b>` : ""}</div>
      </div>
    </section>`;
}

function tableHtml(state) {
  const seats = seatAssignments(state);
  const human = state.players.find((player) => player.human);
  const opponents = state.players.filter((player) => !player.human);
  return `
    <section class="table-layout player-count-${state.settings?.playerCount || state.players.length}">
      <div class="opponent-seats">${opponents.map((player) => playerPanel(state, player, seats.get(player.id))).join("")}</div>
      ${arenaHtml(state, seats)}
      <div class="home-seat">${playerPanel(state, human, "bottom")}</div>
    </section>`;
}

function handHtml(state) {
  const human = state.players.find((player) => player.human);
  const canPlay = state.phase === PHASES.WAITING_FOR_CARD && state.actingPlayerId === human.id && !state.inputLocked;
  return `
    <section class="hand-panel ${canPlay ? "ready" : ""}">
      <div class="panel-heading"><div><span class="eyebrow">MY TECHNIQUES</span><h2>${human.portrait} 내 손패</h2></div><span class="turn-message">${canPlay ? "내 차례 · 기술 선택" : state.inputLocked ? "상대 차례" : "대기 중"}</span></div>
      <div class="hand">${human.hand.map((card) => cardHtml(card, { disabled: !canPlay, action: `data-action="play-card" data-player-id="${human.id}" data-card-id="${card.id}"` })).join("") || `<div class="empty">손패가 비었습니다.</div>`}</div>
    </section>`;
}

function marketContent(state) {
  const activePlayer = state.players.find((player) => player.id === state.pending.loserActionPlayerId);
  const canBuy = state.phase === PHASES.WAITING_FOR_LOSER_ACTION && activePlayer?.human && !state.inputLocked;
  const human = state.players.find((player) => player.human);
  return `<div class="market-summary"><span>보유 경험치 <b>${activePlayer?.human ? activePlayer.experience : human.experience}</b></span><small>${canBuy ? "기술 1장을 선택하세요" : "패배 보상 차례에 수련 가능"}</small></div><div class="market-grid">${MARKET_CARD_IDS.map((id) => {
    const definition = CARD_DEFINITIONS[id];
    const stock = state.market[id];
    const disabled = !canBuy || stock <= 0 || activePlayer.experience < definition.cost || activePlayer.boughtThisDuel;
    return `
      <button class="market-card ${definition.exhausts ? "exhaust" : ""} ${definition.ability === "combo" ? "combo" : ""}" ${disabled ? "disabled" : ""}
        data-action="buy" data-player-id="${activePlayer?.id || ""}" data-card-definition-id="${id}" title="${esc(definition.text)}" aria-label="${esc(definition.name)}, 위력 ${definition.power}, 비용 ${definition.cost}, 재고 ${stock}">
        ${effectMarker(definition)}
        <span class="market-power" aria-label="위력 ${definition.power}">${definition.power}</span>
        <span class="market-art" aria-hidden="true">${CARD_ART[id] || "🥋"}</span>
        <strong>${esc(definition.name)}</strong>
        <span class="market-meta"><b class="cost-badge">🔵 ${definition.cost}</b><small>재고 ${stock}</small></span>
      </button>`;
  }).join("")}</div>`;
}

function pileSection(title, cards, emptyText, note = "") {
  return `<section class="pile-section"><div class="pile-heading"><div><h3>${title}</h3>${note ? `<small>${note}</small>` : ""}</div><b>${cards.length}장</b></div><div class="pile-cards">${cards.map((card) => cardHtml(card, { compact: true, staticCard: true })).join("") || `<p class="pile-empty">${emptyText}</p>`}</div></section>`;
}

function ownedCardsContent(state) {
  const human = state.players.find((player) => player.human);
  return `<div class="owned-card-piles">${pileSection("덱에 남은 카드", human.deck, "덱이 비었습니다.", "순서와 관계없이 구성만 표시")}${pileSection("버린 카드 · 휴식 더미", human.rest, "버린 카드가 없습니다.", "승리하면 이곳의 일반 카드를 없앨 수 있음")}${human.played.length ? pileSection("이번 대련에 낸 카드", human.played, "", "승리하면 일반 카드를 없앨 수 있음") : ""}</div>`;
}

function overlayPanel(state, ui) {
  if (!ui.panel) return "";
  const content = ui.panel === "market"
    ? `<h2>🥋 기술 수련소</h2>${marketContent(state)}`
    : ui.panel === "cards"
      ? `<h2>🂠 내 카드</h2>${ownedCardsContent(state)}`
      : `<h2>📜 도장 기록</h2><div class="log-list">${state.log.map((item) => `<p>${esc(item.message)}</p>`).join("")}</div>`;
  return `<div class="sheet-backdrop" data-action="close-panel"><aside class="bottom-sheet"><div class="sheet-handle"></div><button class="sheet-close" data-action="close-panel" aria-label="닫기">×</button>${content}</aside></div>`;
}

function modalHtml(state) {
  if (state.inputLocked) return `<div class="modal"><div class="modal-box small"><div class="loader">🥋</div><h2>상대가 생각 중입니다</h2></div></div>`;
  const human = state.players.find((player) => player.human);
  if (state.phase === PHASES.WAITING_FOR_WINNER_REWARD && state.duel.winnerId === human.id) {
    const play = state.duel.plays.find((item) => item.playerId === human.id);
    const candidates = getMasteryCandidates(state, human.id);
    return `<div class="modal"><div class="modal-box wide"><span class="result-icon">🏆</span><h2>승자 보상</h2><p>이번 승리의 보상을 선택하세요.</p>${candidates.length ? `<section class="reward-candidates"><div class="pile-heading"><div><h3>없앨 수 있는 카드</h3><small>버린 카드와 이번 대련의 일반 카드</small></div><b>${candidates.length}장</b></div><div class="pile-cards">${candidates.map((candidate) => cardHtml(candidate.definitionId, { compact: true, staticCard: true })).join("")}</div></section>` : ""}<div class="reward-grid"><button data-action="winner-fame"><b>⭐ +${play.totalPower}</b><span>명성 획득</span></button><button data-action="winner-mastery" ${candidates.length ? "" : "disabled"}><b>✨ 기술 체득</b><span>덱에서 카드 제거</span></button></div></div></div>`;
  }
  if (state.phase === PHASES.WAITING_FOR_MASTERY_CARD && state.duel.winnerId === human.id) {
    const candidates = getMasteryCandidates(state, human.id);
    return `<div class="modal"><div class="modal-box wide"><h2>기술 체득(덱에서 제거)</h2><p>선택한 카드는 이번 게임에서 영구 제거됩니다.</p><div class="mastery-list">${candidates.map((card) => { const definition = CARD_DEFINITIONS[card.definitionId]; return `<button class="mastery-option ${definition.exhausts ? "exhaust" : ""} ${definition.ability === "combo" ? "combo" : ""}" data-action="master-card" data-card-id="${card.id}">${effectMarker(definition)}<span class="market-power">${card.power}</span><span class="market-art">${CARD_ART[definition.id] || "🥋"}</span><strong>${esc(card.name)}</strong><small>${card.zone === ZONES.REST ? "버린 카드" : "이번 대련"} · 제거 후 ${card.remainingReusable}장</small></button>`; }).join("")}</div></div></div>`;
  }
  if (state.phase === PHASES.WAITING_FOR_LOSER_ACTION && state.pending.loserActionPlayerId === human.id) {
    return `<div class="modal"><div class="modal-box"><span class="result-icon">💪</span><h2>패배 보상</h2><p>경험치를 사용할 방법을 선택하세요.</p><button class="primary" data-action="toggle-market">기술 수련소 열기</button><div class="modal-actions"><button data-action="train-fame" ${human.experience >= state.rules.trainingExperienceCost ? "" : "disabled"}>경험치 5 → 명성 1</button><button data-action="rest">경험치 보존</button></div></div></div>`;
  }
  if (state.phase === PHASES.GAME_OVER) {
    const winner = state.players.find((player) => player.id === state.winnerId);
    return `<div class="modal"><div class="modal-box champion"><span>${winner.portrait}</span><h2>${esc(winner.name)} 우승!</h2><p>숲속 최고의 무술가가 되었습니다.</p><button class="primary big" data-action="new-game">새 대회 시작</button><button class="secondary" data-action="show-start">메인으로</button></div></div>`;
  }
  return "";
}

export function render(state, ui) {
  const view = ui || {
    screen: "game",
    panel: state.phase === PHASES.WAITING_FOR_LOSER_ACTION ? "market" : null
  };
  if (view.screen === "start") return startScreen(state, view);
  const vanguard = state.players.find((player) => player.id === state.vanguardPlayerId);
  return `<main class="game-shell"><header class="game-header"><div><span class="eyebrow">수련 ${state.trainingCycle}</span><h1>우당탕 동물도장</h1></div><div class="round-info"><span>대련 <b>${state.duelNumber}</b></span><span title="선봉">선봉 ${vanguard?.portrait}</span><button data-action="toggle-rules" aria-label="규칙 보기" title="규칙 보기">?</button></div></header><section class="game-main">${tableHtml(state)}${handHtml(state)}</section>${overlayPanel(state, view)}${view.panel ? "" : modalHtml(state)}${rulesDialog()}</main>`;
}
