import { CARD_DEFINITIONS, MARKET_CARD_IDS, STARTER_CARD_IDS, cardDef } from "./data/cards.js";
import { CHARACTERS, PANDA_MASTER } from "./data/characters.js";
import { PHASES, RULES, ZONES } from "./data/constants.js";

let nextCardId = 1;

export function createRng(seed = Date.now()) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

export function shuffle(items, rng = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createCardInstance(definitionId, ownerId, source = "setup") {
  return { id: `card-${nextCardId++}`, definitionId, ownerId, source, zone: ZONES.DECK };
}

export function resetCardIds(value = 1) {
  nextCardId = value;
}

export function getNextCardId() {
  return nextCardId;
}

export function setNextCardId(value) {
  nextCardId = Math.max(1, Number(value) || 1);
}

function clone(state) {
  return structuredClone(state);
}

function addLog(state, message) {
  return {
    ...state,
    log: [{ id: `log-${state.log.length + 1}`, message, at: Date.now() }, ...state.log].slice(0, 80)
  };
}

function setupDeck(player, cardIds, rng, source) {
  player.deck = shuffle(cardIds.map((id) => createCardInstance(id, player.id, source)), rng);
  for (const card of player.deck) card.zone = ZONES.DECK;
}

function drawOne(player, rng) {
  if (player.deck.length === 0 && player.rest.length > 0) {
    player.deck = shuffle(player.rest.map((card) => ({ ...card, zone: ZONES.DECK })), rng);
    player.rest = [];
  }
  const card = player.deck.pop();
  if (!card) return null;
  card.zone = ZONES.HAND;
  player.hand.push(card);
  return card;
}

export function fillHand(player, rng, handSize = RULES.startingHandSize) {
  while (!player.neutral && player.hand.length < handSize) {
    if (!drawOne(player, rng)) break;
  }
}

function makePlayer(character, index, { human = false, neutral = false } = {}) {
  return {
    id: neutral ? "panda-master" : `player-${index + 1}`,
    name: character.name,
    animal: character.animal,
    portrait: character.portrait,
    color: character.color,
    line: character.line,
    winLine: character.winLine,
    human,
    ai: !human,
    neutral,
    fame: 0,
    experience: 0,
    deck: [],
    hand: [],
    rest: [],
    mastered: [],
    consumed: [],
    played: [],
    finalPower: 0,
    seat: index,
    boughtThisDuel: false
  };
}

export function createGame({ playerCount = 2, seed = Date.now() } = {}) {
  resetCardIds(1);
  const rng = createRng(seed);
  const normalCount = Math.max(2, Math.min(4, playerCount));
  const normalPlayers = Array.from({ length: normalCount }, (_, index) =>
    makePlayer(CHARACTERS[index], index, { human: index === 0 })
  );
  const players = normalCount === 2
    ? [normalPlayers[0], makePlayer(PANDA_MASTER, 1, { neutral: true }), normalPlayers[1]]
    : normalPlayers;

  players.forEach((player, index) => {
    player.seat = index;
    if (player.neutral) {
      setupDeck(player, [...STARTER_CARD_IDS, "combo_stance", "bunny_kick", "tail_spin", "maple_combo", "headbutt"], rng, "panda");
    } else {
      setupDeck(player, STARTER_CARD_IDS, rng, "starter");
      fillHand(player, rng);
    }
  });

  const vanguardIndex = Math.floor(rng() * players.length);
  const state = {
    version: 1,
    phase: PHASES.WAITING_FOR_CARD,
    rules: { ...RULES },
    settings: { animationSpeed: 1, muted: false, volume: 0.5, playerCount: normalCount },
    seed,
    rngSeed: Math.floor(rng() * 0xffffffff),
    trainingCycle: 1,
    duelNumber: 1,
    actingPlayerId: players[vanguardIndex].id,
    vanguardPlayerId: players[vanguardIndex].id,
    seatOrder: players.map((player) => player.id),
    players,
    market: Object.fromEntries(MARKET_CARD_IDS.map((id) => [id, CARD_DEFINITIONS[id].marketCount])),
    duel: { plays: [], winnerId: null, highestPower: 0, masteredCardId: null },
    pending: { winnerReward: null, masteryCards: [], loserQueue: [], loserActionPlayerId: null },
    winnerId: null,
    inputLocked: false,
    log: [],
    nextCardId: getNextCardId()
  };
  return addLog(state, `${players[vanguardIndex].name}이 선봉패를 잡았습니다.`);
}

export function reviveGame(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.players)) return null;
  const state = { ...raw, inputLocked: false };
  state.phase = state.winnerId ? PHASES.GAME_OVER : state.phase;
  if (state.phase === PHASES.RESOLVING_DUEL || state.phase === PHASES.REFILLING_HANDS) {
    state.phase = PHASES.WAITING_FOR_CARD;
  }
  setNextCardId(state.nextCardId || 1);
  return state;
}

function findPlayer(state, playerId) {
  return state.players.find((player) => player.id === playerId);
}

function nextActingPlayer(state) {
  const currentIndex = state.seatOrder.indexOf(state.actingPlayerId);
  for (let offset = 1; offset <= state.seatOrder.length; offset += 1) {
    const id = state.seatOrder[(currentIndex + offset) % state.seatOrder.length];
    if (!state.duel.plays.some((play) => play.playerId === id)) return id;
  }
  return null;
}

function revealFromDeck(player, rng) {
  if (player.deck.length === 0 && player.rest.length > 0) {
    player.deck = shuffle(player.rest.map((card) => ({ ...card, zone: ZONES.DECK })), rng);
    player.rest = [];
  }
  const card = player.deck.pop();
  if (!card) return null;
  card.zone = ZONES.PLAY;
  return card;
}

function resolvePlayedCards(state, player, initialCard) {
  const rng = createRng(state.rngSeed);
  const cards = [{ ...initialCard, zone: ZONES.PLAY }];
  let totalPower = cardDef(initialCard).power;
  let cursor = initialCard;
  let guard = 0;
  while (cardDef(cursor).ability === "combo" && guard < 100) {
    guard += 1;
    const next = revealFromDeck(player, rng);
    if (!next) {
      state = addLog(state, `${player.name}의 연계 자세가 이어질 기술을 찾지 못했습니다.`);
      break;
    }
    cards.push(next);
    totalPower += cardDef(next).power;
    state = addLog(state, `${player.name}의 연계 자세로 ${cardDef(next).name}이 이어졌습니다.`);
    cursor = next;
  }
  state.rngSeed = Math.floor(rng() * 0xffffffff);
  return { state, cards, totalPower };
}

export function playCard(state, playerId, cardId = null) {
  if (state.phase !== PHASES.WAITING_FOR_CARD || state.actingPlayerId !== playerId || state.inputLocked || state.winnerId) return state;
  let next = clone(state);
  let player = findPlayer(next, playerId);
  let card;
  if (player.neutral) {
    card = revealFromDeck(player, createRng(next.rngSeed));
  } else {
    const index = player.hand.findIndex((candidate) => candidate.id === cardId);
    if (index < 0) return state;
    card = player.hand.splice(index, 1)[0];
    card.zone = ZONES.PLAY;
  }
  if (!card) return state;

  const resolved = resolvePlayedCards(next, player, card);
  next = resolved.state;
  player = findPlayer(next, playerId);
  player.played.push(...resolved.cards);
  player.finalPower = resolved.totalPower;
  next.duel.plays.push({
    playerId,
    cardIds: resolved.cards.map((playedCard) => playedCard.id),
    cards: resolved.cards,
    totalPower: resolved.totalPower,
    order: next.duel.plays.length
  });
  next.duel.highestPower = Math.max(next.duel.highestPower, resolved.totalPower);
  next = addLog(next, `${player.name}이 ${cardDef(card).name} ${cardDef(card).power}을 사용했습니다. 최종 위력은 ${resolved.totalPower}입니다.`);

  const following = nextActingPlayer(next);
  if (following) {
    next.actingPlayerId = following;
    return { ...next, nextCardId: getNextCardId() };
  }
  return resolveDuel(next);
}

export function resolveDuel(state) {
  let next = clone(state);
  next.phase = PHASES.RESOLVING_DUEL;
  const winnerPlay = [...next.duel.plays].sort((a, b) => a.totalPower === b.totalPower ? b.order - a.order : b.totalPower - a.totalPower)[0];
  const winner = findPlayer(next, winnerPlay.playerId);
  next.duel.winnerId = winner.id;
  next.vanguardPlayerId = winner.id;
  next.actingPlayerId = winner.id;
  next = addLog(next, `${winner.name}이 대련에서 승리했습니다.`);
  if (winner.neutral) return chooseWinnerReward(next, "fame");

  const masteryCards = getMasteryCandidates(next, winner.id);
  next.pending.winnerReward = { playerId: winner.id, fameGain: winnerPlay.totalPower, canMaster: masteryCards.length > 0 };
  next.pending.masteryCards = masteryCards;
  next.phase = PHASES.WAITING_FOR_WINNER_REWARD;
  return next;
}

export function getMasteryCandidates(state, playerId) {
  const player = findPlayer(state, playerId);
  if (!player || player.neutral) return [];
  const reusable = reusableCardCount(player);
  if (reusable - 1 < state.rules.minimumReusableCardsAfterMastery) return [];
  return [...player.rest, ...(state.rules.allowPlayedCardMastery ? player.played : [])]
    .filter((card) => !cardDef(card).exhausts)
    .map((card) => ({
      id: card.id,
      definitionId: card.definitionId,
      name: cardDef(card).name,
      power: cardDef(card).power,
      zone: player.rest.some((restCard) => restCard.id === card.id) ? ZONES.REST : ZONES.PLAY,
      remainingReusable: reusable - 1
    }));
}

function reusableCardCount(player) {
  return player.deck.length + player.hand.length + player.rest.length + player.played.filter((card) => !cardDef(card).exhausts).length;
}

function checkImmediateWin(state, player) {
  if (player.fame >= state.rules.targetFame) {
    return addLog({ ...state, winnerId: player.id, phase: PHASES.GAME_OVER }, `${player.name}이 명성 ${player.fame}에 도달했습니다.`);
  }
  return state;
}

export function chooseWinnerReward(state, rewardType) {
  if (state.phase !== PHASES.WAITING_FOR_WINNER_REWARD && !findPlayer(state, state.duel.winnerId)?.neutral) return state;
  let next = clone(state);
  const winner = findPlayer(next, next.duel.winnerId);
  const winnerPlay = next.duel.plays.find((play) => play.playerId === winner.id);
  if (rewardType === "mastery" && getMasteryCandidates(next, winner.id).length > 0) {
    next.phase = PHASES.WAITING_FOR_MASTERY_CARD;
    return next;
  }
  winner.fame += winnerPlay.totalPower;
  next = addLog(next, `${winner.name}이 명성 ${winnerPlay.totalPower}을 얻었습니다.`);
  next = checkImmediateWin(next, winner);
  if (next.phase === PHASES.GAME_OVER) return next;
  return beginLoserActions(next);
}

export function masterCard(state, cardId) {
  if (state.phase !== PHASES.WAITING_FOR_MASTERY_CARD) return state;
  let next = clone(state);
  const winner = findPlayer(next, next.duel.winnerId);
  const candidates = getMasteryCandidates(next, winner.id);
  const chosen = candidates.find((card) => card.id === cardId);
  if (!chosen) return state;
  next.duel.masteredCardId = cardId;
  next = addLog(next, `${winner.name}이 ${chosen.name}을 기술 체득(덱에서 제거)했습니다.`);
  return beginLoserActions(next);
}

function beginLoserActions(state) {
  let next = clone(state);
  const winnerId = next.duel.winnerId;
  for (const play of next.duel.plays) {
    const player = findPlayer(next, play.playerId);
    if (player.id !== winnerId && !player.neutral) {
      player.experience = Math.min(next.rules.maxExperience, player.experience + play.totalPower);
      next = addLog(next, `${player.name}이 실전 경험 ${play.totalPower}을 얻었습니다.`);
    }
  }
  const leftOfVanguard = (next.seatOrder.indexOf(next.vanguardPlayerId) + 1) % next.seatOrder.length;
  const ordered = [...next.seatOrder.slice(leftOfVanguard), ...next.seatOrder.slice(0, leftOfVanguard)];
  const loserQueue = ordered.filter((id) => id !== winnerId && !findPlayer(next, id).neutral);
  next.pending.loserQueue = loserQueue;
  next.pending.loserActionPlayerId = loserQueue[0] || null;
  next.phase = loserQueue.length ? PHASES.WAITING_FOR_LOSER_ACTION : PHASES.REFILLING_HANDS;
  return loserQueue.length ? next : finishDuel(next);
}

export function loserAction(state, playerId, action) {
  if (state.phase !== PHASES.WAITING_FOR_LOSER_ACTION || state.pending.loserActionPlayerId !== playerId) return state;
  let next = clone(state);
  const player = findPlayer(next, playerId);
  if (action.type === "buy") {
    const def = CARD_DEFINITIONS[action.cardDefinitionId];
    if (!def || player.boughtThisDuel || next.market[def.id] <= 0 || player.experience < def.cost) return state;
    player.experience -= def.cost;
    player.boughtThisDuel = true;
    next.market[def.id] -= 1;
    const card = createCardInstance(def.id, player.id, "market");
    card.zone = ZONES.REST;
    player.rest.push(card);
    next = addLog(next, `${player.name}이 ${def.name}을 수련했습니다.`);
  } else if (action.type === "train-fame") {
    if (player.experience < next.rules.trainingExperienceCost) return state;
    player.experience -= next.rules.trainingExperienceCost;
    player.fame += next.rules.trainingFameGain;
    next = addLog(next, `${player.name}이 명성 훈련으로 명성 ${next.rules.trainingFameGain}을 얻었습니다.`);
    next = checkImmediateWin(next, player);
    if (next.phase === PHASES.GAME_OVER) return next;
  } else {
    next = addLog(next, `${player.name}이 경험을 아껴 두었습니다.`);
  }

  next.pending.loserQueue = next.pending.loserQueue.filter((id) => id !== playerId);
  next.pending.loserActionPlayerId = next.pending.loserQueue[0] || null;
  next.phase = next.pending.loserActionPlayerId ? PHASES.WAITING_FOR_LOSER_ACTION : PHASES.REFILLING_HANDS;
  return next.phase === PHASES.REFILLING_HANDS ? finishDuel(next) : { ...next, nextCardId: getNextCardId() };
}

function movePlayedCards(player, masteredCardId) {
  const moved = [];
  for (const card of player.played) {
    if (card.id === masteredCardId) {
      player.mastered.push({ ...card, zone: ZONES.MASTERED });
    } else if (cardDef(card).exhausts) {
      player.consumed.push({ ...card, zone: ZONES.CONSUMED });
    } else {
      player.rest.push({ ...card, zone: ZONES.REST });
    }
    moved.push(card.id);
  }
  if (masteredCardId && !moved.includes(masteredCardId)) {
    const index = player.rest.findIndex((card) => card.id === masteredCardId);
    if (index >= 0) {
      const [card] = player.rest.splice(index, 1);
      player.mastered.push({ ...card, zone: ZONES.MASTERED });
    }
  }
  player.played = [];
  player.finalPower = 0;
  player.boughtThisDuel = false;
}

export function finishDuel(state) {
  let next = clone(state);
  for (const player of next.players) movePlayedCards(player, next.duel.masteredCardId);
  const rng = createRng(next.rngSeed);
  const normalPlayers = next.players.filter((player) => !player.neutral);
  const needsRefill = normalPlayers.some((player) => player.hand.length === 0);
  if (needsRefill) {
    for (const player of normalPlayers) fillHand(player, rng);
    next.trainingCycle += 1;
    next = addLog(next, `${next.trainingCycle}번째 수련 주기를 시작합니다.`);
  }
  next.rngSeed = Math.floor(rng() * 0xffffffff);
  next.duelNumber += 1;
  next.duel = { plays: [], winnerId: null, highestPower: 0, masteredCardId: null };
  next.pending = { winnerReward: null, masteryCards: [], loserQueue: [], loserActionPlayerId: null };
  next.actingPlayerId = next.vanguardPlayerId;
  next.phase = PHASES.WAITING_FOR_CARD;
  return { ...next, nextCardId: getNextCardId() };
}

export function setInputLocked(state, value) {
  return { ...state, inputLocked: Boolean(value) };
}
