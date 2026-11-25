import { describe, expect, test } from "bun:test";
import { loadFrames } from "./fixtures";
import { parseLogList } from "./client";
import { resourceFromAPIResource } from "./types";
import { getEffectiveStatus } from "./status-utils";
import { ResourceStatus } from "./types";

describe("default fixture", () => {
  test("parses through the same path as live view messages", async () => {
    const [frame] = await loadFrames("default");
    const resources = (frame?.uiResources ?? []).map(resourceFromAPIResource);
    const byName = Object.fromEntries(resources.map((r) => [r.name, r]));

    expect(resources).toHaveLength(9);
    expect(getEffectiveStatus(byName.api!)).toBe(ResourceStatus.Healthy);
    expect(getEffectiveStatus(byName.worker!)).toBe(ResourceStatus.Building);
    expect(getEffectiveStatus(byName.storybook!)).toBe(ResourceStatus.Unhealthy);
    expect(byName.e2e?.isDisabled).toBe(true);

    const logs = parseLogList(frame!.logList!);
    expect(logs.get("api")?.length).toBeGreaterThan(0);
  });

  test("unknown names that aren't files fail with the fixture list", async () => {
    await expect(loadFrames("nope")).rejects.toThrow(/default/);
  });
});
