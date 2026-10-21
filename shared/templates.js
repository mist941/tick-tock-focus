import { translate } from "./i18n.js";
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
    nameKey: "templateNamePomodoro",
    blocks: [
      repeatGroup(3, [
        templateStage("templateStageFocus", "focus", 25),
        templateStage("templateStageBreak", "break", 5),
      ]),
      singleStage("templateStageFocus", "focus", 25),
      singleStage("templateStageLongBreak", "break", 15),
    ],
  },
  {
    id: "52-17",
    nameKey: "templateName5217",
    blocks: [
      repeatGroup(3, [
        templateStage("templateStageFocus", "focus", 52),
        templateStage("templateStageBreak", "break", 17),
      ]),
    ],
  },
  {
    id: "deep-work",
    nameKey: "templateNameDeepWork",
    blocks: [
      singleStage("templateStageFocus", "focus", 90),
      singleStage("templateStageBreak", "break", 20),
    ],
  },
  {
    id: "study",
    nameKey: "templateNameStudy",
    blocks: [
      repeatGroup(3, [
        templateStage("templateStageStudy", "focus", 45),
        templateStage("templateStageBreak", "break", 10),
      ]),
    ],
  },
  {
    id: "desk-break",
    nameKey: "templateNameDeskBreak",
    blocks: [
      repeatGroup(4, [
        templateStage("templateStageWork", "focus", 30),
        templateStage("templateStageStretch", "break", 2),
      ]),
    ],
  },
]);

const findTemplate = (templateId) =>
  ROUTINE_TEMPLATES.find((template) => template.id === templateId) ?? null;

function buildBlocks(template) {
  const toStage = ({ labelKey, kind, durationSec }) => ({
    label: translate(labelKey),
    kind,
    durationSec,
  });
  return template.blocks.map((block) =>
    block.type === "repeat"
      ? { type: "repeat", times: block.times, stages: block.stages.map(toStage) }
      : { type: "stage", ...toStage(block) }
  );
}

export function previewTemplate(template) {
  const stages = expandRoutine({ blocks: buildBlocks(template) });
  return {
    id: template.id,
    name: translate(template.nameKey),
    stages,
    durationSec: getStagesDurationMs(stages) / 1000,
  };
}

export function createRoutineFromTemplate(templateId, now) {
  const template = findTemplate(templateId);
  if (!template) return null;
  const routine = {
    id: crypto.randomUUID(),
    name: translate(template.nameKey),
    createdAt: now,
    updatedAt: now,
    schemaVersion: ROUTINE_SCHEMA_VERSION,
    templateId: template.id,
    blocks: buildBlocks(template),
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
