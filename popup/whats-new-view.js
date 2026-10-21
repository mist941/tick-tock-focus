import { translate } from "../shared/i18n.js";
import { WHATS_NEW_VERSION } from "../shared/whats-new.js";
import { setTextIfChanged } from "./dom-helpers.js";
import { createIcon } from "./icons.js";
import { getPopupState, reloadNotices, subscribeToPopupState } from "./popup-state.js";
import * as PopupStorage from "./popup-storage.js";
import { focusTimer } from "./timer-view.js";

const elements = {
  text: document.getElementById("whats_new_text"),
  link: document.getElementById("whats_new_link"),
  closeButton: document.getElementById("whats_new_close"),
};

export const isWhatsNewShown = () => getPopupState().notices.whatsNewPending === WHATS_NEW_VERSION;

function renderWhatsNew() {
  const isShown = isWhatsNewShown();
  setTextIfChanged(elements.text, isShown ? translate("popupWhatsNewMessage") : "");
  elements.link.hidden = !isShown;
  elements.closeButton.hidden = !isShown;
}

async function dismissWhatsNew() {
  try {
    await PopupStorage.dismissWhatsNew();
  } catch (error) {
    console.error("Error dismissing what's new:", error);
  }
  await reloadNotices();
}

export function initializeWhatsNewView() {
  elements.closeButton.append(createIcon("close"));
  elements.closeButton.addEventListener("click", async () => {
    await dismissWhatsNew();
    if (!isWhatsNewShown()) focusTimer();
  });
  elements.link.addEventListener("click", async (event) => {
    event.preventDefault();
    await dismissWhatsNew();
    chrome.tabs
      .create({ url: elements.link.href })
      .catch((error) => console.error("Couldn't open the welcome page:", error));
  });
  subscribeToPopupState((change) => {
    if (change.notices) renderWhatsNew();
  });
  renderWhatsNew();
}
