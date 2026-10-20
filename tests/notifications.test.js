import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  NOTIFICATION_ID,
  buildNotification,
  formatClockTime,
  formatSpokenDuration,
  getNotificationRunKey,
  isNotificationForRun,
} from "../background/notifications.js";

const afternoon = new Date(2026, 9, 15, 14, 5).getTime();
const morning = new Date(2026, 9, 15, 9, 30).getTime();

const stages = [
  { label: "Focus", kind: "focus", durationSec: 1500 },
  { label: "Break", kind: "break", durationSec: 300 },
  { label: "Focus", kind: "focus", durationSec: 1500 },
];

const run = (overrides = {}) => ({
  schemaVersion: 2,
  status: "running",
  routineId: "routine-1",
  routineName: "Pomodoro",
  stages,
  stageIndex: 0,
  stageEndsAt: afternoon,
  startedAt: afternoon - 1500 * 1000,
  ...overrides,
});

const waitingRun = (overrides = {}) => {
  const { stageEndsAt, ...waiting } = run({ status: "awaitingNext", stageIndex: 1 });
  return { ...waiting, ...overrides };
};

const pauseAndSkip = [
  { title: "Pause", command: { action: "pauseRoutine" } },
  { title: "Skip", command: { action: "skipStage" } },
];

const startBreakAndStop = [
  { title: "Start Break", command: { action: "startNextStage" } },
  { title: "Stop", command: { action: "stopRoutine" } },
];

describe("formatting", () => {
  test("uses one notification id so each one replaces the previous", () => {
    assert.equal(NOTIFICATION_ID, "stage");
  });

  test("formats durations with the non-zero units", () => {
    assert.equal(formatSpokenDuration(1500), "25 min");
    assert.equal(formatSpokenDuration(5400), "1 h 30 min");
    assert.equal(formatSpokenDuration(3600), "1 h");
    assert.equal(formatSpokenDuration(45), "45 s");
    assert.equal(formatSpokenDuration(3725), "1 h 2 min 5 s");
    assert.equal(formatSpokenDuration(0), "0 s");
  });

  test("formats the time in the 24-hour or 12-hour format", () => {
    assert.equal(formatClockTime(afternoon, "24h"), "14:05");
    assert.equal(formatClockTime(morning, "24h"), "09:30");
    assert.equal(formatClockTime(afternoon, undefined), "14:05");
    assert.equal(formatClockTime(afternoon, "12h"), "02:05 PM");
    assert.equal(formatClockTime(morning, "12h"), "09:30 AM");
    assert.equal(formatClockTime(new Date(2026, 9, 15, 0, 1).getTime(), "12h"), "12:01 AM");
    assert.equal(formatClockTime(new Date(2026, 9, 15, 12, 0).getTime(), "12h"), "12:00 PM");
  });

});

describe("buildNotification", () => {
  test("stage done in auto mode names the next stage and when it ends", () => {
    const nextRun = run({ stageIndex: 1, stageEndsAt: afternoon + 300 * 1000 });
    assert.deepEqual(
      buildNotification(
        { type: "stageDone", stageIndex: 0 },
        { previousRun: run(), nextRun, now: afternoon, timeFormat: "24h" }
      ),
      {
        title: "Focus done · 1 of 3",
        message: "Next: Break · 5 min, ends at 14:10",
        requireInteraction: false,
        buttons: pauseAndSkip,
      }
    );
    assert.equal(
      buildNotification(
        { type: "stageDone", stageIndex: 0 },
        { previousRun: run(), nextRun, now: afternoon, timeFormat: "12h" }
      ).message,
      "Next: Break · 5 min, ends at 02:10 PM"
    );
  });

  test("stage done in wait mode stays on screen", () => {
    assert.deepEqual(
      buildNotification(
        { type: "stageDone", stageIndex: 0 },
        { previousRun: run(), nextRun: waitingRun(), now: afternoon, timeFormat: "24h" }
      ),
      {
        title: "Focus done · 1 of 3",
        message: "Next: Break · 5 min",
        requireInteraction: true,
        buttons: startBreakAndStop,
      }
    );
  });

  test("a stage that ended long ago in wait mode says when it ended", () => {
    const context = { previousRun: run(), nextRun: waitingRun(), now: afternoon + 3_600_000 };
    const notification = { type: "lateStageDone", stageIndex: 0, endedAt: afternoon };
    assert.deepEqual(buildNotification(notification, { ...context, timeFormat: "24h" }), {
      title: "Focus done at 14:05",
      message: "Next: Break · 5 min",
      requireInteraction: true,
      buttons: startBreakAndStop,
    });
    assert.equal(
      buildNotification(notification, { ...context, timeFormat: "12h" }).title,
      "Focus done at 02:05 PM"
    );
  });

  test("routine complete counts the focus time", () => {
    assert.deepEqual(
      buildNotification(
        { type: "routineComplete" },
        { previousRun: run({ stageIndex: 2 }), nextRun: null, now: afternoon, timeFormat: "24h" }
      ),
      {
        title: "Pomodoro complete",
        message: "50 min of focus",
        requireInteraction: false,
        buttons: [
          {
            title: "Start again",
            command: { action: "startRoutine", routineId: "routine-1", replaceRunning: true },
          },
        ],
      }
    );
  });

  test("routine complete without focus stages gives the total time", () => {
    const customStages = stages.map((stage) => ({ ...stage, kind: "custom" }));
    assert.equal(
      buildNotification(
        { type: "routineComplete" },
        { previousRun: run({ stages: customStages }), nextRun: null, now: afternoon }
      ).message,
      "55 min in total"
    );
  });

  test("a finished 1.1 run has no routine to start again", () => {
    assert.deepEqual(
      buildNotification(
        { type: "routineComplete" },
        { previousRun: run({ routineId: null }), nextRun: null, now: afternoon }
      ).buttons,
      []
    );
  });

  test("late finish gives the scheduled finish time", () => {
    assert.deepEqual(
      buildNotification(
        { type: "lateFinish", finishedAt: afternoon },
        { previousRun: run(), nextRun: null, now: afternoon + 3_600_000, timeFormat: "12h" }
      ),
      {
        title: "Pomodoro finished at 02:05 PM",
        message: "50 min of focus",
        requireInteraction: false,
        buttons: [],
      }
    );
  });

  test("caught up names the current stage and the time left in it", () => {
    const nextRun = run({ stageIndex: 2, stageEndsAt: afternoon + 754_200 });
    assert.deepEqual(
      buildNotification(
        { type: "caughtUp" },
        { previousRun: run(), nextRun, now: afternoon, timeFormat: "24h" }
      ),
      {
        title: "Now: Focus · 3 of 3",
        message: "12 min 35 s left",
        requireInteraction: false,
        buttons: pauseAndSkip,
      }
    );
  });

  test("the start button names the stage about to start", () => {
    const deepWorkStages = [...stages.slice(0, 2), { label: "Deep work", kind: "focus", durationSec: 3000 }];
    const previousRun = run({ stages: deepWorkStages, stageIndex: 1 });
    const nextRun = waitingRun({ stages: deepWorkStages, stageIndex: 2 });
    assert.equal(
      buildNotification(
        { type: "stageDone", stageIndex: 1 },
        { previousRun, nextRun, now: afternoon, timeFormat: "24h" }
      ).buttons[0].title,
      "Start Deep work"
    );
  });
});

describe("matching a notification to the run", () => {
  test("a notification matches the run, stage and state it was shown for", () => {
    const runKey = getNotificationRunKey(run({ stageIndex: 1 }));
    assert.deepEqual(runKey, { startedAt: afternoon - 1500 * 1000, stageIndex: 1, status: "running" });
    assert.equal(isNotificationForRun(runKey, run({ stageIndex: 1 })), true);
  });

  test("it no longer matches after the stage, the state or the run changes", () => {
    const runKey = getNotificationRunKey(run({ stageIndex: 1 }));
    assert.equal(isNotificationForRun(runKey, run({ stageIndex: 2 })), false);
    assert.equal(isNotificationForRun(runKey, run({ stageIndex: 1, status: "paused" })), false);
    assert.equal(isNotificationForRun(runKey, run({ stageIndex: 1, startedAt: afternoon })), false);
    assert.equal(isNotificationForRun(runKey, null), false);
  });

  test("a notification shown without a run matches only while nothing runs", () => {
    assert.equal(getNotificationRunKey(null), null);
    assert.equal(isNotificationForRun(null, null), true);
    assert.equal(isNotificationForRun(null, run()), false);
    assert.equal(isNotificationForRun(undefined, null), false);
  });
});
