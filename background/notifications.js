import * as Format from "../shared/format.js";

const { fillTemplate } = Format;

export const NOTIFICATION_ID = "stage";

export const NOTIFICATION_TEXTS = Object.freeze({
  stageDoneTitle: "{label} done · {n} of {total}",
  stageDoneAutoMessage: "Next: {nextLabel} · {duration}, ends at {time}",
  stageDoneWaitMessage: "Next: {nextLabel} · {duration}",
  lateStageDoneTitle: "{label} done at {time}",
  routineCompleteTitle: "{routineName} complete",
  focusTotalMessage: "{focusTotal} of focus",
  totalDurationMessage: "{totalDuration} in total",
  lateFinishTitle: "{routineName} finished at {time}",
  caughtUpTitle: "Now: {label} · {n} of {total}",
  caughtUpMessage: "{remaining} left",
  pauseButton: "Pause",
  skipButton: "Skip",
  startStageButton: "Start {label}",
  stopButton: "Stop",
  startAgainButton: "Start again",
  hours: "{count} h",
  minutes: "{count} min",
  seconds: "{count} s",
  beforeNoon: "AM",
  afterNoon: "PM",
});

export const formatSpokenDuration = (totalSeconds) =>
  Format.formatSpokenDuration(totalSeconds, NOTIFICATION_TEXTS);

export const formatClockTime = (timestamp, timeFormat) =>
  Format.formatClockTime(timestamp, timeFormat, NOTIFICATION_TEXTS);

const sumDurationSec = (stages) => stages.reduce((totalSec, stage) => totalSec + stage.durationSec, 0);

function describeCompletion(run) {
  const focusSec = sumDurationSec(run.stages.filter((stage) => stage.kind === "focus"));
  return focusSec > 0
    ? fillTemplate(NOTIFICATION_TEXTS.focusTotalMessage, {
        focusTotal: formatSpokenDuration(focusSec),
      })
    : fillTemplate(NOTIFICATION_TEXTS.totalDurationMessage, {
        totalDuration: formatSpokenDuration(sumDurationSec(run.stages)),
      });
}

const stagePosition = (run, stageIndex) => ({ n: stageIndex + 1, total: run.stages.length });

function describeUpcomingStage(run) {
  const upcomingStage = run.stages[run.stageIndex];
  return {
    nextLabel: upcomingStage.label,
    duration: formatSpokenDuration(upcomingStage.durationSec),
  };
}

const pauseAndSkipButtons = () => [
  { title: NOTIFICATION_TEXTS.pauseButton, command: { action: "pauseRoutine" } },
  { title: NOTIFICATION_TEXTS.skipButton, command: { action: "skipStage" } },
];

const startAwaitedStageAndStopButtons = (run) => [
  {
    title: fillTemplate(NOTIFICATION_TEXTS.startStageButton, { label: run.stages[run.stageIndex].label }),
    command: { action: "startNextStage" },
  },
  { title: NOTIFICATION_TEXTS.stopButton, command: { action: "stopRoutine" } },
];

const startAgainButtons = (run) =>
  run.routineId
    ? [
        {
          title: NOTIFICATION_TEXTS.startAgainButton,
          command: { action: "startRoutine", routineId: run.routineId, replaceRunning: true },
        },
      ]
    : [];

const NOTIFICATION_BUILDERS = {
  stageDone(notification, { previousRun, nextRun, timeFormat }) {
    const completedStage = previousRun.stages[notification.stageIndex];
    const isWaiting = nextRun.status === "awaitingNext";
    const values = {
      label: completedStage.label,
      ...stagePosition(previousRun, notification.stageIndex),
      ...describeUpcomingStage(nextRun),
    };
    return {
      title: fillTemplate(NOTIFICATION_TEXTS.stageDoneTitle, values),
      message: isWaiting
        ? fillTemplate(NOTIFICATION_TEXTS.stageDoneWaitMessage, values)
        : fillTemplate(NOTIFICATION_TEXTS.stageDoneAutoMessage, {
            ...values,
            time: formatClockTime(nextRun.stageEndsAt, timeFormat),
          }),
      requireInteraction: isWaiting,
      buttons: isWaiting ? startAwaitedStageAndStopButtons(nextRun) : pauseAndSkipButtons(),
    };
  },

  lateStageDone(notification, { previousRun, nextRun, timeFormat }) {
    return {
      title: fillTemplate(NOTIFICATION_TEXTS.lateStageDoneTitle, {
        label: previousRun.stages[notification.stageIndex].label,
        time: formatClockTime(notification.endedAt, timeFormat),
      }),
      message: fillTemplate(NOTIFICATION_TEXTS.stageDoneWaitMessage, describeUpcomingStage(nextRun)),
      requireInteraction: true,
      buttons: startAwaitedStageAndStopButtons(nextRun),
    };
  },

  routineComplete(notification, { previousRun }) {
    return {
      title: fillTemplate(NOTIFICATION_TEXTS.routineCompleteTitle, {
        routineName: previousRun.routineName,
      }),
      message: describeCompletion(previousRun),
      requireInteraction: false,
      buttons: startAgainButtons(previousRun),
    };
  },

  lateFinish(notification, { previousRun, timeFormat }) {
    return {
      title: fillTemplate(NOTIFICATION_TEXTS.lateFinishTitle, {
        routineName: previousRun.routineName,
        time: formatClockTime(notification.finishedAt, timeFormat),
      }),
      message: describeCompletion(previousRun),
      requireInteraction: false,
      buttons: [],
    };
  },

  caughtUp(notification, { nextRun, now }) {
    const currentStage = nextRun.stages[nextRun.stageIndex];
    return {
      title: fillTemplate(NOTIFICATION_TEXTS.caughtUpTitle, {
        label: currentStage.label,
        ...stagePosition(nextRun, nextRun.stageIndex),
      }),
      message: fillTemplate(NOTIFICATION_TEXTS.caughtUpMessage, {
        remaining: formatSpokenDuration(Math.ceil((nextRun.stageEndsAt - now) / 1000)),
      }),
      requireInteraction: false,
      buttons: pauseAndSkipButtons(),
    };
  },
};

export function buildNotification(notification, context) {
  return NOTIFICATION_BUILDERS[notification.type](notification, context);
}

const RUN_KEY_FIELDS = ["startedAt", "stageIndex", "status"];

export const getNotificationRunKey = (run) =>
  run ? Object.fromEntries(RUN_KEY_FIELDS.map((field) => [field, run[field]])) : null;

export function isNotificationForRun(runKey, run) {
  const currentRunKey = getNotificationRunKey(run);
  if (!runKey || !currentRunKey) return runKey === null && currentRunKey === null;
  return RUN_KEY_FIELDS.every((field) => runKey[field] === currentRunKey[field]);
}
