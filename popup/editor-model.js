import { ROUTINE_LIMITS } from "../shared/routine.js";

export const DEFAULT_REPEAT_TIMES = 2;
export const NEW_REPEAT_GROUP_KINDS = Object.freeze(["focus", "break"]);
export const MAX_EDITOR_MINUTES = 1439;
export const MAX_EDITOR_SECONDS = 59;

const DEFAULT_DURATIONS_SEC = { focus: 25 * 60, break: 5 * 60, custom: 10 * 60 };

const splitDuration = (durationSec) => ({
  minutes: String(Math.floor(durationSec / 60)),
  seconds: String(durationSec % 60).padStart(2, "0"),
});

export const getStageDurationSec = (stage) =>
  (Number(stage.minutes) || 0) * 60 + (Number(stage.seconds) || 0);

function createKeyFactory(model) {
  let nextKeyNumber = model?.nextKeyNumber ?? 1;
  return {
    createKey: () => `item-${nextKeyNumber++}`,
    getNextKeyNumber: () => nextKeyNumber,
  };
}

function createStage(createKey, kind, kindLabels, durationSec = DEFAULT_DURATIONS_SEC[kind]) {
  return {
    key: createKey(),
    type: "stage",
    kind,
    label: kindLabels[kind],
    ...splitDuration(durationSec),
  };
}

export function createEditorModel(routine, { kindLabels }) {
  const keys = createKeyFactory(null);
  const toEditorStage = (stage) => ({
    key: keys.createKey(),
    type: "stage",
    kind: stage.kind,
    label: stage.label,
    ...splitDuration(stage.durationSec),
  });
  const blocks = routine
    ? routine.blocks.map((block) =>
        block.type === "repeat"
          ? {
              key: keys.createKey(),
              type: "repeat",
              times: block.times,
              stages: block.stages.map(toEditorStage),
            }
          : toEditorStage(block)
      )
    : [createStage(keys.createKey, "focus", kindLabels)];
  return { name: routine?.name ?? "", blocks, nextKeyNumber: keys.getNextKeyNumber() };
}

export function toRoutineBlocks(model) {
  const toRoutineStage = (stage) => ({
    label: stage.label.trim(),
    kind: stage.kind,
    durationSec: getStageDurationSec(stage),
  });
  return model.blocks.map((block) =>
    block.type === "repeat"
      ? { type: "repeat", times: block.times, stages: block.stages.map(toRoutineStage) }
      : { type: "stage", ...toRoutineStage(block) }
  );
}

export const describeModelContent = (model) =>
  JSON.stringify({ name: model.name.trim(), blocks: toRoutineBlocks(model) });

export function countEditorRows(model) {
  return model.blocks.reduce(
    (rowCount, block) => rowCount + (block.type === "repeat" ? block.stages.length : 1),
    0
  );
}

export function summarizeModel(model) {
  let expandedStageCount = 0;
  let totalDurationSec = 0;
  model.blocks.forEach((block) => {
    if (block.type === "repeat") {
      const groupDurationSec = block.stages.reduce(
        (sumSec, stage) => sumSec + getStageDurationSec(stage),
        0
      );
      expandedStageCount += block.stages.length * block.times;
      totalDurationSec += groupDurationSec * block.times;
    } else {
      expandedStageCount += 1;
      totalDurationSec += getStageDurationSec(block);
    }
  });
  return { expandedStageCount, totalDurationSec, editorRowCount: countEditorRows(model) };
}

export function listEditorItems(model) {
  const items = [];
  let stageNumber = 0;
  let groupNumber = 0;
  model.blocks.forEach((block, blockIndex) => {
    if (block.type === "repeat") {
      groupNumber += 1;
      items.push({ key: block.key, type: "repeat", blockIndex, stageIndex: null, groupNumber });
      block.stages.forEach((stage, stageIndex) => {
        stageNumber += 1;
        items.push({ key: stage.key, type: "stage", blockIndex, stageIndex, stageNumber, groupKey: block.key });
      });
    } else {
      stageNumber += 1;
      items.push({ key: block.key, type: "stage", blockIndex, stageIndex: null, stageNumber, groupKey: null });
    }
  });
  return items;
}

export function findItem(model, key) {
  return listEditorItems(model).find((item) => item.key === key) ?? null;
}

const cloneModel = (model) => structuredClone(model);

function pickNewStageKind(previousStage) {
  return previousStage?.kind === "focus" ? "break" : "focus";
}

export function addStage(model, { groupKey = null, kindLabels }) {
  const nextModel = cloneModel(model);
  const keys = createKeyFactory(nextModel);
  const container = groupKey
    ? nextModel.blocks.find((block) => block.key === groupKey)?.stages
    : nextModel.blocks;
  if (!container) return { model, addedKey: null };

  const previousStages = groupKey
    ? container
    : container.flatMap((block) => (block.type === "repeat" ? block.stages : [block]));
  const stage = createStage(keys.createKey, pickNewStageKind(previousStages.at(-1)), kindLabels);
  container.push(stage);
  nextModel.nextKeyNumber = keys.getNextKeyNumber();
  return { model: nextModel, addedKey: stage.key };
}

export function addRepeatGroup(model, { kindLabels }) {
  const nextModel = cloneModel(model);
  const keys = createKeyFactory(nextModel);
  const group = {
    key: keys.createKey(),
    type: "repeat",
    times: DEFAULT_REPEAT_TIMES,
    stages: NEW_REPEAT_GROUP_KINDS.map((kind) => createStage(keys.createKey, kind, kindLabels)),
  };
  nextModel.blocks.push(group);
  nextModel.nextKeyNumber = keys.getNextKeyNumber();
  return { model: nextModel, addedKey: group.key, addedStageKey: group.stages[0].key };
}

export const canAddRepeatGroup = (model) =>
  countEditorRows(model) + NEW_REPEAT_GROUP_KINDS.length <= ROUTINE_LIMITS.maxEditorRows;

export function removeItem(model, key) {
  const item = findItem(model, key);
  if (!item) return model;
  const nextModel = cloneModel(model);
  if (item.stageIndex === null) {
    nextModel.blocks.splice(item.blockIndex, 1);
  } else {
    nextModel.blocks[item.blockIndex].stages.splice(item.stageIndex, 1);
  }
  return nextModel;
}

export function updateName(model, name) {
  return { ...cloneModel(model), name };
}

export function updateStage(model, key, changes, { kindLabels }) {
  const item = findItem(model, key);
  if (!item || item.type !== "stage") return model;
  const nextModel = cloneModel(model);
  const stage =
    item.stageIndex === null
      ? nextModel.blocks[item.blockIndex]
      : nextModel.blocks[item.blockIndex].stages[item.stageIndex];
  if (changes.kind && changes.kind !== stage.kind && stage.label === kindLabels[stage.kind]) {
    stage.label = kindLabels[changes.kind];
  }
  Object.assign(stage, changes);
  return nextModel;
}

export function updateGroupTimes(model, key, times) {
  const nextModel = cloneModel(model);
  const group = nextModel.blocks.find((block) => block.key === key && block.type === "repeat");
  if (group) group.times = times;
  return nextModel;
}

function planMove(model, item, direction) {
  const step = direction === "up" ? -1 : 1;
  const lastBlockIndex = model.blocks.length - 1;

  if (item.type === "repeat" || item.stageIndex === null) {
    const neighbourIndex = item.blockIndex + step;
    if (neighbourIndex < 0 || neighbourIndex > lastBlockIndex) return null;
    const neighbour = model.blocks[neighbourIndex];
    if (item.type === "stage" && neighbour.type === "repeat") {
      return {
        groupKey: neighbour.key,
        index: direction === "up" ? neighbour.stages.length : 0,
      };
    }
    return { groupKey: null, index: neighbourIndex };
  }

  const group = model.blocks[item.blockIndex];
  const neighbourStageIndex = item.stageIndex + step;
  if (neighbourStageIndex >= 0 && neighbourStageIndex < group.stages.length) {
    return { groupKey: group.key, index: neighbourStageIndex };
  }
  return { groupKey: null, index: direction === "up" ? item.blockIndex : item.blockIndex + 1, leavesGroup: true };
}

export function canMove(model, key, direction) {
  const item = findItem(model, key);
  return item !== null && planMove(model, item, direction) !== null;
}

export function moveItemTo(model, key, { groupKey, index }) {
  const item = findItem(model, key);
  if (!item || (item.type === "repeat" && groupKey)) return model;

  const nextModel = cloneModel(model);
  const sourceContainer =
    item.stageIndex === null ? nextModel.blocks : nextModel.blocks[item.blockIndex].stages;
  const sourceIndex = item.stageIndex === null ? item.blockIndex : item.stageIndex;
  const targetGroup = groupKey ? nextModel.blocks.find((block) => block.key === groupKey) : null;
  if (groupKey && targetGroup?.type !== "repeat") return model;
  const targetContainer = targetGroup ? targetGroup.stages : nextModel.blocks;

  const [movedItem] = sourceContainer.splice(sourceIndex, 1);
  const adjustedIndex =
    sourceContainer === targetContainer && sourceIndex < index ? index - 1 : index;
  targetContainer.splice(Math.max(0, Math.min(adjustedIndex, targetContainer.length)), 0, movedItem);
  return nextModel;
}

export function moveItem(model, key, direction) {
  const item = findItem(model, key);
  if (!item) return model;
  const target = planMove(model, item, direction);
  if (!target) return model;

  if (target.groupKey === null && item.stageIndex === null) {
    const nextModel = cloneModel(model);
    const [movedBlock] = nextModel.blocks.splice(item.blockIndex, 1);
    nextModel.blocks.splice(target.index, 0, movedBlock);
    return nextModel;
  }
  if (target.groupKey !== null && item.stageIndex !== null && target.groupKey === model.blocks[item.blockIndex].key) {
    const nextModel = cloneModel(model);
    const stages = nextModel.blocks[item.blockIndex].stages;
    const [movedStage] = stages.splice(item.stageIndex, 1);
    stages.splice(target.index, 0, movedStage);
    return nextModel;
  }
  if (target.leavesGroup) {
    const nextModel = cloneModel(model);
    const [movedStage] = nextModel.blocks[item.blockIndex].stages.splice(item.stageIndex, 1);
    nextModel.blocks.splice(target.index, 0, movedStage);
    return nextModel;
  }
  return moveItemTo(model, key, { groupKey: target.groupKey, index: target.index });
}

const ERROR_FIELDS = {
  label: "label",
  durationSec: "duration",
  kind: "kind",
  times: "times",
  stages: "stages",
};

export function mapValidationErrors(model, errors) {
  const fieldErrors = [];
  errors.forEach((error) => {
    const pathParts = error.path.split(".");
    if (pathParts[0] === "name") {
      fieldErrors.push({ key: null, field: "name", error });
      return;
    }
    if (pathParts[0] !== "blocks" || pathParts.length === 1) {
      fieldErrors.push({ key: null, field: "routine", error });
      return;
    }
    const block = model.blocks[Number(pathParts[1])];
    if (!block) return;
    if (pathParts[2] === "stages" && pathParts.length > 3) {
      const stage = block.stages[Number(pathParts[3])];
      fieldErrors.push({ key: stage?.key ?? block.key, field: ERROR_FIELDS[pathParts[4]] ?? "row", error });
    } else {
      fieldErrors.push({ key: block.key, field: ERROR_FIELDS[pathParts[2]] ?? "row", error });
    }
  });
  return fieldErrors;
}

export const exceedsEditorRows = (model) => countEditorRows(model) > ROUTINE_LIMITS.maxEditorRows;
