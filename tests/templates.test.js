import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { expandRoutine, normalizeRoutine, toLegacyClocks, validateRoutine } from "../shared/routine.js";
import {
  ROUTINE_TEMPLATES,
  createRoutineFromTemplate,
  getAddedTemplateIds,
  listTemplatesToAdd,
  previewTemplate,
} from "../shared/templates.js";
import { UI_STRINGS, formatDurationText } from "../popup/ui-strings.js";

const texts = UI_STRINGS.templates;
const now = 1_760_000_000_000;

const expectedTemplates = {
  pomodoro: { name: "Pomodoro", stageCount: 8, total: "2 h 10 min" },
  "52-17": { name: "52/17", stageCount: 6, total: "3 h 27 min" },
  "deep-work": { name: "Deep work", stageCount: 2, total: "1 h 50 min" },
  study: { name: "Study", stageCount: 6, total: "2 h 45 min" },
  "desk-break": { name: "Desk break", stageCount: 8, total: "2 h 8 min" },
};

const templateIds = ROUTINE_TEMPLATES.map((template) => template.id);

const describeStages = (stages) =>
  stages.map((stage) => `${stage.label} ${stage.kind} ${stage.durationSec / 60}`);

describe("ROUTINE_TEMPLATES", () => {
  test("lists the five templates in display order with unique ids", () => {
    assert.deepEqual(templateIds, ["pomodoro", "52-17", "deep-work", "study", "desk-break"]);
    assert.equal(new Set(templateIds).size, templateIds.length);
  });

  test("has a name for every template and a label for every stage in the strings", () => {
    for (const template of ROUTINE_TEMPLATES) {
      assert.equal(typeof texts.names[template.id], "string", template.id);
      const stages = template.blocks.flatMap((block) => (block.type === "repeat" ? block.stages : [block]));
      for (const stage of stages) {
        assert.equal(typeof texts.stageLabels[stage.labelKey], "string", `${template.id} ${stage.labelKey}`);
      }
    }
  });

  test("can't be changed by accident", () => {
    assert.ok(Object.isFrozen(ROUTINE_TEMPLATES));
    assert.ok(Object.isFrozen(ROUTINE_TEMPLATES[0].blocks[0].stages[0]));
  });
});

describe("createRoutineFromTemplate", () => {
  test("makes a routine that passes validateRoutine from every template", () => {
    for (const templateId of templateIds) {
      assert.deepEqual(validateRoutine(createRoutineFromTemplate(templateId, now, texts)), [], templateId);
    }
  });

  test("expands every template to its listed step count and total", () => {
    for (const [templateId, expected] of Object.entries(expectedTemplates)) {
      const stages = expandRoutine(createRoutineFromTemplate(templateId, now, texts));
      const totalSec = stages.reduce((sumSec, stage) => sumSec + stage.durationSec, 0);
      assert.equal(stages.length, expected.stageCount, templateId);
      assert.equal(formatDurationText(totalSec), expected.total, templateId);
    }
  });

  test("builds the blocks of each template", () => {
    const stagesOf = (templateId) => describeStages(expandRoutine(createRoutineFromTemplate(templateId, now, texts)));
    assert.deepEqual(stagesOf("pomodoro"), [
      ...Array(3).fill(["Focus focus 25", "Break break 5"]).flat(),
      "Focus focus 25",
      "Long break break 15",
    ]);
    assert.deepEqual(stagesOf("52-17"), Array(3).fill(["Focus focus 52", "Break break 17"]).flat());
    assert.deepEqual(stagesOf("deep-work"), ["Focus focus 90", "Break break 20"]);
    assert.deepEqual(stagesOf("study"), Array(3).fill(["Study focus 45", "Break break 10"]).flat());
    assert.deepEqual(stagesOf("desk-break"), Array(4).fill(["Work focus 30", "Stretch break 2"]).flat());
  });

  test("keeps the repeat groups instead of writing out every step", () => {
    const pomodoro = createRoutineFromTemplate("pomodoro", now, texts);
    assert.deepEqual(pomodoro.blocks, [
      {
        type: "repeat",
        times: 3,
        stages: [
          { label: "Focus", kind: "focus", durationSec: 1500 },
          { label: "Break", kind: "break", durationSec: 300 },
        ],
      },
      { type: "stage", label: "Focus", kind: "focus", durationSec: 1500 },
      { type: "stage", label: "Long break", kind: "break", durationSec: 900 },
    ]);
  });

  test("is a v2 routine with the template id, the given time and the derived clocks", () => {
    const routine = createRoutineFromTemplate("deep-work", now, texts);
    assert.equal(typeof routine.id, "string");
    assert.notEqual(routine.id, "");
    assert.equal(routine.name, "Deep work");
    assert.equal(routine.templateId, "deep-work");
    assert.equal(routine.schemaVersion, 2);
    assert.equal(routine.createdAt, now);
    assert.equal(routine.updatedAt, now);
    assert.deepEqual(routine.clocks, toLegacyClocks(expandRoutine(routine)));
    assert.deepEqual(routine.clocks, [
      { position: 0, hours: 1, minutes: 30, seconds: 0 },
      { position: 1, hours: 0, minutes: 20, seconds: 0 },
    ]);
  });

  test("takes the name and labels from the texts it is given", () => {
    const otherTexts = {
      names: { ...texts.names, study: "Lernen" },
      stageLabels: { ...texts.stageLabels, study: "Lernen", break: "Pause" },
    };
    const routine = createRoutineFromTemplate("study", now, otherTexts);
    assert.equal(routine.name, "Lernen");
    assert.deepEqual(routine.blocks[0].stages.map((stage) => stage.label), ["Lernen", "Pause"]);
  });

  test("gives every routine a new id", () => {
    const ids = Array.from({ length: 20 }, () => createRoutineFromTemplate("pomodoro", now, texts).id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("returns a fresh routine that shares nothing with the template", () => {
    const first = createRoutineFromTemplate("pomodoro", now, texts);
    first.blocks[0].stages[0].durationSec = 60;
    first.blocks[0].times = 9;
    const second = createRoutineFromTemplate("pomodoro", now, texts);
    assert.equal(second.blocks[0].stages[0].durationSec, 1500);
    assert.equal(second.blocks[0].times, 3);
  });

  test("returns null for an unknown template", () => {
    assert.equal(createRoutineFromTemplate("gong", now, texts), null);
    assert.equal(createRoutineFromTemplate(undefined, now, texts), null);
  });

  test("keeps templateId when the routine is read back", () => {
    const routine = createRoutineFromTemplate("study", now, texts);
    assert.equal(normalizeRoutine(structuredClone(routine), (position) => `Step ${position}`).templateId, "study");
  });
});

describe("previewTemplate", () => {
  test("gives the name, the expanded stages and the total for a card", () => {
    const preview = previewTemplate(ROUTINE_TEMPLATES[0], texts);
    assert.equal(preview.id, "pomodoro");
    assert.equal(preview.name, "Pomodoro");
    assert.equal(preview.stages.length, 8);
    assert.equal(preview.durationSec, 130 * 60);
  });

  test("matches the routine the template creates", () => {
    for (const template of ROUTINE_TEMPLATES) {
      assert.deepEqual(
        previewTemplate(template, texts).stages,
        expandRoutine(createRoutineFromTemplate(template.id, now, texts)),
        template.id
      );
    }
  });
});

describe("added templates", () => {
  const routineFrom = (templateId) => createRoutineFromTemplate(templateId, now, texts);
  const ownRoutine = { id: "own", name: "Mine", schemaVersion: 2, blocks: [] };

  test("finds the templates the routines came from", () => {
    assert.deepEqual([...getAddedTemplateIds([routineFrom("study"), ownRoutine, routineFrom("pomodoro")])], [
      "study",
      "pomodoro",
    ]);
    assert.equal(getAddedTemplateIds([]).size, 0);
  });

  test("lists the requested templates in display order, without the ones already added", () => {
    assert.deepEqual(listTemplatesToAdd(["study", "pomodoro", "52-17"], [routineFrom("52-17")]), ["pomodoro", "study"]);
    assert.deepEqual(listTemplatesToAdd(new Set(["desk-break"]), [ownRoutine]), ["desk-break"]);
  });

  test("adds nothing twice", () => {
    const routines = [routineFrom("pomodoro"), routineFrom("deep-work")];
    assert.deepEqual(listTemplatesToAdd(["pomodoro", "deep-work"], routines), []);
    assert.deepEqual(listTemplatesToAdd(["pomodoro", "pomodoro"], []), ["pomodoro"]);
  });

  test("ignores unknown template ids", () => {
    assert.deepEqual(listTemplatesToAdd(["gong", "study"], []), ["study"]);
  });
});
