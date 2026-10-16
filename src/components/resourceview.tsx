// ResourceView component - main content pane for selected resource
// Uses LogBufferView for high-performance log rendering with FrameBuffer

import { createSignal, createMemo, Show, createEffect, on } from "solid-js";
import type { Renderable } from "@opentui/core";
import {
  Footer,
  LogBufferView,
  type LogBufferViewRef,
  Pane,
  PaneHeader,
  useFocus,
  useScope,
  useTheme,
  useToast,
} from "@andycmaj/opentui-app";
import { useTilt } from "../context/tilt";
import { useVersionInfo } from "../context/version-info";
import { Commands } from "../commands";
import type { LogSearchFilter } from "./log-search-modal";

interface ResourceViewProps {
  // The active log search, owned by the app since its modal lives there.
  search: LogSearchFilter | null;
  onSearchChange: (filter: LogSearchFilter | null) => void;
}

export function ResourceView(props: ResourceViewProps) {
  const {
    state,
    logStore,
    triggerResource,
    toggleResourceDisable,
    activeLogFilterNames,
  } = useTilt();
  const { openModal } = useFocus();
  const { updateInfo } = useVersionInfo();
  const { showToast } = useToast();
  const theme = useTheme();

  // Local state
  const [autoScroll, setAutoScroll] = createSignal(true);
  const [showTimestamps, setShowTimestamps] = createSignal(true);
  const [matchCount, setMatchCount] = createSignal(0);

  // Reference to LogBufferView for scroll control
  let logBufferRef: LogBufferViewRef | null = null;

  // Create LogBufferView - returns [Component, Ref] tuple
  const [LogView, logRef] = LogBufferView({
    source: logStore,
    sourceKey: () => state.selectedResource,
    showTimestamps,
    onAutoScrollChange: setAutoScroll,
    onTextCopied: () => {
      showToast("Copied to clipboard");
    },
  });

  // Store ref for keyboard handlers
  logBufferRef = logRef;

  function withSelected(fn: (name: string) => void) {
    return () => {
      if (state.selectedResource) fn(state.selectedResource);
    };
  }

  const halfPage = () => Math.floor((logBufferRef?.height ?? 20) / 2);

  let pane: Renderable | undefined;
  useScope(
    "resource",
    {
      [Commands.NAV_DOWN]: () => logBufferRef?.scrollBy(1),
      [Commands.NAV_UP]: () => logBufferRef?.scrollBy(-1),
      [Commands.NAV_TOP]: () => logBufferRef?.scrollToTop(),
      [Commands.NAV_BOTTOM]: () => logBufferRef?.scrollToBottom(),
      [Commands.SCROLL_PAGEUP]: () => logBufferRef?.scrollBy(-halfPage()),
      [Commands.SCROLL_PAGEDOWN]: () => logBufferRef?.scrollBy(halfPage()),
      [Commands.SCROLL_FOLLOW]: () => logBufferRef?.toggleAutoScroll(),
      [Commands.TOGGLE_TIMESTAMPS]: () => setShowTimestamps((s) => !s),
      [Commands.RESOURCE_DISABLE_TOGGLE]: withSelected(toggleResourceDisable),
      [Commands.RELOAD_RESOURCE]: withSelected(triggerResource),
      [Commands.LOG_SEARCH_OPEN]: () => openModal("logSearch"),
      [Commands.LOG_SEARCH_CLEAR]: () => {
        if (props.search) props.onSearchChange(null);
      },
    },
    { target: () => pane },
  );

  const updateText = createMemo(() => {
    const info = updateInfo();
    return info.status === "update-available"
      ? `update v${info.latest.version}`
      : "";
  });

  // Apply the app-owned search to the log buffer
  createEffect(
    on(
      () => props.search,
      (filter) => {
        if (filter) {
          logBufferRef?.setSearchFilter(filter);
          // Update match count after filter is applied
          setTimeout(() => setMatchCount(logBufferRef?.matchCount ?? 0), 0);
        } else {
          logBufferRef?.clearSearchFilter();
          setMatchCount(0);
        }
      },
      { defer: true },
    ),
  );

  // Clear search when resource changes
  createEffect(
    on(
      () => state.selectedResource,
      () => {
        if (props.search) props.onSearchChange(null);
      },
      { defer: true },
    ),
  );

  return (
    <Pane name="resource" ref={(r) => (pane = r)}>
      {/* Sticky header */}
      <PaneHeader title={`Logs: ${state.selectedResource ?? ""}`}>
        <Show when={activeLogFilterNames().length > 0}>
          <text fg={theme.accent} flexShrink={0}>
            {" "}
            [logFilters: {activeLogFilterNames().join(", ")}]
          </text>
        </Show>
        <Show when={props.search}>
          {(search) => (
            <text fg={theme.primary} flexShrink={0}>
              {" "}
              [/{search().query}/: {matchCount()} matches]
            </text>
          )}
        </Show>
        <Show when={autoScroll()}>
          <text fg={theme.success} flexShrink={0}>
            {" "}
            [autoscroll]
          </text>
        </Show>
        <Show when={!showTimestamps()}>
          <text fg={theme.textMuted} flexShrink={0}>
            {" "}
            [no timestamps]
          </text>
        </Show>
      </PaneHeader>

      {/* Logs buffer */}
      <box marginLeft={2} flexGrow={1}>
        <Show
          when={state.selectedResource}
          fallback={
            <text fg={theme.textMuted}>Select a resource to view logs.</text>
          }
        >
          <LogView />
        </Show>
      </box>

      {/* Sticky footer */}
      <Footer
        right={
          <Show when={updateText()}>
            <box onMouseDown={() => openModal("updateConfirm")}>
              <text fg={theme.warning}>{updateText()}</text>
            </box>
          </Show>
        }
        rightWidth={updateText() ? updateText().length + 3 : 0}
      />
    </Pane>
  );
}
