import { useLocale } from "./support/messages.js";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  formatDuration,
  formatTime,
  getLanguageCode,
  setMessageLookup,
  translate,
} from "../shared/i18n.js";

const afternoon = new Date(2026, 9, 15, 14, 5).getTime();
const morning = new Date(2026, 9, 15, 9, 30).getTime();

describe("translate", () => {
  test("fills the placeholders of the message", () => {
    assert.equal(translate("formatHours", { count: 2 }), "2 h");
  });

  test("keeps the placeholders it has no values for", () => {
    assert.equal(translate("formatMinutes"), "{count} min");
  });

  test("throws on a missing message in tests", () => {
    assert.throws(() => translate("noSuchMessage"), /Missing message: noSuchMessage/);
  });

  test("falls back to the key name with a warning when Chrome has no such message", (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    globalThis.chrome = {
      i18n: { getMessage: (key) => (key === "formatHours" ? "{count} h" : "") },
    };
    setMessageLookup();
    try {
      assert.equal(translate("formatHours", { count: 3 }), "3 h");
      assert.equal(warn.mock.callCount(), 0);
      assert.equal(translate("noSuchMessage", { count: 3 }), "noSuchMessage");
      assert.equal(warn.mock.callCount(), 1);
      assert.match(warn.mock.calls[0].arguments[0], /noSuchMessage/);
    } finally {
      delete globalThis.chrome;
      useLocale("en");
    }
  });
});

describe("getLanguageCode", () => {
  test("is the language of the messages in use", () => {
    assert.equal(getLanguageCode(), "en");
  });
});

describe("formatDuration", () => {
  test("uses the non-zero units", () => {
    assert.equal(formatDuration(1500), "25 min");
    assert.equal(formatDuration(5400), "1 h 30 min");
    assert.equal(formatDuration(3600), "1 h");
    assert.equal(formatDuration(45), "45 s");
    assert.equal(formatDuration(3725), "1 h 2 min 5 s");
    assert.equal(formatDuration(0), "0 s");
  });
});

describe("formatTime", () => {
  test("follows the 24-hour or 12-hour format", () => {
    assert.equal(formatTime(afternoon, "24h"), "14:05");
    assert.equal(formatTime(morning, "24h"), "09:30");
    assert.equal(formatTime(afternoon, undefined), "14:05");
    assert.equal(formatTime(afternoon, "12h"), "02:05 PM");
    assert.equal(formatTime(morning, "12h"), "09:30 AM");
    assert.equal(formatTime(new Date(2026, 9, 15, 0, 1).getTime(), "12h"), "12:01 AM");
    assert.equal(formatTime(new Date(2026, 9, 15, 12, 0).getTime(), "12h"), "12:00 PM");
  });
});
