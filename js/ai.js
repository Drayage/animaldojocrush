import { CARD_DEFINITIONS, cardDef } from "./data/cards.js";
import { PHASES } from "./data/constants.js";
import { getMasteryCandidates } from "./engine.js";

function currentBestPower(state) {
  return state.duel.plays.length ? Math.max(...state.duel.plays.map((play) => play.totalPower)) : -1;
}

export function chooseAiCard(state, player) {
  if (player.neutral) return null;
  const best = currentBestPower(state);
  const winning = player.hand.filter((card) => cardDef(card).power > best);
  const gameWinners = winning.filter((card) => player.fame + cardDef(card).power >= state.rules.targetFame);
  if (gameWinners.length) return gameWinners.toSorted((a, b) => cardDef(a).power - cardDef(b).power)[0].id;
  if (winning.length) return winning.toSorted((a, b) => cardDef(a).power - cardDef(b).power)[0].id;
  const pool = player.hand.filter((card) => !cardDef(card).exhausts);
  return (pool.length ? pool : player.hand).toSorted((a, b) => cardDef(b).power - cardDef(a).power)[0]?.id ?? null;
}

export function chooseAiWinnerReward(state, player) {
  const play = state.duel.plays.find((item) => item.playerId === player.id);
  if (player.fame + play.totalPower >= state.rules.targetFame) return { type: "fame" };
  const candidates = getMasteryCandidates(state, player.id);
  if (!candidates.length) return { type: "fame" };
  const weakest = candidates.toSorted((a, b) => a.power - b.power)[0];
  if (weakest.power <= 3 && weakest.remainingReusable > state.rules.minimumReusableCardsAfterMastery + 1 && Math.random() < 0.45) {
    return { type: "mastery", cardId: weakest.id };
  }
  return { type: "fame" };
}

export function chooseAiLoserAction(state, player) {
  if (player.fame >= state.rules.targetFame - 2 && player.experience >= state.rules.trainingExperienceCost) {
    return { type: "train-fame" };
  }
  const affordable = Object.entries(state.market)
    .filter(([, count]) => count > 0)
    .map(([id]) => CARD_DEFINITIONS[id])
    .filter((def) => def.cost <= player.experience);
  if (!affordable.length) return { type: "rest" };
  const best = affordable.toSorted((a, b) => (b.power / Math.max(1, b.cost)) - (a.power / Math.max(1, a.cost)) || b.power - a.power)[0];
  if (player.experience < 10 && best.power < 7 && Math.random() < 0.35) return { type: "rest" };
  return { type: "buy", cardDefinitionId: best.id };
}

export function getAiIntent(state) {
  if (state.inputLocked || state.phase === PHASES.GAME_OVER) return null;
  const actor = state.players.find((player) => player.id === state.actingPlayerId);
  if (state.phase === PHASES.WAITING_FOR_CARD && actor?.ai) {
    return { kind: "play-card", playerId: actor.id, cardId: chooseAiCard(state, actor) };
  }
  const winner = state.players.find((player) => player.id === state.duel.winnerId);
  if (state.phase === PHASES.WAITING_FOR_WINNER_REWARD && winner?.ai && !winner.neutral) {
    return { kind: "winner-reward", ...chooseAiWinnerReward(state, winner) };
  }
  if (state.phase === PHASES.WAITING_FOR_MASTERY_CARD && winner?.ai) {
    const candidates = getMasteryCandidates(state, winner.id);
    return { kind: "master-card", cardId: candidates.toSorted((a, b) => a.power - b.power)[0]?.id };
  }
  const loser = state.players.find((player) => player.id === state.pending.loserActionPlayerId);
  if (state.phase === PHASES.WAITING_FOR_LOSER_ACTION && loser?.ai) {
    return { kind: "loser-action", playerId: loser.id, action: chooseAiLoserAction(state, loser) };
  }
  return null;
}
