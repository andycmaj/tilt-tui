import { describe, expect, test } from "bun:test";
import { buildMiseUpdateArgs, formatMiseUpdateCommand } from "./update-install";

describe("mise update command", () => {
  test("pins install to release tag", () => {
    expect(buildMiseUpdateArgs("v0.4.1")).toEqual([
      "use",
      "-g",
      "github:andycmaj/tilt-tui@v0.4.1",
    ]);
  });

  test("formats display command", () => {
    expect(formatMiseUpdateCommand("v0.4.1")).toBe(
      "mise use -g github:andycmaj/tilt-tui@v0.4.1",
    );
  });
});
