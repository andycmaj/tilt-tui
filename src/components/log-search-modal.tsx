// Log Search Modal - simple text input for filtering logs
// Supports string match and regex search (using /pattern/ syntax)

import { createSignal } from "solid-js";
import {
  useTheme,
  Modal,
  ModalHeader,
  ModalFilterInput,
  ModalCommands,
  type BindingSpec,
} from "@andycmaj/opentui-app";
import type { LogSearchFilter } from "@andycmaj/opentui-app";
import { parseSearchQuery } from "../utils/log-search-utils";

const SUBMIT: BindingSpec = {
  key: "return",
  cmd: ModalCommands.MODAL_SELECT,
  desc: "search",
};

interface LogSearchModalProps {
  onClose: () => void;
  onSearch: (filter: LogSearchFilter | null) => void;
  initialQuery?: string;
}

export function LogSearchModal(props: LogSearchModalProps) {
  const theme = useTheme();
  const [query, setQuery] = createSignal(props.initialQuery ?? "");
  const [error, setError] = createSignal<string | null>(null);

  function handleSearch() {
    const filter = parseSearchQuery(query());
    if (filter?.isRegex && !filter.regex) {
      setError("Invalid regex pattern");
      return;
    }
    setError(null);
    props.onSearch(filter);
    props.onClose();
  }

  return (
    <Modal
      size="sm"
      onClose={props.onClose}
      bindings={[SUBMIT]}
      commands={{ [ModalCommands.MODAL_SELECT]: handleSearch }}
    >
      <ModalHeader title="Search Logs" />

      <box paddingLeft={2} paddingRight={2}>
        <text fg={theme.textMuted}>Use /regex/ for regex search</text>
      </box>

      <ModalFilterInput
        initialValue={props.initialQuery}
        onInput={(v) => {
          setQuery(v);
          setError(null);
        }}
        placeholder="Search..."
      />

      {error() && (
        <box paddingLeft={2} paddingRight={2} paddingBottom={1}>
          <text fg={theme.error}>{error()}</text>
        </box>
      )}

      <box paddingLeft={2} paddingRight={2} paddingBottom={1}>
        <text fg={theme.textMuted}>Enter to search</text>
      </box>
    </Modal>
  );
}

export { parseSearchQuery } from "../utils/log-search-utils";
export type { LogSearchFilter };
