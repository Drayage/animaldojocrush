export const PHASES = Object.freeze({
  WAITING_FOR_CARD: "WAITING_FOR_CARD",
  RESOLVING_DUEL: "RESOLVING_DUEL",
  WAITING_FOR_WINNER_REWARD: "WAITING_FOR_WINNER_REWARD",
  WAITING_FOR_MASTERY_CARD: "WAITING_FOR_MASTERY_CARD",
  WAITING_FOR_LOSER_ACTION: "WAITING_FOR_LOSER_ACTION",
  REFILLING_HANDS: "REFILLING_HANDS",
  GAME_OVER: "GAME_OVER"
});

export const RULES = Object.freeze({
  targetFame: 50,
  maxExperience: 30,
  trainingExperienceCost: 5,
  trainingFameGain: 1,
  startingHandSize: 3,
  minimumReusableCardsAfterMastery: 3,
  allowPlayedCardMastery: true,
  allowComboCardMastery: true,
  aiDelayMs: 520,
  animationMs: 260
});

export const ZONES = Object.freeze({
  DECK: "deck",
  HAND: "hand",
  REST: "rest",
  PLAY: "play",
  MASTERED: "mastered",
  CONSUMED: "consumed"
});
