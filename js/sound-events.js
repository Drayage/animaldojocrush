import { cardDef } from "./data/cards.js";
import { GAME_ACTIONS } from "./game-actions.js";

function sumPlayers(state, selector) {
  return state.players.reduce((sum, player) => sum + selector(player), 0);
}

export function getSoundEvents(previous, next, action) {
  const events = [];
  if (action.type === GAME_ACTIONS.PLAY_CARD) {
    const play = next.duel.plays.find((item) => item.playerId === action.playerId);
    events.push("card");
    if (play?.cards.length > 1) events.push("combo");
    if (play?.cards.some((card) => cardDef(card).exhausts)) events.push("exhaust");
    if (!previous.duel.winnerId && next.duel.winnerId) events.push("duelWin");
  }

  const fameGain = sumPlayers(next, (player) => player.fame) - sumPlayers(previous, (player) => player.fame);
  const experienceGain = sumPlayers(next, (player) => player.experience) - sumPlayers(previous, (player) => player.experience);
  const masteredGain = sumPlayers(next, (player) => player.mastered.length) - sumPlayers(previous, (player) => player.mastered.length);
  const stockSpent = Object.values(previous.market).reduce((sum, stock) => sum + stock, 0)
    - Object.values(next.market).reduce((sum, stock) => sum + stock, 0);
  const milestoneGain = (next.milestones?.history?.length || 0) - (previous.milestones?.history?.length || 0);
  const selectedMastery = action.type === GAME_ACTIONS.MASTER_CARD
    || (action.type === GAME_ACTIONS.MILESTONE_MASTERY && action.cardId)
    || (action.type === GAME_ACTIONS.MILESTONE_FALLBACK && action.cardId);

  if (milestoneGain > 0) events.push("milestone");
  if (stockSpent > 0) events.push("buy");
  if (masteredGain > 0 || selectedMastery) events.push("mastery");
  if (fameGain > 0) events.push("fame");
  if (experienceGain > 0) events.push("experience");
  if (previous.phase !== "GAME_OVER" && next.phase === "GAME_OVER") events.push("champion");
  if (action.type === GAME_ACTIONS.CONFIRM_DUEL_RECAP
    || (action.type === GAME_ACTIONS.LOSER_ACTION && action.action?.type === "rest")
    || (action.type === GAME_ACTIONS.WINNER_REWARD && action.rewardType === "mastery")) events.push("confirm");
  return events;
}
