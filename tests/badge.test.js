import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  BADGE_COLORS,
  getBadgeColors,
  getBadgeText,
  getBadgeTitle,
  getNextBadgeChangeAt,
} from "../shared/badge.js";

const minute = 60_000;
const hour = 60 * minute;
const now = 10_000_000;

const stages = [
  { label: "Focus", kind: "focus", durationSec: 1500 },
  { label: "Break", kind: "break", durationSec: 300 },
  { label: "Review", kind: "custom", durationSec: 600 },
];

const runningRun = (remainingMs, overrides = {}) => ({
  schemaVersion: 2,
  status: "running",
  routineId: "routine-1",
  routineName: "Pomodoro",
  stages,
  stageIndex: 0,
  stageEndsAt: now + remainingMs,
  startedAt: now - minute,
  ...overrides,
});

const pausedRun = (overrides = {}) => {
  const { stageEndsAt, ...run } = runningRun(10 * minute);
  return { ...run, status: "paused", remainingMs: 10 * minute, ...overrides };
};

const awaitingRun = (overrides = {}) => {
  const { stageEndsAt, ...run } = runningRun(0);
  return { ...run, status: "awaitingNext", stageIndex: 1, ...overrides };
};

function relativeLuminance(hexColor) {
  const [red, green, blue] = [1, 3, 5]
    .map((start) => parseInt(hexColor.slice(start, start + 2), 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(firstColor, secondColor) {
  const [lighter, darker] = [relativeLuminance(firstColor), relativeLuminance(secondColor)].sort(
    (first, second) => second - first
  );
  return (lighter + 0.05) / (darker + 0.05);
}

describe("getBadgeText", () => {
  test("shows the minutes left in the stage, rounded up", () => {
    assert.equal(getBadgeText(runningRun(25 * minute), now), "25");
    assert.equal(getBadgeText(runningRun(24 * minute + 1), now), "25");
    assert.equal(getBadgeText(runningRun(24 * minute), now), "24");
    assert.equal(getBadgeText(runningRun(99 * minute), now), "99");
    assert.equal(getBadgeText(runningRun(minute + 1), now), "2");
  });

  test("shows 1 for the whole last minute, also when the stage is overdue", () => {
    assert.equal(getBadgeText(runningRun(minute), now), "1");
    assert.equal(getBadgeText(runningRun(30_000), now), "1");
    assert.equal(getBadgeText(runningRun(1), now), "1");
    assert.equal(getBadgeText(runningRun(0), now), "1");
    assert.equal(getBadgeText(runningRun(-5_000), now), "1");
  });

  test("shows hours, rounded up, once the minutes would reach 100", () => {
    assert.equal(getBadgeText(runningRun(99 * minute + 1), now), "2h");
    assert.equal(getBadgeText(runningRun(2 * hour), now), "2h");
    assert.equal(getBadgeText(runningRun(2 * hour + 1), now), "3h");
    assert.equal(getBadgeText(runningRun(24 * hour), now), "24h");
  });

  test("shows the state while paused or waiting, and nothing without a run", () => {
    assert.equal(getBadgeText(pausedRun(), now), "II");
    assert.equal(getBadgeText(awaitingRun(), now), "▶");
    assert.equal(getBadgeText(null, now), "");
  });
});

describe("getNextBadgeChangeAt", () => {
  test("is the next whole minute counted back from the stage end", () => {
    const fresh = runningRun(25 * minute);
    assert.equal(getNextBadgeChangeAt(fresh, now), fresh.stageEndsAt - 24 * minute);
    const resumed = runningRun(24 * minute + 10_000);
    assert.equal(getNextBadgeChangeAt(resumed, now), now + 10_000);
  });

  test("is the moment the badge text changes", () => {
    for (const remainingMs of [25 * minute, 2 * minute + 5_000, minute + 30_000, 99 * minute + 30_000, 2 * hour + 1, 5 * hour]) {
      const run = runningRun(remainingMs);
      const changeAt = getNextBadgeChangeAt(run, now);
      assert.ok(changeAt > now, `${remainingMs}`);
      assert.equal(getBadgeText(run, changeAt - 1), getBadgeText(run, now), `${remainingMs}`);
      assert.notEqual(getBadgeText(run, changeAt), getBadgeText(run, now), `${remainingMs}`);
    }
  });

  test("goes from hours to minutes at 99 minutes left", () => {
    const run = runningRun(2 * hour);
    assert.equal(getNextBadgeChangeAt(run, now), run.stageEndsAt - 99 * minute);
  });

  test("goes from 2 to 1 one minute before the stage ends", () => {
    const run = runningRun(minute + 30_000);
    const changeAt = getNextBadgeChangeAt(run, now);
    assert.equal(changeAt, run.stageEndsAt - minute);
    assert.equal(getBadgeText(run, changeAt - 1), "2");
    assert.equal(getBadgeText(run, changeAt), "1");
  });

  test("has no change before the stage ends once 1 shows", () => {
    assert.equal(getNextBadgeChangeAt(runningRun(minute), now), null);
    assert.equal(getNextBadgeChangeAt(runningRun(30_000), now), null);
    assert.equal(getNextBadgeChangeAt(runningRun(0), now), null);
  });

  test("has no change while paused, waiting or idle", () => {
    for (const run of [pausedRun(), awaitingRun(), null]) {
      assert.equal(getNextBadgeChangeAt(run, now), null);
    }
  });
});

describe("getBadgeColors", () => {
  test("uses the kind colour of the current or awaited stage", () => {
    assert.equal(getBadgeColors(runningRun(minute)), BADGE_COLORS.focus);
    assert.equal(getBadgeColors(runningRun(minute, { stageIndex: 1 })), BADGE_COLORS.break);
    assert.equal(getBadgeColors(awaitingRun()), BADGE_COLORS.break);
    assert.equal(getBadgeColors(awaitingRun({ stageIndex: 2 })), BADGE_COLORS.custom);
  });

  test("uses neutral grey while paused, whatever the kind", () => {
    assert.equal(getBadgeColors(pausedRun({ stageIndex: 1 })), BADGE_COLORS.paused);
    assert.equal(getBadgeColors(null), null);
  });

  test("keeps the badge text readable on every background", () => {
    for (const [name, { background, text }] of Object.entries(BADGE_COLORS)) {
      const ratio = contrastRatio(background, text);
      assert.ok(ratio >= 4.5, `${name}: ${ratio.toFixed(2)}`);
    }
  });
});

describe("getBadgeTitle", () => {
  test("names the routine, the stage and the time left", () => {
    assert.equal(getBadgeTitle(runningRun(25 * minute), now), "Pomodoro · Focus 1 of 3 · 25 min left");
    assert.equal(getBadgeTitle(runningRun(3 * hour), now), "Pomodoro · Focus 1 of 3 · 3 h left");
    assert.equal(
      getBadgeTitle(runningRun(30_000, { stageIndex: 2 }), now),
      "Pomodoro · Review 3 of 3 · 1 min left"
    );
  });

  test("says when the timer is paused or waiting", () => {
    assert.equal(getBadgeTitle(pausedRun(), now), "Pomodoro · Paused · Focus 1 of 3");
    assert.equal(getBadgeTitle(awaitingRun(), now), "Pomodoro · Waiting for you · Next: Break 2 of 3");
  });

  test("is the extension name without a run", () => {
    assert.equal(getBadgeTitle(null, now), "TickTockFocus");
  });
});
