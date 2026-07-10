import test from "node:test";
import assert from "node:assert/strict";
import { CARD_DEFINITIONS } from "../js/data/cards.js";
import { PHASES } from "../js/data/constants.js";
import { chooseWinnerReward, createCardInstance, createGame, getMasteryCandidates, loserAction, masterCard, playCard } from "../js/engine.js";

function setHands(state, hands) {
  const next = structuredClone(state);
  for (const [playerId, cardIds] of Object.entries(hands)) {
    const player = next.players.find((item) => item.id === playerId);
    player.hand = cardIds.map((id) => {
      const card = createCardInstance(id, player.id, "test");
      card.zone = "hand";
      return card;
    });
    player.deck = [];
    player.rest = [];
    player.played = [];
  }
  return next;
}

function setOrder(state, firstId) {
  return { ...state, vanguardPlayerId: firstId, actingPlayerId: firstId, duel: { plays: [], winnerId: null, highestPower: 0, masteredCardId: null } };
}

function playFirstCard(state, playerId) {
  const player = state.players.find((item) => item.id === playerId);
  return playCard(state, playerId, player.hand[0]?.id ?? null);
}

test("highest power wins and takes the vanguard", () => {
  let state = createGame({ playerCount: 3, seed: 1 });
  state = setHands(state, { "player-1": ["start_2"], "player-2": ["start_5"], "player-3": ["start_3"] });
  state = setOrder(state, "player-1");
  state = playFirstCard(state, "player-1");
  state = playFirstCard(state, "player-2");
  state = playFirstCard(state, "player-3");
  assert.equal(state.phase, PHASES.WAITING_FOR_WINNER_REWARD);
  assert.equal(state.duel.winnerId, "player-2");
  assert.equal(state.vanguardPlayerId, "player-2");
});

test("later player wins ties", () => {
  let state = createGame({ playerCount: 3, seed: 2 });
  state = setHands(state, { "player-1": ["start_4"], "player-2": ["start_4"], "player-3": ["start_3"] });
  state = setOrder(state, "player-1");
  state = playFirstCard(state, "player-1");
  state = playFirstCard(state, "player-2");
  state = playFirstCard(state, "player-3");
  assert.equal(state.duel.winnerId, "player-2");
});

test("winner chooses either fame or mastery, including just played normal card", () => {
  let state = createGame({ playerCount: 3, seed: 3 });
  state = setHands(state, { "player-1": ["start_5"], "player-2": ["start_2"], "player-3": ["start_3"] });
  state.players[0].rest.push(createCardInstance("start_1", "player-1", "test"));
  state.players[0].deck.push(createCardInstance("start_2", "player-1", "test"), createCardInstance("start_3", "player-1", "test"), createCardInstance("start_4", "player-1", "test"));
  state = setOrder(state, "player-1");
  state = playFirstCard(state, "player-1");
  state = playFirstCard(state, "player-2");
  state = playFirstCard(state, "player-3");
  const candidates = getMasteryCandidates(state, "player-1");
  assert.ok(candidates.some((card) => card.zone === "play" && card.power === 5));
  state = chooseWinnerReward(state, "mastery");
  state = masterCard(state, candidates.find((card) => card.zone === "play").id);
  assert.equal(state.players[0].fame, 0);
});

test("exhaust cards cannot be mastered and reusable floor is enforced", () => {
  let state = createGame({ playerCount: 3, seed: 4 });
  state = setHands(state, { "player-1": ["headbutt"], "player-2": ["start_2"], "player-3": ["start_3"] });
  state.players[0].deck = [createCardInstance("start_1", "player-1", "test"), createCardInstance("start_2", "player-1", "test")];
  state.players[0].rest = [createCardInstance("start_3", "player-1", "test")];
  state = setOrder(state, "player-1");
  state = playFirstCard(state, "player-1");
  state = playFirstCard(state, "player-2");
  state = playFirstCard(state, "player-3");
  assert.equal(getMasteryCandidates(state, "player-1").length, 0);
});

test("losers gain capped experience, buy once, stock decreases, and bought card goes to rest", () => {
  let state = createGame({ playerCount: 3, seed: 5 });
  state = setHands(state, { "player-1": ["start_5"], "player-2": ["start_3"], "player-3": ["start_2"] });
  state.players[1].experience = 29;
  state = setOrder(state, "player-1");
  state = playFirstCard(state, "player-1");
  state = playFirstCard(state, "player-2");
  state = playFirstCard(state, "player-3");
  state = chooseWinnerReward(state, "fame");
  const loser = state.players.find((player) => player.id === state.pending.loserActionPlayerId);
  assert.equal(loser.experience, 30);
  const before = state.market.bunny_kick;
  state = loserAction(state, loser.id, { type: "buy", cardDefinitionId: "bunny_kick" });
  const updated = state.players.find((player) => player.id === loser.id);
  assert.equal(state.market.bunny_kick, before - 1);
  assert.ok(updated.rest.some((card) => card.definitionId === "bunny_kick"));
});

test("experience can train fame and reaching 50 ends immediately", () => {
  let state = createGame({ playerCount: 3, seed: 6 });
  state = setHands(state, { "player-1": ["start_5"], "player-2": ["start_2"], "player-3": ["start_3"] });
  state.players[1].fame = 49;
  state.players[1].experience = 5;
  state = setOrder(state, "player-1");
  state = playFirstCard(state, "player-1");
  state = playFirstCard(state, "player-2");
  state = playFirstCard(state, "player-3");
  state = chooseWinnerReward(state, "fame");
  state = loserAction(state, state.pending.loserActionPlayerId, { type: "train-fame" });
  assert.equal(state.phase, PHASES.GAME_OVER);
  assert.equal(state.winnerId, "player-2");
});

test("combo chains add power and exhaust combo-revealed 9 or 20", () => {
  let state = createGame({ playerCount: 3, seed: 7 });
  state = setHands(state, { "player-1": ["combo_stance"], "player-2": ["start_2"], "player-3": ["start_3"] });
  state.players[0].deck = [createCardInstance("headbutt", "player-1", "test"), createCardInstance("combo_stance", "player-1", "test")];
  state = setOrder(state, "player-1");
  state = playFirstCard(state, "player-1");
  assert.equal(state.duel.plays[0].totalPower, 11);
  state = playFirstCard(state, "player-2");
  state = playFirstCard(state, "player-3");
  state = chooseWinnerReward(state, "fame");
  state = loserAction(state, state.pending.loserActionPlayerId, { type: "rest" });
  state = loserAction(state, state.pending.loserActionPlayerId, { type: "rest" });
  assert.ok(state.players[0].consumed.some((card) => CARD_DEFINITIONS[card.definitionId].power === 9));
});

test("2 player setup inserts panda master and panda can win", () => {
  let state = createGame({ playerCount: 2, seed: 8 });
  assert.ok(state.players.some((player) => player.neutral && player.name === "판다 사범"));
  const panda = state.players.find((player) => player.neutral);
  panda.fame = 49;
  state = setOrder(state, panda.id);
  panda.deck = [createCardInstance("start_5", panda.id, "test")];
  state.players.find((player) => player.id === "player-2").hand = [createCardInstance("start_1", "player-2", "test")];
  state.players.find((player) => player.id === "player-1").hand = [createCardInstance("start_1", "player-1", "test")];
  state = playCard(state, panda.id);
  state = playFirstCard(state, "player-2");
  state = playFirstCard(state, "player-1");
  assert.equal(state.phase, PHASES.GAME_OVER);
  assert.equal(state.winnerId, panda.id);
});
