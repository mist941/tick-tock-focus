import {
  DECLINED_PROMPT,
  RATED_PROMPT,
  isRatingPromptDue,
  postponeRatingPrompt,
} from "../shared/rating-prompt.js";
import { getPopupState, reloadNotices, subscribeToPopupState } from "./popup-state.js";
import * as PopupStorage from "./popup-storage.js";
import { focusTimer } from "./timer-view.js";
import { isWhatsNewShown } from "./whats-new-view.js";

const elements = {
  prompt: document.getElementById("rating_prompt"),
  rateLink: document.getElementById("rating_rate"),
  laterButton: document.getElementById("rating_later"),
  neverButton: document.getElementById("rating_never"),
};

function renderRatingPrompt() {
  const { completedRoutines, ratingPrompt } = getPopupState().notices;
  elements.prompt.hidden = isWhatsNewShown() || !isRatingPromptDue(completedRoutines, ratingPrompt);
}

async function answerRatingPrompt(ratingPrompt) {
  try {
    await PopupStorage.saveRatingPrompt(ratingPrompt);
  } catch (error) {
    console.error("Error saving the rating prompt answer:", error);
  }
  await reloadNotices();
}

async function answerAndMoveFocus(ratingPrompt) {
  await answerRatingPrompt(ratingPrompt);
  if (elements.prompt.hidden) focusTimer();
}

export function initializeRatingPromptView() {
  elements.rateLink.addEventListener("click", async (event) => {
    event.preventDefault();
    await answerRatingPrompt(RATED_PROMPT);
    chrome.tabs
      .create({ url: elements.rateLink.href })
      .catch((error) => console.error("Couldn't open the reviews page:", error));
  });
  elements.laterButton.addEventListener("click", () =>
    answerAndMoveFocus(postponeRatingPrompt(getPopupState().notices.completedRoutines))
  );
  elements.neverButton.addEventListener("click", () => answerAndMoveFocus(DECLINED_PROMPT));
  subscribeToPopupState((change) => {
    if (change.notices) renderRatingPrompt();
  });
  renderRatingPrompt();
}
