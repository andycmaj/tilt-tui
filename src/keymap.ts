// Declarative keymap: framework base bindings plus tilt-tui's own, keyed by
// scope. "app" applies anywhere in the pane layout; "tree" and "resource"
// while focus is within that pane.

import {
  baseAppBindings,
  navBindings,
  type BindingSpec,
  type KeymapTable,
} from "@andycmaj/opentui-app";
import { Commands } from "./commands";

export const PANES = ["tree", "resource"];

// The tree moves a cursor rather than scrolling, so it has no paging.
const treeNav = navBindings().filter(
  (b) => b.cmd !== Commands.SCROLL_PAGEUP && b.cmd !== Commands.SCROLL_PAGEDOWN,
);

const resourceActions: BindingSpec[] = [
  {
    key: "r",
    cmd: Commands.RELOAD_RESOURCE,
    desc: "trigger reload",
    help: "trigger",
  },
  {
    key: "ctrl+d",
    cmd: Commands.RESOURCE_DISABLE_TOGGLE,
    desc: "toggle disable",
  },
];

export const keymap: KeymapTable = {
  app: [
    ...baseAppBindings,
    {
      key: "space",
      cmd: Commands.RESOURCE_PICKER_OPEN,
      desc: "resource picker",
      help: "resources",
    },
    { key: "w", cmd: Commands.ENGINE_INFO_OPEN, desc: "watcher info" },
    { key: "i", cmd: Commands.RESOURCE_INFO_OPEN, desc: "resource info" },
  ],
  tree: [
    ...treeNav,
    { key: "return", cmd: Commands.TREE_SELECT, desc: "select" },
    { key: "d", cmd: Commands.TREE_TOGGLE_DISABLED, desc: "toggle disabled" },
    {
      key: "f",
      cmd: Commands.STATUS_FILTER_CYCLE,
      desc: "status filter",
      help: "filter",
    },
    {
      key: "escape",
      cmd: Commands.STATUS_FILTER_RESET,
      desc: "reset status filter",
    },
    ...resourceActions,
  ],
  resource: [
    ...navBindings(),
    {
      key: "s",
      cmd: Commands.SCROLL_FOLLOW,
      desc: "autoscroll logs",
      help: "autoscroll",
    },
    {
      key: "t",
      cmd: Commands.TOGGLE_TIMESTAMPS,
      desc: "toggle timestamps",
      help: "timestamps",
    },
    {
      key: "/",
      cmd: Commands.LOG_SEARCH_OPEN,
      desc: "search logs",
      help: "search",
    },
    { key: "escape", cmd: Commands.LOG_SEARCH_CLEAR, desc: "clear search" },
    ...resourceActions,
  ],
};
