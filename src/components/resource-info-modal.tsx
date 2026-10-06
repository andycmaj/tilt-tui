import { TextAttributes } from "@opentui/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import {
  batch,
  createEffect,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
} from "solid-js";
import {
  useTheme,
  Modal,
  ModalHeader,
  BaseCommands,
  navBindings,
} from "@andycmaj/opentui-app";
import { useTilt } from "../context/tilt";
import type { EngineDump } from "../tilt/client";
import {
  buildDependencyTreeRows,
  type DependencyTreeLine,
} from "../tilt/engine-dump-deps";
import { useBlinkWhenBuilding } from "@/hooks/useBlinkWhenBuilding";
import { DependencyTreeRow } from "./dependency-tree-row";

interface ResourceInfoModalProps {
  resourceName: string;
  onClose: () => void;
}

export function ResourceInfoModal(props: ResourceInfoModalProps) {
  const theme = useTheme();
  const { client, state } = useTilt();
  const { getBlinkingColor } = useBlinkWhenBuilding({ theme });

  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [treeRows, setTreeRows] = createSignal<DependencyTreeLine[]>([]);

  let scrollRef: ScrollBoxRenderable | undefined;

  createEffect(
    on(
      () => props.resourceName,
      (resourceName) => {
        let cancelled = false;
        onCleanup(() => {
          cancelled = true;
        });

        batch(() => {
          setLoading(true);
          setError(null);
          setTreeRows([]);
        });

        client.dumpEngine().then(
          (dump: EngineDump) => {
            if (cancelled) return;
            const rows = buildDependencyTreeRows(resourceName, dump);
            batch(() => {
              if (rows === null) {
                setError(
                  `Resource "${resourceName}" not found in engine state`,
                );
              } else {
                setTreeRows(rows);
              }
              setLoading(false);
            });
          },
          (err: unknown) => {
            if (cancelled) return;
            batch(() => {
              setError(err instanceof Error ? err.message : String(err));
              setLoading(false);
            });
          },
        );
      },
    ),
  );

  const maxHeight = 24;

  return (
    <Modal
      size="lg"
      onClose={props.onClose}
      bindings={navBindings()}
      commands={{
        [BaseCommands.NAV_UP]: () => scrollRef?.scrollBy(-1),
        [BaseCommands.NAV_DOWN]: () => scrollRef?.scrollBy(1),
        [BaseCommands.SCROLL_PAGEUP]: () => scrollRef?.scrollBy(-10),
        [BaseCommands.SCROLL_PAGEDOWN]: () => scrollRef?.scrollBy(10),
      }}
    >
      <ModalHeader title={`Resource Info — ${props.resourceName}`} />

      <Show
        when={!loading()}
        fallback={
          <box paddingLeft={2} paddingRight={2} paddingBottom={1}>
            <text fg={theme.textMuted}>Loading resource info...</text>
          </box>
        }
      >
        <Show
          when={!error()}
          fallback={
            <box paddingLeft={2} paddingRight={2} paddingBottom={1}>
              <text fg={theme.error}>Error: {error()}</text>
            </box>
          }
        >
          <scrollbox
            ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
            maxHeight={maxHeight}
            paddingLeft={1}
            paddingRight={1}
            paddingBottom={1}
          >
            <box paddingLeft={1} paddingBottom={1}>
              <text fg={theme.accent} attributes={TextAttributes.BOLD}>
                Dependencies
              </text>
            </box>

            <box paddingTop={1} paddingLeft={0} paddingRight={0}>
              <For each={treeRows()}>
                {(line) => (
                  <DependencyTreeRow
                    theme={theme}
                    line={line}
                    resource={
                      line.resourceName
                        ? state.resources.find(
                            (r) => r.name === line.resourceName,
                          )
                        : undefined
                    }
                    getBlinkingColor={getBlinkingColor}
                  />
                )}
              </For>
            </box>
          </scrollbox>
        </Show>
      </Show>
    </Modal>
  );
}
