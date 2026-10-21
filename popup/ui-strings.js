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
    nextStep: "Next step",
    startAutomatically: "Start automatically",
    waitForMe: "Wait for me",
    timeFormat: "Time format",
    hours24: "24-hour",
    hours12: "12-hour",
    sound: "Sound",
    playSound: "Play a sound when a step ends",
    tone: "Tone",
    soundNames: {
      chime: "Chime",
      bell: "Bell",
      soft: "Soft",
    },
    volume: "Volume",
    volumePercent: "{volume}%",
    testSound: "Test",
    timeOnIcon: "Time on icon",
    showTimeOnIcon: "Show the time left on the toolbar icon",
    saveFailed: "Couldn't save the setting. Try again.",
    linksLabel: "TickTockFocus links",
    howItWorks: "How it works",
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
    templatesIntro: "Start with one of these:",
    add: "Add",
    addTemplate: "Add {name}",
    buildYourOwn: "or build your own",
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
  editor: {
    newHeading: "New routine",
    editHeading: "Edit routine",
    name: "Name",
    stepsLabel: "Steps",
    runningNote: "Changes apply the next time you start it.",
    rowLimit:
      "This routine has {count} steps; up to {limit} are allowed. Remove steps or group them into a repeat to save.",
    kinds: {
      focus: "Focus",
      break: "Break",
      custom: "Custom",
    },
    stageNumber: "step {position}",
    groupNumber: "repeat group {position}",
    kindOf: "Kind of {step}",
    labelOf: "Name of {step}",
    minutesOf: "Minutes of {step}",
    secondsOf: "Seconds of {step}",
    minutesUnit: "min",
    secondsUnit: "s",
    moveStageUp: "Move {step} up",
    moveStageDown: "Move {step} down",
    removeStage: "Remove {step}",
    repeat: "Repeat",
    repeatCountOf: "Repeat count of {group}",
    timesOption: "×{times}",
    moveGroupUp: "Move {group} up",
    moveGroupDown: "Move {group} down",
    removeGroup: "Remove {group} and its steps",
    addStage: "Add step",
    addGroup: "Add repeat group",
    addStageToGroup: "Add step to group",
    total: "Total {duration} · {count} steps",
    totalOneStep: "Total {duration} · 1 step",
    stageMoved: "{label} moved to position {position} of {count}.",
    stageMovedInGroup: "{label} moved to position {position} of {count}, in {group}.",
    groupMoved: "Moved. This is now {group}.",
    cancel: "Cancel",
    save: "Save",
    discardQuestion: "Discard your changes?",
    discard: "Discard",
    keepEditing: "Keep editing",
    saveFailed: "Couldn't save the routine. Try again.",
    errors: {
      invalid: "This step can't be saved. Check its values.",
      nameMissing: "Enter a name.",
      nameTooLong: "Use at most {limit} characters.",
      labelMissing: "Enter a name for this step.",
      labelTooLong: "Use at most {limit} characters.",
      kindInvalid: "Choose a kind.",
      durationInvalid: "Enter minutes and seconds.",
      durationTooShort: "Make this step at least {limit} seconds long.",
      durationTooLong: "Make this step shorter than 24 hours.",
      repeatTimesOutOfRange: "Choose how many times to repeat.",
      repeatEmpty: "Add a step to this group or remove the group.",
      nestedRepeat: "A repeat group can't contain another group.",
      noStages: "Add at least one step.",
      tooManyRows: "A routine can have at most {limit} steps.",
      tooManyStages: "With repeats this routine has {count} steps; up to {limit} are allowed.",
    },
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
  whatsNew: {
    message: "New in 1.2: named steps, repeats, pause and skip, sound and time on the icon.",
    seeHowItWorks: "See how it works",
    close: "Close",
  },
  rating: {
    question: "Enjoying TickTockFocus? A rating helps others find it.",
    rate: "Rate",
    later: "Later",
    never: "Don't ask again",
  },
  templates: {
    names: {
      pomodoro: "Pomodoro",
      "52-17": "52/17",
      "deep-work": "Deep work",
      study: "Study",
      "desk-break": "Desk break",
    },
    stageLabels: {
      focus: "Focus",
      break: "Break",
      longBreak: "Long break",
      study: "Study",
      work: "Work",
      stretch: "Stretch",
    },
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
