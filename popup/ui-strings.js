import { fillTemplate, formatSpokenDuration } from "../shared/format.js";

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
  formats: {
    hours: "{count} h",
    minutes: "{count} min",
    seconds: "{count} s",
    beforeNoon: "AM",
    afterNoon: "PM",
  },
  timer: {
    newRoutine: "New routine",
    noRoutines: "No routines yet",
    createRoutine: "Create a routine",
    startRoutine: "Start {name}, {duration}",
    noDuration: "This routine has no duration.",
    shortStages:
      "Some steps are shorter than {seconds} seconds, so their notifications may arrive late.",
    loadFailed: "Couldn't load your routines. Reopen the popup to try again.",
    stagePosition: "{label} · {n} of {total}",
    pausedPosition: "Paused · {label} {n} of {total}",
    stageDone: "{label} done",
    next: "Next: {label} · {duration}",
    lastStage: "Last step",
    endsAt: "Ends at {time}",
    pause: "Pause",
    resume: "Resume",
    startStage: "Start {label}",
    skip: "Skip",
    extend: "+{minutes} min",
    stop: "Stop",
    unreachable: "Couldn't reach the timer. Close and reopen this popup, then try again.",
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
  routines: {
    empty: "No routines yet",
    newRoutine: "New routine",
    summary: "{count} steps · {duration}",
    summaryOneStep: "1 step · {duration}",
    start: "Start {name}",
    running: "Running",
    moreActions: "More actions for {name}",
    edit: "Edit",
    duplicate: "Duplicate",
    delete: "Delete",
    copyName: "Copy of {name}",
    duplicated: "{name} added",
    deleted: "Routine deleted",
    undo: "Undo",
    confirmReplace: "Stop {running} and start {name}?",
    confirmStart: "Start",
    confirmCancel: "Cancel",
    saveFailed: "Couldn't save the routine. Try again.",
    deleteFailed: "Couldn't delete the routine. Try again.",
    migrationFailed:
      "Couldn't move your presets from the previous version. They're still on this device; reopen the popup to try again.",
  },
});

export const formatUiString = (template, values = {}) => fillTemplate(template, values);

export const formatDurationText = (totalSeconds) =>
  formatSpokenDuration(totalSeconds, UI_STRINGS.formats);

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
