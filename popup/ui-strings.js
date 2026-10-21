import { getLanguageCode, translate } from "../shared/i18n.js";

export function applyUiStrings(root = document) {
  document.documentElement.lang = getLanguageCode();
  root.querySelectorAll("[data-ui-text]").forEach((element) => {
    element.textContent = translate(element.dataset.uiText);
  });
  root.querySelectorAll("[data-ui-label]").forEach((element) => {
    const label = translate(element.dataset.uiLabel);
    element.setAttribute("aria-label", label);
    if (element.tagName === "BUTTON") element.title = label;
  });
}
