import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateRoutine } from "../shared/routine.js";
import {
  addRepeatGroup,
  addStage,
  canAddRepeatGroup,
  canMove,
  countEditorRows,
  createEditorModel,
  describeModelContent,
  exceedsEditorRows,
  listEditorItems,
  mapValidationErrors,
  moveItem,
  moveItemTo,
  removeItem,
  summarizeModel,
  toRoutineBlocks,
  updateGroupTimes,
  updateStage,
} from "../popup/editor-model.js";

const kindLabels = { focus: "Focus", break: "Break", custom: "Custom" };
const options = { kindLabels };

const pomodoro = {
  id: "pomodoro",
  name: "Pomodoro",
  schemaVersion: 2,
  blocks: [
    {
      type: "repeat",
      times: 3,
      stages: [
        { label: "Focus", kind: "focus", durationSec: 1500 },
        { label: "Break", kind: "break", durationSec: 300 },
      ],
    },
    { type: "stage", label: "Long break", kind: "break", durationSec: 900 },
  ],
};

const labelsInOrder = (model) =>
  model.blocks.map((block) =>
    block.type === "repeat" ? `[${block.stages.map((stage) => stage.label).join(",")}]` : block.label
  );

const keyOf = (model, label) =>
  listEditorItems(model).find((item) => {
    if (item.type !== "stage") return false;
    const block = model.blocks[item.blockIndex];
    const stage = item.stageIndex === null ? block : block.stages[item.stageIndex];
    return stage.label === label;
  }).key;

const flatModel = () =>
  createEditorModel(
    {
      name: "Flat",
      blocks: ["A", "B", "C"].map((label) => ({ type: "stage", label, kind: "custom", durationSec: 60 })),
    },
    options
  );

describe("createEditorModel and toRoutineBlocks", () => {
  test("round-trips a routine with repeats", () => {
    const model = createEditorModel(pomodoro, options);
    assert.deepEqual(toRoutineBlocks(model), pomodoro.blocks);
    assert.equal(model.name, "Pomodoro");
  });

  test("splits durations into minutes and two-digit seconds", () => {
    const model = createEditorModel(
      { name: "x", blocks: [{ type: "stage", label: "A", kind: "focus", durationSec: 3723 }] },
      options
    );
    assert.equal(model.blocks[0].minutes, "62");
    assert.equal(model.blocks[0].seconds, "03");
  });

  test("a new routine starts with one 25-minute focus step", () => {
    const model = createEditorModel(null, options);
    assert.equal(model.name, "");
    assert.deepEqual(toRoutineBlocks(model), [
      { type: "stage", label: "Focus", kind: "focus", durationSec: 1500 },
    ]);
  });

  test("trims labels and reads empty fields as zero", () => {
    const model = updateStage(
      createEditorModel(null, options),
      createEditorModel(null, options).blocks[0].key,
      { label: "  Read  ", minutes: "", seconds: "45" },
      options
    );
    assert.deepEqual(toRoutineBlocks(model)[0], {
      type: "stage",
      label: "Read",
      kind: "focus",
      durationSec: 45,
    });
  });

  test("gives every block and stage a unique key", () => {
    const keys = listEditorItems(createEditorModel(pomodoro, options)).map((item) => item.key);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(keys.length, 4);
  });
});

describe("summarizeModel", () => {
  test("counts expanded steps, editor rows and the total time", () => {
    assert.deepEqual(summarizeModel(createEditorModel(pomodoro, options)), {
      expandedStageCount: 7,
      totalDurationSec: 3 * 1800 + 900,
      editorRowCount: 3,
    });
  });
});

describe("adding and removing", () => {
  test("a new step alternates focus and break", () => {
    let model = createEditorModel(null, options);
    ({ model } = addStage(model, options));
    ({ model } = addStage(model, options));
    assert.deepEqual(
      toRoutineBlocks(model).map((block) => `${block.kind}/${block.durationSec}`),
      ["focus/1500", "break/300", "focus/1500"]
    );
  });

  test("a step added to a group follows the group's last step", () => {
    const model = createEditorModel(pomodoro, options);
    const { model: nextModel, addedKey } = addStage(model, { groupKey: model.blocks[0].key, ...options });
    assert.equal(nextModel.blocks[0].stages.length, 3);
    assert.equal(nextModel.blocks[0].stages[2].key, addedKey);
    assert.equal(nextModel.blocks[0].stages[2].kind, "focus");
  });

  test("a repeat group starts with a 25-minute focus step, a 5-minute break and ×2", () => {
    const { model, addedKey, addedStageKey } = addRepeatGroup(createEditorModel(null, options), options);
    const group = model.blocks.at(-1);
    assert.equal(group.key, addedKey);
    assert.equal(group.stages[0].key, addedStageKey);
    assert.deepEqual(toRoutineBlocks(model).at(-1), {
      type: "repeat",
      times: 2,
      stages: [
        { label: "Focus", kind: "focus", durationSec: 1500 },
        { label: "Break", kind: "break", durationSec: 300 },
      ],
    });
  });

  test("a repeat group can be added only while two rows are left", () => {
    const withRows = (count) =>
      createEditorModel(
        {
          name: "x",
          blocks: Array.from({ length: count }, (_, index) => ({
            type: "stage",
            label: `Step ${index + 1}`,
            kind: "custom",
            durationSec: 60,
          })),
        },
        options
      );
    assert.equal(canAddRepeatGroup(withRows(18)), true);
    assert.equal(canAddRepeatGroup(withRows(19)), false);
    assert.equal(canAddRepeatGroup(withRows(20)), false);
  });

  test("new keys stay unique after adding", () => {
    let model = createEditorModel(pomodoro, options);
    ({ model } = addStage(model, options));
    ({ model } = addRepeatGroup(model, options));
    const keys = listEditorItems(model).map((item) => item.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  test("removing a group removes its steps", () => {
    const model = createEditorModel(pomodoro, options);
    const nextModel = removeItem(model, model.blocks[0].key);
    assert.deepEqual(labelsInOrder(nextModel), ["Long break"]);
  });

  test("removing the last step of a group keeps the empty group", () => {
    let model = createEditorModel(
      { name: "x", blocks: [{ type: "repeat", times: 2, stages: [{ label: "Only", kind: "focus", durationSec: 60 }] }] },
      options
    );
    model = removeItem(model, keyOf(model, "Only"));
    assert.equal(model.blocks.length, 1);
    assert.deepEqual(model.blocks[0].stages, []);
  });

  test("does not change the model it is given", () => {
    const model = createEditorModel(pomodoro, options);
    const snapshot = structuredClone(model);
    addStage(model, options);
    removeItem(model, model.blocks[0].key);
    moveItem(model, keyOf(model, "Long break"), "up");
    assert.deepEqual(model, snapshot);
  });
});

describe("updating", () => {
  test("changing the kind replaces a default label", () => {
    const model = createEditorModel(null, options);
    const key = model.blocks[0].key;
    const changed = updateStage(model, key, { kind: "break" }, options);
    assert.equal(changed.blocks[0].label, "Break");
  });

  test("changing the kind keeps a custom label", () => {
    let model = createEditorModel(null, options);
    const key = model.blocks[0].key;
    model = updateStage(model, key, { label: "Reading" }, options);
    model = updateStage(model, key, { kind: "custom" }, options);
    assert.equal(model.blocks[0].label, "Reading");
    assert.equal(model.blocks[0].kind, "custom");
  });

  test("sets the repeat count", () => {
    const model = createEditorModel(pomodoro, options);
    assert.equal(updateGroupTimes(model, model.blocks[0].key, 5).blocks[0].times, 5);
  });

  test("describes the content for change detection, ignoring keys", () => {
    const first = createEditorModel(pomodoro, options);
    const second = createEditorModel(pomodoro, options);
    second.blocks[0].key = "different";
    assert.equal(describeModelContent(first), describeModelContent(second));
    assert.notEqual(
      describeModelContent(first),
      describeModelContent(updateGroupTimes(first, first.blocks[0].key, 4))
    );
  });
});

describe("moving with up and down", () => {
  test("swaps top-level steps", () => {
    const model = flatModel();
    assert.deepEqual(labelsInOrder(moveItem(model, keyOf(model, "B"), "up")), ["B", "A", "C"]);
    assert.deepEqual(labelsInOrder(moveItem(model, keyOf(model, "B"), "down")), ["A", "C", "B"]);
  });

  test("cannot move past the ends", () => {
    const model = flatModel();
    assert.equal(canMove(model, keyOf(model, "A"), "up"), false);
    assert.equal(canMove(model, keyOf(model, "C"), "down"), false);
    assert.equal(canMove(model, keyOf(model, "B"), "up"), true);
    assert.equal(moveItem(model, keyOf(model, "A"), "up"), model);
  });

  test("a step moves into a group at its edge", () => {
    const model = createEditorModel(pomodoro, options);
    const intoGroup = moveItem(model, keyOf(model, "Long break"), "up");
    assert.deepEqual(labelsInOrder(intoGroup), ["[Focus,Break,Long break]"]);

    const above = createEditorModel(
      { name: "x", blocks: [{ type: "stage", label: "Warm up", kind: "custom", durationSec: 60 }, ...pomodoro.blocks] },
      options
    );
    assert.deepEqual(labelsInOrder(moveItem(above, keyOf(above, "Warm up"), "down")), [
      "[Warm up,Focus,Break]",
      "Long break",
    ]);
  });

  test("a step moves within its group and then out of it", () => {
    let model = createEditorModel(pomodoro, options);
    model = moveItem(model, keyOf(model, "Break"), "up");
    assert.deepEqual(labelsInOrder(model), ["[Break,Focus]", "Long break"]);
    model = moveItem(model, keyOf(model, "Break"), "up");
    assert.deepEqual(labelsInOrder(model), ["Break", "[Focus]", "Long break"]);

    let downModel = createEditorModel(pomodoro, options);
    downModel = moveItem(downModel, keyOf(downModel, "Break"), "down");
    assert.deepEqual(labelsInOrder(downModel), ["[Focus]", "Break", "Long break"]);
  });

  test("a group moves as a whole and never enters another group", () => {
    const model = createEditorModel(
      {
        name: "x",
        blocks: [
          { type: "repeat", times: 2, stages: [{ label: "A", kind: "focus", durationSec: 60 }] },
          { type: "repeat", times: 2, stages: [{ label: "B", kind: "focus", durationSec: 60 }] },
          { type: "stage", label: "C", kind: "custom", durationSec: 60 },
        ],
      },
      options
    );
    assert.deepEqual(labelsInOrder(moveItem(model, model.blocks[0].key, "down")), ["[B]", "[A]", "C"]);
    assert.deepEqual(labelsInOrder(moveItem(model, model.blocks[1].key, "down")), ["[A]", "C", "[B]"]);
    assert.equal(canMove(model, model.blocks[0].key, "up"), false);
  });

  test("moving never changes the row count", () => {
    let model = createEditorModel(pomodoro, options);
    for (const direction of ["up", "up", "down", "down", "down"]) {
      model = moveItem(model, keyOf(model, "Long break"), direction);
      assert.equal(countEditorRows(model), 3);
    }
  });
});

describe("moveItemTo (drag and drop)", () => {
  test("moves a step to a position in another container", () => {
    const model = createEditorModel(pomodoro, options);
    const moved = moveItemTo(model, keyOf(model, "Long break"), {
      groupKey: model.blocks[0].key,
      index: 1,
    });
    assert.deepEqual(labelsInOrder(moved), ["[Focus,Long break,Break]"]);
  });

  test("moves later in the same container counting from before the move", () => {
    const model = flatModel();
    assert.deepEqual(
      labelsInOrder(moveItemTo(model, keyOf(model, "A"), { groupKey: null, index: 3 })),
      ["B", "C", "A"]
    );
    assert.deepEqual(
      labelsInOrder(moveItemTo(model, keyOf(model, "C"), { groupKey: null, index: 0 })),
      ["C", "A", "B"]
    );
  });

  test("refuses to put a group inside a group", () => {
    const { model } = addRepeatGroup(createEditorModel(pomodoro, options), options);
    assert.equal(moveItemTo(model, model.blocks[2].key, { groupKey: model.blocks[0].key, index: 0 }), model);
  });
});

describe("validation mapping", () => {
  test("points errors at the name, a step, a group or the whole routine", () => {
    let model = createEditorModel(pomodoro, options);
    model = updateStage(model, keyOf(model, "Break"), { label: " ", minutes: "0", seconds: "10" }, options);
    model = { ...model, name: "" };
    const errors = validateRoutine({ name: model.name, blocks: toRoutineBlocks(model) });
    const mapped = mapValidationErrors(model, errors).map(
      ({ key, field, error }) => `${key === null ? "-" : key === model.blocks[0].stages[1].key ? "break" : key}/${field}/${error.code}`
    );
    assert.deepEqual(mapped, ["-/name/nameMissing", "break/label/labelMissing", "break/duration/durationTooShort"]);
  });

  test("maps an empty group to the group", () => {
    let model = createEditorModel(pomodoro, options);
    model = removeItem(model, keyOf(model, "Focus"));
    model = removeItem(model, keyOf(model, "Break"));
    const errors = validateRoutine({ name: "x", blocks: toRoutineBlocks(model) });
    assert.deepEqual(
      mapValidationErrors(model, errors).map(({ key, field, error }) => [key, field, error.code]),
      [[model.blocks[0].key, "stages", "repeatEmpty"]]
    );
  });

  test("flags more than 20 rows", () => {
    const blocks = Array.from({ length: 21 }, (_, index) => ({
      type: "stage",
      label: `Step ${index + 1}`,
      kind: "custom",
      durationSec: 60,
    }));
    const model = createEditorModel({ name: "Long", blocks }, options);
    assert.equal(exceedsEditorRows(model), true);
    const errors = validateRoutine({ name: "Long", blocks: toRoutineBlocks(model) });
    assert.deepEqual(
      mapValidationErrors(model, errors).map(({ key, field }) => [key, field]),
      [[null, "routine"]]
    );
  });
});
