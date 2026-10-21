import { formatDuration, formatTime, translate } from "../shared/i18n.js";

export const NOTIFICATION_ID = "stage";

const sumDurationSec = (stages) => stages.reduce((totalSec, stage) => totalSec + stage.durationSec, 0);

function describeCompletion(run) {
  const focusSec = sumDurationSec(run.stages.filter((stage) => stage.kind === "focus"));
  return focusSec > 0
    ? translate("notificationFocusTotalMessage", { focusTotal: formatDuration(focusSec) })
    : translate("notificationTotalDurationMessage", {
        totalDuration: formatDuration(sumDurationSec(run.stages)),
      });
}

const stagePosition = (run, stageIndex) => ({ n: stageIndex + 1, total: run.stages.length });

function describeUpcomingStage(run) {
  const upcomingStage = run.stages[run.stageIndex];
  return {
    nextLabel: upcomingStage.label,
    duration: formatDuration(upcomingStage.durationSec),
  };
}

const pauseAndSkipButtons = () => [
  { title: translate("notificationPauseButton"), command: { action: "pauseRoutine" } },
  { title: translate("notificationSkipButton"), command: { action: "skipStage" } },
];

const startAwaitedStageAndStopButtons = (run) => [
  {
    title: translate("notificationStartStageButton", { label: run.stages[run.stageIndex].label }),
    command: { action: "startNextStage" },
  },
  { title: translate("notificationStopButton"), command: { action: "stopRoutine" } },
];

const startAgainButtons = (run) =>
  run.routineId
    ? [
        {
          title: translate("notificationStartAgainButton"),
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
      title: translate("notificationStageDoneTitle", values),
      message: isWaiting
        ? translate("notificationStageDoneWaitMessage", values)
        : translate("notificationStageDoneAutoMessage", {
            ...values,
            time: formatTime(nextRun.stageEndsAt, timeFormat),
          }),
      requireInteraction: isWaiting,
      buttons: isWaiting ? startAwaitedStageAndStopButtons(nextRun) : pauseAndSkipButtons(),
    };
  },

  lateStageDone(notification, { previousRun, nextRun, timeFormat }) {
    return {
      title: translate("notificationLateStageDoneTitle", {
        label: previousRun.stages[notification.stageIndex].label,
        time: formatTime(notification.endedAt, timeFormat),
      }),
      message: translate("notificationStageDoneWaitMessage", describeUpcomingStage(nextRun)),
      requireInteraction: true,
      buttons: startAwaitedStageAndStopButtons(nextRun),
    };
  },

  routineComplete(notification, { previousRun }) {
    return {
      title: translate("notificationRoutineCompleteTitle", { routineName: previousRun.routineName }),
      message: describeCompletion(previousRun),
      requireInteraction: false,
      buttons: startAgainButtons(previousRun),
    };
  },

  lateFinish(notification, { previousRun, timeFormat }) {
    return {
      title: translate("notificationLateFinishTitle", {
        routineName: previousRun.routineName,
        time: formatTime(notification.finishedAt, timeFormat),
      }),
      message: describeCompletion(previousRun),
      requireInteraction: false,
      buttons: [],
    };
  },

  caughtUp(notification, { nextRun, now }) {
    const currentStage = nextRun.stages[nextRun.stageIndex];
    return {
      title: translate("notificationCaughtUpTitle", {
        label: currentStage.label,
        ...stagePosition(nextRun, nextRun.stageIndex),
      }),
      message: translate("notificationCaughtUpMessage", {
        remaining: formatDuration(Math.ceil((nextRun.stageEndsAt - now) / 1000)),
      }),
      requireInteraction: false,
      buttons: pauseAndSkipButtons(),
    };
  },
};

export function buildNotification(notification, context) {
  return NOTIFICATION_BUILDERS[notification.type](notification, context);
}

const NOTIFICATION_TYPES_WITH_SOUND = new Set(["stageDone", "routineComplete"]);

export const playsSound = (notification) => NOTIFICATION_TYPES_WITH_SOUND.has(notification.type);

const RUN_KEY_FIELDS = ["startedAt", "stageIndex", "status"];

export const getNotificationRunKey = (run) =>
  run ? Object.fromEntries(RUN_KEY_FIELDS.map((field) => [field, run[field]])) : null;

export function isNotificationForRun(runKey, run) {
  const currentRunKey = getNotificationRunKey(run);
  if (!runKey || !currentRunKey) return runKey === null && currentRunKey === null;
  return RUN_KEY_FIELDS.every((field) => runKey[field] === currentRunKey[field]);
}
