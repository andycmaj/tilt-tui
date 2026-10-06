import { describe, expect, test } from "bun:test";
import {
  compareSemver,
  decideUpdateInfo,
  normalizeVersionTag,
  parseLatestRelease,
} from "./update-check";

describe("normalizeVersionTag", () => {
  test("strips leading v", () => {
    expect(normalizeVersionTag("v0.4.0")).toBe("0.4.0");
  });

  test("keeps version without leading v", () => {
    expect(normalizeVersionTag("0.4.0")).toBe("0.4.0");
  });
});

describe("compareSemver", () => {
  test("detects newer patch", () => {
    expect(compareSemver("v0.4.1", "0.4.0")).toBeGreaterThan(0);
  });

  test("treats equivalent tags as equal", () => {
    expect(compareSemver("0.4.0", "v0.4.0")).toBe(0);
  });

  test("compares multi-digit minor versions numerically", () => {
    expect(compareSemver("0.10.0", "0.9.9")).toBeGreaterThan(0);
  });

  test("handles malformed versions without throwing", () => {
    expect(compareSemver("latest", "0.4.0")).toBeLessThan(0);
    expect(compareSemver("0.4.0", "unknown")).toBeGreaterThan(0);
  });
});

describe("parseLatestRelease", () => {
  test("parses minimal GitHub release payload", () => {
    expect(
      parseLatestRelease({
        tag_name: "v0.5.0",
        html_url: "https://github.com/andycmaj/tilt-tui/releases/tag/v0.5.0",
        name: "v0.5.0",
      }),
    ).toEqual({
      version: "0.5.0",
      tagName: "v0.5.0",
      htmlUrl: "https://github.com/andycmaj/tilt-tui/releases/tag/v0.5.0",
      name: "v0.5.0",
    });
  });

  test("rejects invalid payload", () => {
    expect(parseLatestRelease({ tag_name: 1 })).toBeNull();
  });
});

describe("decideUpdateInfo", () => {
  test("reports update when latest release is newer", () => {
    const release = parseLatestRelease({
      tag_name: "v0.5.0",
      html_url: "https://github.com/andycmaj/tilt-tui/releases/tag/v0.5.0",
    });
    if (!release) throw new Error("release payload should parse");

    expect(decideUpdateInfo("0.4.0", release)).toEqual({
      status: "update-available",
      currentVersion: "0.4.0",
      latest: release,
    });
  });

  test("reports current when latest release matches current version", () => {
    const release = parseLatestRelease({
      tag_name: "v0.4.0",
      html_url: "https://github.com/andycmaj/tilt-tui/releases/tag/v0.4.0",
    });
    if (!release) throw new Error("release payload should parse");

    expect(decideUpdateInfo("0.4.0", release)).toEqual({
      status: "current",
      currentVersion: "0.4.0",
      latest: release,
    });
  });

  test("reports error when latest release cannot be parsed", () => {
    expect(decideUpdateInfo("0.4.0", null)).toEqual({
      status: "error",
      currentVersion: "0.4.0",
    });
  });
});
