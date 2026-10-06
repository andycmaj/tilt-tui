// Tilt-specific color mappings on top of the framework theme.

import type { Theme, ThemeColor } from "@andycmaj/opentui-app";
import type { StatusFilter } from "@/context/tilt";
import { ResourceStatus } from "@/tilt/types";

export function statusColor(theme: Theme, status: StatusFilter): ThemeColor {
  switch (status) {
    case ResourceStatus.Healthy:
      return theme.success;
    case ResourceStatus.Pending:
    case ResourceStatus.Building:
      return theme.textMuted;
    case ResourceStatus.Unhealthy:
      return theme.error;
    case ResourceStatus.Warning:
      return theme.warning;
    case ResourceStatus.Disabled:
    case ResourceStatus.None:
      return theme.textMuted;
    default:
      // title color for all resources
      return theme.primary;
  }
}
