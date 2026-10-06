// App commands: the framework's base commands plus tilt-tui's own.

import { BaseCommands } from "@andycmaj/opentui-app";

export const Commands = {
  ...BaseCommands,

  // App-level
  RESOURCE_PICKER_OPEN: "resource.picker.open",
  ENGINE_INFO_OPEN: "engine.info.open",
  RESOURCE_INFO_OPEN: "resource.info.open",

  // Shared by tree + resource
  RELOAD_RESOURCE: "resource.trigger",
  RESOURCE_DISABLE_TOGGLE: "resource.disable.toggle",

  // Tree-specific
  TREE_SELECT: "tree.select",
  TREE_EXPAND_ALL: "tree.expand.all",
  TREE_COLLAPSE_ALL: "tree.collapse.all",
  TREE_TOGGLE_DISABLED: "tree.toggle.disabled",
  STATUS_FILTER_CYCLE: "status.filter.cycle",
  STATUS_FILTER_RESET: "status.filter.reset",

  // Resource (log view)-specific
  SCROLL_FOLLOW: "scroll.follow",
  TOGGLE_TIMESTAMPS: "logs.timestamps.toggle",
  LOG_SEARCH_OPEN: "logs.search.open",
  LOG_SEARCH_CLEAR: "logs.search.clear",
} as const;
