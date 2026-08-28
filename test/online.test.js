import test from "node:test";
import assert from "node:assert/strict";
import { chooseAiLoserAction, chooseAiWinnerReward } from "../js/ai.js";
import { createCardInstance, createGame } from "../js/engine.js";
import { viewFor } from "../js/view.js";

test("createGame with humanSeatIndexes:[0] matches the historical default (only seat 0 is human)", () => {
  const state = createGame({ playerCount: 3, seed: 42 });
  const [p1, p2, p3] = state.players.filter((p) => !p.neutral);
  assert.equal(p1.human, true);
  assert.equal(p1.ai, false);
  assert.equal(p2.human, false);
  assert.equal(p2.ai, true);
  assert.equal(p3.human, false);
  assert.equal(p3.ai, true);
});

test("createGame with humanSeatIndexes:[0,1] makes both online seats non-AI (needed for host+guest online play)", () => {
  const state = createGame({ playerCount: 2, seed: 42, humanSeatIndexes: [0, 1] });
  const real = state.players.filter((p) => !p.neutral);
  assert.equal(real.length, 2);
  for (const player of real) {
    assert.equal(player.human, true);
    assert.equal(player.ai, false);
  }
  // the panda-master seat stays AI-controlled regardless (it always auto-plays)
  const panda = state.players.find((p) => p.neutral);
  assert.equal(panda.ai, true);
});

test("viewFor hides other players' hand/deck/rest identities but keeps the viewer's own and counts", () => {
  const state = createGame({ playerCount: 2, seed: 7, humanSeatIndexes: [0, 1] });
  const [p1, , p2] = state.players; // player-1, panda-master, player-2
  const view = viewFor(state, p1.id);
  const viewedP1 = view.players.find((p) => p.id === p1.id);
  const viewedP2 = view.players.find((p) => p.id === p2.id);

  // viewer's own hand is untouched
  assert.deepEqual(viewedP1.hand, p1.hand);
  assert.equal(viewedP1.deck.length, p1.deck.length);

  // opponent's hand/deck/rest are masked but counts are preserved
  assert.equal(viewedP2.hand.length, p2.hand.length);
  assert.equal(viewedP2.deck.length, p2.deck.length);
  assert.equal(viewedP2.rest.length, p2.rest.length);
  for (const card of viewedP2.hand) {
    assert.equal(card.hidden, true);
    assert.equal("definitionId" in card, false);
  }

  // original state is untouched (pure function)
  assert.ok(p2.hand.every((card) => Boolean(card.definitionId)));
});

test("viewFor also masks the neutral panda-master's deck for every viewer", () => {
  const state = createGame({ playerCount: 2, seed: 7, humanSeatIndexes: [0, 1] });
  const panda = state.players.find((p) => p.neutral);
  const view = viewFor(state, state.players[0].id);
  const viewedPanda = view.players.find((p) => p.id === panda.id);
  assert.equal(viewedPanda.deck.length, panda.deck.length);
  assert.ok(viewedPanda.deck.every((card) => card.hidden === true));
});

test("AI winner-reward gambles on the RNG branch deterministically from state.rngSeed (no bare Math.random)", () => {
  const state = createGame({ playerCount: 3, seed: 99 });
  const winner = state.players[0];
  winner.fame = 0;
  winner.rest = Array.from({ length: 6 }, () => createCardInstance("start_1", winner.id, "test"));
  state.duel.plays = [{ playerId: winner.id, totalPower: 2, order: 0 }];

  // Same state, same player -> same decision every time (the mastery-gamble branch is reachable
  // here: weakest.power === 1 <= 3, and remainingReusable comfortably clears the +1 threshold).
  const results = new Set();
  for (let i = 0; i < 5; i += 1) results.add(JSON.stringify(chooseAiWinnerReward(state, winner)));
  assert.equal(results.size, 1);
});

test("AI loser-action rest-vs-buy gamble is deterministic from state.rngSeed (no bare Math.random)", () => {
  const state = createGame({ playerCount: 3, seed: 99 });
  const loser = state.players[1];
  loser.experience = 3; // < 10, and cheapest affordable market card (combo_stance, power 1) is < 7
  const results = new Set();
  for (let i = 0; i < 5; i += 1) results.add(JSON.stringify(chooseAiLoserAction(state, loser)));
  assert.equal(results.size, 1);
});
