import { TextAttributes } from "@opentui/core";
import {
  useTheme,
  Modal,
  ModalCommands,
  ModalHeader,
  type BindingSpec,
} from "@andycmaj/opentui-app";
import { formatMiseUpdateCommand } from "../update-install";

const CONFIRM_BINDINGS: BindingSpec[] = [
  { key: "return", cmd: ModalCommands.MODAL_SELECT, desc: "update" },
  { key: "y", cmd: ModalCommands.MODAL_SELECT, desc: "update" },
];

interface UpdateConfirmModalProps {
  tagName: string;
  version: string;
  isRunning: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function UpdateConfirmModal(props: UpdateConfirmModalProps) {
  const theme = useTheme();

  function confirm() {
    if (!props.isRunning) props.onConfirm();
  }

  return (
    <Modal
      size="sm"
      onClose={props.onClose}
      bindings={CONFIRM_BINDINGS}
      commands={{ [ModalCommands.MODAL_SELECT]: confirm }}
    >
      <ModalHeader title={`Update to v${props.version}`} />

      <box paddingLeft={2} paddingRight={2} paddingTop={1}>
        <text fg={theme.text}>update with mise?</text>
      </box>

      <box paddingLeft={2} paddingRight={2} paddingTop={1}>
        <text fg={theme.textMuted}>
          {formatMiseUpdateCommand(props.tagName)}
        </text>
      </box>

      <box
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="row"
        justifyContent="space-between"
      >
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          {props.isRunning ? "Updating..." : "Enter/y to confirm"}
        </text>
        <text fg={theme.textMuted}>Esc to cancel</text>
      </box>
    </Modal>
  );
}
