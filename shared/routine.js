export const ROUTINE_SCHEMA_VERSION = 2;

export const STAGE_KINDS = Object.freeze(["focus", "break", "custom"]);

export const ROUTINE_LIMITS = Object.freeze({
  nameMaxLength: 50,
  labelMaxLength: 30,
  stageMinSec: 30,
  stageMaxSec: 23 * 3600 + 59 * 60 + 59,
  repeatMinTimes: 2,
  repeatMaxTimes: 10,
  maxEditorRows: 20,
  maxExpandedStages: 50,
});

export const CATCH_UP_GRACE_MS = 60_000;

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const getStageDurationMs = (stage) => stage.durationSec * 1000;

export const getStagesDurationMs = (stages) =>
  stages.reduce((totalMs, stage) => totalMs + getStageDurationMs(stage), 0);

function validateName(name, errors) {
  if (typeof name !== "string" || name.trim() === "") {
    errors.push({ code: "nameMissing", path: "name" });
  } else if (name.length > ROUTINE_LIMITS.nameMaxLength) {
    errors.push({ code: "nameTooLong", path: "name", limit: ROUTINE_LIMITS.nameMaxLength });
  }
}

function validateStage(stage, path, errors) {
  const { labelMaxLength, stageMinSec, stageMaxSec } = ROUTINE_LIMITS;

  if (typeof stage.label !== "string" || stage.label.trim() === "") {
    errors.push({ code: "labelMissing", path: `${path}.label` });
  } else if (stage.label.length > labelMaxLength) {
    errors.push({ code: "labelTooLong", path: `${path}.label`, limit: labelMaxLength });
  }

  if (!STAGE_KINDS.includes(stage.kind)) {
    errors.push({ code: "kindInvalid", path: `${path}.kind` });
  }

  if (!Number.isInteger(stage.durationSec)) {
    errors.push({ code: "durationInvalid", path: `${path}.durationSec` });
  } else if (stage.durationSec < stageMinSec) {
    errors.push({ code: "durationTooShort", path: `${path}.durationSec`, limit: stageMinSec });
  } else if (stage.durationSec > stageMaxSec) {
    errors.push({ code: "durationTooLong", path: `${path}.durationSec`, limit: stageMaxSec });
  }
}

function validateRepeat(repeat, path, errors) {
  const { repeatMinTimes, repeatMaxTimes } = ROUTINE_LIMITS;

  if (
    !Number.isInteger(repeat.times) ||
    repeat.times < repeatMinTimes ||
    repeat.times > repeatMaxTimes
  ) {
    errors.push({
      code: "repeatTimesOutOfRange",
      path: `${path}.times`,
      limit: { min: repeatMinTimes, max: repeatMaxTimes },
    });
  }

  if (!Array.isArray(repeat.stages) || repeat.stages.length === 0) {
    errors.push({ code: "repeatEmpty", path: `${path}.stages` });
    return;
  }

  repeat.stages.forEach((stage, stageIndex) => {
    const stagePath = `${path}.stages.${stageIndex}`;
    if (!isPlainObject(stage)) {
      errors.push({ code: "blockTypeInvalid", path: stagePath });
    } else if (stage.type === "repeat") {
      errors.push({ code: "nestedRepeat", path: stagePath });
    } else if (stage.type !== undefined && stage.type !== "stage") {
      errors.push({ code: "blockTypeInvalid", path: stagePath });
    } else {
      validateStage(stage, stagePath, errors);
    }
  });
}

function countRows(blocks) {
  let editorRows = 0;
  let expandedStages = 0;
  for (const block of blocks) {
    if (!isPlainObject(block)) continue;
    if (block.type === "repeat") {
      const stageCount = Array.isArray(block.stages) ? block.stages.length : 0;
      const times = Number.isInteger(block.times) && block.times > 0 ? block.times : 1;
      editorRows += stageCount;
      expandedStages += stageCount * times;
    } else {
      editorRows += 1;
      expandedStages += 1;
    }
  }
  return { editorRows, expandedStages };
}

export function validateRoutine(routine) {
  const errors = [];
  if (!isPlainObject(routine)) {
    return [{ code: "routineInvalid", path: "" }];
  }

  validateName(routine.name, errors);

  if (!Array.isArray(routine.blocks) || routine.blocks.length === 0) {
    errors.push({ code: "noStages", path: "blocks" });
    return errors;
  }

  routine.blocks.forEach((block, blockIndex) => {
    const blockPath = `blocks.${blockIndex}`;
    if (!isPlainObject(block)) {
      errors.push({ code: "blockTypeInvalid", path: blockPath });
    } else if (block.type === "repeat") {
      validateRepeat(block, blockPath, errors);
    } else if (block.type === "stage") {
      validateStage(block, blockPath, errors);
    } else {
      errors.push({ code: "blockTypeInvalid", path: blockPath });
    }
  });

  const { editorRows, expandedStages } = countRows(routine.blocks);
  if (editorRows > ROUTINE_LIMITS.maxEditorRows) {
    errors.push({ code: "tooManyRows", path: "blocks", limit: ROUTINE_LIMITS.maxEditorRows });
  }
  if (expandedStages > ROUTINE_LIMITS.maxExpandedStages) {
    errors.push({
      code: "tooManyStages",
      path: "blocks",
      limit: ROUTINE_LIMITS.maxExpandedStages,
    });
  }
  return errors;
}

const toStageSnapshot = ({ label, kind, durationSec }) => ({ label, kind, durationSec });

export function expandRoutine(routine) {
  const blocks = Array.isArray(routine?.blocks) ? routine.blocks : [];
  return blocks.flatMap((block) => {
    if (block.type !== "repeat") return [toStageSnapshot(block)];
    const repeatedStages = (block.stages ?? []).map(toStageSnapshot);
    const times = Number.isInteger(block.times) && block.times > 0 ? block.times : 0;
    return Array.from({ length: times }, () => repeatedStages.map((stage) => ({ ...stage }))).flat();
  });
}

export function toLegacyClocks(stages) {
  return stages.map((stage, position) => ({
    position,
    hours: Math.floor(stage.durationSec / 3600),
    minutes: Math.floor((stage.durationSec % 3600) / 60),
    seconds: stage.durationSec % 60,
  }));
}

function getLegacyClockDurationSec(clock) {
  const totalSeconds =
    (Number(clock?.hours) || 0) * 3600 +
    (Number(clock?.minutes) || 0) * 60 +
    (Number(clock?.seconds) || 0);
  return Math.max(0, Math.round(totalSeconds));
}

export function stagesFromLegacyClocks(clocks, makeStageLabel) {
  return clocks.map((clock, index) => ({
    label: makeStageLabel(index + 1),
    kind: "custom",
    durationSec: getLegacyClockDurationSec(clock),
  }));
}

export function isLegacyPreset(storedObject) {
  return (
    isPlainObject(storedObject) &&
    storedObject.schemaVersion === undefined &&
    Array.isArray(storedObject.clocks)
  );
}

export function migrateLegacyPreset(preset, makeStageLabel) {
  const createdAt = preset.createdAt ?? null;
  return {
    id: preset.id,
    name: preset.name,
    createdAt,
    updatedAt: preset.updatedAt ?? createdAt,
    schemaVersion: ROUTINE_SCHEMA_VERSION,
    blocks: stagesFromLegacyClocks(preset.clocks, makeStageLabel).map((stage) => ({
      type: "stage",
      ...stage,
    })),
    clocks: preset.clocks.map((clock) => ({ ...clock })),
  };
}

export function normalizeRoutine(storedObject, makeStageLabel) {
  if (isLegacyPreset(storedObject)) {
    return migrateLegacyPreset(storedObject, makeStageLabel);
  }
  if (
    isPlainObject(storedObject) &&
    storedObject.schemaVersion === ROUTINE_SCHEMA_VERSION &&
    Array.isArray(storedObject.blocks)
  ) {
    return storedObject;
  }
  return null;
}

function toAwaitingRun(run, nextStageIndex) {
  const { stageEndsAt, remainingMs, ...runWithoutTiming } = run;
  return { ...runWithoutTiming, status: "awaitingNext", stageIndex: nextStageIndex };
}

export function planCatchUp(run, now, { autoAdvance, graceMs }) {
  if (!run || run.status !== "running" || now < run.stageEndsAt) {
    return { run, notification: null };
  }

  const lastStageIndex = run.stages.length - 1;
  const firstMissedEndMs = now - run.stageEndsAt;
  let completedStageIndex = run.stageIndex;
  let completedAt = run.stageEndsAt;

  while (autoAdvance && completedStageIndex < lastStageIndex) {
    const nextStageEndsAt =
      completedAt + getStageDurationMs(run.stages[completedStageIndex + 1]);
    if (nextStageEndsAt > now) break;
    completedStageIndex += 1;
    completedAt = nextStageEndsAt;
  }

  if (completedStageIndex >= lastStageIndex) {
    const notification =
      now - completedAt <= graceMs
        ? { type: "routineComplete" }
        : { type: "lateFinish", finishedAt: completedAt };
    return { run: null, notification };
  }

  if (!autoAdvance) {
    return {
      run: toAwaitingRun(run, completedStageIndex + 1),
      notification: { type: "stageDone", stageIndex: completedStageIndex },
    };
  }

  const nextStageIndex = completedStageIndex + 1;
  const nextRun = {
    ...run,
    stageIndex: nextStageIndex,
    stageEndsAt: completedAt + getStageDurationMs(run.stages[nextStageIndex]),
  };
  const notification =
    firstMissedEndMs <= graceMs
      ? { type: "stageDone", stageIndex: completedStageIndex }
      : { type: "caughtUp" };
  return { run: nextRun, notification };
}


export function getRunProgress(run, now) {
  const currentStageMs = getStageDurationMs(run.stages[run.stageIndex]);
  const stageRemainingByStatus = {
    running: () => Math.min(currentStageMs, Math.max(0, run.stageEndsAt - now)),
    paused: () => run.remainingMs,
    awaitingNext: () => currentStageMs,
  };
  const stageRemainingMs = stageRemainingByStatus[run.status]();
  return {
    stageRemainingMs,
    routineRemainingMs:
      stageRemainingMs + getStagesDurationMs(run.stages.slice(run.stageIndex + 1)),
    routineDurationMs: getStagesDurationMs(run.stages),
  };
}
