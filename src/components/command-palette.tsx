// Command palette: tilt-specific actions (update, endpoint links, resource and
// global buttons) plus the keybound commands reachable from the active pane,
// rendered by the framework's CommandPalette.

import { createMemo } from "solid-js";
import {
  CommandPalette,
  getScopeBindings,
  useFocus,
  useKeymap,
  useKeymapTable,
  useReachableBindings,
  type PaletteAction,
} from "@andycmaj/opentui-app";
import { useTilt } from "../context/tilt";
import { useVersionInfo } from "../context/version-info";
import { Commands } from "../commands";
import type { ButtonAction } from "../tilt/types";
import type { APIButton, APIInputSpec } from "../tilt/api-types";

function hasVisibleInputs(button: APIButton): boolean {
  return (button.spec.inputs ?? []).some(
    (input: APIInputSpec) => input.text || input.bool || input.choice,
  );
}

interface TiltCommandPaletteProps {
  onClose: () => void;
  onButtonForm: (button: APIButton) => void;
}

export function TiltCommandPalette(props: TiltCommandPaletteProps) {
  const { state, client, setAllGroupsExpanded } = useTilt();
  const { activePaneTarget, openModal } = useFocus();
  const { updateInfo } = useVersionInfo();
  const keymap = useKeymap();
  const bindings = useReachableBindings();
  const treeBindings = getScopeBindings(useKeymapTable(), "tree");

  const treeKeys = (cmd: string): string | undefined =>
    treeBindings.find((b) => b.cmd === cmd)?.keys;

  function buttonAction(
    button: ButtonAction,
    hint: string,
    group: string,
  ): PaletteAction {
    return {
      id: `button:${button.name}`,
      label: button.text,
      hint,
      group,
      run: () => {
        const raw = button.raw;
        if (hasVisibleInputs(raw) || raw.spec.requiresConfirmation) {
          props.onButtonForm(raw);
        } else {
          client.clickButton(raw).catch((err: unknown) => {
            console.error("Failed to click button:", err);
          });
        }
      },
    };
  }

  // Derive actions reactively so late-arriving data (e.g. resource buttons,
  // which stream in on a separate WebSocket channel from resources) appears
  // even if the palette was opened before that data loaded. Groups render in
  // first-appearance order.
  const actions = createMemo<PaletteAction[]>(() => {
    const result: PaletteAction[] = [];
    const info = updateInfo();
    const selected = state.resources.find(
      (r) => r.name === state.selectedResource,
    );

    if (info.status === "update-available") {
      result.push({
        id: `update:${info.latest.version}`,
        label: `Update available: v${info.latest.version}`,
        hint: `current v${info.currentVersion}`,
        group: "Updates",
        run: () => void client.openUrl(info.latest.htmlUrl),
      });
    }

    if (selected) {
      for (const endpoint of selected.endpoints) {
        const hasName = endpoint.name && endpoint.name !== endpoint.url;
        result.push({
          id: `link:${endpoint.url}`,
          label: hasName ? endpoint.name : endpoint.url,
          hint: hasName ? endpoint.url : undefined,
          group: "Links",
          run: () => void client.openUrl(endpoint.url),
        });
      }

      for (const button of selected.buttons) {
        if (!button.disabled) {
          result.push(buttonAction(button, selected.name, "Actions"));
        }
      }

      result.push({
        id: `command:${Commands.RESOURCE_INFO_OPEN}`,
        label: "Resource info",
        hint: "i",
        group: "Actions",
        run: () => openModal("resourceInfo"),
      });
    }

    // Global actions are always available regardless of selected resource
    for (const button of state.globalButtons) {
      if (!button.disabled) {
        result.push(buttonAction(button, button.name, "Global Actions"));
      }
    }

    // Offered from any pane: the expansion state lives in the tilt context, so
    // these don't need the tree focused to dispatch.
    result.push(
      {
        id: `command:${Commands.TREE_EXPAND_ALL}`,
        label: "Expand all groups",
        hint: treeKeys(Commands.TREE_EXPAND_ALL),
        group: "Tree",
        run: () => setAllGroupsExpanded(true),
      },
      {
        id: `command:${Commands.TREE_COLLAPSE_ALL}`,
        label: "Collapse all groups",
        hint: treeKeys(Commands.TREE_COLLAPSE_ALL),
        group: "Tree",
        run: () => setAllGroupsExpanded(false),
      },
    );

    // Keybound commands reachable from the active pane, innermost first.
    // Dispatch against that pane: the palette's own modal holds real focus.
    const seen = new Set<string>();
    for (const binding of bindings()) {
      if (!binding.help || seen.has(binding.cmd)) continue;
      seen.add(binding.cmd);
      result.push({
        id: `command:${binding.cmd}`,
        label: binding.desc,
        hint: binding.keys,
        group: "Commands",
        run: () => {
          keymap.dispatchCommand(binding.cmd, { focused: activePaneTarget() });
        },
      });
    }

    return result;
  });

  return (
    <CommandPalette
      actions={actions()}
      placeholder="Type to filter..."
      onClose={props.onClose}
    />
  );
}
