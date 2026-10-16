import { fillTemplate } from "../shared/format.js";

export const UI_STRINGS = Object.freeze({
  navigation: {
    sections: "Sections",
    timerTab: "Timer",
    routinesTab: "Routines",
    settings: "Settings",
    back: "Back",
  },
  settings: {
    heading: "Settings",
    linksLabel: "TickTockFocus links",
    website: "Website",
    sendFeedback: "Send feedback",
    rate: "Rate on Chrome Web Store",
    reportBug: "Report a bug",
    opensInNewTab: "(opens in a new tab)",
    version: "Version {version}",
  },
  timer: {
    selectPresetOption: "Select preset",
    start: "Start",
    stop: "Stop",
    noPresets: "Create a preset on the Routines tab to start.",
    selectPreset: "Select a preset to start.",
    noDuration: "This preset has no duration. Select another one.",
    shortStages:
      "Some segments are shorter than {seconds} seconds, so their notifications may arrive late.",
    unreachable: "Couldn't reach the timer. Close and reopen this popup, then try again.",
    stagePosition: "{label} · {n} of {total}",
    paused: "Paused",
    waitingForNext: "Waiting — next: {label}",
  },
  presetForm: {
    hours: "Hours",
    minutes: "Minutes",
    seconds: "Seconds",
    nameMissing: "Enter a preset name.",
    nameTooLong: "Use at most {count} characters.",
    noSegments: "Add at least one segment.",
    fieldOutOfRange: "{label} must be between {min} and {max}.",
    zeroDuration: "Enter a duration longer than 00:00:00.",
    segmentTooShort: "Each segment must be at least {seconds} seconds long.",
    tooManySegments: "A preset can have at most {count} segments.",
    moveSegmentUp: "Move segment {position} up",
    moveSegmentDown: "Move segment {position} down",
    removeSegment: "Remove segment {position} ({duration})",
    segmentMoved: "Segment {duration} moved to position {position} of {count}.",
    saveFailed: "Couldn't save the preset. Try again.",
  },
  savedPresets: {
    selectOnTimerTab: "Select on the Timer tab",
    deletePreset: "Delete preset {name}",
    loadFailed: "Couldn't load your presets. Reopen the popup to try again.",
    deleteFailed: "Couldn't delete the preset. Try again.",
    migrationFailed:
      "Couldn't move your presets from the previous version. They're still on this device; reopen the popup to try again.",
  },
});

export const formatUiString = (template, values = {}) => fillTemplate(template, values);

export function lookupUiString(path) {
  const text = path.split(".").reduce((group, key) => group?.[key], UI_STRINGS);
  if (typeof text !== "string") throw new Error(`Unknown UI string: ${path}`);
  return text;
}

export function applyUiStrings(root = document) {
  root.querySelectorAll("[data-ui-text]").forEach((element) => {
    element.textContent = lookupUiString(element.dataset.uiText);
  });
  root.querySelectorAll("[data-ui-label]").forEach((element) => {
    const label = lookupUiString(element.dataset.uiLabel);
    element.setAttribute("aria-label", label);
    if (element.tagName === "BUTTON") element.title = label;
  });
}
