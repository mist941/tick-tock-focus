import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  DECLINED_PROMPT,
  RATED_PROMPT,
  addCompletedRoutine,
  countsAsCompletedRoutine,
  isRatingPromptDue,
  postponeRatingPrompt,
} from "../shared/rating-prompt.js";

describe("countsAsCompletedRoutine", () => {
  test("counts a routine that finished, on time or late", () => {
    assert.equal(countsAsCompletedRoutine({ type: "routineComplete" }), true);
    assert.equal(countsAsCompletedRoutine({ type: "lateFinish", finishedAt: 1000 }), true);
  });

  test("doesn't count stages, catching up or no notification at all", () => {
    for (const notification of [
      { type: "stageDone", stageIndex: 0 },
      { type: "lateStageDone", stageIndex: 0, endedAt: 1000 },
      { type: "caughtUp" },
      null,
      undefined,
    ]) {
      assert.equal(countsAsCompletedRoutine(notification), false, JSON.stringify(notification));
    }
  });
});

describe("addCompletedRoutine", () => {
  test("adds one to the stored count", () => {
    assert.equal(addCompletedRoutine(4), 5);
    assert.equal(addCompletedRoutine(0), 1);
  });

  test("starts from zero when nothing usable is stored", () => {
    for (const stored of [undefined, null, -3, 2.5, "7", Number.NaN]) {
      assert.equal(addCompletedRoutine(stored), 1, String(stored));
    }
  });
});

describe("isRatingPromptDue", () => {
  test("is due from the fifth completed routine", () => {
    assert.equal(isRatingPromptDue(0, undefined), false);
    assert.equal(isRatingPromptDue(4, undefined), false);
    assert.equal(isRatingPromptDue(5, undefined), true);
    assert.equal(isRatingPromptDue(12, null), true);
  });

  test("waits for ten more completed routines after Later", () => {
    const later = postponeRatingPrompt(5);
    assert.deepEqual(later, { state: "later", askAfterCompleted: 15 });
    assert.equal(isRatingPromptDue(5, later), false);
    assert.equal(isRatingPromptDue(14, later), false);
    assert.equal(isRatingPromptDue(15, later), true);
    assert.deepEqual(postponeRatingPrompt(8), { state: "later", askAfterCompleted: 18 });
  });

  test("never asks again after Rate or Don't ask again", () => {
    for (const answer of [RATED_PROMPT, DECLINED_PROMPT]) {
      assert.equal(isRatingPromptDue(5, answer), false, answer.state);
      assert.equal(isRatingPromptDue(1000, answer), false, answer.state);
    }
    assert.deepEqual(RATED_PROMPT, { state: "rated", askAfterCompleted: null });
    assert.deepEqual(DECLINED_PROMPT, { state: "declined", askAfterCompleted: null });
  });

  test("goes through a whole history of answers", () => {
    let ratingPrompt;
    const dueAt = [];
    for (let completedRoutines = 1; completedRoutines <= 40; completedRoutines += 1) {
      if (!isRatingPromptDue(completedRoutines, ratingPrompt)) continue;
      dueAt.push(completedRoutines);
      ratingPrompt = dueAt.length < 3 ? postponeRatingPrompt(completedRoutines) : DECLINED_PROMPT;
    }
    assert.deepEqual(dueAt, [5, 15, 25]);
  });

  test("treats a missing count as zero", () => {
    assert.equal(isRatingPromptDue(undefined, undefined), false);
    assert.equal(isRatingPromptDue(null, postponeRatingPrompt(0)), false);
  });
});
