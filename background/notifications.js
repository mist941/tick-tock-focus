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
    };
  },

  routineComplete(notification, { previousRun }) {
    return {
      title: fillTemplate(NOTIFICATION_TEXTS.routineCompleteTitle, {
        routineName: previousRun.routineName,
      }),
      message: describeCompletion(previousRun),
      requireInteraction: false,
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
    };
  },
};

export function buildNotification(notification, context) {
  return NOTIFICATION_BUILDERS[notification.type](notification, context);
}
