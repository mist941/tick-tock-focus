import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { WHATS_NEW_VERSION, compareVersions, isOlderThanWhatsNew } from "../shared/whats-new.js";

describe("compareVersions", () => {
  test("compares each part as a number, not as text", () => {
    assert.equal(compareVersions("1.10.0", "1.2.0"), 1);
    assert.equal(compareVersions("1.2.0", "1.10.0"), -1);
    assert.equal(compareVersions("1.1.10", "1.1.9"), 1);
    assert.equal(compareVersions("10.0", "9.9.9"), 1);
  });

  test("treats missing parts as zero", () => {
    assert.equal(compareVersions("1.2", "1.2.0"), 0);
    assert.equal(compareVersions("1.2.0.0", "1.2"), 0);
    assert.equal(compareVersions("1.2.0.1", "1.2.0"), 1);
    assert.equal(compareVersions("1", "1.0.1"), -1);
  });

  test("orders the released versions and the next ones", () => {
    const ordered = ["1.0", "1.1.0", "1.1.1", "1.2.0", "1.2.1", "1.10.0"];
    const shuffled = ["1.2.1", "1.10.0", "1.1.0", "1.2.0", "1.1.1", "1.0"];
    assert.deepEqual(shuffled.sort(compareVersions), ordered);
  });
});

describe("isOlderThanWhatsNew", () => {
  test("is true for 1.0, 1.1.0, 1.1.1 and anything else before 1.2.0", () => {
    for (const version of ["1.0", "1.0.0", "1.1.0", "1.1.1", "1.1.9.9"]) {
      assert.equal(isOlderThanWhatsNew(version), true, version);
    }
  });

  test("is false from 1.2.0 on, including 1.10", () => {
    for (const version of ["1.2", "1.2.0", "1.2.0.1", "1.2.1", "1.3.0", "1.10", "2.0.0"]) {
      assert.equal(isOlderThanWhatsNew(version), false, version);
    }
  });

  test("names the release the banner is about", () => {
    assert.equal(WHATS_NEW_VERSION, "1.2");
  });
});
