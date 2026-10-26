import { describe, expect, test } from "bun:test";
import type { APIResource, APIResourceStatus } from "./api-types";
import { waitingOnResources } from "./status-utils";

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
