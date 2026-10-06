// Main App component: the provider stack, the tree + log-view layout, and the
// app-level modals.

import { createSignal, Show } from "solid-js";
import type { Renderable } from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import {
  FocusProvider,
  KeymapProvider,
  ThemeProvider,
  Toast,
  ToastProvider,
  useFocus,
  useScope,
  useTheme,
  useToast,
  type ThemeName,
} from "@andycmaj/opentui-app";
import { TiltProvider, useTilt } from "./context/tilt";
import { VersionInfoProvider, useVersionInfo } from "./context/version-info";
import { Header } from "./components/header";
import { Tree } from "./components/tree";
import { ResourceView } from "./components/resourceview";
import {
  LogSearchModal,
  type LogSearchFilter,
} from "./components/log-search-modal";
import { TiltCommandPalette } from "./components/command-palette";
import { ResourcePicker } from "./components/resource-picker";
import { TiltKeyboardHelp } from "./components/keyboard-help";
import { ButtonFormModal } from "./components/button-form-modal";
import { EngineInfo } from "./components/engine-info";
import { ResourceInfoModal } from "./components/resource-info-modal";
import { UpdateConfirmModal } from "./components/update-confirm-modal";
import { Commands } from "./commands";
import { keymap, PANES } from "./keymap";
import type { APIButton } from "./tilt/api-types";
import { runMiseUpdate } from "./update-install";

function AppContent() {
  const renderer = useRenderer();
  const {
    cyclePane,
    sidebarVisible,
    toggleSidebar,
    activeModal,
    openModal,
    closeModal,
  } = useFocus();
  const { client, state } = useTilt();
  const { updateInfo } = useVersionInfo();
  const { showToast } = useToast();
  const theme = useTheme();

  // Button being configured in the form modal
  const [formButton, setFormButton] = createSignal<APIButton | null>(null);
  const [isUpdating, setIsUpdating] = createSignal(false);
  const [logSearch, setLogSearch] = createSignal<LogSearchFilter | null>(null);

  // App-wide bindings, active while focus is anywhere in the pane layout (so
  // not while a modal holds focus).
  let layout: Renderable | undefined;
  useScope(
    "app",
    {
      [Commands.APP_QUIT]: () => {
        renderer.destroy();
        process.exit(0);
      },
      [Commands.SIDEBAR_TOGGLE]: toggleSidebar,
      [Commands.FOCUS_NEXT]: cyclePane,
      [Commands.PALETTE_OPEN]: () => openModal("palette"),
      [Commands.RESOURCE_PICKER_OPEN]: () => openModal("resourcePicker"),
      [Commands.HELP_OPEN]: () => openModal("help"),
      [Commands.ENGINE_INFO_OPEN]: () => openModal("engineInfo"),
      [Commands.RESOURCE_INFO_OPEN]: () => {
        if (state.selectedResource) openModal("resourceInfo");
      },
    },
    { target: () => layout },
  );

  // Palette hands off a button that needs a form
  function handleButtonForm(button: APIButton) {
    setFormButton(button);
    openModal("buttonForm");
  }

  // Form submit: click the button with collected input values
  async function handleFormSubmit(
    button: APIButton,
    inputValues: Record<string, string | boolean>,
  ) {
    try {
      await client.clickButton(button, inputValues);
    } catch (err) {
      console.error("Failed to click button:", err);
    }
    closeModal();
    setFormButton(null);
  }

  function handleFormClose() {
    closeModal();
    setFormButton(null);
  }

  async function handleUpdateConfirm() {
    const info = updateInfo();
    if (info.status !== "update-available" || isUpdating()) return;

    setIsUpdating(true);
    console.log(
      `[updater] confirmed update ${info.currentVersion} -> ${info.latest.version} (${info.latest.tagName})`,
    );
    try {
      const result = await runMiseUpdate(info.latest.tagName);
      console.log(`[updater] finished: ${result.command}`);
      closeModal();
      showToast(`Updated to v${info.latest.version}`, 4000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[updater] update error: ${message}`);
      showToast(`Update failed: ${message}`, 6000, "error");
    } finally {
      setIsUpdating(false);
    }
  }

  function closeUpdateModal() {
    if (!isUpdating()) closeModal();
  }

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.background}
    >
      {/* Main content: Tree (sidebar) + ResourceView */}
      <box
        ref={(r: Renderable) => (layout = r)}
        flexDirection="row"
        flexGrow={1}
      >
        <Show when={sidebarVisible()}>
          <Tree />
        </Show>
        <ResourceView search={logSearch()} onSearchChange={setLogSearch} />
      </box>

      <Show when={activeModal() === "palette"}>
        <TiltCommandPalette
          onClose={closeModal}
          onButtonForm={handleButtonForm}
        />
      </Show>

      <Show when={activeModal() === "logSearch"}>
        <LogSearchModal
          onClose={closeModal}
          onSearch={setLogSearch}
          initialQuery={logSearch()?.query ?? ""}
        />
      </Show>

      <Show when={activeModal() === "resourcePicker"}>
        <ResourcePicker onClose={closeModal} />
      </Show>

      <Show when={activeModal() === "help"}>
        <TiltKeyboardHelp onClose={closeModal} />
      </Show>

      <Show when={activeModal() === "buttonForm" && formButton()}>
        {(button) => (
          <ButtonFormModal
            button={button()}
            onClose={handleFormClose}
            onSubmit={handleFormSubmit}
          />
        )}
      </Show>

      <Show when={activeModal() === "engineInfo"}>
        <EngineInfo onClose={closeModal} />
      </Show>

      <Show when={activeModal() === "resourceInfo" && state.selectedResource}>
        {(name) => (
          <ResourceInfoModal resourceName={name()} onClose={closeModal} />
        )}
      </Show>

      <Show when={activeModal() === "updateConfirm"}>
        {(() => {
          const info = updateInfo();
          return info.status === "update-available" ? (
            <UpdateConfirmModal
              tagName={info.latest.tagName}
              version={info.latest.version}
              isRunning={isUpdating()}
              onClose={closeUpdateModal}
              onConfirm={handleUpdateConfirm}
            />
          ) : null;
        })()}
      </Show>

      {/* Header - only shown when sidebar is hidden */}
      <Show when={!sidebarVisible()}>
        <box flexShrink={0}>
          <Header />
        </box>
      </Show>
    </box>
  );
}

export interface AppProps {
  host?: string;
  port?: number;
  theme?: ThemeName;
}

export function App(props: AppProps) {
  return (
    <ThemeProvider name={props.theme}>
      <TiltProvider host={props.host} port={props.port}>
        <VersionInfoProvider>
          <FocusProvider panes={PANES}>
            <ToastProvider>
              <KeymapProvider keymap={keymap}>
                <AppContent />
                <Toast />
              </KeymapProvider>
            </ToastProvider>
          </FocusProvider>
        </VersionInfoProvider>
      </TiltProvider>
    </ThemeProvider>
  );
}
