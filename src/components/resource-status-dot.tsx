import type { RGBA } from "@opentui/core";
import { type Theme, contrastingForeground } from "@andycmaj/opentui-app";
import type { Resource } from "@/tilt/types";
import { getEffectiveStatus } from "@/tilt/status-utils";
import type { BlinkWhenBuildingResult } from "@/hooks/useBlinkWhenBuilding";

export interface ResourceStatusDotProps {
  theme: Theme;
  getBlinkingColor: BlinkWhenBuildingResult["getBlinkingColor"];
  resource: Resource | undefined;
  /** Dot color when row is selected (contrasts with primary background) */
  selected?: boolean;
}

export function ResourceStatusDot(props: ResourceStatusDotProps) {
  const dotColor = (): string | RGBA | undefined => {
    if (props.selected) {
      return contrastingForeground(props.theme.primary);
    }
    if (!props.resource) {
      return props.theme.textMuted;
    }
    return props.getBlinkingColor(
      getEffectiveStatus(props.resource),
      props.resource.isBuilding,
      props.resource.isDisabled,
    );
  };

  return <text fg={dotColor()}>{"\u25CF"}</text>;
}
