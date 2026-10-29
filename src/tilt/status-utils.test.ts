import { describe, expect, test } from "bun:test";
import type { APIResource, APIResourceStatus } from "./api-types";
import { primaryBlocker, waitingOnResources } from "./status-utils";
import type { Resource } from "./types";

function resource(status: Partial<APIResourceStatus>): APIResource {
  return {
    metadata: { name: "web" },
    status: status as APIResourceStatus,
  } as APIResource;
}

describe("waitingOnResources", () => {
  test("returns blocking UIResource names", () => {
    const r = resource({
      waiting: {
        reason: "waiting-for-dependencies",
        on: [
          { kind: "UIResource", apiVersion: "tilt.dev/v1alpha1", name: "api" },
          { kind: "UIResource", apiVersion: "tilt.dev/v1alpha1", name: "db" },
        ],
      },
    });
    expect(waitingOnResources(r)).toEqual(["api", "db"]);
  });

  test("ignores non-UIResource refs", () => {
    const r = resource({
      waiting: {
        reason: "waiting-for-cluster",
        on: [{ kind: "Cluster", name: "default" }],
      },
    });
    expect(waitingOnResources(r)).toEqual([]);
  });

  test("empty when not waiting", () => {
    expect(waitingOnResources(resource({}))).toEqual([]);
    expect(waitingOnResources(undefined)).toEqual([]);
  });
});

describe("primaryBlocker", () => {
  const waitingOnApiAndDb = resource({
    waiting: {
      reason: "waiting-for-dependencies",
      on: [
        { kind: "UIResource", name: "api" },
        { kind: "UIResource", name: "db" },
      ],
    },
  });

  function res(name: string, isBuilding: boolean): Resource {
    return { name, isBuilding } as Resource;
  }

  test("prefers a building dependency", () => {
    expect(
      primaryBlocker(waitingOnApiAndDb, [res("api", false), res("db", true)]),
    ).toBe("db");
  });

  test("falls back to the first dependency", () => {
    expect(
      primaryBlocker(waitingOnApiAndDb, [res("api", false), res("db", false)]),
    ).toBe("api");
  });

  test("undefined when not waiting", () => {
    expect(primaryBlocker(resource({}), [])).toBeUndefined();
  });
});
