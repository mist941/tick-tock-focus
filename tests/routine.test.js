import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  CATCH_UP_GRACE_MS,
  ROUTINE_LIMITS,
  STAGE_KINDS,
  expandRoutine,
  getRunProgress,
  migrateLegacyPreset,
  normalizeRoutine,
  planCatchUp,
  toLegacyClocks,
  validateRoutine,
} from "../shared/routine.js";

const makeStepLabel = (position) => `Step ${position}`;

const stageBlock = (label, kind, durationSec) => ({ type: "stage", label, kind, durationSec });

const makeRoutine = (blocks, overrides = {}) => ({
  id: "routine-1",
  name: "Pomodoro",
  createdAt: 1000,
  updatedAt: 1000,
  schemaVersion: 2,
  blocks,
  ...overrides,
});

const pomodoro = makeRoutine([
  {
    type: "repeat",
    times: 3,
    stages: [
      { label: "Focus", kind: "focus", durationSec: 1500 },
      { label: "Break", kind: "break", durationSec: 300 },
    ],
  },
  stageBlock("Long break", "break", 900),
]);

const legacyPreset = {
  id: "legacy-1",
  name: "Work",
  createdAt: 500,
  clocks: [
    { position: 0, hours: 0, minutes: 25, seconds: 0 },
    { position: 1, hours: 0, minutes: 5, seconds: 0 },
    { position: 2, hours: 1, minutes: 2, seconds: 3 },
  ],
};

const errorCodes = (routine) => validateRoutine(routine).map((error) => error.code);

const repeatedStages = (count, durationSec = 60) =>
  Array.from({ length: count }, (_, index) => ({
    label: `Stage ${index + 1}`,
    kind: "custom",
    durationSec,
  }));

describe("expandRoutine", () => {
  test("expands repeats in order and keeps single stages", () => {
    assert.deepEqual(
      expandRoutine(pomodoro).map((stage) => stage.label),
      ["Focus", "Break", "Focus", "Break", "Focus", "Break", "Long break"]
    );
  });

  test("returns plain stage snapshots without block fields", () => {
    assert.deepEqual(expandRoutine(pomodoro).at(-1), {
      label: "Long break",
      kind: "break",
      durationSec: 900,
    });
  });

  test("returns copies that do not share objects with the routine", () => {
    const stages = expandRoutine(pomodoro);
    stages[0].durationSec = 1;
    assert.equal(stages[2].durationSec, 1500);
    assert.equal(pomodoro.blocks[0].stages[0].durationSec, 1500);
  });

  test("returns an empty list for a routine without blocks", () => {
    assert.deepEqual(expandRoutine({}), []);
    assert.deepEqual(expandRoutine(null), []);
  });
});

describe("validateRoutine", () => {
  test("accepts a valid routine", () => {
    assert.deepEqual(validateRoutine(pomodoro), []);
  });

  test("exports the stage kinds", () => {
    assert.deepEqual([...STAGE_KINDS], ["focus", "break", "custom"]);
  });

  test("requires a name of 1 to 50 characters", () => {
    assert.deepEqual(errorCodes({ ...pomodoro, name: "" }), ["nameMissing"]);
    assert.deepEqual(errorCodes({ ...pomodoro, name: "   " }), ["nameMissing"]);
    assert.deepEqual(errorCodes({ ...pomodoro, name: undefined }), ["nameMissing"]);
    assert.deepEqual(errorCodes({ ...pomodoro, name: "a" }), []);
    assert.deepEqual(errorCodes({ ...pomodoro, name: "n".repeat(50) }), []);
    assert.deepEqual(validateRoutine({ ...pomodoro, name: "n".repeat(51) }), [
      { code: "nameTooLong", path: "name", limit: 50 },
    ]);
  });

  test("requires a stage label of 1 to 30 characters", () => {
    const withLabel = (label) => makeRoutine([stageBlock(label, "focus", 60)]);
    assert.deepEqual(errorCodes(withLabel("")), ["labelMissing"]);
    assert.deepEqual(errorCodes(withLabel(" ")), ["labelMissing"]);
    assert.deepEqual(errorCodes(withLabel("l".repeat(30))), []);
    assert.deepEqual(validateRoutine(withLabel("l".repeat(31))), [
      { code: "labelTooLong", path: "blocks.0.label", limit: 30 },
    ]);
  });

  test("requires a known stage kind", () => {
    assert.deepEqual(errorCodes(makeRoutine([stageBlock("Rest", "nap", 60)])), [
      "kindInvalid",
    ]);
  });

  test("requires a whole-second stage duration from 30 s to 23:59:59", () => {
    const withDuration = (durationSec) => makeRoutine([stageBlock("Work", "focus", durationSec)]);
    assert.deepEqual(errorCodes(withDuration(29)), ["durationTooShort"]);
    assert.deepEqual(errorCodes(withDuration(30)), []);
    assert.deepEqual(errorCodes(withDuration(ROUTINE_LIMITS.stageMaxSec)), []);
    assert.equal(ROUTINE_LIMITS.stageMaxSec, 86_399);
    assert.deepEqual(errorCodes(withDuration(86_400)), ["durationTooLong"]);
    assert.deepEqual(errorCodes(withDuration(30.5)), ["durationInvalid"]);
    assert.deepEqual(errorCodes(withDuration("60")), ["durationInvalid"]);
  });

  test("requires a repeat count from 2 to 10", () => {
    const withTimes = (times) =>
      makeRoutine([{ type: "repeat", times, stages: repeatedStages(2) }]);
    assert.deepEqual(errorCodes(withTimes(1)), ["repeatTimesOutOfRange"]);
    assert.deepEqual(errorCodes(withTimes(2)), []);
    assert.deepEqual(errorCodes(withTimes(10)), []);
    assert.deepEqual(errorCodes(withTimes(11)), ["repeatTimesOutOfRange"]);
    assert.deepEqual(errorCodes(withTimes(2.5)), ["repeatTimesOutOfRange"]);
  });

  test("allows only stages inside a repeat", () => {
    assert.deepEqual(
      errorCodes(makeRoutine([{ type: "repeat", times: 2, stages: [] }])),
      ["repeatEmpty"]
    );
    assert.deepEqual(
      errorCodes(
        makeRoutine([
          {
            type: "repeat",
            times: 2,
            stages: [{ type: "repeat", times: 2, stages: repeatedStages(1) }],
          },
        ])
      ),
      ["nestedRepeat"]
    );
  });

  test("points errors inside a repeat at the stage", () => {
    const routine = makeRoutine([
      {
        type: "repeat",
        times: 2,
        stages: [
          { label: "Focus", kind: "focus", durationSec: 60 },
          { label: "", kind: "break", durationSec: 60 },
        ],
      },
    ]);
    assert.deepEqual(validateRoutine(routine), [
      { code: "labelMissing", path: "blocks.0.stages.1.label" },
    ]);
  });

  test("requires at least one block of a known type", () => {
    assert.deepEqual(errorCodes(makeRoutine([])), ["noStages"]);
    assert.deepEqual(errorCodes(makeRoutine(undefined)), ["noStages"]);
    assert.deepEqual(errorCodes(makeRoutine([{ type: "pause" }])), ["blockTypeInvalid"]);
    assert.deepEqual(errorCodes(null), ["routineInvalid"]);
  });

  test("allows at most 20 editor rows, counting stages inside repeats", () => {
    const singleStages = (count) =>
      Array.from({ length: count }, (_, index) => stageBlock(`Stage ${index + 1}`, "custom", 60));
    assert.deepEqual(errorCodes(makeRoutine(singleStages(20))), []);
    assert.deepEqual(errorCodes(makeRoutine(singleStages(21))), ["tooManyRows"]);
    assert.deepEqual(
      errorCodes(
        makeRoutine([
          { type: "repeat", times: 2, stages: repeatedStages(10) },
          ...singleStages(11),
        ])
      ),
      ["tooManyRows"]
    );
  });

  test("allows at most 50 stages after expansion", () => {
    const tenTimes = { type: "repeat", times: 10, stages: repeatedStages(5) };
    assert.deepEqual(errorCodes(makeRoutine([tenTimes])), []);
    assert.deepEqual(
      validateRoutine(makeRoutine([tenTimes, stageBlock("Extra", "custom", 60)])),
      [{ code: "tooManyStages", path: "blocks", limit: 50 }]
    );
  });

  test("a routine at every limit fits in one sync storage item", () => {
    const longLabel = "Ж".repeat(ROUTINE_LIMITS.labelMaxLength);
    const maxStage = { label: longLabel, kind: "custom", durationSec: ROUTINE_LIMITS.stageMaxSec };
    const routine = makeRoutine(
      [
        { type: "repeat", times: 3, stages: Array.from({ length: 15 }, () => ({ ...maxStage })) },
        ...Array.from({ length: 5 }, () => ({ type: "stage", ...maxStage })),
      ],
      {
        id: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
        name: "Ж".repeat(ROUTINE_LIMITS.nameMaxLength),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
    );
    assert.deepEqual(validateRoutine(routine), []);
    const storedRoutine = { ...routine, clocks: toLegacyClocks(expandRoutine(routine)) };
    assert.equal(storedRoutine.clocks.length, 50);

    const itemBytes = new TextEncoder().encode(`preset_${routine.id}${JSON.stringify(storedRoutine)}`)
      .length;
    assert.ok(itemBytes < 8192, `${itemBytes} bytes`);
  });
});

describe("toLegacyClocks", () => {
  test("splits durations into hours, minutes and seconds with positions", () => {
    assert.deepEqual(
      toLegacyClocks([
        { label: "A", kind: "custom", durationSec: 3661 },
        { label: "B", kind: "custom", durationSec: 30 },
        { label: "C", kind: "custom", durationSec: 86_399 },
      ]),
      [
        { position: 0, hours: 1, minutes: 1, seconds: 1 },
        { position: 1, hours: 0, minutes: 0, seconds: 30 },
        { position: 2, hours: 23, minutes: 59, seconds: 59 },
      ]
    );
  });

  test("round-trips 1.1 clocks through a migrated routine", () => {
    const routine = migrateLegacyPreset(legacyPreset, makeStepLabel);
    assert.deepEqual(toLegacyClocks(expandRoutine(routine)), legacyPreset.clocks);
  });

  test("round-trips a routine with repeats through 1.1 clocks", () => {
    const stages = expandRoutine(pomodoro);
    const legacyRoutine = migrateLegacyPreset(
      { id: "x", name: "x", createdAt: 0, clocks: toLegacyClocks(stages) },
      makeStepLabel
    );
    assert.deepEqual(
      expandRoutine(legacyRoutine).map((stage) => stage.durationSec),
      stages.map((stage) => stage.durationSec)
    );
  });
});

describe("migrateLegacyPreset", () => {
  test("turns every clock into a custom stage with a generated label", () => {
    assert.deepEqual(migrateLegacyPreset(legacyPreset, makeStepLabel), {
      id: "legacy-1",
      name: "Work",
      createdAt: 500,
      updatedAt: 500,
      schemaVersion: 2,
      blocks: [
        { type: "stage", label: "Step 1", kind: "custom", durationSec: 1500 },
        { type: "stage", label: "Step 2", kind: "custom", durationSec: 300 },
        { type: "stage", label: "Step 3", kind: "custom", durationSec: 3723 },
      ],
      clocks: legacyPreset.clocks,
    });
  });

  test("passes the 1-based position to the label function", () => {
    const routine = migrateLegacyPreset(legacyPreset, (position) => `#${position}`);
    assert.deepEqual(
      routine.blocks.map((block) => block.label),
      ["#1", "#2", "#3"]
    );
  });

  test("keeps 1.0 presets with short, empty or partial clocks", () => {
    const routine = migrateLegacyPreset(
      {
        id: "old",
        name: "Old",
        clocks: [{ hours: 0, minutes: 0, seconds: 0 }, { minutes: 1 }, { seconds: 10 }],
      },
      makeStepLabel
    );
    assert.deepEqual(
      routine.blocks.map((block) => block.durationSec),
      [0, 60, 10]
    );
    assert.equal(routine.createdAt, null);
    assert.equal(routine.updatedAt, null);
  });

  test("does not modify the stored preset", () => {
    const stored = structuredClone(legacyPreset);
    const routine = migrateLegacyPreset(stored, makeStepLabel);
    routine.clocks[0].minutes = 99;
    assert.deepEqual(stored, legacyPreset);
  });
});

describe("normalizeRoutine", () => {
  test("returns v2 routines unchanged", () => {
    assert.equal(normalizeRoutine(pomodoro, makeStepLabel), pomodoro);
  });

  test("migrates 1.1 presets", () => {
    assert.deepEqual(
      normalizeRoutine(legacyPreset, makeStepLabel),
      migrateLegacyPreset(legacyPreset, makeStepLabel)
    );
  });

  test("returns null for values that are neither", () => {
    for (const storedObject of [
      null,
      undefined,
      "preset",
      [],
      { id: "x", name: "No clocks" },
      { ...pomodoro, schemaVersion: 3 },
      { ...pomodoro, blocks: undefined },
    ]) {
      assert.equal(normalizeRoutine(storedObject, makeStepLabel), null);
    }
  });
});

describe("planCatchUp", () => {
  const startedAt = 1_000_000;
  const minute = 60_000;
  const auto = { autoAdvance: true, graceMs: CATCH_UP_GRACE_MS };
  const wait = { autoAdvance: false, graceMs: CATCH_UP_GRACE_MS };

  const makeRun = (overrides = {}) => ({
    schemaVersion: 2,
    status: "running",
    routineId: "routine-1",
    routineName: "Three minutes",
    stages: [
      { label: "A", kind: "focus", durationSec: 60 },
      { label: "B", kind: "break", durationSec: 60 },
      { label: "C", kind: "focus", durationSec: 60 },
    ],
    stageIndex: 0,
    stageEndsAt: startedAt + minute,
    startedAt,
    ...overrides,
  });

  test("leaves a stage that has not ended alone", () => {
    const run = makeRun();
    assert.deepEqual(planCatchUp(run, startedAt + minute - 1, auto), {
      run,
      notification: null,
    });
  });

  test("starts the next stage from the scheduled end, not from now", () => {
    const onTime = planCatchUp(makeRun(), startedAt + minute, auto);
    assert.deepEqual(onTime, {
      run: makeRun({ stageIndex: 1, stageEndsAt: startedAt + 2 * minute }),
      notification: { type: "stageDone", stageIndex: 0 },
    });

    const late = planCatchUp(makeRun(), startedAt + minute + 30_000, auto);
    assert.equal(late.run.stageEndsAt, startedAt + 2 * minute);
    assert.deepEqual(late.notification, { type: "stageDone", stageIndex: 0 });
  });

  test("auto mode: catches up silently to the stage running now", () => {
    assert.deepEqual(planCatchUp(makeRun(), startedAt + 2.5 * minute, auto), {
      run: makeRun({ stageIndex: 2, stageEndsAt: startedAt + 3 * minute }),
      notification: { type: "caughtUp" },
    });
  });

  test("auto mode: several boundaries within the grace period give one stage notification", () => {
    const run = makeRun({
      stages: [
        { label: "A", kind: "focus", durationSec: 60 },
        { label: "Zero", kind: "custom", durationSec: 0 },
        { label: "C", kind: "focus", durationSec: 60 },
      ],
    });
    const plan = planCatchUp(run, startedAt + minute + 10_000, auto);
    assert.equal(plan.run.stageIndex, 2);
    assert.equal(plan.run.stageEndsAt, startedAt + 2 * minute);
    assert.deepEqual(plan.notification, { type: "stageDone", stageIndex: 1 });
  });

  test("auto mode: past the end gives one late finish at the scheduled end", () => {
    assert.deepEqual(planCatchUp(makeRun(), startedAt + 8 * minute, auto), {
      run: null,
      notification: { type: "lateFinish", finishedAt: startedAt + 3 * minute },
    });
  });

  test("completes normally when the last stage ended within the grace period", () => {
    const lastStage = makeRun({ stageIndex: 2, stageEndsAt: startedAt + 3 * minute });
    assert.deepEqual(planCatchUp(lastStage, startedAt + 3 * minute + 5_000, auto), {
      run: null,
      notification: { type: "routineComplete" },
    });

    assert.deepEqual(planCatchUp(makeRun(), startedAt + 3 * minute + 10_000, auto), {
      run: null,
      notification: { type: "routineComplete" },
    });
  });

  test("wait mode: stops after the stage that ended and waits for the next one", () => {
    const { stageEndsAt, ...runWithoutEnd } = makeRun();
    const expected = {
      run: { ...runWithoutEnd, status: "awaitingNext", stageIndex: 1 },
      notification: { type: "stageDone", stageIndex: 0 },
    };
    assert.deepEqual(planCatchUp(makeRun(), startedAt + minute, wait), expected);
    assert.deepEqual(planCatchUp(makeRun(), startedAt + 10 * minute, wait), expected);
  });

  test("wait mode: the last stage still completes the routine", () => {
    const lastStage = makeRun({ stageIndex: 2, stageEndsAt: startedAt + 3 * minute });
    assert.deepEqual(planCatchUp(lastStage, startedAt + 3 * minute, wait).notification, {
      type: "routineComplete",
    });
    assert.deepEqual(planCatchUp(lastStage, startedAt + 10 * minute, wait), {
      run: null,
      notification: { type: "lateFinish", finishedAt: startedAt + 3 * minute },
    });
  });

  test("paused and waiting runs do not move", () => {
    const paused = makeRun({ status: "paused", stageEndsAt: undefined, remainingMs: 30_000 });
    const awaiting = makeRun({ status: "awaitingNext", stageEndsAt: undefined, stageIndex: 1 });
    for (const run of [paused, awaiting]) {
      assert.deepEqual(planCatchUp(run, startedAt + 60 * minute, auto), {
        run,
        notification: null,
      });
    }
    assert.deepEqual(planCatchUp(null, startedAt, auto), { run: null, notification: null });
  });

  test("a boundary exactly 60 s late is still a normal transition", () => {
    const boundary = startedAt + minute;
    const run = makeRun({
      stages: [
        { label: "A", kind: "focus", durationSec: 60 },
        { label: "B", kind: "break", durationSec: 300 },
        { label: "C", kind: "focus", durationSec: 60 },
      ],
    });
    assert.deepEqual(planCatchUp(run, boundary + 60_000, auto).notification, {
      type: "stageDone",
      stageIndex: 0,
    });
    assert.deepEqual(planCatchUp(run, boundary + 60_001, auto).notification, {
      type: "caughtUp",
    });
  });

  test("a routine that ended exactly 60 s ago still completes normally", () => {
    const end = startedAt + 3 * minute;
    const lastStage = makeRun({ stageIndex: 2, stageEndsAt: end });
    assert.deepEqual(planCatchUp(lastStage, end + 60_000, auto).notification, {
      type: "routineComplete",
    });
    assert.deepEqual(planCatchUp(lastStage, end + 60_001, auto).notification, {
      type: "lateFinish",
      finishedAt: end,
    });
  });

  test("does not modify the run it is given", () => {
    const run = makeRun();
    const snapshot = structuredClone(run);
    planCatchUp(run, startedAt + 2.5 * minute, auto);
    planCatchUp(run, startedAt + minute, wait);
    assert.deepEqual(run, snapshot);
  });
});

describe("getRunProgress", () => {
  const stages = [
    { label: "A", kind: "focus", durationSec: 60 },
    { label: "B", kind: "break", durationSec: 120 },
    { label: "C", kind: "focus", durationSec: 180 },
  ];
  const now = 2_000_000;

  test("running: time left in the stage and in the routine", () => {
    const run = { status: "running", stages, stageIndex: 1, stageEndsAt: now + 45_000 };
    assert.deepEqual(getRunProgress(run, now), {
      stageRemainingMs: 45_000,
      routineRemainingMs: 225_000,
      routineDurationMs: 360_000,
    });
  });

  test("running: never below zero or above the stage length", () => {
    const ended = { status: "running", stages, stageIndex: 2, stageEndsAt: now - 5_000 };
    assert.equal(getRunProgress(ended, now).stageRemainingMs, 0);
    const skewed = { status: "running", stages, stageIndex: 0, stageEndsAt: now + 600_000 };
    assert.equal(getRunProgress(skewed, now).stageRemainingMs, 60_000);
  });

  test("paused: the stored time left", () => {
    const run = { status: "paused", stages, stageIndex: 0, remainingMs: 10_000 };
    assert.deepEqual(getRunProgress(run, now), {
      stageRemainingMs: 10_000,
      routineRemainingMs: 310_000,
      routineDurationMs: 360_000,
    });
  });

  test("waiting: the full length of the stage about to start", () => {
    const run = { status: "awaitingNext", stages, stageIndex: 1 };
    assert.deepEqual(getRunProgress(run, now), {
      stageRemainingMs: 120_000,
      routineRemainingMs: 300_000,
      routineDurationMs: 360_000,
    });
  });
});
