export const NOTIFICATION_ID = "stage";

export const NOTIFICATION_TEXTS = Object.freeze({
  stageDoneTitle: "{label} done · {n} of {total}",
  stageDoneAutoMessage: "Next: {nextLabel} · {duration}, ends at {time}",
  stageDoneWaitMessage: "Next: {nextLabel} · {duration}",
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

export function fillTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (placeholder, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder
  );
}

export function formatSpokenDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    [hours, NOTIFICATION_TEXTS.hours],
    [minutes, NOTIFICATION_TEXTS.minutes],
    [seconds, NOTIFICATION_TEXTS.seconds],
  ]
    .filter(([count]) => count > 0)
    .map(([count, template]) => fillTemplate(template, { count }));
  return parts.length > 0 ? parts.join(" ") : fillTemplate(NOTIFICATION_TEXTS.seconds, { count: 0 });
}

export function formatClockTime(timestamp, timeFormat) {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  if (timeFormat !== "12h") return `${String(hours).padStart(2, "0")}:${minutes}`;

  const suffix = hours >= 12 ? NOTIFICATION_TEXTS.afterNoon : NOTIFICATION_TEXTS.beforeNoon;
  return `${String(hours % 12 || 12).padStart(2, "0")}:${minutes} ${suffix}`;
}

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

const NOTIFICATION_BUILDERS = {
  stageDone(notification, { previousRun, nextRun, timeFormat }) {
    const completedStage = previousRun.stages[notification.stageIndex];
    const nextStage = nextRun.stages[nextRun.stageIndex];
    const isWaiting = nextRun.status === "awaitingNext";
    const values = {
      label: completedStage.label,
      ...stagePosition(previousRun, notification.stageIndex),
      nextLabel: nextStage.label,
      duration: formatSpokenDuration(nextStage.durationSec),
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
