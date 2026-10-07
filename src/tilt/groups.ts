import type { Resource } from "./types";

// Group resources by labels
export function getGroupKey(r: Resource): string {
  if (!r.raw) return "ungrouped";

  const labels = r.raw.metadata.labels ?? {};
  if (Object.keys(labels).length === 0) return "ungrouped";

  // Priority keys for grouping
  const priorityKeys = [
    "app",
    "app.kubernetes.io/name",
    "app.kubernetes.io/component",
    "component",
    "service",
    "tilt.dev/resource",
  ];

  for (const key of priorityKeys) {
    if (labels[key]) return labels[key];
  }

  // Fall back to first label value
  for (const val of Object.values(labels)) {
    if (val) return val;
  }

  return "ungrouped";
}
