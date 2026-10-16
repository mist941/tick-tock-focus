import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fillTemplate, formatCountdown, padTwoDigits } from "../shared/format.js";

describe("fillTemplate", () => {
  test("fills only the placeholders it has values for", () => {
    assert.equal(fillTemplate("{a} and {b}", { a: 1 }), "1 and {b}");
  });

  test("fills a placeholder every time it appears", () => {
    assert.equal(fillTemplate("{name}, {name}", { name: "Focus" }), "Focus, Focus");
  });
});

describe("padTwoDigits", () => {
  test("pads single digits", () => {
    assert.equal(padTwoDigits(5), "05");
    assert.equal(padTwoDigits(12), "12");
  });
});

describe("formatCountdown", () => {
  test("shows hours, minutes and seconds, rounding up", () => {
    assert.equal(formatCountdown(0), "00:00:00");
    assert.equal(formatCountdown(1), "00:00:01");
    assert.equal(formatCountdown(61_000), "00:01:01");
    assert.equal(formatCountdown(3_723_000), "01:02:03");
  });

  test("never goes below zero", () => {
    assert.equal(formatCountdown(-5_000), "00:00:00");
  });
});
