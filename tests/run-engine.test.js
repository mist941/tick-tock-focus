import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { EXTENDED_STAGE_MAX_SEC } from "../shared/routine.js";
import {
  createRun,
  extendCurrentStage,
  migrateLegacyRun,
  pauseRun,
  resumeRun,
  skipCurrentStage,
  startAwaitedStage,
} from "../background/run-engine.js";

const makeStepLabel = (position) => `Step ${position}`;
const now = 5_000_000;
const minute = 60_000;

const stages = [
  { label: "Focus", kind: "focus", durationSec: 1500 },
  { label: "Break", kind: "break", durationSec: 300 },
  { label: "Wrap up", kind: "custom", durationSec: 600 },
];

const runningRun = (overrides = {}) => ({
  schemaVersion: 2,
  status: "running",
  routineId: "routine-1",
  routineName: "Pomodoro",
  stages,
  stageIndex: 0,
  stageEndsAt: now + 10 * minute,
  startedAt: now - 15 * minute,
  ...overrides,
});

const pausedRun = (overrides = {}) => {
  const { stageEndsAt, ...run } = runningRun();
  return { ...run, status: "paused", remainingMs: 4 * minute, ...overrides };
};

const awaitingRun = (overrides = {}) => {
  const { stageEndsAt, ...run } = runningRun();
  return { ...run, status: "awaitingNext", stageIndex: 1, ...overrides };
};

describe("createRun", () => {
  test("starts the first stage now with a snapshot of the stages", () => {
    assert.deepEqual(createRun({ id: "routine-1", name: "Pomodoro" }, stages, now), {
      schemaVersion: 2,
      status: "running",
      routineId: "routine-1",
      routineName: "Pomodoro",
      stages,
      stageIndex: 0,
      stageEndsAt: now + 1500 * 1000,
      startedAt: now,
    });
  });
});

describe("pauseRun and resumeRun", () => {
  test("pause keeps the time left in the stage", () => {
    const { stageEndsAt, ...run } = runningRun();
    assert.deepEqual(pauseRun(runningRun(), now), {
      ...run,
      status: "paused",
      remainingMs: 10 * minute,
    });
  });

  test("resume schedules the stage end from now", () => {
    const { remainingMs, ...run } = pausedRun();
    assert.deepEqual(resumeRun(pausedRun(), now), {
      ...run,
      status: "running",
      stageEndsAt: now + 4 * minute,
    });
  });

  test("are ignored in states where they are not allowed", () => {
    for (const run of [pausedRun(), awaitingRun(), null]) {
      assert.equal(pauseRun(run, now), run);
    }
    for (const run of [runningRun(), awaitingRun(), null]) {
      assert.equal(resumeRun(run, now), run);
    }
  });
});

describe("skipCurrentStage", () => {
  test("starts the next stage now from a running or paused stage", () => {
    for (const run of [runningRun(), pausedRun()]) {
      const skipped = skipCurrentStage(run, now);
      assert.equal(skipped.status, "running");
      assert.equal(skipped.stageIndex, 1);
      assert.equal(skipped.stageEndsAt, now + 300 * 1000);
      assert.equal("remainingMs" in skipped, false);
    }
  });

  test("skips the stage that was about to start when waiting", () => {
    const skipped = skipCurrentStage(awaitingRun(), now);
    assert.equal(skipped.status, "running");
    assert.equal(skipped.stageIndex, 2);
    assert.equal(skipped.stageEndsAt, now + 600 * 1000);
  });

  test("ends the run past the last stage", () => {
    assert.equal(skipCurrentStage(runningRun({ stageIndex: 2 }), now), null);
    assert.equal(skipCurrentStage(awaitingRun({ stageIndex: 2 }), now), null);
  });

  test("is ignored without a run", () => {
    assert.equal(skipCurrentStage(null, now), null);
  });
});

describe("extendCurrentStage", () => {
  test("adds minutes to a running stage and its end time", () => {
    const extended = extendCurrentStage(runningRun(), 5);
    assert.equal(extended.stageEndsAt, now + 15 * minute);
    assert.equal(extended.stages[0].durationSec, 1800);
    assert.equal(extended.stages[1].durationSec, 300);
    assert.equal(stages[0].durationSec, 1500);
  });

  test("adds minutes to the time left in a paused stage", () => {
    const extended = extendCurrentStage(pausedRun(), 5);
    assert.equal(extended.remainingMs, 9 * minute);
    assert.equal(extended.stages[0].durationSec, 1800);
  });

  test("caps a stage at 24 hours", () => {
    const longStages = [{ label: "Long", kind: "focus", durationSec: EXTENDED_STAGE_MAX_SEC - 120 }];
    const extended = extendCurrentStage(runningRun({ stages: longStages }), 5);
    assert.equal(extended.stages[0].durationSec, EXTENDED_STAGE_MAX_SEC);
    assert.equal(extended.stageEndsAt, now + 10 * minute + 120_000);

    const atCap = runningRun({ stages: extended.stages });
    assert.equal(extendCurrentStage(atCap, 5), atCap);
  });

  test("is ignored when waiting, without a run, or with an invalid amount", () => {
    for (const run of [awaitingRun(), null]) {
      assert.equal(extendCurrentStage(run, 5), run);
    }
    const run = runningRun();
    for (const minutes of [0, -5, 2.5, "5", undefined]) {
      assert.equal(extendCurrentStage(run, minutes), run);
    }
  });
});

describe("startAwaitedStage", () => {
  test("starts the waiting stage now", () => {
    assert.deepEqual(startAwaitedStage(awaitingRun(), now), {
      ...awaitingRun(),
      status: "running",
      stageEndsAt: now + 300 * 1000,
    });
  });

  test("is ignored in other states", () => {
    for (const run of [runningRun(), pausedRun(), null]) {
      assert.equal(startAwaitedStage(run, now), run);
    }
  });
});

describe("migrateLegacyRun", () => {
  const legacyClocks = [
    { position: 0, hours: 0, minutes: 1, seconds: 0 },
    { position: 1, hours: 0, minutes: 1, seconds: 0 },
    { position: 2, hours: 0, minutes: 2, seconds: 0 },
  ];
  const legacyState = (overrides = {}) => ({
    isRunning: true,
    endTime: now + 2 * minute,
    totalDuration: 4 * minute,
    presetName: "Legacy",
    clocks: legacyClocks,
    ...overrides,
  });

  test("puts the run on the stage that is running now", () => {
    assert.deepEqual(migrateLegacyRun(legacyState(), now + 10_000, makeStepLabel), {
      schemaVersion: 2,
      status: "running",
      routineId: null,
      routineName: "Legacy",
      stages: [
        { label: "Step 1", kind: "custom", durationSec: 60 },
        { label: "Step 2", kind: "custom", durationSec: 60 },
        { label: "Step 3", kind: "custom", durationSec: 120 },
      ],
      stageIndex: 2,
      stageEndsAt: now + 2 * minute,
      startedAt: now - 2 * minute,
    });
  });

  test("counts a boundary that is exactly now as passed", () => {
    const run = migrateLegacyRun(legacyState(), now - minute, makeStepLabel);
    assert.equal(run.stageIndex, 1);
    assert.equal(run.stageEndsAt, now);
  });

  test("leaves a run that already ended on its last stage, ending at the old end time", () => {
    const run = migrateLegacyRun(legacyState(), now + 10 * minute, makeStepLabel);
    assert.equal(run.stageIndex, 2);
    assert.equal(run.stageEndsAt, now + 2 * minute);
  });

  test("returns null for the reset state 1.1 leaves after a stop", () => {
    const resetState = {
      isRunning: false,
      endTime: null,
      totalDuration: null,
      presetName: null,
      clocks: null,
    };
    assert.equal(migrateLegacyRun(resetState, now, makeStepLabel), null);
    assert.equal(migrateLegacyRun({}, now, makeStepLabel), null);
    assert.equal(migrateLegacyRun(legacyState({ clocks: [] }), now, makeStepLabel), null);
  });
});
