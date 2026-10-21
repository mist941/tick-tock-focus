import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { DEFAULT_SOUND_SETTINGS, SOUND_IDS, getSoundPath, getSoundSettings } from "../shared/sounds.js";

describe("getSoundSettings", () => {
  test("defaults to Chime at 70 % with the sound on", () => {
    assert.deepEqual(getSoundSettings({}), { soundEnabled: true, soundId: "chime", soundVolume: 70 });
    assert.deepEqual(getSoundSettings(), DEFAULT_SOUND_SETTINGS);
  });

  test("keeps the saved choices", () => {
    assert.deepEqual(getSoundSettings({ soundEnabled: false, soundId: "bell", soundVolume: 35 }), {
      soundEnabled: false,
      soundId: "bell",
      soundVolume: 35,
    });
    assert.equal(getSoundSettings({ soundVolume: 0 }).soundVolume, 0);
  });

  test("falls back to Chime for an unknown sound", () => {
    assert.equal(getSoundSettings({ soundId: "gong" }).soundId, "chime");
    assert.equal(getSoundSettings({ soundId: "../popup/popup" }).soundId, "chime");
  });

  test("keeps the volume a whole number from 0 to 100", () => {
    assert.equal(getSoundSettings({ soundVolume: 140 }).soundVolume, 100);
    assert.equal(getSoundSettings({ soundVolume: -5 }).soundVolume, 0);
    assert.equal(getSoundSettings({ soundVolume: 42.6 }).soundVolume, 43);
    assert.equal(getSoundSettings({ soundVolume: "50" }).soundVolume, 70);
    assert.equal(getSoundSettings({ soundVolume: Number.NaN }).soundVolume, 70);
  });
});

describe("sound files", () => {
  test("every sound has a file in sounds/", () => {
    assert.deepEqual([...SOUND_IDS], ["chime", "bell", "soft"]);
    for (const soundId of SOUND_IDS) {
      assert.equal(getSoundPath(soundId), `sounds/${soundId}.ogg`);
      assert.ok(existsSync(new URL(`../${getSoundPath(soundId)}`, import.meta.url)), soundId);
    }
  });
});
