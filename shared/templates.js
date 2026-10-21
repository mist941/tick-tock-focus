import {
  ROUTINE_SCHEMA_VERSION,
  expandRoutine,
  getStagesDurationMs,
  toLegacyClocks,
} from "./routine.js";

const deepFreeze = (value) => {
  if (value !== null && typeof value === "object") Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const templateStage = (labelKey, kind, minutes) => ({ labelKey, kind, durationSec: minutes * 60 });

const singleStage = (labelKey, kind, minutes) => ({
  type: "stage",
  ...templateStage(labelKey, kind, minutes),
});

const repeatGroup = (times, stages) => ({ type: "repeat", times, stages });

export const ROUTINE_TEMPLATES = deepFreeze([
  {
    id: "pomodoro",
    blocks: [
      repeatGroup(3, [templateStage("focus", "focus", 25), templateStage("break", "break", 5)]),
      singleStage("focus", "focus", 25),
      singleStage("longBreak", "break", 15),
    ],
  },
  {
    id: "52-17",
    blocks: [repeatGroup(3, [templateStage("focus", "focus", 52), templateStage("break", "break", 17)])],
  },
  {
    id: "deep-work",
    blocks: [singleStage("focus", "focus", 90), singleStage("break", "break", 20)],
  },
  {
    id: "study",
    blocks: [repeatGroup(3, [templateStage("study", "focus", 45), templateStage("break", "break", 10)])],
  },
  {
    id: "desk-break",
    blocks: [repeatGroup(4, [templateStage("work", "focus", 30), templateStage("stretch", "break", 2)])],
  },
]);

const findTemplate = (templateId) =>
  ROUTINE_TEMPLATES.find((template) => template.id === templateId) ?? null;

function buildBlocks(template, texts) {
  const toStage = ({ labelKey, kind, durationSec }) => ({
    label: texts.stageLabels[labelKey],
    kind,
    durationSec,
  });
  return template.blocks.map((block) =>
    block.type === "repeat"
      ? { type: "repeat", times: block.times, stages: block.stages.map(toStage) }
      : { type: "stage", ...toStage(block) }
  );
}

export function previewTemplate(template, texts) {
  const stages = expandRoutine({ blocks: buildBlocks(template, texts) });
  return {
    id: template.id,
    name: texts.names[template.id],
    stages,
    durationSec: getStagesDurationMs(stages) / 1000,
  };
}

export function createRoutineFromTemplate(templateId, now, texts) {
  const template = findTemplate(templateId);
  if (!template) return null;
  const routine = {
    id: crypto.randomUUID(),
    name: texts.names[template.id],
    createdAt: now,
    updatedAt: now,
    schemaVersion: ROUTINE_SCHEMA_VERSION,
    templateId: template.id,
    blocks: buildBlocks(template, texts),
  };
  return { ...routine, clocks: toLegacyClocks(expandRoutine(routine)) };
}

export const getAddedTemplateIds = (routines) =>
  new Set(
    routines
      .map((routine) => routine.templateId)
      .filter((templateId) => typeof templateId === "string")
  );

export function listTemplatesToAdd(templateIds, routines) {
  const requestedIds = new Set(templateIds);
  const addedIds = getAddedTemplateIds(routines);
  return ROUTINE_TEMPLATES.map((template) => template.id).filter(
    (templateId) => requestedIds.has(templateId) && !addedIds.has(templateId)
  );
}
