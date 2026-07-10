export const PHASES = Object.freeze({
  WAITING_FOR_CARD: "WAITING_FOR_CARD",
  RESOLVING_DUEL: "RESOLVING_DUEL",
  WAITING_FOR_WINNER_REWARD: "WAITING_FOR_WINNER_REWARD",
  WAITING_FOR_MASTERY_CARD: "WAITING_FOR_MASTERY_CARD",
  WAITING_FOR_LOSER_ACTION: "WAITING_FOR_LOSER_ACTION",
  WAITING_FOR_DUEL_RECAP: "WAITING_FOR_DUEL_RECAP",
  WAITING_FOR_MILESTONE_MASTERY: "WAITING_FOR_MILESTONE_MASTERY",
  WAITING_FOR_MILESTONE_FALLBACK: "WAITING_FOR_MILESTONE_FALLBACK",
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
  milestoneMode: true,
  aiDelayMs: 850,
  animationMs: 260
});

export const MILESTONE_REWARDS = Object.freeze([
  { score: 6, type: "experience", amount: 2 },
  { score: 12, type: "mastery", amount: 1 },
  { score: 18, type: "experience", amount: 3 },
  { score: 24, type: "mastery", amount: 1 },
  { score: 30, type: "experience", amount: 4 },
  { score: 36, type: "mastery", amount: 1 },
  { score: 42, type: "experience", amount: 3 }
]);

export const ZONES = Object.freeze({
  DECK: "deck",
  HAND: "hand",
  REST: "rest",
  PLAY: "play",
  MASTERED: "mastered",
  CONSUMED: "consumed"
});
