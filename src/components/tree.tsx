// Tree component - resource list with grouping (sidebar)

import {
  createSignal,
  createMemo,
  createEffect,
  on,
  For,
  Show,
  type Accessor,
  createSelector,
} from "solid-js";
import type { Renderable, ScrollBoxRenderable, RGBA } from "@opentui/core";
import { useTilt } from "../context/tilt";
import {
  useFocus,
  contrastingForeground,
  useTheme,
  PaneHeader,
  truncate,
  type Theme,
  formatRelativeTime,
  formatBuildDuration,
  formatDuration,
  Pane,
  useScope,
} from "@andycmaj/opentui-app";
import { statusColor } from "@/theme/tilt-colors";
import { Header } from "./header";
import { type Resource, ResourceStatus, ResourceName } from "../tilt/types";
import { Commands } from "@/commands";
import { getGroupKey } from "@/tilt/groups";
import {
  getEffectiveStatus,
  runtimeReadinessDurationMs,
} from "@/tilt/status-utils";
import {
  useBlinkWhenBuilding,
  type BlinkWhenBuildingResult,
} from "@/hooks/useBlinkWhenBuilding";
import { StatusCounts } from "./status-counts";

interface TreeNode {
  type: "group" | "resource";
  groupName?: string;
  resource?: Resource;
  expanded?: boolean;
  childCount?: number;
  depth: number;
}

function buildTreeNodes(
  resources: Resource[],
  expandedGroups: Record<string, boolean>,
): TreeNode[] {
  const nodes: TreeNode[] = [];
  const grouped = new Map<string, number[]>();
  const groupOrder: string[] = [];

  // Group resources
  resources.forEach((r, i) => {
    const key = getGroupKey(r);
    if (!grouped.has(key)) {
      groupOrder.push(key);
      grouped.set(key, []);
    }
    grouped.get(key)!.push(i);
  });

  // Sort groups (ungrouped at end)
  groupOrder.sort((a, b) => {
    if (a === "ungrouped") return 1;
    if (b === "ungrouped") return -1;
    return a.localeCompare(b);
  });

  // Build nodes
  for (const groupKey of groupOrder) {
    const indices = grouped.get(groupKey)!;

    // Check if any resources in this group are enabled
    const hasEnabledResources = indices.some(
      (idx) => !resources[idx].isDisabled,
    );

    // Default to collapsed if no enabled resources, expanded otherwise
    const defaultExpanded = hasEnabledResources;
    const expanded = expandedGroups[groupKey] ?? defaultExpanded;

    nodes.push({
      type: "group",
      groupName: groupKey,
      expanded,
      childCount: indices.length,
      depth: 0,
    });

    if (expanded) {
      for (const idx of indices) {
        nodes.push({
          type: "resource",
          resource: resources[idx],
          depth: 1,
        });
      }
    }
  }

  return nodes;
}

export function Tree() {
  const {
    state,
    selectResource,
    triggerResource,
    toggleResourceDisable,
    cycleStatusFilter,
    resetStatusFilter,
    toggleShowDisabledResources,
    setGroupExpanded,
    setAllGroupsExpanded,
  } = useTilt();
  const { setActivePane, isPaneFocused } = useFocus();
  const isFocused = () => isPaneFocused("tree");
  const theme = useTheme();

  const [cursor, setCursor] = createSignal(0);
  const isSelected = createSelector(cursor);

  let scrollRef: ScrollBoxRenderable | undefined;

  const { opacity, getBlinkingColor } = useBlinkWhenBuilding({ theme });

  // Consolidated memo: filter resources and build tree nodes in one pass
  // Avoids intermediate memo overhead from chained dependencies
  const nodes = createMemo(() => {
    const filter = state.statusFilter;
    let resources =
      filter === "all"
        ? state.resources
        : state.resources.filter((r) => getEffectiveStatus(r) === filter);

    // Filter out disabled resources if showDisabledResources is false
    if (!state.showDisabledResources) {
      resources = resources.filter((r) => !r.isDisabled);
    }

    return buildTreeNodes(resources, state.expandedGroups);
  });

  // Derived: count of filtered resources for header display
  const filteredResourceCount = createMemo(() => {
    const filter = state.statusFilter;
    let resources =
      filter === "all"
        ? state.resources
        : state.resources.filter((r) => getEffectiveStatus(r) === filter);

    // Filter out disabled resources if showDisabledResources is false
    if (!state.showDisabledResources) {
      resources = resources.filter((r) => !r.isDisabled);
    }

    return resources.length;
  });

  // Reset cursor when filter changes
  createEffect(
    on(
      () => state.statusFilter,
      () => {
        setCursor(0);
      },
    ),
  );

  // Auto-expand group and set cursor when resource is selected externally (e.g., from picker)
  createEffect(
    on(
      () => state.selectedResource,
      (name) => {
        if (!name) return null;
        const resource = state.resources.find((r) => r.name === name);
        if (resource) {
          const groupKey = getGroupKey(resource);
          // Expand the group first
          setGroupExpanded(groupKey, true);

          // Find the cursor position for this resource in the nodes list
          // Need to rebuild nodes with the expanded group to find correct index
          const filter = state.statusFilter;
          let filtered =
            filter === "all"
              ? state.resources
              : state.resources.filter((r) => getEffectiveStatus(r) === filter);

          // Filter out disabled resources if showDisabledResources is false
          if (!state.showDisabledResources) {
            filtered = filtered.filter((r) => !r.isDisabled);
          }

          const updatedNodes = buildTreeNodes(filtered, {
            ...state.expandedGroups,
            [groupKey]: true,
          });
          const nodeIndex = updatedNodes.findIndex(
            (n) => n.type === "resource" && n.resource?.name === name,
          );
          if (nodeIndex !== -1) {
            setCursor(nodeIndex);
          }
        }
      },
    ),
  );

  // On first load, select the (Tiltfile) resource once it becomes available
  const [didInitSelect, setDidInitSelect] = createSignal(false);
  createEffect(
    on(
      () => state.resources,
      (resources) => {
        if (didInitSelect()) return;
        const tiltfile = resources.find(
          (r) => r.name === ResourceName.tiltfile,
        );
        if (tiltfile) {
          setDidInitSelect(true);
          selectResource(tiltfile.name);
        }
      },
    ),
  );

  // Keep cursor aligned with the selected resource when the node list changes
  // (e.g. resources load in and reorder, shifting the selected resource's index)
  createEffect(
    on(nodes, (nodeList, prevList) => {
      // If the cursor was on a group (e.g. it was just toggled), stay on that
      // group rather than jumping to the selected resource
      const prevNode = prevList?.[cursor()];
      if (prevNode?.type === "group") {
        const groupIndex = nodeList.findIndex(
          (n) => n.type === "group" && n.groupName === prevNode.groupName,
        );
        if (groupIndex !== -1) {
          setCursor(groupIndex);
          return;
        }
      }

      const name = state.selectedResource;
      if (!name) return;
      const nodeIndex = nodeList.findIndex(
        (n) => n.type === "resource" && n.resource?.name === name,
      );
      if (nodeIndex !== -1) {
        if (nodeIndex !== cursor()) setCursor(nodeIndex);
        return;
      }

      // The selected resource's group was collapsed (e.g. collapse all): land
      // on that group instead of an index that now points elsewhere.
      const resource = state.resources.find((r) => r.name === name);
      const groupIndex = resource
        ? nodeList.findIndex(
            (n) => n.type === "group" && n.groupName === getGroupKey(resource),
          )
        : -1;
      if (groupIndex !== -1) {
        setCursor(groupIndex);
      } else if (cursor() >= nodeList.length) {
        setCursor(Math.max(nodeList.length - 1, 0));
      }
    }),
  );

  // Calculate the row position for a given cursor index
  // Group Height: 1(content)
  // Node Height: 2(content) + 1(marginBottom)
  function getRowPosition(cursorIndex: number): {
    top: number;
    height: number;
  } {
    const nodeList = nodes();
    let row = 0;
    for (let i = 0; i < cursorIndex && i < nodeList.length; i++) {
      row += nodeList[i].type === "group" ? 1 : 3;
    }
    const height = nodeList[cursorIndex]?.type === "group" ? 1 : 2;
    return { top: row, height };
  }

  // Scroll to keep cursor visible when it changes
  createEffect(
    on(cursor, (cursorIndex) => {
      if (!scrollRef) return null;

      const { top: itemTop, height: itemHeight } = getRowPosition(cursorIndex);
      const scrollTop = scrollRef.scrollTop;
      // Use viewport.height for the visible area, not scrollRef.height (total content height)
      const visibleRows = scrollRef.viewport.height ?? 10;

      // Scroll up if item is above viewport
      if (itemTop < scrollTop) {
        scrollRef.scrollTo(itemTop);
      }
      // Scroll down if item is below viewport
      else if (itemTop + itemHeight > scrollTop + visibleRows) {
        scrollRef.scrollTo(itemTop + itemHeight - visibleRows);
      }
    }),
  );

  const toggleGroup = () => {
    const node = nodes()[cursor()];
    if (node?.type === "group" && node.groupName) {
      setGroupExpanded(node.groupName, !node.expanded);
    }
  };

  const selectResourceAtCursor = (switchToResourcePane: boolean) => {
    const node = nodes()[cursor()];
    if (node?.type === "resource" && node.resource) {
      selectResource(node.resource.name);

      if (switchToResourcePane) {
        setActivePane("resource");
      }
    }
  };

  function moveCursor(next: (c: number) => number) {
    setCursor(next);
    selectResourceAtCursor(false);
  }

  function resourceAtCursor(): Resource | undefined {
    const node = nodes()[cursor()];
    return node?.type === "resource" ? node.resource : undefined;
  }

  let pane: Renderable | undefined;
  useScope(
    "tree",
    {
      [Commands.NAV_DOWN]: () =>
        moveCursor((c) => Math.min(c + 1, nodes().length - 1)),
      [Commands.NAV_UP]: () => moveCursor((c) => Math.max(c - 1, 0)),
      [Commands.NAV_TOP]: () => moveCursor(() => 0),
      [Commands.NAV_BOTTOM]: () => moveCursor(() => nodes().length - 1),
      [Commands.TREE_SELECT]: () => {
        toggleGroup();
        selectResourceAtCursor(true);
      },
      [Commands.TREE_EXPAND_ALL]: () => setAllGroupsExpanded(true),
      [Commands.TREE_COLLAPSE_ALL]: () => setAllGroupsExpanded(false),
      [Commands.TREE_TOGGLE_DISABLED]: toggleShowDisabledResources,
      [Commands.STATUS_FILTER_CYCLE]: cycleStatusFilter,
      [Commands.STATUS_FILTER_RESET]: () => {
        if (state.statusFilter !== "all") resetStatusFilter();
      },
      [Commands.RELOAD_RESOURCE]: () => {
        const resource = resourceAtCursor();
        if (resource) triggerResource(resource.name);
        selectResourceAtCursor(false);
      },
      [Commands.RESOURCE_DISABLE_TOGGLE]: () => {
        const resource = resourceAtCursor();
        if (resource) toggleResourceDisable(resource.name);
      },
    },
    { target: () => pane },
  );

  return (
    <Pane name="tree" variant="sidebar" ref={(r) => (pane = r)}>
      <PaneHeader
        title={
          state.statusFilter === "all"
            ? "All Resources"
            : `[${state.statusFilter}]`
        }
        color={statusColor(theme, state.statusFilter)}
      >
        <Show when={state.showDisabledResources}>
          <text fg={theme.textMuted}>[⊘]</text>
        </Show>
        <StatusCounts
          narrow={true}
          resources={state.resources}
          activeProfile={state.activeProfile}
          theme={theme}
        />
      </PaneHeader>

      {/* Tree content */}
      <scrollbox
        ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
        paddingLeft={1}
        flexGrow={1}
        stickyScroll={false}
      >
        <For each={nodes()}>
          {(node, index) => {
            const isItemSelected = createMemo(() => isSelected(index()));

            if (node.type === "group") {
              return (
                <GroupNode
                  node={node}
                  isSelected={isItemSelected()}
                  theme={theme}
                />
              );
            } else {
              return (
                <ResourceNode
                  node={node}
                  isSelected={isItemSelected()}
                  isFocused={isFocused()}
                  theme={theme}
                  opacity={opacity}
                  getBlinkingColor={getBlinkingColor}
                />
              );
            }
          }}
        </For>
      </scrollbox>

      {/* Header at bottom of sidebar */}
      <Header narrow={true} />
    </Pane>
  );
}

function GroupNode(props: {
  node: TreeNode;
  isSelected: boolean;
  theme: Theme;
}) {
  const expandIcon = () => (props.node.expanded ? "▼" : "▶");
  const displayText = () =>
    `${expandIcon()} ${props.node.groupName} (${props.node.childCount})`;

  return (
    <box
      paddingLeft={1}
      flexDirection="row"
      backgroundColor={props.isSelected ? props.theme.primary : undefined}
    >
      <text
        fg={
          props.isSelected
            ? contrastingForeground(props.theme.primary)
            : props.theme.primary
        }
        attributes={1}
      >
        {displayText()}
      </text>
    </box>
  );
}

function ResourceNode(props: {
  node: TreeNode;
  isSelected: boolean;
  isFocused: boolean;
  theme: Theme;
  // Blink animation lifted from parent - single interval for all resources
  opacity: Accessor<number>;
  getBlinkingColor: BlinkWhenBuildingResult["getBlinkingColor"];
}) {
  const r = () => props.node.resource!;
  const isDisabled = () => r().isDisabled;

  // Runtime status color for line 1 border (muted if disabled)
  const runtimeColor = () =>
    props.getBlinkingColor(r().runtimeStatus, r().isBuilding, isDisabled());

  // Build status color for line 2 border (muted if disabled)
  const buildColor = () =>
    props.getBlinkingColor(r().updateStatus, r().isBuilding, isDisabled());

  const lastUpdate = createMemo(() => formatRelativeTime(r().lastDeployAt));
  const buildDuration = createMemo(() => {
    if (!r().raw?.status.buildHistory?.length) return "";
    const lastBuild = r().raw!.status.buildHistory![0];
    return formatBuildDuration(lastBuild.startTime, lastBuild.finishTime);
  });

  const readinessDuration = createMemo(() => {
    const ms = runtimeReadinessDurationMs(r().raw);
    return ms === undefined ? "" : formatDuration(ms);
  });

  const subheading = createMemo(() => {
    const parts: string[] = [];
    if (lastUpdate()) parts.push(lastUpdate());
    if (buildDuration()) parts.push(buildDuration());
    return parts.join(" · ") || "—";
  });

  // Foreground for the selected row, contrasting with its highlight background
  // (primary when focused, secondary when not).
  const selectedTextColor = createMemo(() =>
    contrastingForeground(
      props.isFocused ? props.theme.primary : props.theme.secondary,
    ),
  );

  // Text color: muted when disabled, otherwise normal
  const nameColor = createMemo(() => {
    if (props.isSelected) return selectedTextColor();
    return isDisabled() ? props.theme.textMuted : props.theme.text;
  });

  const subheadingColor = createMemo(() => {
    if (props.isSelected) return selectedTextColor();
    return props.theme.textMuted; // Always muted for subheading
  });

  const backgroundColor = createMemo(() => {
    if (props.isSelected && props.isFocused) {
      return props.theme.primary;
    }

    if (props.isSelected) {
      return props.theme.secondary;
    }

    return undefined;
  });

  return (
    <box
      flexDirection="column"
      marginLeft={1}
      marginBottom={1}
      backgroundColor={backgroundColor()}
    >
      {/* Line 1: Resource name + runtime readiness duration - runtime status border */}
      <box flexDirection="row" justifyContent="flex-start" gap={1}>
        <text bg={runtimeColor()}> </text>
        <text fg={nameColor()} attributes={props.isSelected ? 1 : 0}>
          {truncate(r().name, 30)}
        </text>
        <Show when={readinessDuration()}>
          <text fg={subheadingColor()}>· {readinessDuration()}</text>
        </Show>
      </box>

      {/* Line 2: Timestamp + duration - build status border */}
      <box flexDirection="row" justifyContent="flex-start" gap={1}>
        <text bg={buildColor()}> </text>
        <text fg={subheadingColor()}>{subheading()}</text>
      </box>
    </box>
  );
}
