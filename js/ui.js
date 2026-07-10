import { CARD_DEFINITIONS, MARKET_CARD_IDS, cardDef } from "./data/cards.js";
import { MILESTONE_REWARDS, PHASES, ZONES } from "./data/constants.js";
import { getMasteryCandidates, getMilestoneMasteryCandidates } from "./engine.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
})[char]);

const CARD_ART = Object.freeze({
  start_1: "art-c1-r1",
  start_2: "art-c2-r1",
  start_3: "art-c3-r1",
  start_4: "art-c4-r1",
  start_5: "art-c1-r2",
  combo_stance: "art-c2-r2",
  bunny_kick: "art-c3-r2",
  tail_spin: "art-c4-r2",
  maple_combo: "art-c1-r3",
  headbutt: "art-c2-r3",
  tiger_dash: "art-c3-r3",
  legend_fist: "art-c4-r3"
});

function cardArtHtml(definitionId, className = "card-art") {
  return `<span class="${className} card-illustration ${CARD_ART[definitionId] || "art-c1-r1"}" aria-hidden="true"></span>`;
}

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
      ${cardArtHtml(definition.id)}
      <strong class="card-name">${esc(definition.name)}</strong>
    </${tag}>`;
}

function rulesDialog() {
  return `<dialog id="rules-modal"><h2>게임 규칙</h2><p><b>1.</b> 선봉부터 기술 카드 1장씩 공개합니다.</p><p><b>2.</b> 가장 높은 위력이 승리하며, 동점이면 나중에 낸 참가자가 이깁니다.</p><p><b>3.</b> 승자는 명성을 얻거나 기술 체득(덱에서 제거)을 선택합니다.</p><p><b>4.</b> 패자는 경험치를 얻어 새 기술을 수련합니다.</p><p><b>5.</b> 선착 보상 모드에서는 명성 6점 단위 보상을 가장 먼저 도달한 참가자만 얻습니다.</p><p><b>6.</b> 설정한 목표 명성에 먼저 도달하면 우승합니다.</p><button data-action="close-rules">확인</button></dialog>`;
}

function audioToggles(ui) {
  const audio = ui.audio || { bgmEnabled: true, sfxEnabled: true };
  return `<div class="setting-row"><span>소리</span><div class="toggle-group"><button data-action="toggle-bgm" aria-pressed="${audio.bgmEnabled}">🎵 배경음 ${audio.bgmEnabled ? "켜짐" : "꺼짐"}</button><button data-action="toggle-sfx" aria-pressed="${audio.sfxEnabled}">🥋 효과음 ${audio.sfxEnabled ? "켜짐" : "꺼짐"}</button></div></div>`;
}

function newGameSettings(ui) {
  const target = ui.selectedTargetFame || 50;
  return `<section class="new-game-settings"><h3>게임 설정</h3><div class="setting-row"><label for="target-fame">목표 명성</label><div class="target-options">${[30, 42, 50, 60].map((score) => `<button class="${target === score ? "selected" : ""}" data-action="select-target" data-score="${score}">${score}</button>`).join("")}<input id="target-fame" data-setting="target-fame" type="number" inputmode="numeric" min="12" max="100" value="${target}" aria-label="목표 명성 직접 입력" /></div></div><div class="setting-row"><span>6점 선착 보상</span><button class="setting-toggle" data-action="toggle-milestone-mode" aria-pressed="${ui.milestoneMode !== false}">${ui.milestoneMode !== false ? "사용" : "미사용"}</button></div>${audioToggles(ui)}</section>`;
}

function offlineSetup(ui) {
  return `<p>플레이 인원을 선택하세요. 나머지 참가자는 일반 AI가 맡습니다.</p><div class="player-count">${[2, 3, 4].map((count) => `<button class="${ui.selectedPlayers === count ? "selected" : ""}" data-action="select-players" data-count="${count}">${count}인</button>`).join("")}</div>${newGameSettings(ui)}<button class="primary big" data-action="start-game">대회 시작</button>${ui.hasSave ? `<button class="secondary big" data-action="continue-game">이어하기</button>` : ""}`;
}

function onlineSetup(ui) {
  return `<p>친구와 2~4인 대전을 시작합니다. 방장이 인원과 규칙을 결정합니다.</p><div class="setting-row"><span>온라인 인원</span><div class="player-count online-count">${[2, 3, 4].map((count) => `<button class="${ui.selectedPlayers === count ? "selected" : ""}" data-action="select-players" data-count="${count}">${count}인</button>`).join("")}</div></div>${newGameSettings(ui)}<button class="primary big" data-action="create-online-room" ${ui.onlineBusy ? "disabled" : ""}>온라인 방 만들기</button><div class="online-divider"><span>또는</span></div><label class="room-code-field"><span>참가 코드</span><input data-setting="room-code" inputmode="text" maxlength="6" value="${esc(ui.roomCodeInput || "")}" placeholder="예: A7K2Q" autocomplete="off" /></label><button class="secondary big" data-action="join-online-room" ${ui.onlineBusy ? "disabled" : ""}>코드로 참가</button>${ui.hasRejoin ? `<button class="text-button" data-action="rejoin-online-room">이전 온라인 방 다시 연결</button>` : ""}${ui.onlineError ? `<p class="online-error" role="alert">${esc(ui.onlineError)}</p>` : ""}`;
}

function startScreen(state, ui) {
  const online = ui.playMode === "online";
  return `<main class="start-screen"><section class="hero-card"><div class="hero-animals">🐰 🐱 🐻 🦝</div><p class="eyebrow">FOREST MARTIAL ARTS</p><h1>우당탕<br>동물도장</h1><p>대련에서 이기면 명성을 얻고,<br>지면 경험을 얻는다.</p></section><section class="start-card"><h2>새 대회</h2><div class="play-mode" role="group" aria-label="플레이 방식"><button class="${online ? "" : "selected"}" data-action="select-play-mode" data-mode="offline">AI 대전</button><button class="${online ? "selected" : ""}" data-action="select-play-mode" data-mode="online">온라인 2~4인</button></div>${online ? onlineSetup(ui) : offlineSetup(ui)}<button class="text-button" data-action="toggle-rules">규칙 보기</button></section>${rulesDialog()}</main>`;
}

function lobbyScreen(ui) {
  const room = ui.onlineRoom;
  const players = Object.values(room?.players || {}).sort((a, b) => (a.seat || 0) - (b.seat || 0));
  const expected = room?.state?.settings?.playerCount || 2;
  const gamePlayers = room?.state?.players || [];
  const seats = Array.from({ length: expected }, (_, seat) => {
    const player = players.find((item) => item.seat === seat);
    const gamePlayer = gamePlayers[seat];
    const ai = !player && gamePlayer?.ai;
    const ready = ai || Boolean(player && player.online !== false);
    return { seat, player, gamePlayer, ai, ready };
  });
  const readySeats = seats.filter((seat) => seat.ready).length;
  const ready = readySeats === expected;
  return `<main class="lobby-screen"><section class="lobby-box"><span class="eyebrow">ONLINE DOJO</span><h1>온라인 대기실</h1><p>친구에게 참가 코드를 알려 주세요. 좌석 ${readySeats}/${expected}</p><button class="room-code" data-action="copy-room-code" aria-label="방 코드 복사"><strong>${esc(ui.onlineCode)}</strong><span>복사</span></button><div class="lobby-players">${seats.map(({ seat, player, gamePlayer, ai }) => { const offline = player?.online === false; const title = player ? player.name : ai ? `${gamePlayer.name} AI` : "참가자 기다리는 중"; const status = player ? offline ? "연결 끊김" : "사람 · 입장 완료" : ai ? "AI 참가자" : "친구 참가 또는 AI 추가"; const control = ui.onlineIsHost && seat > 0 ? ai ? `<button class="lobby-seat-action" data-action="remove-online-ai" data-seat="${seat}">AI 빼기</button>` : !player || offline ? `<button class="lobby-seat-action" data-action="add-online-ai" data-seat="${seat}">${offline ? "AI로 교체" : "AI 추가"}</button>` : "" : ""; return `<article class="lobby-player ${player && !offline ? "joined" : ai ? "ai" : "empty"}"><span>${gamePlayer?.portrait || "🥋"}</span><div><strong>${esc(title)}</strong><small>${status}</small></div>${control}</article>`; }).join("")}</div><div class="lobby-rules"><span>총 좌석 <b>${expected}명</b></span><span>목표 명성 <b>${room?.state?.rules?.targetFame || 50}</b></span><span>선착 보상 <b>${room?.state?.rules?.milestoneMode ? "사용" : "미사용"}</b></span></div>${ui.onlineIsHost ? `<button class="primary big" data-action="start-online-game" ${ready && !ui.onlineBusy ? "" : "disabled"}>${ready ? "온라인 대회 시작" : `${expected - readySeats}좌석 채우는 중`}</button>` : `<p class="waiting-message">방장이 참가자와 AI 구성을 마치고 시작하기를 기다립니다.</p>`}<button class="secondary" data-action="leave-online-room">방 나가기</button>${ui.onlineError ? `<p class="online-error" role="alert">${esc(ui.onlineError)}</p>` : ""}</section></main>`;
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
  const availableCardIds = MARKET_CARD_IDS.filter((id) => state.market[id] > 0);
  return `<div class="market-summary"><span>보유 경험치 <b>${activePlayer?.human ? activePlayer.experience : human.experience}</b></span><small>${canBuy ? "기술 1장을 선택하세요" : "패배 보상 차례에 수련 가능"}</small></div><div class="market-grid">${availableCardIds.map((id) => {
    const definition = CARD_DEFINITIONS[id];
    const stock = state.market[id];
    const disabled = !canBuy || stock <= 0 || activePlayer.experience < definition.cost || activePlayer.boughtThisDuel;
    return `
      <button class="market-card ${definition.exhausts ? "exhaust" : ""} ${definition.ability === "combo" ? "combo" : ""}" ${disabled ? "disabled" : ""}
        data-action="buy" data-player-id="${activePlayer?.id || ""}" data-card-definition-id="${id}" title="${esc(definition.text)}" aria-label="${esc(definition.name)}, 위력 ${definition.power}, 비용 ${definition.cost}, 재고 ${stock}">
        ${effectMarker(definition)}
        <span class="market-power" aria-label="위력 ${definition.power}">${definition.power}</span>
        ${cardArtHtml(id, "market-art")}
        <strong>${esc(definition.name)}</strong>
        <span class="market-meta"><b class="cost-badge">🔵 ${definition.cost}</b><small>재고 ${stock}</small></span>
      </button>`;
  }).join("") || `<p class="market-empty">수련 가능한 기술이 모두 소진되었습니다.</p>`}</div>`;
}

function latestRewardDecision(state) {
  const decision = state.rewardHistory?.[0];
  if (!decision || decision.duelNumber < state.duelNumber - 1) return null;
  const player = state.players.find((item) => item.id === decision.playerId);
  if (!player) return null;
  return { ...decision, player };
}

function rewardDecisionHtml(state, { compact = false } = {}) {
  const decision = latestRewardDecision(state);
  if (!decision) return "";
  const detail = decision.choice === "fame"
    ? `<strong>명성 +${decision.amount}</strong><span>명성 획득 선택</span>`
    : `<strong>${esc(decision.cardName)}</strong><span>기술 체득(덱에서 제거) 선택</span>`;
  return `<section class="reward-decision ${compact ? "compact" : ""}" aria-label="최근 승자 선택"><span class="decision-avatar">${decision.player.portrait}</span><div><small>대련 ${decision.duelNumber} · ${esc(decision.player.name)}의 승자 선택</small>${detail}</div></section>`;
}

function loserActionText(action) {
  if (!action || action.type === "rest") return "경험치 보존";
  if (action.type === "buy") return `${action.cardName} 수련 · 경험치 -${action.cost}`;
  return `명성 훈련 · 경험치 -${action.cost} · 명성 +${action.fameGain}`;
}

function milestoneRewardText(record) {
  if (record.rewardType === "experience") return `경험치 +${record.experienceGained ?? record.amount}`;
  if (record.cardName) return `${record.cardName} 체득`;
  if (record.status === "fallback") return "체득 기회 양도 중";
  const removed = record.fallbackChoices?.filter((choice) => choice.choice === "mastery").length || 0;
  return `다른 참가자 체득 ${removed}명`;
}

function milestoneTrackHtml(state) {
  const rewards = MILESTONE_REWARDS.filter((reward) => reward.score < state.rules.targetFame);
  return `<section class="milestone-track"><div class="milestone-track-heading"><div><h3>6점 선착 보상표</h3><small>각 점수에 먼저 도달한 참가자 한 명만 획득</small></div><b>목표 ${state.rules.targetFame}</b></div><div class="milestone-track-grid">${rewards.map((reward) => {
    const playerId = state.milestones?.claimed?.[reward.score];
    const player = state.players.find((item) => item.id === playerId);
    const record = state.milestones?.history?.find((item) => item.score === reward.score);
    const current = record?.duelNumber === state.duelNumber;
    const rewardLabel = reward.type === "experience" ? `경험치 +${reward.amount}` : "기술 1개 체득";
    return `<div class="milestone-step ${player ? "claimed" : "open"} ${current ? "current" : ""}"><strong>${reward.score}</strong><span>${reward.type === "experience" ? "🔵" : "✨"} ${rewardLabel}</span><small>${player ? `${player.portrait} ${esc(player.name)}` : "선착 대기"}</small></div>`;
  }).join("")}</div></section>`;
}

function duelRecapHtml(state) {
  const winner = state.players.find((player) => player.id === state.duel.winnerId);
  const winnerPlay = state.duel.plays.find((play) => play.playerId === winner?.id);
  const reward = state.rewardHistory?.find((decision) => decision.duelNumber === state.duelNumber && decision.playerId === winner?.id);
  const winnerChoice = reward?.choice === "mastery" ? `${reward.cardName} 기술 체득(덱에서 제거)` : `명성 +${reward?.amount || winnerPlay?.totalPower || 0}`;
  const loserRows = state.duel.plays.filter((play) => play.playerId !== winner?.id).map((play) => {
    const player = state.players.find((item) => item.id === play.playerId);
    const experience = state.duel.experienceGains?.find((item) => item.playerId === play.playerId)?.amount || 0;
    const action = state.duel.loserActions?.find((item) => item.playerId === play.playerId);
    return `<li><span class="recap-player">${player.portrait} <b>${esc(player.name)}</b></span><span>경험치 +${experience}</span><strong>${esc(loserActionText(action))}</strong></li>`;
  }).join("");
  const milestoneResult = state.milestones?.history?.find((record) => record.duelNumber === state.duelNumber);
  return `<div class="modal"><div class="modal-box wide duel-recap"><span class="result-icon">📋</span><h2>대련 ${state.duelNumber} 정리</h2><p>모든 참가자의 행동이 끝났습니다.</p><ul class="recap-list"><li class="recap-winner"><span class="recap-player">${winner?.portrait} <b>${esc(winner?.name)}</b></span><span>최종 위력 ${winnerPlay?.totalPower || 0}</span><strong>${esc(winnerChoice)}</strong></li>${loserRows}</ul>${milestoneResult ? `<div class="milestone-result"><b>이번 선착 보상</b><span>명성 ${milestoneResult.score} · ${esc(milestoneRewardText(milestoneResult))}</span></div>` : ""}${state.rules.milestoneMode ? milestoneTrackHtml(state) : ""}<button class="primary big" data-action="continue-duel">다음 대련 시작</button><small>확인하기 전에는 다음 대련과 AI 행동이 시작되지 않습니다.</small></div></div>`;
}

function pileSection(title, cards, emptyText, note = "") {
  return `<section class="pile-section"><div class="pile-heading"><div><h3>${title}</h3>${note ? `<small>${note}</small>` : ""}</div><b>${cards.length}장</b></div><div class="pile-cards">${cards.map((card) => cardHtml(card, { compact: true, staticCard: true })).join("") || `<p class="pile-empty">${emptyText}</p>`}</div></section>`;
}

function ownedCardsContent(state) {
  const human = state.players.find((player) => player.human);
  return `<div class="owned-card-piles">${pileSection("덱에 남은 카드", human.deck, "덱이 비었습니다.", "순서와 관계없이 구성만 표시")}${pileSection("버린 카드 · 휴식 더미", human.rest, "버린 카드가 없습니다.", "승리하면 이곳의 일반 카드를 없앨 수 있음")}${human.played.length ? pileSection("이번 대련에 낸 카드", human.played, "", "승리하면 일반 카드를 없앨 수 있음") : ""}</div>`;
}

function settingsContent(state, ui) {
  return `<div class="game-settings-panel"><div class="setting-row"><span>목표 명성</span><strong>${state.rules.targetFame}</strong></div><div class="setting-row"><span>6점 선착 보상</span><strong>${state.rules.milestoneMode ? "사용 중" : "미사용"}</strong></div>${state.rules.milestoneMode ? milestoneTrackHtml(state) : ""}${audioToggles(ui)}<button class="secondary big" data-action="show-start">메인 화면</button><small>목표 명성과 선착 보상은 새 대회를 시작할 때 설정합니다.</small></div>`;
}

function overlayPanel(state, ui) {
  if (!ui.panel) return "";
  const content = ui.panel === "market"
    ? `<h2>🥋 기술 수련소</h2>${marketContent(state)}`
    : ui.panel === "cards"
      ? `<h2>🂠 내 카드</h2>${ownedCardsContent(state)}`
      : ui.panel === "settings"
        ? `<h2>⚙️ 게임 설정</h2>${settingsContent(state, ui)}`
        : `<h2>📜 도장 기록</h2><div class="log-list">${state.log.map((item) => `<p>${esc(item.message)}</p>`).join("")}</div>`;
  return `<div class="sheet-backdrop" data-action="close-panel"><aside class="bottom-sheet"><div class="sheet-handle"></div><button class="sheet-close" data-action="close-panel" aria-label="닫기">×</button>${content}</aside></div>`;
}

function milestoneCardsHtml(state, playerId, action) {
  const candidates = getMilestoneMasteryCandidates(state, playerId);
  return candidates.map((card) => { const definition = CARD_DEFINITIONS[card.definitionId]; return `<button class="mastery-option ${definition.ability === "combo" ? "combo" : ""}" data-action="${action}" data-card-id="${card.id}" data-player-id="${playerId}">${effectMarker(definition)}<span class="market-power">${card.power}</span>${cardArtHtml(definition.id, "market-art")}<strong>${esc(card.name)}</strong><small>${card.zone === ZONES.HAND ? "손패" : card.zone === ZONES.DECK ? "덱" : card.zone === ZONES.REST ? "버린 카드" : "이번 대련"} · 제거 후 ${card.remainingReusable}장</small></button>`; }).join("");
}

function modalHtml(state) {
  if (state.inputLocked) return `<div class="thinking-toast" role="status" aria-live="polite"><span class="thinking-icon">🥋</span><strong>상대 생각 중</strong><span class="thinking-dots" aria-hidden="true">•••</span></div>`;
  const human = state.players.find((player) => player.human);
  if (state.phase === PHASES.WAITING_FOR_MILESTONE_MASTERY && state.pending.milestoneActivePlayerId === human.id) {
    const reward = state.pending.milestoneCurrent;
    return `<div class="modal"><div class="modal-box wide milestone-modal"><span class="result-icon">🎖️</span><h2>명성 ${reward.score} 선착 보상</h2><p>기술 하나를 체득(덱에서 제거)하세요.</p><div class="mastery-list">${milestoneCardsHtml(state, human.id, "milestone-master")}</div></div></div>`;
  }
  if (state.phase === PHASES.WAITING_FOR_MILESTONE_FALLBACK && state.pending.milestoneActivePlayerId === human.id) {
    const reward = state.pending.milestoneCurrent;
    const claimant = state.players.find((player) => player.id === reward.playerId);
    const cards = milestoneCardsHtml(state, human.id, "milestone-fallback-card");
    return `<div class="modal"><div class="modal-box wide milestone-modal"><span class="result-icon">🎁</span><h2>체득 기회가 넘어왔습니다</h2><p>${claimant.portrait} ${esc(claimant.name)}이 명성 ${reward.score} 보상을 사용할 수 없어 다른 참가자에게 기회가 주어졌습니다.</p>${cards ? `<div class="mastery-list">${cards}</div>` : `<p>제거할 수 있는 일반 카드가 없습니다.</p>`}<button class="secondary big" data-action="milestone-fallback-skip" data-player-id="${human.id}">제거하지 않고 넘기기</button></div></div>`;
  }
  if (state.phase === PHASES.WAITING_FOR_WINNER_REWARD && state.duel.winnerId === human.id) {
    const play = state.duel.plays.find((item) => item.playerId === human.id);
    const candidates = getMasteryCandidates(state, human.id);
    return `<div class="modal"><div class="modal-box wide"><span class="result-icon">🏆</span><h2>승자 보상</h2><p>이번 승리의 보상을 선택하세요.</p>${candidates.length ? `<section class="reward-candidates"><div class="pile-heading"><div><h3>없앨 수 있는 카드</h3><small>버린 카드와 이번 대련의 일반 카드</small></div><b>${candidates.length}장</b></div><div class="pile-cards">${candidates.map((candidate) => cardHtml(candidate.definitionId, { compact: true, staticCard: true })).join("")}</div></section>` : ""}<div class="reward-grid"><button data-action="winner-fame"><b>⭐ +${play.totalPower}</b><span>명성 획득</span></button><button data-action="winner-mastery" ${candidates.length ? "" : "disabled"}><b>✨ 기술 체득</b><span>덱에서 카드 제거</span></button></div></div></div>`;
  }
  if (state.phase === PHASES.WAITING_FOR_MASTERY_CARD && state.duel.winnerId === human.id) {
    const candidates = getMasteryCandidates(state, human.id);
    return `<div class="modal"><div class="modal-box wide"><h2>기술 체득(덱에서 제거)</h2><p>선택한 카드는 이번 게임에서 영구 제거됩니다.</p><div class="mastery-list">${candidates.map((card) => { const definition = CARD_DEFINITIONS[card.definitionId]; return `<button class="mastery-option ${definition.exhausts ? "exhaust" : ""} ${definition.ability === "combo" ? "combo" : ""}" data-action="master-card" data-card-id="${card.id}">${effectMarker(definition)}<span class="market-power">${card.power}</span>${cardArtHtml(definition.id, "market-art")}<strong>${esc(card.name)}</strong><small>${card.zone === ZONES.REST ? "버린 카드" : "이번 대련"} · 제거 후 ${card.remainingReusable}장</small></button>`; }).join("")}</div></div></div>`;
  }
  if (state.phase === PHASES.WAITING_FOR_LOSER_ACTION && state.pending.loserActionPlayerId === human.id) {
    return `<div class="modal"><div class="modal-box"><span class="result-icon">💪</span><h2>패배 보상</h2><p>경험치를 사용할 방법을 선택하세요.</p><button class="primary" data-action="toggle-market">기술 수련소 열기</button><div class="modal-actions"><button data-action="train-fame" ${human.experience >= state.rules.trainingExperienceCost ? "" : "disabled"}>경험치 5 → 명성 1</button><button data-action="rest">경험치 보존</button></div></div></div>`;
  }
  if (state.phase === PHASES.WAITING_FOR_DUEL_RECAP) return duelRecapHtml(state);
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
  if (view.screen === "lobby") return lobbyScreen(view);
  const vanguard = state.players.find((player) => player.id === state.vanguardPlayerId);
  return `<main class="game-shell"><header class="game-header"><div><span class="eyebrow">수련 ${state.trainingCycle}</span><h1>우당탕 동물도장</h1></div><div class="round-info">${view.onlineCode ? `<span class="online-room-chip">방 <b>${esc(view.onlineCode)}</b></span>` : ""}<span class="duel-chip">대련 <b>${state.duelNumber}</b></span><span>목표 <b>${state.rules.targetFame}</b></span><span title="선봉">선봉 ${vanguard?.portrait}</span><button data-action="toggle-rules" aria-label="규칙 보기" title="규칙 보기">?</button></div></header>${rewardDecisionHtml(state)}<section class="game-main">${tableHtml(state)}${handHtml(state)}</section>${overlayPanel(state, view)}${view.panel ? "" : modalHtml(state)}${rulesDialog()}</main>`;
}
