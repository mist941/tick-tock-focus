import { withLocale } from "./support/messages.js";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { makeStepLabel } from "../shared/stage-labels.js";
import { normalizeRoutine } from "../shared/routine.js";

const legacyPreset = {
  id: "legacy",
  name: "Old timer",
  createdAt: 1_700_000_000_000,
  clocks: [
    { position: 0, hours: 0, minutes: 25, seconds: 0 },
    { position: 1, hours: 0, minutes: 5, seconds: 0 },
  ],
};

describe("makeStepLabel", () => {
  test("numbers the step", () => {
    assert.equal(makeStepLabel(3), "Step 3");
  });

  test("names the stages of a preset from 1.1", () => {
    const labels = normalizeRoutine(legacyPreset, makeStepLabel).blocks.map((block) => block.label);
    assert.deepEqual(labels, ["Step 1", "Step 2"]);
  });

  test("names them in the language of the messages", () => {
    const labels = withLocale("uk", () =>
      normalizeRoutine(legacyPreset, makeStepLabel).blocks.map((block) => block.label)
    );
    assert.deepEqual(labels, ["Етап 1", "Етап 2"]);
  });
});
