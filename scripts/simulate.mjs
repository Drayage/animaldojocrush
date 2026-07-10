import { chooseAiCard, chooseAiLoserAction, chooseAiWinnerReward } from "../js/ai.js";
import { PHASES } from "../js/data/constants.js";
import { chooseWinnerReward, createGame, getMasteryCandidates, loserAction, masterCard, playCard } from "../js/engine.js";

const GAMES = Number(process.argv[2] || 200);
const MAX_STEPS = 2000;

function stepGame(state) {
  const actor = state.players.find((player) => player.id === state.actingPlayerId);
  if (state.phase === PHASES.WAITING_FOR_CARD) {
    const cardId = actor.neutral ? null : chooseAiCard(state, actor);
    return playCard(state, actor.id, cardId);
  }
  const winner = state.players.find((player) => player.id === state.duel.winnerId);
  if (state.phase === PHASES.WAITING_FOR_WINNER_REWARD) {
    const reward = chooseAiWinnerReward(state, winner);
    return chooseWinnerReward(state, reward.type);
  }
  if (state.phase === PHASES.WAITING_FOR_MASTERY_CARD) {
    const card = getMasteryCandidates(state, winner.id).toSorted((a, b) => a.power - b.power)[0];
    return masterCard(state, card.id);
  }
  if (state.phase === PHASES.WAITING_FOR_LOSER_ACTION) {
    const loser = state.players.find((player) => player.id === state.pending.loserActionPlayerId);
    return loserAction(state, loser.id, chooseAiLoserAction(state, loser));
  }
  return state;
}

const stats = { games: 0, deadlocks: 0, totalSteps: 0, wins: {}, deadlockSeeds: [] };

for (let seed = 1; seed <= GAMES; seed += 1) {
  let state = createGame({ playerCount: 2, seed });
  for (const player of state.players) player.human = false;
  let steps = 0;
  while (state.phase !== PHASES.GAME_OVER && steps < MAX_STEPS) {
    state = stepGame(state);
    steps += 1;
  }
  if (state.phase !== PHASES.GAME_OVER) {
    stats.deadlocks += 1;
    stats.deadlockSeeds.push(seed);
    continue;
  }
  stats.games += 1;
  stats.totalSteps += steps;
  const winner = state.players.find((player) => player.id === state.winnerId);
  stats.wins[winner.name] = (stats.wins[winner.name] || 0) + 1;
}

console.log(`판수: ${stats.games}, 교착: ${stats.deadlocks}`);
console.log(`평균 단계: ${(stats.totalSteps / Math.max(1, stats.games)).toFixed(1)}`);
console.log("승리 분포:", stats.wins);
if (stats.deadlocks) {
  console.error("교착 seed:", stats.deadlockSeeds.slice(0, 20).join(", "));
  process.exit(1);
}
