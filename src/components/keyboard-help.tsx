// Keyboard help: the framework's help modal, with tilt-tui and tilt versions
// in the footer.

import { createMemo, createResource, Show } from "solid-js";
import { KeyboardHelp, useTheme } from "@andycmaj/opentui-app";
import { useTilt } from "../context/tilt";
import { useVersionInfo } from "../context/version-info";

interface TiltKeyboardHelpProps {
  onClose: () => void;
}

export function TiltKeyboardHelp(props: TiltKeyboardHelpProps) {
  const theme = useTheme();
  const { client } = useTilt();
  const { appVersion, updateInfo } = useVersionInfo();

  // Fetch the tilt CLI version when the modal mounts (opens)
  const [version] = createResource(() => client.getVersion());

  const availableUpdate = createMemo(() => {
    const info = updateInfo();
    return info.status === "update-available" ? info.latest : null;
  });

  return (
    <KeyboardHelp
      onClose={props.onClose}
      scopeLabels={{ app: "Global", tree: "Tree View", resource: "Log View" }}
      scopeOrder={["app", "tree", "resource"]}
      footer={
        <box flexDirection="column">
          <text fg={theme.textMuted}>tilt-tui v{appVersion}</text>
          <text fg={theme.textMuted}>
            tilt {version() ?? (version.loading ? "…" : "unknown")}
          </text>
          <Show when={availableUpdate()}>
            {(latest) => (
              <text fg={theme.warning}>
                update available v{latest().version}
              </text>
            )}
          </Show>
        </box>
      }
    />
  );
}
