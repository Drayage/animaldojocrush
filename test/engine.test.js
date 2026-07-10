import test from "node:test";
import assert from "node:assert/strict";
import { CARD_DEFINITIONS } from "../js/data/cards.js";
import { PHASES } from "../js/data/constants.js";
import { getAiIntent } from "../js/ai.js";
import { chooseWinnerReward, confirmDuelRecap, createCardInstance, createGame, getMasteryCandidates, getMilestoneMasteryCandidates, loserAction, masterCard, playCard, resolveMilestoneFallback, resolveMilestoneMastery, reviveGame } from "../js/engine.js";
import { applyGameAction, GAME_ACTIONS } from "../js/game-actions.js";
import { render } from "../js/ui.js";

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
  assert.match(render(state, { screen: "game", panel: null }), /없앨 수 있는 카드/);
  state = chooseWinnerReward(state, "mastery");
  state = masterCard(state, candidates.find((card) => card.zone === "play").id);
  assert.equal(state.players[0].fame, 0);
  assert.equal(state.rewardHistory[0].choice, "mastery");
  assert.equal(state.rewardHistory[0].playerId, "player-1");
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
  assert.equal(state.rewardHistory[0].choice, "fame");
  assert.equal(state.rewardHistory[0].amount, 5);
  assert.match(render(state, { screen: "game", panel: null }), /명성 획득 선택/);
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
  assert.equal(state.phase, PHASES.WAITING_FOR_DUEL_RECAP);
  assert.equal(state.duelNumber, 1);
  assert.match(render(state, { screen: "game", panel: null }), /대련 1 정리/);
  assert.match(render(state, { screen: "game", panel: null }), /경험치 보존/);
  state = confirmDuelRecap(state, "player-1");
  assert.equal(state.duelNumber, 2);
  assert.ok(state.players[0].consumed.some((card) => CARD_DEFINITIONS[card.definitionId].power === 9));
});

test("2 player setup uses one human and one regular AI without panda master", () => {
  const state = createGame({ playerCount: 2, seed: 8 });
  assert.equal(state.players.length, 2);
  assert.equal(state.players.filter((player) => player.human).length, 1);
  assert.equal(state.players.filter((player) => player.ai).length, 1);
  assert.equal(state.players.some((player) => player.neutral), false);
});

test("human loser reward UI exposes card training and mastery wording includes deck removal", () => {
  let state = createGame({ playerCount: 3, seed: 9 });
  state = setHands(state, { "player-1": ["start_2"], "player-2": ["start_5"], "player-3": ["start_3"] });
  state.players[0].experience = 4;
  state = setOrder(state, "player-1");
  state = playFirstCard(state, "player-1");
  state = playFirstCard(state, "player-2");
  state = playFirstCard(state, "player-3");
  state = chooseWinnerReward(state, "fame");
  const html = render(state);
  assert.match(html, /패배 보상/);
  assert.match(html, /data-action="buy"/);
  assert.match(html, /기술 체득\(덱에서 제거\)/);
});

test("my card panel shows deck and discarded cards while a human turn highlights the hand", () => {
  const state = createGame({ playerCount: 2, seed: 10 });
  const human = state.players.find((player) => player.human);
  human.rest.push(createCardInstance("start_1", human.id, "test"));
  state.phase = PHASES.WAITING_FOR_CARD;
  state.actingPlayerId = human.id;
  state.inputLocked = false;

  const html = render(state, { screen: "game", panel: "cards" });
  assert.match(html, /덱에 남은 카드/);
  assert.match(html, /버린 카드 · 휴식 더미/);
  assert.match(html, /hand-panel ready/);
  assert.match(html, /내 차례 · 기술 선택/);
});

test("sold out techniques are omitted from the training market", () => {
  const state = createGame({ playerCount: 2, seed: 11 });
  state.market.combo_stance = 0;
  const html = render(state, { screen: "game", panel: "market" });
  assert.doesNotMatch(html, /data-card-definition-id="combo_stance"/);
  assert.match(html, /data-card-definition-id="bunny_kick"/);
});

test("duel recap blocks AI and waits for every human acknowledgement", () => {
  let state = createGame({ playerCount: 2, seed: 12 });
  state.phase = PHASES.WAITING_FOR_DUEL_RECAP;
  state.players[1].human = true;
  state.players[1].ai = false;
  const duelNumber = state.duelNumber;

  assert.equal(getAiIntent(state), null);
  state = confirmDuelRecap(state, state.players[0].id);
  assert.equal(state.phase, PHASES.WAITING_FOR_DUEL_RECAP);
  assert.equal(state.duelNumber, duelNumber);
  state = confirmDuelRecap(state, state.players[1].id);
  assert.equal(state.phase, PHASES.WAITING_FOR_CARD);
  assert.equal(state.duelNumber, duelNumber + 1);
});

test("AI thinking state uses a compact toast without a screen-blocking modal", () => {
  const state = createGame({ playerCount: 2, seed: 13 });
  state.inputLocked = true;
  const html = render(state, { screen: "game", panel: null });
  assert.match(html, /class="thinking-toast"/);
  assert.doesNotMatch(html, /상대가 생각 중입니다/);
  assert.doesNotMatch(html, /class="modal"><div class="modal-box small"/);
});

test("the first player to fame 6 receives the milestone experience once", () => {
  let state = createGame({ playerCount: 3, seed: 14 });
  state = setHands(state, { "player-1": ["start_5"], "player-2": ["start_2"], "player-3": ["start_3"] });
  state.players[0].fame = 1;
  state = setOrder(state, "player-1");
  state = playFirstCard(state, "player-1");
  state = playFirstCard(state, "player-2");
  state = playFirstCard(state, "player-3");
  state = chooseWinnerReward(state, "fame");

  assert.equal(state.players[0].experience, 2);
  assert.equal(state.milestones.claimed[6], "player-1");
  assert.equal(state.milestones.history[0].status, "resolved");
  assert.equal(state.phase, PHASES.WAITING_FOR_LOSER_ACTION);

  const replay = structuredClone(state);
  replay.phase = PHASES.WAITING_FOR_WINNER_REWARD;
  replay.duel.winnerId = "player-2";
  replay.duel.plays = [{ playerId: "player-2", totalPower: 5, cards: [] }];
  replay.players[1].fame = 1;
  const afterClaimed = chooseWinnerReward(replay, "fame");
  assert.equal(afterClaimed.players[1].experience, replay.players[1].experience);
  assert.equal(afterClaimed.milestones.history.length, 1);
});

test("fame 12 pauses for mastery and resumes loser actions after removal", () => {
  let state = createGame({ playerCount: 3, seed: 15 });
  state = setHands(state, { "player-1": ["start_5"], "player-2": ["start_2"], "player-3": ["start_3"] });
  state.players[0].fame = 7;
  state.players[0].deck = ["start_1", "start_2", "start_3"].map((id) => createCardInstance(id, "player-1", "test"));
  state = setOrder(state, "player-1");
  state = playFirstCard(state, "player-1");
  state = playFirstCard(state, "player-2");
  state = playFirstCard(state, "player-3");
  state = chooseWinnerReward(state, "fame");

  assert.equal(state.phase, PHASES.WAITING_FOR_MILESTONE_MASTERY);
  const candidate = getMilestoneMasteryCandidates(state, "player-1")[0];
  assert.ok(candidate);
  state = resolveMilestoneMastery(state, "player-1", candidate.id);
  assert.equal(state.players[0].mastered.some((card) => card.id === candidate.id), true);
  assert.equal(state.phase, PHASES.WAITING_FOR_LOSER_ACTION);
});

test("an unusable mastery milestone gives every other player an optional removal", () => {
  let state = createGame({ playerCount: 3, seed: 16 });
  state = setHands(state, { "player-1": ["start_5"], "player-2": ["start_2"], "player-3": ["start_3"] });
  state.players[0].fame = 7;
  state.players[0].deck = ["start_1", "start_2"].map((id) => createCardInstance(id, "player-1", "test"));
  for (const player of state.players.slice(1)) {
    player.deck = ["start_1", "start_2", "start_4"].map((id) => createCardInstance(id, player.id, "test"));
  }
  state = setOrder(state, "player-1");
  state = playFirstCard(state, "player-1");
  state = playFirstCard(state, "player-2");
  state = playFirstCard(state, "player-3");
  state = chooseWinnerReward(state, "fame");

  assert.equal(state.phase, PHASES.WAITING_FOR_MILESTONE_FALLBACK);
  assert.equal(state.pending.milestoneActivePlayerId, "player-2");
  state = resolveMilestoneFallback(state, "player-2", null);
  assert.equal(state.pending.milestoneActivePlayerId, "player-3");
  const candidate = getMilestoneMasteryCandidates(state, "player-3")[0];
  state = resolveMilestoneFallback(state, "player-3", candidate.id);
  assert.equal(state.players[2].mastered.some((card) => card.id === candidate.id), true);
  assert.equal(state.phase, PHASES.WAITING_FOR_LOSER_ACTION);
  assert.deepEqual(state.milestones.history[0].fallbackChoices.map((item) => item.choice), ["skip", "mastery"]);
});

test("milestone mode and target fame are configurable and survive restore", () => {
  let state = createGame({ playerCount: 2, seed: 17, targetFame: 42, milestoneMode: false });
  assert.equal(state.rules.targetFame, 42);
  assert.equal(state.rules.milestoneMode, false);
  state.phase = PHASES.WAITING_FOR_MILESTONE_FALLBACK;
  state.pending.milestoneActivePlayerId = "player-1";
  const restored = reviveGame(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.phase, PHASES.WAITING_FOR_MILESTONE_FALLBACK);
  assert.equal(restored.pending.milestoneActivePlayerId, "player-1");
});

test("serializable game actions use the same reducer intended for online play", () => {
  let state = createGame({ playerCount: 2, seed: 18 });
  const player = state.players.find((item) => item.id === state.actingPlayerId);
  const action = JSON.parse(JSON.stringify({ type: GAME_ACTIONS.PLAY_CARD, playerId: player.id, cardId: player.hand[0].id }));
  state = applyGameAction(state, action);
  assert.equal(state.duel.plays.length, 1);
});
