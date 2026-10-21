import { fillTemplate } from "../shared/format.js";
import { getLanguageCode, translate } from "../shared/i18n.js";

export const UI_STRINGS = Object.freeze({
  settings: {
    linksLabel: "TickTockFocus links",
    website: "Website",
    sendFeedback: "Send feedback",
    opensInNewTab: "(opens in a new tab)",
  },
  welcome: {
    pageTitle: "Welcome to TickTockFocus",
    title: "TickTockFocus",
    tagline: "Time any routine, step by step.",
    pickTitle: "Pick routines to start with",
    added: "Added",
    addSelected: "Add selected",
    addedToRoutines: "Added to your routines",
    addFailed: "Couldn't add the routines. Try again.",
    pinTitle: "Pin the extension",
    pinText: "Click the puzzle icon in the toolbar, then the pin next to TickTockFocus.",
    startTitle: "Start a routine",
    startText: "Click the icon and press {startButton} on a routine.",
    startButton: "Start",
    howItWorksTitle: "How it works",
    stepsTitle: "Steps, types and repeat groups",
    stepsText:
      "A routine is a list of steps that run one after another. Each step is Focus, Break or Custom, which gives it its colour, and a repeat group runs its steps {minTimes} to {maxTimes} times.",
    controlsTitle: "Pause, Skip, +5 min",
    controlsText:
      "Pause a step and pick it up later, skip to the next one, or give the current one 5 more minutes.",
    nextStepTitle: "Start automatically or wait for you",
    nextStepText:
      "When a step ends, the next one starts on its own or waits until you press Start. Choose in Settings.",
    alertsTitle: "Notifications, sound and the time on the icon",
    alertsText:
      "Every step ends with a notification and a short sound, and the notification's buttons pause, skip or start the next step. The toolbar icon shows the minutes left. Settings turns the sound or the time on the icon off.",
    minimumTitle: "Steps are at least {seconds} seconds",
    minimumText:
      "Chrome won't ring an extension's alarm sooner than {seconds} seconds after it's set, so a shorter step would end late.",
    privacyTitle: "Privacy",
    privacyText:
      "No site access, no account, no tracking. Routines and settings sync with Chrome Sync when it's on; the running timer stays on this computer.",
    privacyPolicy: "Privacy policy",
  },
});

export const formatUiString = (template, values = {}) => fillTemplate(template, values);

export function lookupUiString(path) {
  const text = path.split(".").reduce((group, key) => group?.[key], UI_STRINGS);
  if (typeof text !== "string") throw new Error(`Unknown UI string: ${path}`);
  return text;
}

export function applyUiStrings(root = document, lookUpText = translate) {
  document.documentElement.lang = getLanguageCode();
  root.querySelectorAll("[data-ui-text]").forEach((element) => {
    element.textContent = lookUpText(element.dataset.uiText);
  });
  root.querySelectorAll("[data-ui-label]").forEach((element) => {
    const label = lookUpText(element.dataset.uiLabel);
    element.setAttribute("aria-label", label);
    if (element.tagName === "BUTTON") element.title = label;
  });
}
