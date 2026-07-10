import {
  chooseWinnerReward,
  confirmDuelRecap,
  loserAction,
  masterCard,
  playCard,
  resolveMilestoneFallback,
  resolveMilestoneMastery,
} from "./engine.js";

export const GAME_ACTIONS = Object.freeze({
  PLAY_CARD: "PLAY_CARD",
  WINNER_REWARD: "WINNER_REWARD",
  MASTER_CARD: "MASTER_CARD",
  LOSER_ACTION: "LOSER_ACTION",
  CONFIRM_DUEL_RECAP: "CONFIRM_DUEL_RECAP",
  MILESTONE_MASTERY: "MILESTONE_MASTERY",
  MILESTONE_FALLBACK: "MILESTONE_FALLBACK",
});

export function applyGameAction(state, action) {
  switch (action?.type) {
    case GAME_ACTIONS.PLAY_CARD:
      return playCard(state, action.playerId, action.cardId);
    case GAME_ACTIONS.WINNER_REWARD:
      return chooseWinnerReward(state, action.rewardType);
    case GAME_ACTIONS.MASTER_CARD:
      return masterCard(state, action.cardId);
    case GAME_ACTIONS.LOSER_ACTION:
      return loserAction(state, action.playerId, action.action);
    case GAME_ACTIONS.CONFIRM_DUEL_RECAP:
      return confirmDuelRecap(state, action.playerId);
    case GAME_ACTIONS.MILESTONE_MASTERY:
      return resolveMilestoneMastery(state, action.playerId, action.cardId);
    case GAME_ACTIONS.MILESTONE_FALLBACK:
      return resolveMilestoneFallback(state, action.playerId, action.cardId ?? null);
    default:
      return state;
  }
}

export function actionFromAiIntent(intent) {
  if (!intent) return null;
  if (intent.kind === "play-card") return { type: GAME_ACTIONS.PLAY_CARD, playerId: intent.playerId, cardId: intent.cardId };
  if (intent.kind === "winner-reward") return { type: GAME_ACTIONS.WINNER_REWARD, rewardType: intent.type };
  if (intent.kind === "master-card") return { type: GAME_ACTIONS.MASTER_CARD, cardId: intent.cardId };
  if (intent.kind === "loser-action") return { type: GAME_ACTIONS.LOSER_ACTION, playerId: intent.playerId, action: intent.action };
  if (intent.kind === "milestone-mastery") return { type: GAME_ACTIONS.MILESTONE_MASTERY, playerId: intent.playerId, cardId: intent.cardId };
  if (intent.kind === "milestone-fallback") return { type: GAME_ACTIONS.MILESTONE_FALLBACK, playerId: intent.playerId, cardId: intent.cardId ?? null };
  return null;
}
