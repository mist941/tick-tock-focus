export const RATING_PROMPT_LIMITS = Object.freeze({
  firstAskAtCompleted: 5,
  askAgainAfterCompleted: 10,
});

const NOTIFICATIONS_OF_COMPLETED_ROUTINES = new Set(["routineComplete", "lateFinish"]);

export const countsAsCompletedRoutine = (notification) =>
  NOTIFICATIONS_OF_COMPLETED_ROUTINES.has(notification?.type);

const toCount = (value) => (Number.isInteger(value) && value > 0 ? value : 0);

export const addCompletedRoutine = (completedRoutines) => toCount(completedRoutines) + 1;

export const RATED_PROMPT = Object.freeze({ state: "rated", askAfterCompleted: null });

export const DECLINED_PROMPT = Object.freeze({ state: "declined", askAfterCompleted: null });

export const postponeRatingPrompt = (completedRoutines) => ({
  state: "later",
  askAfterCompleted: toCount(completedRoutines) + RATING_PROMPT_LIMITS.askAgainAfterCompleted,
});

export function isRatingPromptDue(completedRoutines, ratingPrompt) {
  if (ratingPrompt?.state === RATED_PROMPT.state || ratingPrompt?.state === DECLINED_PROMPT.state) {
    return false;
  }
  const askAtCompleted = Number.isInteger(ratingPrompt?.askAfterCompleted)
    ? ratingPrompt.askAfterCompleted
    : RATING_PROMPT_LIMITS.firstAskAtCompleted;
  return toCount(completedRoutines) >= askAtCompleted;
}
