import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  fillTemplate,
  formatClockTime,
  formatCountdown,
  formatSpokenDuration,
  formatTimerCountdown,
  padTwoDigits,
} from "../shared/format.js";

const units = { hours: "{count} h", minutes: "{count} min", seconds: "{count} s" };
const meridiem = { beforeNoon: "AM", afterNoon: "PM" };

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

describe("formatTimerCountdown", () => {
  test("shows minutes and seconds under an hour", () => {
    assert.equal(formatTimerCountdown(0), "00:00");
    assert.equal(formatTimerCountdown(1_122_000), "18:42");
    assert.equal(formatTimerCountdown(3_599_000), "59:59");
    assert.equal(formatTimerCountdown(3_599_001), "1:00:00");
  });

  test("adds hours from one hour up", () => {
    assert.equal(formatTimerCountdown(3_600_000), "1:00:00");
    assert.equal(formatTimerCountdown(86_400_000), "24:00:00");
  });
});

describe("formatSpokenDuration", () => {
  test("uses the units it is given and skips zero parts", () => {
    assert.equal(formatSpokenDuration(7800, units), "2 h 10 min");
    assert.equal(formatSpokenDuration(45, units), "45 s");
    assert.equal(formatSpokenDuration(0, units), "0 s");
  });
});

describe("formatClockTime", () => {
  const afternoon = new Date(2026, 9, 16, 14, 35).getTime();

  test("follows the time format", () => {
    assert.equal(formatClockTime(afternoon, "24h", meridiem), "14:35");
    assert.equal(formatClockTime(afternoon, "12h", meridiem), "02:35 PM");
  });
});
