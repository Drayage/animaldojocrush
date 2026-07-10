import test from "node:test";
import assert from "node:assert/strict";
import { PHASES } from "../js/data/constants.js";
import { chooseWinnerReward, createCardInstance, createGame, finishDuel, loserAction, playCard, reviveGame } from "../js/engine.js";

function setOrder(state, firstId) {
  return {
    ...state,
    vanguardPlayerId: firstId,
    actingPlayerId: firstId,
    duel: { plays: [], winnerId: null, highestPower: 0, masteredCardId: null }
  };
}

test("판다 사범이 카드를 낼 때 RNG 상태가 전진한다", () => {
  let state = createGame({ playerCount: 2, seed: 100 });
  const panda = state.players.find((player) => player.neutral);
  state = setOrder(state, panda.id);
  const before = state.rngSeed;
  state = playCard(state, panda.id);
  assert.notEqual(state.rngSeed, before);
});

test("일반 플레이어 모두의 손패가 비었을 때만 수련 주기를 보충한다", () => {
  let state = createGame({ playerCount: 3, seed: 101 });
  const normal = state.players.filter((player) => !player.neutral);
  normal[0].hand = [];
  normal[1].hand = [createCardInstance("start_1", normal[1].id, "test")];
  normal[2].hand = [createCardInstance("start_2", normal[2].id, "test")];
  const beforeCycle = state.trainingCycle;
  state = finishDuel(state);
  assert.equal(state.trainingCycle, beforeCycle);
  assert.equal(state.players.find((player) => player.id === normal[1].id).hand.length, 1);
});

test("모든 일반 플레이어 손패가 비면 전원 최대 3장까지 다시 뽑는다", () => {
  let state = createGame({ playerCount: 3, seed: 102 });
  for (const player of state.players.filter((item) => !item.neutral)) {
    player.rest.push(...player.hand.map((card) => ({ ...card, zone: "rest" })));
    player.hand = [];
  }
  const beforeCycle = state.trainingCycle;
  state = finishDuel(state);
  assert.equal(state.trainingCycle, beforeCycle + 1);
  for (const player of state.players.filter((item) => !item.neutral)) {
    assert.equal(player.hand.length, 3);
  }
});

test("완료된 RESOLVING_DUEL 저장 상태는 복원 시 승자 판정으로 이어진다", () => {
  let state = createGame({ playerCount: 3, seed: 103 });
  state.phase = PHASES.RESOLVING_DUEL;
  state.duel.plays = state.players.map((player, order) => ({
    playerId: player.id,
    cardIds: [],
    cards: [],
    totalPower: order + 1,
    order
  }));
  const revived = reviveGame(state);
  assert.equal(revived.phase, PHASES.WAITING_FOR_WINNER_REWARD);
  assert.equal(revived.duel.winnerId, state.players[2].id);
});

test("불완전한 RESOLVING_DUEL 저장 상태는 잘못된 카드 선택 단계가 아니라 복원 실패 처리한다", () => {
  let state = createGame({ playerCount: 3, seed: 104 });
  state.phase = PHASES.RESOLVING_DUEL;
  state.duel.plays = [];
  assert.equal(reviveGame(state), null);
});

test("연계 자세로 공개된 소모 기술은 대련 종료 후 소모 영역으로 간다", () => {
  let state = createGame({ playerCount: 3, seed: 105 });
  const [p1, p2, p3] = state.players;
  p1.hand = [createCardInstance("combo_stance", p1.id, "test")];
  p1.deck = [createCardInstance("headbutt", p1.id, "test")];
  p2.hand = [createCardInstance("start_2", p2.id, "test")];
  p3.hand = [createCardInstance("start_3", p3.id, "test")];
  state = setOrder(state, p1.id);
  state = playCard(state, p1.id, p1.hand[0].id);
  state = playCard(state, p2.id, p2.hand[0].id);
  state = playCard(state, p3.id, p3.hand[0].id);
  state = chooseWinnerReward(state, "fame");
  while (state.phase === PHASES.WAITING_FOR_LOSER_ACTION) {
    const loser = state.pending.loserActionPlayerId;
    state = loserAction(state, loser, { type: "rest" });
  }
  assert.ok(state.players[0].consumed.some((card) => card.definitionId === "headbutt"));
});
